import Redis from 'ioredis';
import { GameState, Player, RoomPlayer, RoomState } from '../shared/types';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.on('error', (err: Error) => {
  console.error('[Redis]', err.message);
});

type NewPlayer = Pick<Player, 'id' | 'nickname'>;

const ROOM_KEY = (code: string) => `room:${code}:state`;
const GAME_KEY = (code: string) => `room:${code}:game`;

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createRoom(roomCode: string, player: NewPlayer): Promise<RoomState> {
  const roomPlayer: RoomPlayer = {
    ...player,
    position: 0,
    teamId: 0,
    connected: true,
  };
  const state: RoomState = { roomCode, players: [roomPlayer], gameStarted: false };
  // 60s TTL — auto-deletes if nobody else joins
  await redis.set(ROOM_KEY(roomCode), JSON.stringify(state), 'EX', 60);
  return state;
}

export async function joinRoom(
  roomCode: string,
  player: NewPlayer
): Promise<{ room: RoomState | null; error?: string }> {
  const raw = await redis.get(ROOM_KEY(roomCode));
  if (!raw) return { room: null, error: 'Room not found' };

  const state: RoomState = JSON.parse(raw);
  if (state.gameStarted) return { room: null, error: 'Game already started' };
  if (state.players.length >= 4) return { room: null, error: 'Room is full' };

  const position = state.players.length as 0 | 1 | 2 | 3;
  const teamId: 0 | 1 = position === 0 || position === 2 ? 0 : 1;

  state.players.push({ ...player, position, teamId, connected: true });

  // Clear the TTL now that the room has multiple players
  await redis.set(ROOM_KEY(roomCode), JSON.stringify(state));
  return { room: state };
}

export async function getRoomState(roomCode: string): Promise<RoomState | null> {
  const raw = await redis.get(ROOM_KEY(roomCode));
  return raw ? JSON.parse(raw) : null;
}

export async function saveRoomState(state: RoomState): Promise<void> {
  await redis.set(ROOM_KEY(state.roomCode), JSON.stringify(state));
}

export async function getGameState(roomCode: string): Promise<GameState | null> {
  const raw = await redis.get(GAME_KEY(roomCode));
  return raw ? JSON.parse(raw) : null;
}

export async function saveGameState(state: GameState): Promise<void> {
  await redis.set(GAME_KEY(state.roomCode), JSON.stringify(state));
}

export async function removePlayer(roomCode: string, playerId: string): Promise<RoomState | null> {
  const state = await getRoomState(roomCode);
  if (!state) return null;

  state.players = state.players.filter((p) => p.id !== playerId);

  if (state.players.length === 0) {
    await redis.del(ROOM_KEY(roomCode));
    await redis.del(GAME_KEY(roomCode));
    return null;
  }

  await saveRoomState(state);
  return state;
}

export async function markPlayerDisconnected(
  roomCode: string,
  playerId: string
): Promise<RoomState | null> {
  const state = await getRoomState(roomCode);
  if (!state) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (player) {
    player.connected = false;
    await saveRoomState(state);
  }

  return state;
}

export async function markPlayerConnected(
  roomCode: string,
  playerId: string
): Promise<RoomState | null> {
  const state = await getRoomState(roomCode);
  if (!state) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (player) {
    player.connected = true;
    await saveRoomState(state);
  }

  return state;
}
