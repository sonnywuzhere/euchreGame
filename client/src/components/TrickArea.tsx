import type { TrickCard, Player } from '../../../shared/types';
import CardComponent from './Card';

interface TrickAreaProps {
  trick: TrickCard[];
  players: Player[];
  myPosition: number;
  trickWinner?: string | null;
  goingAlone?: boolean;
  alonePlayerId?: string | null;
}

function EmptySlot() {
  return (
    <div className="w-16 h-24 rounded-lg border-2 border-dashed border-white/20" />
  );
}

export default function TrickArea({
  trick,
  players,
  myPosition,
  trickWinner,
  goingAlone,
  alonePlayerId,
}: TrickAreaProps) {
  const getCardForSeat = (seatOffset: 0 | 1 | 2 | 3) => {
    const absPosition = (myPosition + seatOffset) % 4;
    const player = players.find((p) => p.position === absPosition);
    if (!player) return null;
    if (goingAlone && alonePlayerId && player.id !== alonePlayerId) {
      const alonePlayer = players.find((p) => p.id === alonePlayerId);
      if (alonePlayer) {
        const isPartner = (player.position + 2) % 4 === alonePlayer.position;
        if (isPartner) return 'sitting-out' as const;
      }
    }
    return trick.find((tc) => tc.playerId === player.id) ?? null;
  };

  const myCard = getCardForSeat(0);
  const leftCard = getCardForSeat(1);
  const topCard = getCardForSeat(2);
  const rightCard = getCardForSeat(3);

  const renderSlot = (value: TrickCard | null | 'sitting-out') => {
    if (value === 'sitting-out') {
      return (
        <div className="w-16 h-24 rounded-lg border border-white/10 flex items-center justify-center">
          <span className="text-white/30 text-xs text-center leading-tight">sitting<br />out</span>
        </div>
      );
    }
    if (!value) return <EmptySlot />;
    return <CardComponent card={value.card} />;
  };

  // Strict cross/plus layout via 3×3 CSS grid
  // Row 0: [ _ | top  | _ ]
  // Row 1: [left| felt |right]
  // Row 2: [ _ | me   | _ ]
  return (
    <div className="relative">
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'auto auto auto',
          gridTemplateRows: 'auto auto auto',
          gap: '8px',
        }}
      >
        {/* Row 0 */}
        <div />
        <div className="flex justify-center">{renderSlot(topCard)}</div>
        <div />

        {/* Row 1 */}
        <div className="flex items-center justify-center">{renderSlot(leftCard)}</div>
        {/* Center felt — empty */}
        <div className="w-16 h-24 rounded-lg bg-green-800/40" />
        <div className="flex items-center justify-center">{renderSlot(rightCard)}</div>

        {/* Row 2 */}
        <div />
        <div className="flex justify-center">{renderSlot(myCard)}</div>
        <div />
      </div>

      {trickWinner && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/75 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg">
            {trickWinner} wins the trick!
          </div>
        </div>
      )}
    </div>
  );
}
