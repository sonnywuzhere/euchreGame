// Verifies the sliding-TTL behavior on room + game keys. Uses an in-memory
// Redis fake that models `set ... EX`, `expire`, and per-key TTLs so we can
// assert the window is applied on writes AND refreshed on reads — and that the
// old 60s create-TTL (which expired rooms before invitees could join) is gone.

// ── In-memory ioredis fake ──────────────────────────────────────────────────
class MockRedis {
  private store = new Map<string, string>();
  private expireAt = new Map<string, number>();

  on(): void {}

  private isExpired(key: string): boolean {
    const at = this.expireAt.get(key);
    if (at !== undefined && at <= Date.now()) {
      this.store.delete(key);
      this.expireAt.delete(key);
      return true;
    }
    return false;
  }

  async set(key: string, val: string, mode?: string, ttl?: number): Promise<'OK'> {
    this.store.set(key, val);
    if (mode === 'EX' && typeof ttl === 'number') {
      this.expireAt.set(key, Date.now() + ttl * 1000);
    } else {
      this.expireAt.delete(key); // plain SET clears any TTL
    }
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null;
    return this.store.get(key) ?? null;
  }

  async expire(key: string, ttl: number): Promise<number> {
    if (this.isExpired(key) || !this.store.has(key)) return 0;
    this.expireAt.set(key, Date.now() + ttl * 1000);
    return 1;
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) {
      if (this.store.delete(k)) n++;
      this.expireAt.delete(k);
    }
    return n;
  }

  // test-only introspection: remaining TTL in seconds (-2 no key, -1 no expiry)
  ttl(key: string): number {
    if (this.isExpired(key) || !this.store.has(key)) return -2;
    const at = this.expireAt.get(key);
    if (at === undefined) return -1;
    return Math.ceil((at - Date.now()) / 1000);
  }
}

jest.mock('ioredis', () => MockRedis);

import {
  createRoom,
  joinRoom,
  getRoomState,
  saveGameState,
  redis,
} from './roomManager';
import { GameState } from '../shared/types';

const r = redis as unknown as MockRedis;
const ROOM = (code: string) => `room:${code}:state`;
const GAME = (code: string) => `room:${code}:game`;

// The expected window: generous, human-scale, and definitely not the old 60s.
const EXPECTED_TTL = 30 * 60;

describe('room sliding TTL', () => {
  it('createRoom sets a generous TTL, not the old 60s', async () => {
    await createRoom('AAAAAA', { id: 'p0', nickname: 'Ann' });
    const ttl = r.ttl(ROOM('AAAAAA'));
    expect(ttl).toBeGreaterThan(60); // regression: the bug value is gone
    expect(ttl).toBeLessThanOrEqual(EXPECTED_TTL);
    expect(ttl).toBeGreaterThanOrEqual(EXPECTED_TTL - 2);
  });

  it('getRoomState slides the TTL forward (a read is activity)', async () => {
    await createRoom('BBBBBB', { id: 'p0', nickname: 'Ann' });
    // Simulate the window nearly elapsing.
    await r.expire(ROOM('BBBBBB'), 5);
    expect(r.ttl(ROOM('BBBBBB'))).toBeLessThanOrEqual(5);

    const state = await getRoomState('BBBBBB');
    expect(state).not.toBeNull();
    expect(r.ttl(ROOM('BBBBBB'))).toBeGreaterThanOrEqual(EXPECTED_TTL - 2);
  });

  it('a room survives long past the old 60s window if someone joins late', async () => {
    await createRoom('CCCCCC', { id: 'p0', nickname: 'Ann' });
    // Old bug: after 60s the key was gone. Simulate 90s elapsed on a 30min TTL.
    await r.expire(ROOM('CCCCCC'), EXPECTED_TTL - 90);

    const { room, error } = await joinRoom('CCCCCC', { id: 'p1', nickname: 'Bob' });
    expect(error).toBeUndefined();
    expect(room?.players).toHaveLength(2);
    // Join refreshed the window.
    expect(r.ttl(ROOM('CCCCCC'))).toBeGreaterThanOrEqual(EXPECTED_TTL - 2);
  });

  it('game state is written with a TTL (no more forever-leak on restart)', async () => {
    const gs = { roomCode: 'DDDDDD', players: [] } as unknown as GameState;
    await saveGameState(gs);
    const ttl = r.ttl(GAME('DDDDDD'));
    expect(ttl).toBeGreaterThan(60);
    expect(ttl).toBeLessThanOrEqual(EXPECTED_TTL);
  });
});
