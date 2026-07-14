import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../hooks/useSocket';
import type { RoomState } from '../../../shared/types';
import {
  clearStoredSession,
  getStoredPlayerId,
  getStoredRoomCode,
  setStoredPlayerId,
} from '../lib/session';

export type HomeNavState =
  | { kind: 'created'; initialRoomState: RoomState }
  | { kind: 'joining'; nickname: string; roomCode: string };

export default function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'joining'>('idle');
  const [error, setError] = useState('');

  // Resume-on-boot: if we have a stored identity + room (e.g. the browser was
  // closed mid-game), jump straight back to the game and let it reconnect.
  useEffect(() => {
    const storedRoom = getStoredRoomCode();
    const storedId = getStoredPlayerId();
    if (storedRoom && storedId) {
      navigate(`/game/${storedRoom}`, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreate() {
    if (!nickname.trim()) return;
    setError('');

    // Starting fresh — drop any stale identity from a previous game.
    clearStoredSession();

    // Capture the creator's UUID before Room.tsx mounts its listener.
    // The server emits player:registered right after room:state, so this
    // socket.once will fire (even post-navigation) and seed storage.
    socket.once('player:registered', (id: string) => {
      setStoredPlayerId(id);
    });
    socket.once('room:state', (state: RoomState) => {
      const navState: HomeNavState = { kind: 'created', initialRoomState: state };
      navigate(`/room/${state.roomCode}`, { state: navState });
    });
    socket.once('error', (msg: string) => {
      setError(msg);
    });

    socket.emit('room:create', { nickname: nickname.trim() });
  }

  function handleJoin() {
    if (!nickname.trim() || !roomCode.trim()) return;
    setError('');

    // Starting fresh — drop any stale identity from a previous game.
    clearStoredSession();

    // Navigate immediately — Room.tsx will emit room:join once its listener is ready.
    const code = roomCode.trim().toUpperCase();
    const navState: HomeNavState = { kind: 'joining', nickname: nickname.trim(), roomCode: code };
    navigate(`/room/${code}`, { state: navState });
  }

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <h1 className="text-3xl font-bold text-green-900 text-center mb-2">Euchre Online</h1>
        <p className="text-gray-500 text-center text-sm mb-8">4-player private rooms</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Your nickname</label>
          <input
            type="text"
            maxLength={16}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && mode === 'joining' && handleJoin()}
            placeholder="Enter nickname…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {mode === 'joining' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Room code</label>
            <input
              type="text"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. ABC123"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          {mode === 'idle' ? (
            <>
              <button
                onClick={handleCreate}
                disabled={!nickname.trim()}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                Create Game
              </button>
              <button
                onClick={() => { setMode('joining'); setError(''); }}
                disabled={!nickname.trim()}
                className="w-full border border-green-700 text-green-700 hover:bg-green-50 disabled:opacity-40 font-semibold py-2 rounded-lg transition-colors"
              >
                Join Game
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleJoin}
                disabled={!nickname.trim() || !roomCode.trim()}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                Join Room
              </button>
              <button
                onClick={() => { setMode('idle'); setError(''); setRoomCode(''); }}
                className="w-full text-gray-500 hover:text-gray-700 text-sm py-1 transition-colors"
              >
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
