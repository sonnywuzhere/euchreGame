import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import type { RoomPlayer, RoomState } from '../../../shared/types';
import socket from '../hooks/useSocket';
import type { HomeNavState } from './Home';

const TEAM_POSITIONS: [number, number][] = [
  [0, 2], // Team 1
  [1, 3], // Team 2
];

function PlayerSlot({ player, isMe }: { player: RoomPlayer | undefined; isMe: boolean }) {
  if (!player) {
    return (
      <div className="flex items-center gap-2 bg-green-800/40 rounded-lg px-4 py-3">
        <div className="w-3 h-3 rounded-full bg-gray-500" />
        <span className="text-gray-400 text-sm italic">Waiting…</span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-3 ${
        isMe ? 'bg-yellow-400/20 ring-2 ring-yellow-400' : 'bg-green-800/40'
      }`}
    >
      <div className={`w-3 h-3 rounded-full ${player.connected ? 'bg-green-400' : 'bg-red-400'}`} />
      <span className={`text-sm font-medium ${isMe ? 'text-yellow-200' : 'text-white'}`}>
        {player.nickname}
        {isMe && <span className="ml-1 text-xs text-yellow-400">(you)</span>}
      </span>
    </div>
  );
}

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as HomeNavState | null;

  const initialRoomState: RoomState | null =
    navState?.kind === 'created' ? navState.initialRoomState : null;

  const { roomState, gameState, playerId } = useGameState(initialRoomState);
  const [error, setError] = useState('');

  // If this is a join (not a create), emit room:join now that listeners are ready.
  useEffect(() => {
    if (navState?.kind !== 'joining' || !code) return;

    const { nickname, roomCode } = navState;

    function onError(msg: string) {
      setError(msg);
    }
    socket.once('error', onError);
    socket.emit('room:join', { nickname, roomCode });

    return () => {
      socket.off('error', onError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — emit exactly once on mount

  // Navigate to game when game:start fires
  useEffect(() => {
    if (!gameState) return;
    navigate(`/game/${code}`);
  }, [gameState, code, navigate]);

  function copyCode() {
    if (code) navigator.clipboard.writeText(code);
  }

  const players = roomState?.players ?? [];
  const allSeated = players.length === 4;

  const getAtPosition = (pos: number): RoomPlayer | undefined =>
    players.find((p) => p.position === pos);

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Room code */}
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Room Code</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-bold tracking-widest text-green-900">{code}</span>
            <button
              onClick={copyCode}
              className="text-xs text-green-700 border border-green-700 hover:bg-green-50 px-2 py-1 rounded-md transition-colors"
            >
              Copy invite
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-2 text-sm text-green-700 underline"
            >
              ← Back to lobby
            </button>
          </div>
        )}

        {/* Teams */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {TEAM_POSITIONS.map(([pos0, pos1], teamIdx) => (
            <div key={teamIdx}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Team {teamIdx + 1}
              </p>
              <div className="flex flex-col gap-2">
                <PlayerSlot player={getAtPosition(pos0)} isMe={getAtPosition(pos0)?.id === playerId} />
                <PlayerSlot player={getAtPosition(pos1)} isMe={getAtPosition(pos1)?.id === playerId} />
              </div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="text-center">
          {allSeated ? (
            <p className="text-green-700 font-semibold text-sm animate-pulse">
              All players joined — starting game…
            </p>
          ) : (
            <p className="text-gray-500 text-sm">
              Waiting for players… ({players.length}/4)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
