import { useEffect, useState } from 'react';
import type { RoomState, GameState } from '../../../shared/types';
import socket from './useSocket';

const PLAYER_ID_KEY = 'euchre_player_id';

export function useGameState(initialRoomState?: RoomState | null) {
  const [roomState, setRoomState] = useState<RoomState | null>(initialRoomState ?? null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>(
    () => sessionStorage.getItem(PLAYER_ID_KEY) ?? ''
  );

  useEffect(() => {
    function onPlayerRegistered(id: string) {
      sessionStorage.setItem(PLAYER_ID_KEY, id);
      setPlayerId(id);
    }

    function onRoomState(state: RoomState) {
      setRoomState(state);
    }

    function onGameState(state: GameState) {
      setGameState(state);
    }

    function onGameStart(state: GameState) {
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
