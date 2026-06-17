import { createDeck, dealHands, shuffleDeck } from './deck';
import { isValidBid, nextBidderPosition, resolveRound1Bidding, resolveRound2Bidding, sisterSuit } from './bidding';
import {
  cardStrength,
  effectiveSuit,
  getValidPlays,
  isLeftBower,
  isRightBower,
  resolveTrick,
} from './tricks';
import { applyRoundScore, isGameOver, scoreRound } from './scoring';
import { Card, GameState, Player, Suit, TrickCard } from '../../../shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(rank: string, suit: Suit): Card {
  return { rank: rank as Card['rank'], suit };
}

const PLAYER_IDS = ['p0', 'p1', 'p2', 'p3'] as const;

function makePlayers(): Player[] {
  return [
    { id: 'p0', nickname: 'Alice', teamId: 0, position: 0 },
    { id: 'p1', nickname: 'Bob',   teamId: 1, position: 1 },
    { id: 'p2', nickname: 'Carol', teamId: 0, position: 2 },
    { id: 'p3', nickname: 'Dave',  teamId: 1, position: 3 },
  ];
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'TEST',
    players: makePlayers(),
    hands: { p0: [], p1: [], p2: [], p3: [] },
    kitty: card('9', 'spades'),
    trump: null,
    maker: null,
    goingAlone: false,
    alonePlayerId: null,
    currentTrick: [],
    trickHistory: [],
    scores: [0, 0],
    roundTricks: [0, 0],
    phase: 'bidding_round1',
    dealerPosition: 3,
    currentPlayerPosition: 0,
    ...overrides,
  };
}

// ─── Deck Tests ───────────────────────────────────────────────────────────────

describe('deck', () => {
  test('createDeck produces exactly 24 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(24);

    const keys = new Set(deck.map((c) => `${c.rank}-${c.suit}`));
    expect(keys.size).toBe(24);
  });

  test('shuffleDeck returns 24 cards without duplicates', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(24);

    const keys = new Set(shuffled.map((c) => `${c.rank}-${c.suit}`));
    expect(keys.size).toBe(24);
  });

  test('shuffleDeck does not mutate the original deck', () => {
    const deck = createDeck();
    const original = deck.map((c) => ({ ...c }));
    shuffleDeck(deck);
    expect(deck).toEqual(original);
  });

  test('dealHands gives each player exactly 5 cards with 1 kitty', () => {
    const deck = shuffleDeck(createDeck());
    const { hands, kitty } = dealHands(deck, ['p0', 'p1', 'p2', 'p3']);

    expect(hands['p0']).toHaveLength(5);
    expect(hands['p1']).toHaveLength(5);
    expect(hands['p2']).toHaveLength(5);
    expect(hands['p3']).toHaveLength(5);
    expect(kitty).toBeDefined();
    expect(kitty.rank).toBeDefined();
    expect(kitty.suit).toBeDefined();
  });

  test('dealHands distributes 21 unique cards (5×4 + 1 kitty)', () => {
    const deck = shuffleDeck(createDeck());
    const { hands, kitty } = dealHands(deck, ['p0', 'p1', 'p2', 'p3']);
    const allCards = [
      ...hands['p0'],
      ...hands['p1'],
      ...hands['p2'],
      ...hands['p3'],
      kitty,
    ];
    const keys = new Set(allCards.map((c) => `${c.rank}-${c.suit}`));
    expect(keys.size).toBe(21);
  });

  test('dealHands throws on wrong deck size', () => {
    const deck = createDeck().slice(0, 20);
    expect(() => dealHands(deck, ['p0', 'p1', 'p2', 'p3'])).toThrow();
  });
});

// ─── Bidding Tests ────────────────────────────────────────────────────────────

