import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import { config } from './config/env.js';
import {
  requireUserAuth,
  resolveUserIdFromSocketHandshake,
} from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { setupSocketHandler } from './socket/handler.js';
import { schedulerService } from './services/SchedulerService.js';
import accountsRouter from './routes/accounts.js';
import serversRouter from './routes/servers.js';
import botsRouter from './routes/bots.js';
import schedulesRouter from './routes/schedules.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@afkr/shared';

const logger = pino({ name: 'server' });

const app = express();
app.set('trust proxy', config.TRUST_PROXY);

// Security headers
app.use(helmet());
app.disable('x-powered-by');

// CORS - strict origin
app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));

// Global rate limit: 100 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Stricter rate limit on auth endpoints
app.use('/api/accounts/:id/auth', rateLimit({
  windowMs: 300_000,   // 5 minutes
  max: 5,              // 5 auth attempts per 5 min
  message: 'too many auth attempts, try again later',
}));

// Health check (outside rate limit)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Require authenticated user for all control-plane API routes
app.use('/api', requireUserAuth);

// API routes
app.use('/api/accounts', accountsRouter);
app.use('/api/servers', serversRouter);
app.use('/api/bots/connect', rateLimit({ windowMs: 60_000, max: 10 }));
app.use('/api/bots/disconnect', rateLimit({ windowMs: 60_000, max: 20 }));
app.use('/api/bots/command', rateLimit({ windowMs: 60_000, max: 60 }));
app.use('/api/bots', botsRouter);
app.use('/api/schedules', schedulesRouter);

// Create HTTP + Socket.IO servers
const httpServer = createServer(app);

const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, never, { userId: string }>(httpServer, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
  // Socket.IO security
  maxHttpBufferSize: 1e6, // 1MB max message size
  pingTimeout: 20_000,
  pingInterval: 25_000,
  connectTimeout: 10_000,
});

io.use((socket, next) => {
  resolveUserIdFromSocketHandshake(socket.handshake)
    .then((userId) => {
      if (!userId) {
        next(new Error('unauthorized'));
        return;
      }

      socket.data.userId = userId;
      next();
    })
    .catch(() => {
      next(new Error('unauthorized'));
    });
});

// Setup socket handlers
setupSocketHandler(io);

// Start server
httpServer.listen(config.PORT, async () => {
  logger.info({ port: config.PORT }, 'Server started');

  // Load scheduled commands
  await schedulerService.loadSchedules();
  logger.info('Scheduler initialized');
});
