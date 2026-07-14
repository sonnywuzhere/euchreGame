import { useEffect, useState } from 'react';
import type { RoomState, GameState } from '../../../shared/types';
import socket from './useSocket';
import { getStoredPlayerId, setStoredPlayerId, setStoredRoomCode } from '../lib/session';

export function useGameState(initialRoomState?: RoomState | null) {
  const [roomState, setRoomState] = useState<RoomState | null>(initialRoomState ?? null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>(() => getStoredPlayerId() ?? '');

  useEffect(() => {
    function onPlayerRegistered(id: string) {
      setStoredPlayerId(id);
      setPlayerId(id);
    }

    // Persist the room code from any state update so we can rejoin after a
    // reconnect or browser restart (see lib/session + Game reconnect effect).
    function onRoomState(state: RoomState) {
      setStoredRoomCode(state.roomCode);
      setRoomState(state);
    }

    function onGameState(state: GameState) {
      setStoredRoomCode(state.roomCode);
      setGameState(state);
    }

    function onGameStart(state: GameState) {
      setStoredRoomCode(state.roomCode);
      setGameState(state);
    }

    socket.on('player:registered', onPlayerRegistered);
    socket.on('room:state', onRoomState);
    socket.on('game:state', onGameState);
    socket.on('game:start', onGameStart);

    return () => {
      socket.off('player:registered', onPlayerRegistered);
      socket.off('room:state', onRoomState);
      socket.off('game:state', onGameState);
      socket.off('game:start', onGameStart);
    };
  }, []);

  return { roomState, gameState, playerId };
}
