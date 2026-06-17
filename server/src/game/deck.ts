import { Card, Rank, Suit } from '../shared/types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export type DealtHands = {
  hands: Record<string, Card[]>;
  kitty: Card;
};

// Deal 5 cards to each of the 4 players; one card face-up as kitty.
// playerIds must be ordered by seat position [0, 1, 2, 3].
export function dealHands(deck: Card[], playerIds: [string, string, string, string]): DealtHands {
  if (deck.length !== 24) {
    throw new Error(`Deck must have 24 cards, got ${deck.length}`);
  }
  const hands: Record<string, Card[]> = {};
  for (const id of playerIds) {
    hands[id] = [];
  }

  // Traditional Euchre deal pattern: 3-2-3-2 or 2-3-2-3 alternating per player.
  // Simplified: deal 5 cards each in two passes (3 then 2), kitty = card 21.
  const passes = [3, 2];
  let cardIndex = 0;

  for (const count of passes) {
    for (const id of playerIds) {
      for (let i = 0; i < count; i++) {
        hands[id].push(deck[cardIndex++]);
      }
    }
  }

  const kitty = deck[cardIndex];

  return { hands, kitty };
}
