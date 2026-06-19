import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Card } from '../../../shared/types';
import { useGameState } from '../hooks/useGameState';
import socket from '../hooks/useSocket';
import Scoreboard from '../components/Scoreboard';
import TrickArea from '../components/TrickArea';
import Hand from '../components/Hand';
import CardComponent from '../components/Card';
import BiddingPanel from '../components/BiddingPanel';
import DealerDiscardPanel from '../components/DealerDiscardPanel';

const PLAYER_ID_KEY = 'euchre_player_id';

function FaceDownHand({ count }: { count: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <CardComponent key={i} card={{ rank: '9', suit: 'spades' }} faceDown />
      ))}
    </div>
  );
}

export default function Game() {
  const { code: roomCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { gameState, playerId } = useGameState();

  const [trickWinner, setTrickWinner] = useState<string | null>(null);
  const [roundOverlay, setRoundOverlay] = useState<{
    teamLabel: string;
    points: number;
  } | null>(null);
  const [gameOverResult, setGameOverResult] = useState<{
    winner: 0 | 1;
    scores: [number, number];
  } | null>(null);

  // Track scores before round:complete fires so we can compute the delta
  const scoresRef = useRef<[number, number]>([0, 0]);
  useEffect(() => {
    if (gameState) scoresRef.current = gameState.scores;
  }, [gameState]);

  // Reconnect on mount if state is missing
  useEffect(() => {
    const storedId = sessionStorage.getItem(PLAYER_ID_KEY);
    if (!gameState && roomCode && storedId) {
      socket.emit('player:reconnect', { roomCode, playerId: storedId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // trick:complete — brief winner banner
  useEffect(() => {
    function onTrickComplete({ winner }: { winner: string }) {
      const winnerPlayer = gameState?.players.find(
        (p) => p.id === winner || p.nickname === winner,
      );
      setTrickWinner(winnerPlayer?.nickname ?? winner);
      const timer = setTimeout(() => setTrickWinner(null), 2000);
      return () => clearTimeout(timer);
    }
    socket.on('trick:complete', onTrickComplete);
    return () => { socket.off('trick:complete', onTrickComplete); };
  }, [gameState]);

  // round:complete — 3-second overlay
  useEffect(() => {
    function onRoundComplete({ scores }: { scores: [number, number] }) {
      const prev = scoresRef.current;
      const d0 = scores[0] - prev[0];
      const d1 = scores[1] - prev[1];
      const winningTeam = d0 > 0 ? (0 as 0 | 1) : (1 as 0 | 1);
      const points = d0 > 0 ? d0 : d1;

      // Label winning team by player nicknames
      const teamPlayers = gameState?.players.filter((p) => p.teamId === winningTeam) ?? [];
      const teamLabel = teamPlayers.length > 0
        ? teamPlayers.map((p) => p.nickname).join(' & ')
        : `Team ${winningTeam === 0 ? 'A' : 'B'}`;

      setRoundOverlay({ teamLabel, points });
      setTimeout(() => setRoundOverlay(null), 3000);
    }
    socket.on('round:complete', onRoundComplete);
    return () => { socket.off('round:complete', onRoundComplete); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // game:over — full-screen overlay
  useEffect(() => {
    function onGameOver(result: { winner: 0 | 1; scores: [number, number] }) {
      setGameOverResult(result);
    }
    socket.on('game:over', onGameOver);
    return () => { socket.off('game:over', onGameOver); };
  }, []);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/60 text-sm">Reconnecting to game…</p>
      </div>
    );
  }

  const me = gameState.players.find((p) => p.id === playerId);
  const myPosition = me?.position ?? 0;
  const myTeamId = me?.teamId ?? 0;

  const leftPos    = (myPosition + 1) % 4;
  const partnerPos = (myPosition + 2) % 4;
  const rightPos   = (myPosition + 3) % 4;

  const leftPlayer    = gameState.players.find((p) => p.position === leftPos);
  const partnerPlayer = gameState.players.find((p) => p.position === partnerPos);
  const rightPlayer   = gameState.players.find((p) => p.position === rightPos);

  const myCards = me ? (gameState.hands[me.id] ?? []) : [];
  const getHandCount = (id: string | undefined) => {
    if (!id) return 0;
    return gameState.hands[id]?.length ?? 5;
  };

  const isMyTurn =
    gameState.phase === 'playing' && gameState.currentPlayerPosition === myPosition;
  const validPlays: Card[] = isMyTurn ? myCards : [];

  const isPartnerSittingOut =
    gameState.goingAlone &&
    gameState.alonePlayerId !== null &&
    (() => {
      const alone = gameState.players.find((p) => p.id === gameState.alonePlayerId);
      return alone ? (alone.position + 2) % 4 === partnerPos : false;
    })();

  const currentTurnPlayer = gameState.players.find(
    (p) => p.position === gameState.currentPlayerPosition,
  );
  const playerHighlight = (pid: string | undefined) =>
    gameState.phase === 'playing' && currentTurnPlayer?.id === pid
      ? 'ring-2 ring-yellow-400/60'
      : '';

  const isBiddingPhase =
    gameState.phase === 'bidding_round1' || gameState.phase === 'bidding_round2';

  const isDealerDiscardPhase = gameState.phase === 'dealer_discard';
  const dealerPlayer = gameState.players.find((p) => p.position === gameState.dealerPosition);
  const amIDealer = dealerPlayer?.id === playerId;

  // Game-over overlay (full-screen)
  if (gameOverResult) {
    const winnerPlayers = gameState.players.filter((p) => p.teamId === gameOverResult.winner);
    const winnerLabel = winnerPlayers.map((p) => p.nickname).join(' & ') || `Team ${gameOverResult.winner === 0 ? 'A' : 'B'}`;
    const [s0, s1] = gameOverResult.scores;
    return (
      <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center gap-6 text-center px-6">
        <div className="text-5xl">🏆</div>
        <h1 className="text-white text-3xl font-bold">{winnerLabel} wins!</h1>
        <p className="text-white/60 text-lg">Final score: {s0} – {s1}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 py-3 px-8 bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold rounded-xl transition-all"
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-900 flex flex-col">
      <Scoreboard
        scores={gameState.scores}
        roundTricks={gameState.roundTricks}
        trump={gameState.trump}
        maker={gameState.maker}
        players={gameState.players}
        goingAlone={gameState.goingAlone}
        myTeamId={myTeamId}
      />

      <div className="flex-1 flex flex-col items-center justify-between px-4 py-4 gap-4 relative">

        {/* Partner (top) */}
        <div className={`flex flex-col items-center gap-2 rounded-xl px-3 py-2 ${playerHighlight(partnerPlayer?.id)}`}>
          <span className="text-white/80 text-sm font-medium">
            {partnerPlayer?.nickname ?? '—'}
            {isPartnerSittingOut && (
              <span className="ml-2 text-white/40 text-xs">(sitting out)</span>
            )}
          </span>
          {isPartnerSittingOut ? (
            <div className="h-24 flex items-center">
              <span className="text-white/20 text-xs">No cards</span>
            </div>
          ) : (
            <FaceDownHand count={getHandCount(partnerPlayer?.id)} />
          )}
        </div>

        {/* Middle: left | trick area | right */}
        <div className="flex items-center justify-center gap-6 w-full max-w-2xl">

          {/* Left opponent */}
          <div className={`flex flex-col items-center gap-2 rounded-xl px-3 py-2 ${playerHighlight(leftPlayer?.id)}`}>
            <span className="text-white/80 text-sm font-medium">
              {leftPlayer?.nickname ?? '—'}
            </span>
            <FaceDownHand count={getHandCount(leftPlayer?.id)} />
          </div>

          {/* Trick area + bidding panel overlay */}
          <div className="relative">
            <TrickArea
              trick={gameState.currentTrick}
              players={gameState.players}
              myPosition={myPosition}
              trickWinner={trickWinner}
              goingAlone={gameState.goingAlone}
              alonePlayerId={gameState.alonePlayerId}
              centerCard={
                gameState.phase === 'bidding_round1' || gameState.phase === 'dealer_discard'
                  ? gameState.kitty
                  : null
              }
            />
            {isBiddingPhase && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <BiddingPanel
                  key={`${gameState.phase}-${gameState.currentPlayerPosition}`}
                  gameState={gameState}
                  playerId={playerId}
                  onBid={(payload) => socket.emit('bid:submit', payload)}
                />
              </div>
            )}
            {isDealerDiscardPhase && !amIDealer && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-green-900/95 border border-white/20 rounded-2xl px-5 py-3 shadow-2xl text-center">
                  <p className="text-white text-sm">
                    {dealerPlayer?.nickname ?? 'Dealer'} is choosing a card to discard…
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right opponent */}
          <div className={`flex flex-col items-center gap-2 rounded-xl px-3 py-2 ${playerHighlight(rightPlayer?.id)}`}>
            <span className="text-white/80 text-sm font-medium">
              {rightPlayer?.nickname ?? '—'}
            </span>
            <FaceDownHand count={getHandCount(rightPlayer?.id)} />
          </div>
        </div>

        {/* My hand (bottom) */}
        <div className={`flex flex-col items-center gap-2 rounded-xl px-4 py-2 ${playerHighlight(me?.id)}`}>
          {isDealerDiscardPhase && amIDealer ? (
            <DealerDiscardPanel
              gameState={gameState}
              playerId={playerId}
              onDiscard={(card) => socket.emit('dealer:discard', { card })}
            />
          ) : (
            <>
              <Hand
                cards={myCards}
                validPlays={validPlays}
                onCardClick={(card) => socket.emit('card:play', { card })}
              />
              <span className="text-white/60 text-xs">
                {isMyTurn ? (
                  <span className="text-yellow-400 font-semibold">Your turn — play a card</span>
                ) : (
                  `You (${me?.nickname ?? '…'})`
                )}
              </span>
            </>
          )}
        </div>

        {/* Round complete overlay */}
        {roundOverlay && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-black/80 text-white text-center rounded-2xl px-8 py-5 shadow-2xl">
              <p className="text-lg font-bold">{roundOverlay.teamLabel}</p>
              <p className="text-white/70 text-sm mt-1">
                scores {roundOverlay.points} point{roundOverlay.points !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
