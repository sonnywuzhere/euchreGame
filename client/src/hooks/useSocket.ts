import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../../../shared/types';

// In dev, Vite proxies /socket.io → localhost:3001 (see vite.config.ts).
// In production, client and server share the same origin so no URL needed.
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
});

export default socket;
