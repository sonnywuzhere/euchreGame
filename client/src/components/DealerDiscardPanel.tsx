import { useState } from 'react';
import type { Card, GameState } from '../../../shared/types';
import CardComponent from './Card';

interface DealerDiscardPanelProps {
  gameState: GameState;
  playerId: string;
  onDiscard: (card: Card) => void;
}

export default function DealerDiscardPanel({ gameState, playerId, onDiscard }: DealerDiscardPanelProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const dealer = gameState.players.find((p) => p.position === gameState.dealerPosition);
  if (!dealer || dealer.id !== playerId) return null;

  const myCards = gameState.hands[playerId] ?? [];
  const kitty = gameState.kitty;

  function isSelected(card: Card) {
    return selectedCard?.suit === card.suit && selectedCard?.rank === card.rank;
  }

  function isKittyCard(card: Card) {
    return card.suit === kitty.suit && card.rank === kitty.rank;
  }

  function handleConfirm() {
    if (!selectedCard || submitted) return;
    setSubmitted(true);
    onDiscard(selectedCard);
  }

  if (submitted) {
    return (
      <div className="text-white/60 text-sm py-2">Waiting for game to continue…</div>
    );
  }

  const SUIT_NAMES: Record<string, string> = {
    hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs', spades: 'Spades',
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="text-center">
        <p className="text-white font-semibold text-sm">Choose a card to discard</p>
        <p className="text-white/50 text-xs mt-0.5">
          {kitty.rank} of {SUIT_NAMES[kitty.suit]} was ordered up — you have 6 cards, discard one
        </p>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        {myCards.map((card, i) => (
          <div key={`${card.rank}-${card.suit}-${i}`} className="relative flex flex-col items-center">
            {isKittyCard(card) && !isSelected(card) && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap z-10">
                NEW
              </span>
            )}
            {isSelected(card) && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap z-10">
                DISCARD
              </span>
            )}
            <CardComponent
              card={card}
              highlighted={isSelected(card)}
              onClick={() => setSelectedCard(card)}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleConfirm}
        disabled={!selectedCard}
        className="py-2 px-6 rounded-xl font-semibold text-sm transition-all bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {selectedCard
          ? `Discard ${selectedCard.rank} of ${SUIT_NAMES[selectedCard.suit]}`
          : 'Tap a card to select'}
      </button>
    </div>
  );
}
