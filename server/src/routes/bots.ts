import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pino from 'pino';
import { botManager } from '../services/BotManager.js';
import { sanitizeCommand, isValidUuid } from '../middleware/validate.js';
import { requireAuthenticatedUserId } from '../middleware/auth.js';
import { getHistory } from '../db/commands.js';

const logger = pino({ name: 'routes:bots' });
const router = Router();

const connectSchema = z.object({
  account_id: z.string().uuid(),
  server_id: z.string().uuid(),
});

const commandSchema = z.object({
  account_id: z.string().uuid(),
  command: z.string().min(1).max(256),
});

const disconnectSchema = z.object({
  account_id: z.string().uuid(),
});

// POST /api/bots/connect
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    await botManager.connectBot(parsed.data.account_id, parsed.data.server_id, userId);
    res.json({ message: 'Bot connected', account_id: parsed.data.account_id });
  } catch (err) {
    logger.error({ err }, 'Failed to connect bot');
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/bots/disconnect
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = disconnectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    botManager.disconnectBot(parsed.data.account_id, userId);
    res.json({ message: 'Bot disconnected', account_id: parsed.data.account_id });
  } catch (err) {
    logger.error({ err }, 'Failed to disconnect bot');
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/bots/command
router.post('/command', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = commandSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const safeCommand = sanitizeCommand(parsed.data.command);
    if (!safeCommand) {
      res.status(400).json({ error: 'command is empty after sanitization' });
      return;
    }

    await botManager.sendCommand(parsed.data.account_id, safeCommand, userId);
    res.json({ message: 'Command sent' });
  } catch (err) {
    logger.error({ err }, 'Failed to send command');
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/bots/history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const accountId = typeof req.query.account_id === 'string' ? req.query.account_id : undefined;
    if (accountId && !isValidUuid(accountId)) {
      res.status(400).json({ error: 'invalid account_id format' });
      return;
    }

    const limit = parseInt(String(req.query.limit || '50'), 10);
    const offset = parseInt(String(req.query.offset || '0'), 10);
    const history = await getHistory({
      owner_user_id: userId,
      account_id: accountId,
      limit: Math.min(limit, 200),
      offset: Math.max(offset, 0),
    });
    res.json(history);
  } catch (err) {
    logger.error({ err }, 'Failed to get command history');
    res.status(500).json({ error: 'Failed to get command history' });
  }
});

// GET /api/bots/states
router.get('/states', (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const states = botManager.getAllStates(userId);
    res.json(states);
  } catch (err) {
    logger.error({ err }, 'Failed to get bot states');
    res.status(500).json({ error: 'Failed to get bot states' });
  }
});

export default router;
