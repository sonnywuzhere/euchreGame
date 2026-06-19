import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  BidAction,
  Card,
  ClientToServerEvents,
  GameState,
  Player,
  ServerToClientEvents,
  Suit,
} from '../shared/types';
import { dealHands, createDeck, shuffleDeck } from '../game/deck';
import {
  isValidBid,
  nextBidderPosition,
  resolveRound1Bidding,
  resolveRound2Bidding,
} from '../game/bidding';
import { isValidPlay, resolveTrick } from '../game/tricks';
import { applyRoundScore, getWinner, isGameOver, scoreRound } from '../game/scoring';
import {
  createRoom,
  generateRoomCode,
  getGameState,
  getRoomState,
  joinRoom,
  markPlayerConnected,
  markPlayerDisconnected,
  removePlayer,
  saveGameState,
  saveRoomState,
} from '../rooms/roomManager';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// socket.id → { roomCode, playerId }
const socketMap = new Map<string, { roomCode: string; playerId: string }>();
// playerId → socket.id (latest active socket for that player)
const playerSocketMap = new Map<string, string>();
// "roomCode:playerId" → disconnect grace timer
const disconnectTimers = new Map<string, NodeJS.Timeout>();

function makePlayerView(state: GameState, playerId: string): GameState {
  const hands: Record<string, Card[]> = {};
  for (const pid of Object.keys(state.hands)) {
    hands[pid] = pid === playerId ? state.hands[pid] : [];
  }
  return { ...state, hands };
}

async function emitGameStateToAll(io: IoServer, state: GameState): Promise<void> {
  for (const player of state.players) {
    const sid = playerSocketMap.get(player.id);
    if (sid) {
      io.sockets.sockets.get(sid)?.emit('game:state', makePlayerView(state, player.id));
    }
  }
}

function buildInitialGameState(
  roomCode: string,
  players: Player[],
  dealerPosition: number,
  existingScores: [number, number] = [0, 0]
): GameState {
  const deck = shuffleDeck(createDeck());
  const playerIds = [...players]
    .sort((a, b) => a.position - b.position)
    .map((p) => p.id) as [string, string, string, string];

  const { hands, kitty } = dealHands(deck, playerIds);

  return {
    roomCode,
    players,
    hands,
    kitty,
    trump: null,
    maker: null,
    goingAlone: false,
    alonePlayerId: null,
    currentTrick: [],
    trickHistory: [],
    scores: existingScores,
    roundTricks: [0, 0],
    phase: 'bidding_round1',
    dealerPosition,
    currentPlayerPosition: (dealerPosition + 1) % 4,
    currentRoundBids: [],
  };
}

function partnerPosition(makerPosition: number): number {
  return (makerPosition + 2) % 4;
}

function nextActiveTrickPlayer(currentPos: number, state: GameState): number {
  let next = (currentPos + 1) % 4;
  if (state.goingAlone && state.alonePlayerId) {
    const maker = state.players.find((p) => p.id === state.alonePlayerId);
    if (maker && next === partnerPosition(maker.position)) {
      next = (next + 1) % 4;
    }
  }
  return next;
}