describe('bidding — round 1', () => {
  const kitty = card('J', 'hearts');
  const players = makePlayers();

  test('player ordering up triggers trump immediately', () => {
    const result = resolveRound1Bidding(
      [{ type: 'order_up', playerId: 'p0', goAlone: false }],
      kitty,
      players,
      3
    );
    expect(result.decided).toBe(true);
    if (result.decided) {
      expect(result.trump).toBe('hearts');
      expect(result.maker).toBe('p0');
      expect(result.goingAlone).toBe(false);
    }
  });

  test('going alone is captured', () => {
    const result = resolveRound1Bidding(
      [{ type: 'order_up', playerId: 'p1', goAlone: true }],
      kitty,
      players,
      3
    );
    expect(result.decided).toBe(true);
    if (result.decided) {
      expect(result.goingAlone).toBe(true);
      expect(result.alonePlayerId).toBe('p1');
    }
  });

  test('four passes returns decided=false', () => {
    const bids = PLAYER_IDS.map((id) => ({ type: 'pass' as const, playerId: id }));
    const result = resolveRound1Bidding(bids, kitty, players, 3);
    expect(result.decided).toBe(false);
  });

  test('nextBidderPosition starts left of dealer', () => {
    // Dealer at position 3; first bidder should be position 0
    expect(nextBidderPosition(3, 0)).toBe(0);
    expect(nextBidderPosition(3, 1)).toBe(1);
    expect(nextBidderPosition(3, 3)).toBe(3); // dealer gets last turn
  });
});

describe('bidding — round 2', () => {
  const players = makePlayers();
  const turnedDownSuit: Suit = 'hearts';

  test('player naming a suit decides trump', () => {
    const result = resolveRound2Bidding(
      [{ type: 'name_suit', playerId: 'p2', suit: 'spades', goAlone: false }],
      turnedDownSuit,
      players,
      3
    );
    expect(result.decided).toBe(true);
    if (result.decided) {
      expect(result.trump).toBe('spades');
      expect(result.maker).toBe('p2');
    }
  });

  test('isValidBid rejects naming turned-down suit in round 2', () => {
    const state = baseState({
      phase: 'bidding_round2',
      kitty: card('9', 'hearts'),
      currentPlayerPosition: 0,
    });
    const err = isValidBid({ type: 'name_suit', playerId: 'p0', suit: 'hearts', goAlone: false }, state);
    expect(err).toMatch(/turned-down/i);
  });

  test('isValidBid rejects dealer passing in round 2', () => {
    // Dealer is at position 3 (p3)
    const state = baseState({
      phase: 'bidding_round2',
      kitty: card('9', 'hearts'),
      currentPlayerPosition: 3,
      dealerPosition: 3,
    });
    const err = isValidBid({ type: 'pass', playerId: 'p3' }, state);
    expect(err).toMatch(/stick the dealer/i);
  });

  test('isValidBid allows non-dealer to pass in round 2', () => {
    const state = baseState({
      phase: 'bidding_round2',
      kitty: card('9', 'hearts'),
      currentPlayerPosition: 0,
      dealerPosition: 3,
    });
    const err = isValidBid({ type: 'pass', playerId: 'p0' }, state);
    expect(err).toBeNull();
  });
});

// ─── Tricks Tests ─────────────────────────────────────────────────────────────

