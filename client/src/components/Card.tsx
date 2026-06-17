import type { Card } from '../../../shared/types';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

interface CardProps {
  card: Card;
  faceDown?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
}

export default function Card({ card, faceDown, onClick, disabled, highlighted }: CardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const symbol = SUIT_SYMBOLS[card.suit];
  const clickable = !!onClick && !disabled;

  if (faceDown) {
    return (
      <div className="w-16 h-24 rounded-lg border-2 border-white/30 bg-emerald-800 relative overflow-hidden flex-shrink-0 select-none">
        <div className="absolute inset-1.5 rounded border border-emerald-600 bg-gradient-to-br from-emerald-700 to-emerald-900" />
      </div>
    );
  }

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={[
        'w-16 h-24 rounded-lg border-2 bg-white flex flex-col justify-between p-1.5 select-none flex-shrink-0 transition-all duration-150',
        isRed ? 'text-red-600' : 'text-slate-900',
        highlighted
          ? 'border-yellow-400 ring-2 ring-yellow-300 shadow-lg shadow-yellow-200/60 -translate-y-1'
          : 'border-slate-200',
        clickable ? 'cursor-pointer hover:-translate-y-3 hover:shadow-xl' : 'cursor-default',
        disabled ? 'opacity-40 grayscale' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col items-start leading-none">
        <span className="text-sm font-bold">{card.rank}</span>
        <span className="text-xs">{symbol}</span>
      </div>
      <div className="text-center text-2xl leading-none">{symbol}</div>
      <div className="flex flex-col items-end leading-none rotate-180">
        <span className="text-sm font-bold">{card.rank}</span>
        <span className="text-xs">{symbol}</span>
      </div>
    </div>
  );
}