export function registerHandlers(io: IoServer, socket: IoSocket): void {
  // ── room:create ──────────────────────────────────────────────────────────────
  socket.on('room:create', async (payload) => {
    const { nickname } = payload;
    const playerId = uuidv4();
    const roomCode = generateRoomCode();

    const roomState = await createRoom(roomCode, { id: playerId, nickname });

    socket.join(roomCode);
    socketMap.set(socket.id, { roomCode, playerId });
    playerSocketMap.set(playerId, socket.id);

    socket.emit('room:state', roomState);
    socket.emit('player:registered', playerId);
  });

  // ── room:join ────────────────────────────────────────────────────────────────
  socket.on('room:join', async (payload) => {
    const { nickname, roomCode } = payload;
    const playerId = uuidv4();

    const { room, error } = await joinRoom(roomCode, { id: playerId, nickname });
    if (error || !room) {
      socket.emit('error', error ?? 'Failed to join room');
      return;
    }

    socket.join(roomCode);
    socketMap.set(socket.id, { roomCode, playerId });
    playerSocketMap.set(playerId, socket.id);

    io.to(roomCode).emit('room:state', room);
    // Also emit directly to the joining socket so they get the full state
    // even if their room:state listener wasn't ready for the broadcast above.
    socket.emit('room:state', room);
    socket.emit('player:registered', playerId);

    // Auto-start when 4 players are seated
    if (room.players.length === 4) {
      room.gameStarted = true;
      await saveRoomState(room);

      const gameState = buildInitialGameState(roomCode, room.players, 0);
      await saveGameState(gameState);

      for (const player of room.players) {
        const sid = playerSocketMap.get(player.id);
        if (sid) {
          io.sockets.sockets.get(sid)?.emit('game:start', makePlayerView(gameState, player.id));
        }
      }
    }
  });

  // ── bid:submit ───────────────────────────────────────────────────────────────
  socket.on('bid:submit', async (payload) => {
    const ctx = socketMap.get(socket.id);
    if (!ctx) { socket.emit('error', 'Not in a room'); return; }

    const { roomCode, playerId } = ctx;
    const state = await getGameState(roomCode);
    if (!state) { socket.emit('error', 'Game not found'); return; }

    if (state.phase !== 'bidding_round1' && state.phase !== 'bidding_round2') {
      socket.emit('error', 'Not in bidding phase');
      return;
    }

    const { pass, suit, alone } = payload;
    let action: BidAction;

    if (pass) {
      action = { type: 'pass', playerId };
    } else if (state.phase === 'bidding_round1') {
      action = { type: 'order_up', playerId, goAlone: alone ?? false };
    } else {
      if (!suit) { socket.emit('error', 'Must name a suit in round 2'); return; }
      action = { type: 'name_suit', playerId, suit: suit as Suit, goAlone: alone ?? false };
    }

    const validationError = isValidBid(action, state);
    if (validationError) { socket.emit('error', validationError); return; }

    const bids = state.currentRoundBids ?? [];
    bids.push(action);
    state.currentRoundBids = bids;

    const decidedResult =
      state.phase === 'bidding_round1'
        ? resolveRound1Bidding(bids, state.kitty, state.players, state.dealerPosition)
        : resolveRound2Bidding(bids, state.kitty.suit, state.players, state.dealerPosition);

    if (decidedResult.decided) {
      state.trump = decidedResult.trump;
      state.maker = decidedResult.maker;
      state.goingAlone = decidedResult.goingAlone;
      state.alonePlayerId = decidedResult.alonePlayerId;
      state.currentRoundBids = [];

      if (action.type === 'order_up') {
        // Dealer picks up the kitty card (6 cards temporarily) then must discard one
        const dealer = state.players.find((p) => p.position === state.dealerPosition);
        if (dealer) {
          state.hands[dealer.id] = [...state.hands[dealer.id], state.kitty];
        }
        state.phase = 'dealer_discard';
        state.currentPlayerPosition = state.dealerPosition;
      } else {
        // Round 2 name_suit — go straight to playing
        state.phase = 'playing';
        state.currentPlayerPosition = (state.dealerPosition + 1) % 4;
        if (state.goingAlone && state.alonePlayerId) {
          const maker = state.players.find((p) => p.id === state.alonePlayerId);
          if (maker && state.currentPlayerPosition === partnerPosition(maker.position)) {
            state.currentPlayerPosition = (state.currentPlayerPosition + 1) % 4;
          }
        }
      }
    } else if (state.phase === 'bidding_round1' && bids.length === 4) {
      // All four passed in round 1 — advance to round 2
      state.phase = 'bidding_round2';
      state.currentRoundBids = [];
      state.currentPlayerPosition = (state.dealerPosition + 1) % 4;
    } else {
      state.currentPlayerPosition = nextBidderPosition(state.dealerPosition, bids.length);
    }

    await saveGameState(state);
    await emitGameStateToAll(io, state);
  });

  // ── dealer:discard ───────────────────────────────────────────────────────────
  socket.on('dealer:discard', async (payload) => {
    const ctx = socketMap.get(socket.id);
    if (!ctx) { socket.emit('error', 'Not in a room'); return; }

    const { roomCode, playerId } = ctx;
    const state = await getGameState(roomCode);
    if (!state) { socket.emit('error', 'Game not found'); return; }

    if (state.phase !== 'dealer_discard') {
      socket.emit('error', 'Not in dealer discard phase');
      return;
    }

    const dealer = state.players.find((p) => p.position === state.dealerPosition);
    if (!dealer || dealer.id !== playerId) {
      socket.emit('error', 'Only the dealer can discard');
      return;
    }

    const { card } = payload;
    let removed = false;
    const newHand = state.hands[playerId].filter((c) => {
      if (!removed && c.suit === card.suit && c.rank === card.rank) {
        removed = true;
        return false;
      }
      return true;
    });

    if (!removed) { socket.emit('error', 'Card not in your hand'); return; }

    state.hands[playerId] = newHand;
    state.phase = 'playing';
    state.currentPlayerPosition = (state.dealerPosition + 1) % 4;

    if (state.goingAlone && state.alonePlayerId) {
      const maker = state.players.find((p) => p.id === state.alonePlayerId);
      if (maker && state.currentPlayerPosition === partnerPosition(maker.position)) {
        state.currentPlayerPosition = (state.currentPlayerPosition + 1) % 4;
      }
    }

    await saveGameState(state);
    await emitGameStateToAll(io, state);
  });

  // ── card:play ────────────────────────────────────────────────────────────────
  socket.on('card:play', async (payload) => {
    const ctx = socketMap.get(socket.id);
    if (!ctx) { socket.emit('error', 'Not in a room'); return; }

    const { roomCode, playerId } = ctx;
    const state = await getGameState(roomCode);
    if (!state) { socket.emit('error', 'Game not found'); return; }

    const { card } = payload;
    const validationError = isValidPlay(playerId, card, state);
    if (validationError) { socket.emit('error', validationError); return; }

    // Remove card from hand
    state.hands[playerId] = state.hands[playerId].filter(
      (c) => !(c.suit === card.suit && c.rank === card.rank)
    );

    // Append to current trick
    state.currentTrick = [...state.currentTrick, { playerId, card }];

    const trickSize = state.goingAlone ? 3 : 4;

    if (state.currentTrick.length === trickSize) {
      // Resolve completed trick
      const winnerEntry = resolveTrick(state.currentTrick, state.trump!);
      const winnerPlayer = state.players.find((p) => p.id === winnerEntry.playerId)!;

      state.trickHistory = [
        ...state.trickHistory,
        {
          winnerId: winnerEntry.playerId,
          winnerTeamId: winnerPlayer.teamId,
          cards: state.currentTrick,
        },
      ];
      const updatedRoundTricks: [number, number] = [...state.roundTricks];
      updatedRoundTricks[winnerPlayer.teamId]++;
      state.roundTricks = updatedRoundTricks;

      const completedTrick = state.currentTrick;
      state.currentTrick = [];

      io.to(roomCode).emit('trick:complete', {
        winner: winnerEntry.playerId,
        trick: completedTrick.map((tc) => tc.card),
      });

      if (state.trickHistory.length === 5) {
        // Round over — score and decide next step
        const roundResult = scoreRound(state);
        state.scores = applyRoundScore(state.scores, roundResult);

        io.to(roomCode).emit('round:complete', { scores: state.scores });

        if (isGameOver(state.scores)) {
          const winner = getWinner(state.scores)!;
          state.phase = 'game_over';
          await saveGameState(state);
          io.to(roomCode).emit('game:over', { winner, scores: state.scores });
          return;
        }

        // Start next round with rotated dealer
        const newDealerPosition = (state.dealerPosition + 1) % 4;
        const nextRound = buildInitialGameState(
          roomCode,
          state.players,
          newDealerPosition,
          state.scores
        );
        await saveGameState(nextRound);
        await emitGameStateToAll(io, nextRound);
        return;
      }

      // Next trick: winner leads
      state.currentPlayerPosition = winnerPlayer.position;
    } else {
      // Advance within the current trick
      state.currentPlayerPosition = nextActiveTrickPlayer(state.currentPlayerPosition, state);
    }

    await saveGameState(state);
    await emitGameStateToAll(io, state);
  });

  // ── player:reconnect ─────────────────────────────────────────────────────────
  socket.on('player:reconnect', async (payload) => {
    const { roomCode, playerId } = payload;

    // Cancel any pending grace timer
    const timerKey = `${roomCode}:${playerId}`;
    const timer = disconnectTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(timerKey);
    }

    // Remap socket for this player
    const oldSocketId = playerSocketMap.get(playerId);
    if (oldSocketId) socketMap.delete(oldSocketId);

    socketMap.set(socket.id, { roomCode, playerId });
    playerSocketMap.set(playerId, socket.id);
    socket.join(roomCode);

    const roomState = await markPlayerConnected(roomCode, playerId);
    if (roomState) io.to(roomCode).emit('room:state', roomState);

    socket.emit('player:registered', playerId);

    const gameState = await getGameState(roomCode);
    if (gameState) socket.emit('game:state', makePlayerView(gameState, playerId));
  });

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const ctx = socketMap.get(socket.id);
    if (!ctx) return;

    const { roomCode, playerId } = ctx;
    socketMap.delete(socket.id);

    const roomState = await markPlayerDisconnected(roomCode, playerId);
    if (roomState) io.to(roomCode).emit('room:state', roomState);

    // Grace period: remove player after 60s if they don't reconnect
    const timerKey = `${roomCode}:${playerId}`;
    const timer = setTimeout(async () => {
      disconnectTimers.delete(timerKey);
      playerSocketMap.delete(playerId);

      const updated = await removePlayer(roomCode, playerId);
      if (updated) io.to(roomCode).emit('room:state', updated);
    }, 60_000);

    disconnectTimers.set(timerKey, timer);
  });
}