describe('tricks — bowers and trump', () => {
  test('sisterSuit returns correct pairs', () => {
    expect(sisterSuit('hearts')).toBe('diamonds');
    expect(sisterSuit('diamonds')).toBe('hearts');
    expect(sisterSuit('clubs')).toBe('spades');
    expect(sisterSuit('spades')).toBe('clubs');
  });

  test('right bower is highest trump', () => {
    expect(isRightBower(card('J', 'hearts'), 'hearts')).toBe(true);
    expect(isRightBower(card('J', 'diamonds'), 'hearts')).toBe(false);
    expect(isRightBower(card('A', 'hearts'), 'hearts')).toBe(false);
  });

  test('left bower recognized correctly', () => {
    // Hearts is trump → J of diamonds is left bower
    expect(isLeftBower(card('J', 'diamonds'), 'hearts')).toBe(true);
    expect(isLeftBower(card('J', 'hearts'), 'hearts')).toBe(false);
    expect(isLeftBower(card('J', 'spades'), 'clubs')).toBe(true);
    expect(isLeftBower(card('J', 'clubs'), 'spades')).toBe(true);
  });

  test('left bower effectiveSuit is trump, not its printed suit', () => {
    // J of diamonds with hearts trump → effective suit is hearts
    expect(effectiveSuit(card('J', 'diamonds'), 'hearts')).toBe('hearts');
    expect(effectiveSuit(card('J', 'spades'), 'clubs')).toBe('clubs');
    // Normal card: effective suit = printed suit
    expect(effectiveSuit(card('A', 'diamonds'), 'hearts')).toBe('diamonds');
  });

  test('cardStrength: right bower > left bower > trump A > non-trump A', () => {
    const trump: Suit = 'hearts';
    const rightBower = cardStrength(card('J', 'hearts'), trump);  // 17
    const leftBower  = cardStrength(card('J', 'diamonds'), trump); // 16
    const trumpAce   = cardStrength(card('A', 'hearts'), trump);   // 10+5=15
    const offAce     = cardStrength(card('A', 'spades'), trump);   // 5

    expect(rightBower).toBeGreaterThan(leftBower);
    expect(leftBower).toBeGreaterThan(trumpAce);
    expect(trumpAce).toBeGreaterThan(offAce);
  });

  test('resolveTrick: led-suit card beats off-suit card', () => {
    const trump: Suit = 'spades';
    const trick: TrickCard[] = [
      { playerId: 'p0', card: card('A', 'hearts') },  // led hearts
      { playerId: 'p1', card: card('K', 'diamonds') }, // off-suit — irrelevant
      { playerId: 'p2', card: card('9', 'hearts') },   // follows led suit
      { playerId: 'p3', card: card('Q', 'clubs') },    // off-suit — irrelevant
    ];
    const winner = resolveTrick(trick, trump);
    expect(winner.playerId).toBe('p0'); // A of hearts leads and wins
  });

  test('resolveTrick: trump beats led suit', () => {
    const trump: Suit = 'spades';
    const trick: TrickCard[] = [
      { playerId: 'p0', card: card('A', 'hearts') },
      { playerId: 'p1', card: card('9', 'spades') },  // lowest trump still wins
      { playerId: 'p2', card: card('K', 'hearts') },
      { playerId: 'p3', card: card('Q', 'hearts') },
    ];
    const winner = resolveTrick(trick, trump);
    expect(winner.playerId).toBe('p1');
  });

  test('resolveTrick: left bower beats all non-right-bower trump', () => {
    const trump: Suit = 'hearts';
    const trick: TrickCard[] = [
      { playerId: 'p0', card: card('A', 'hearts') },          // trump ace
      { playerId: 'p1', card: card('J', 'diamonds') },        // LEFT bower
      { playerId: 'p2', card: card('K', 'hearts') },          // trump king
      { playerId: 'p3', card: card('Q', 'hearts') },          // trump queen
    ];
    const winner = resolveTrick(trick, trump);
    expect(winner.playerId).toBe('p1'); // left bower wins
  });

  test('resolveTrick: right bower beats left bower', () => {
    const trump: Suit = 'hearts';
    const trick: TrickCard[] = [
      { playerId: 'p0', card: card('J', 'diamonds') },  // left bower
      { playerId: 'p1', card: card('J', 'hearts') },    // RIGHT bower
      { playerId: 'p2', card: card('A', 'hearts') },
      { playerId: 'p3', card: card('K', 'hearts') },
    ];
    const winner = resolveTrick(trick, trump);
    expect(winner.playerId).toBe('p1'); // right bower wins
  });

  test('getValidPlays enforces follow-suit', () => {
    const trump: Suit = 'spades';
    const hand: Card[] = [
      card('A', 'hearts'),
      card('K', 'hearts'),
      card('9', 'diamonds'), // off-suit
    ];
    // Led card is hearts → must follow with hearts
    const trick: TrickCard[] = [{ playerId: 'p3', card: card('Q', 'hearts') }];
    const valid = getValidPlays(hand, trick, trump);
    expect(valid).toHaveLength(2);
    expect(valid.every((c) => c.suit === 'hearts')).toBe(true);
  });

  test('getValidPlays: left bower must be played when hearts is led and trump', () => {
    // Hearts is trump; left bower = J of diamonds → treated as hearts
    const trump: Suit = 'hearts';
    const hand: Card[] = [
      card('J', 'diamonds'), // left bower = trump = hearts
      card('9', 'spades'),
    ];
    const trick: TrickCard[] = [{ playerId: 'p3', card: card('A', 'hearts') }]; // led hearts
    const valid = getValidPlays(hand, trick, trump);
    // Left bower is a heart (trump), so it's the only card that can follow hearts
    expect(valid).toHaveLength(1);
    expect(valid[0]).toEqual(card('J', 'diamonds'));
  });

  test('getValidPlays: all cards valid when void in led suit', () => {
    const trump: Suit = 'spades';
    const hand: Card[] = [card('A', 'clubs'), card('K', 'diamonds')];
    const trick: TrickCard[] = [{ playerId: 'p3', card: card('Q', 'hearts') }];
    const valid = getValidPlays(hand, trick, trump);
    expect(valid).toHaveLength(2);
  });
});

