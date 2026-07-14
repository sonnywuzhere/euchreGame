// Persistent identity used to rejoin a game after a tab-away, a dropped socket,
// or a full browser restart. Deliberately uses localStorage (survives closing
// the tab/window) rather than sessionStorage (wiped on close).

const PLAYER_ID_KEY = 'euchre_player_id';
const ROOM_CODE_KEY = 'euchre_room_code';

export function getStoredPlayerId(): string | null {
  return localStorage.getItem(PLAYER_ID_KEY);
}

export function setStoredPlayerId(id: string): void {
  localStorage.setItem(PLAYER_ID_KEY, id);
}

export function getStoredRoomCode(): string | null {
  return localStorage.getItem(ROOM_CODE_KEY);
}

export function setStoredRoomCode(code: string): void {
  localStorage.setItem(ROOM_CODE_KEY, code);
}

// Forget the current game (called on game over or when a resume attempt fails)
// so we don't try to rejoin a room that no longer exists.
export function clearStoredSession(): void {
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(ROOM_CODE_KEY);
}
