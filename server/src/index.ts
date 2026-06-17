import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from './shared/types';
import { redis } from './rooms/roomManager';
import { registerHandlers } from './socket/handlers';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

app.get('/health', async (_req, res) => {
  try {
    const pong = await redis.ping();
    res.json({ status: 'ok', redis: pong === 'PONG' ? 'connected' : 'error' });
  } catch {
    res.status(500).json({ status: 'error', redis: 'disconnected' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  registerHandlers(io, socket);
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Euchre server running on port ${PORT}`);
});