// ─── Scoring Tests ────────────────────────────────────────────────────────────

describe('scoring', () => {
  function stateWithTricks(
    makerTeam: 0 | 1,
    makerTricks: number,
    goingAlone = false
  ): GameState {
    const defenderTricks = 5 - makerTricks;
    const scores: [number, number] = [0, 0];
    const roundTricks: [number, number] = [0, 0];
    roundTricks[makerTeam] = makerTricks;
    roundTricks[makerTeam === 0 ? 1 : 0] = defenderTricks;

    return baseState({
      trump: 'hearts',
      maker: makerTeam === 0 ? 'p0' : 'p1',
      goingAlone,
      scores,
      roundTricks,
      phase: 'scoring',
    });
  }

  test('makers win 3 tricks → 1 point to makers', () => {
    const result = scoreRound(stateWithTricks(0, 3));
    expect(result.pointsScored).toBe(1);
    expect(result.scoringTeam).toBe(0);
    expect(result.wasEuchre).toBe(false);
  });

  test('makers win 4 tricks → 1 point to makers', () => {
    const result = scoreRound(stateWithTricks(0, 4));
    expect(result.pointsScored).toBe(1);
    expect(result.scoringTeam).toBe(0);
  });

  test('makers win all 5 tricks → 2 points to makers', () => {
    const result = scoreRound(stateWithTricks(0, 5));
    expect(result.pointsScored).toBe(2);
    expect(result.scoringTeam).toBe(0);
    expect(result.wonAllFive).toBe(true);
  });

  test('euchre: makers win only 2 tricks → 2 points to defenders', () => {
    const result = scoreRound(stateWithTricks(0, 2));
    expect(result.wasEuchre).toBe(true);
    expect(result.pointsScored).toBe(2);
    expect(result.scoringTeam).toBe(1); // defenders score
  });

  test('euchre: makers win only 1 trick → 2 points to defenders', () => {
    const result = scoreRound(stateWithTricks(0, 1));
    expect(result.wasEuchre).toBe(true);
    expect(result.pointsScored).toBe(2);
    expect(result.scoringTeam).toBe(1);
  });

  test('going alone, win all 5 → 4 points', () => {
    const result = scoreRound(stateWithTricks(0, 5, true));
    expect(result.pointsScored).toBe(4);
    expect(result.scoringTeam).toBe(0);
    expect(result.wentAlone).toBe(true);
  });

  test('going alone, win 3 tricks → 1 point', () => {
    const result = scoreRound(stateWithTricks(0, 3, true));
    expect(result.pointsScored).toBe(1);
    expect(result.scoringTeam).toBe(0);
  });

  test('going alone, euchred → 2 points to defenders', () => {
    const result = scoreRound(stateWithTricks(0, 2, true));
    expect(result.wasEuchre).toBe(true);
    expect(result.pointsScored).toBe(2);
    expect(result.scoringTeam).toBe(1);
  });

  test('applyRoundScore accumulates correctly', () => {
    const result = scoreRound(stateWithTricks(0, 3));
    const updated = applyRoundScore([4, 7], result);
    expect(updated).toEqual([5, 7]);
  });

  test('isGameOver false below 10 points', () => {
    expect(isGameOver([9, 9])).toBe(false);
    expect(isGameOver([0, 0])).toBe(false);
  });

  test('isGameOver true at 10 points', () => {
    expect(isGameOver([10, 7])).toBe(true);
    expect(isGameOver([6, 10])).toBe(true);
    expect(isGameOver([10, 10])).toBe(true);
  });

  test('full euchre round from 8-8: defenders reach 10', () => {
    // Team 0 is making, wins only 2 tricks → euchred → team 1 gets 2 pts
    const state = stateWithTricks(0, 2);
    state.scores = [8, 8];
    const result = scoreRound(state);
    const final = applyRoundScore(state.scores, result);
    expect(final).toEqual([8, 10]);
    expect(isGameOver(final)).toBe(true);
  });
});
