import { BidAction, Card, GameState, Player, Suit } from '../../../shared/types';

// The suit of the same color as the given suit (for left bower logic).
export function sisterSuit(suit: Suit): Suit {
  if (suit === 'hearts') return 'diamonds';
  if (suit === 'diamonds') return 'hearts';
  if (suit === 'clubs') return 'spades';
  return 'clubs';
}

export type BidResult =
  | { decided: false }
  | {
      decided: true;
      trump: Suit;
      maker: string;
      goingAlone: boolean;
      alonePlayerId: string | null;
    };

/**
 * Round 1: each player in order (starting left of dealer) can order up the
 * face-up kitty card's suit, or pass. If ordered up, dealer picks up kitty
 * (hand management happens elsewhere). Dealer can be ordered up by any player
 * including themselves.
 *
 * @param bids - array of bid actions so far this round (length 0–4)
 * @param kitty - the face-up card
 * @param players - all 4 players in seat-position order
 * @param dealerPosition - seat index of dealer (0–3)
 */
export function resolveRound1Bidding(
  bids: BidAction[],
  kitty: Card,
  players: Player[],
  dealerPosition: number
): BidResult {
  for (const bid of bids) {
    if (bid.type === 'order_up') {
      return {
        decided: true,
        trump: kitty.suit,
        maker: bid.playerId,
        goingAlone: bid.goAlone,
        alonePlayerId: bid.goAlone ? bid.playerId : null,
      };
    }
  }

  // All 4 passed in round 1
  if (bids.length === 4 && bids.every((b) => b.type === 'pass')) {
    return { decided: false };
  }

  return { decided: false };
}

/**
 * Round 2: each player (starting left of dealer) names a suit (not the kitty
 * suit) or passes. Dealer cannot pass — "stick the dealer" rule.
 *
 * @param bids - array of bid actions so far in round 2 (length 0–4)
 * @param kittyTurnedSuit - the suit of the card turned down; cannot be named
 * @param players - all 4 players in seat-position order
 * @param dealerPosition - seat index of dealer (0–3)
 */
export function resolveRound2Bidding(
  bids: BidAction[],
  kittyTurnedSuit: Suit,
  players: Player[],
  dealerPosition: number
): BidResult {
  for (const bid of bids) {
    if (bid.type === 'name_suit') {
      return {
        decided: true,
        trump: bid.suit,
        maker: bid.playerId,
        goingAlone: bid.goAlone,
        alonePlayerId: bid.goAlone ? bid.playerId : null,
      };
    }
  }

  return { decided: false };
}

/**
 * Validate a single bid action given the current game state.
 * Returns null if valid, or an error string if invalid.
 */
export function isValidBid(action: BidAction, state: GameState): string | null {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return 'Player not found';
  if (player.position !== state.currentPlayerPosition) return 'Not your turn';

  if (state.phase === 'bidding_round1') {
    if (action.type === 'name_suit') return 'Cannot name suit in round 1';
    return null;
  }

  if (state.phase === 'bidding_round2') {
    if (action.type === 'order_up') return 'Cannot order up in round 2';
    if (action.type === 'name_suit') {
      if (action.suit === state.kitty.suit) {
        return 'Cannot name the turned-down suit';
      }
      return null;
    }
    // Pass in round 2: only allowed if not dealer
    if (action.type === 'pass') {
      if (player.position === state.dealerPosition) {
        return 'Dealer must name a suit (stick the dealer)';
      }
      return null;
    }
  }

  return 'Invalid bid for current phase';
}

/**
 * Returns the next player position to bid, wrapping around the table.
 * Bidding starts left of dealer (dealerPosition + 1) % 4.
 */
export function nextBidderPosition(
  dealerPosition: number,
  bidsSubmitted: number
): number {
  return (dealerPosition + 1 + bidsSubmitted) % 4;
}
