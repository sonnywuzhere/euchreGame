import type { Card } from '../../../shared/types';
import CardComponent from './Card';

interface HandProps {
  cards: Card[];
  validPlays?: Card[];
  onCardClick?: (card: Card) => void;
}

function cardsMatch(a: Card, b: Card) {
  return a.rank === b.rank && a.suit === b.suit;
}

export default function Hand({ cards, validPlays, onCardClick }: HandProps) {
  const isValid = (card: Card) =>
    validPlays ? validPlays.some((v) => cardsMatch(v, card)) : false;

  const shouldOverlap = cards.length > 5;

  return (
    <div
      className={`flex items-end justify-center ${shouldOverlap ? '' : 'gap-2'}`}
      style={shouldOverlap ? { gap: 0 } : undefined}
    >
      {cards.map((card, i) => {
        const valid = isValid(card);
        return (
          <div
            key={`${card.rank}-${card.suit}-${i}`}
            className="relative transition-all duration-150 hover:z-10"
            style={shouldOverlap ? { marginLeft: i === 0 ? 0 : -24, zIndex: i } : undefined}
          >
            <CardComponent
              card={card}
              highlighted={valid}
              onClick={valid && onCardClick ? () => onCardClick(card) : undefined}
              disabled={validPlays !== undefined && !valid}
            />
          </div>
        );
      })}
    </div>
  );
}
