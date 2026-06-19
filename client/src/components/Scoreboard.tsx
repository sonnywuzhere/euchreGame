import type { Suit, Player } from '../../../shared/types';
import MusicPlayer from './MusicPlayer';

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLOR: Record<Suit, string> = {
  hearts: 'text-red-400',
  diamonds: 'text-red-400',
  clubs: 'text-white',
  spades: 'text-white',
};

interface ScoreboardProps {
  scores: [number, number];
  roundTricks: [number, number];
  trump: Suit | null;
  maker: string | null;
  players: Player[];
  goingAlone: boolean;
  myTeamId: 0 | 1;
}

function PipRow({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex gap-1 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full border ${
            i < filled ? 'bg-yellow-400 border-yellow-300' : 'bg-white/10 border-white/20'
          }`}
        />
      ))}
    </div>
  );
}

export default function Scoreboard({
  scores,
  roundTricks,
  trump,
  maker,
  players,
  goingAlone,
  myTeamId,
}: ScoreboardProps) {
  const makerPlayer = maker ? players.find((p) => p.id === maker) : null;

  const team0Players = players.filter((p) => p.teamId === 0).map((p) => p.nickname);
  const team1Players = players.filter((p) => p.teamId === 1).map((p) => p.nickname);

  return (
    <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 px-4 py-2 flex items-center gap-4 flex-wrap">
      {/* Team scores */}
      <div className="flex items-center gap-3">
        {([0, 1] as const).map((teamId) => {
          const isMyTeam = teamId === myTeamId;
          return (
            <div
              key={teamId}
              className={`flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[90px] ${
                isMyTeam ? 'bg-blue-900/50 ring-1 ring-blue-400/40' : 'bg-white/5'
              }`}
            >
              <span className="text-white/50 text-xs mb-0.5">
                {isMyTeam ? 'Your Team' : 'Opponents'}
              </span>
              <span className="text-white text-xs truncate max-w-full text-center leading-tight">
                {(teamId === 0 ? team0Players : team1Players).join(' & ')}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-white">{scores[teamId]}</span>
                <span className="text-white/40 text-xs">/10</span>
              </div>
              <PipRow filled={scores[teamId]} total={10} />
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-10 w-px bg-white/10 hidden sm:block" />

      {/* Round tricks */}
      <div className="flex flex-col items-center">
        <span className="text-white/50 text-xs mb-1">This Round</span>
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">{roundTricks[myTeamId]}</span>
          <span className="text-white/30 text-sm">–</span>
          <span className="text-white font-semibold">{roundTricks[myTeamId === 0 ? 1 : 0]}</span>
        </div>
        <span className="text-white/40 text-xs">tricks</span>
      </div>

      {/* Divider */}
      <div className="h-10 w-px bg-white/10 hidden sm:block" />

      {/* Trump + maker */}
      <div className="flex flex-col items-start gap-0.5">
        {trump ? (
          <div className="flex items-center gap-1.5">
            <span className="text-white/60 text-xs">Trump:</span>
            <span className={`text-lg font-bold ${SUIT_COLOR[trump]}`}>
              {SUIT_SYMBOLS[trump]}
            </span>
            <span className="text-white/80 text-xs capitalize">{trump}</span>
          </div>
        ) : (
          <span className="text-white/40 text-xs">Trump: TBD</span>
        )}
        {makerPlayer && (
          <div className="flex items-center gap-1.5">
            <span className="text-white/60 text-xs">Maker:</span>
            <span className="text-white text-xs font-medium">{makerPlayer.nickname}</span>
            {goingAlone && (
              <span className="text-yellow-400 text-xs font-semibold">Going alone!</span>
            )}
          </div>
        )}
      </div>

      <MusicPlayer />
    </div>
  );
}
