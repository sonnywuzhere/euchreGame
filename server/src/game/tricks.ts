import { Card, GameState, Rank, Suit, TrickCard, TrickResult } from '../../shared/types';
import { sisterSuit } from './bidding';

/**
 * Returns true if a card is the right bower (Jack of trump suit).
 */
export function isRightBower(card: Card, trump: Suit): boolean {
  return card.rank === 'J' && card.suit === trump;
}

/**
 * Returns true if a card is the left bower (Jack of same-color suit as trump).
 */
export function isLeftBower(card: Card, trump: Suit): boolean {
  return card.rank === 'J' && card.suit === sisterSuit(trump);
}

/**
 * Returns the effective suit of a card given the current trump.
 * The left bower counts as trump suit, not its printed suit.
 */
export function effectiveSuit(card: Card, trump: Suit): Suit {
  if (isLeftBower(card, trump)) return trump;
  return card.suit;
}

const RANK_ORDER: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Returns a numeric strength for a card given the current trump and led suit.
 * Higher = stronger. Trump cards always beat non-trump cards.
 *
 * Strength bands:
 *   0–5:   non-trump (9=0 … A=5)
 *   10–15: trump non-bower (9=10 … A=15)
 *   16:    left bower
 *   17:    right bower
 */
export function cardStrength(card: Card, trump: Suit): number {
  if (isRightBower(card, trump)) return 17;
  if (isLeftBower(card, trump)) return 16;

  const rankValue = RANK_ORDER.indexOf(card.rank);
  const isTrump = card.suit === trump;
  return isTrump ? 10 + rankValue : rankValue;
}

/**
 * Returns the cards in a player's hand that are legal to play.
 * Must follow the led suit if possible. If no led suit (leading), all cards legal.
 */
export function getValidPlays(hand: Card[], currentTrick: TrickCard[], trump: Suit): Card[] {
  if (currentTrick.length === 0) return hand;

  const ledCard = currentTrick[0].card;
  const ledSuit = effectiveSuit(ledCard, trump);
  const suitMatchCards = hand.filter((c) => effectiveSuit(c, trump) === ledSuit);

  return suitMatchCards.length > 0 ? suitMatchCards : hand;
}

/**
 * Validate that a card play is legal.
 * Returns null if valid, or an error string.
 */
export function isValidPlay(
  playerId: string,
  card: Card,
  state: GameState
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 'Player not found';
  if (player.position !== state.currentPlayerPosition) return 'Not your turn';
  if (state.phase !== 'playing') return 'Game is not in playing phase';
  if (state.trump === null) return 'Trump has not been set';

  const hand = state.hands[playerId];
  if (!hand) return 'No hand found for player';

  const cardInHand = hand.some((c) => c.suit === card.suit && c.rank === card.rank);
  if (!cardInHand) return 'Card not in hand';

  const valid = getValidPlays(hand, state.currentTrick, state.trump);
  const isAllowed = valid.some((c) => c.suit === card.suit && c.rank === card.rank);
  if (!isAllowed) return 'Must follow suit';

  return null;
}

/**
 * Determines the winner of a completed trick (4 cards played).
 * The led suit and trump govern card strength comparisons.
 */
export function resolveTrick(trick: TrickCard[], trump: Suit): TrickCard {
  if (trick.length === 0) throw new Error('Cannot resolve empty trick');

  const ledSuit = effectiveSuit(trick[0].card, trump);

  let winner = trick[0];
  let winnerStrength = cardStrength(trick[0].card, trump);

  for (let i = 1; i < trick.length; i++) {
    const entry = trick[i];
    const suit = effectiveSuit(entry.card, trump);

    // Card is irrelevant if it's neither trump nor led suit
    if (suit !== trump && suit !== ledSuit) continue;

    const strength = cardStrength(entry.card, trump);
    if (strength > winnerStrength) {
      winner = entry;
      winnerStrength = strength;
    }
  }

  return winner;
}

// Re-export type for convenience
export type { TrickCard, TrickResult };
