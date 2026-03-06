import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pino from 'pino';
import {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../db/accounts.js';
import { authService } from '../services/AuthService.js';
import { requireAuthenticatedUserId } from '../middleware/auth.js';
import { validateParamId } from '../middleware/validate.js';
import { isAdminUserId } from '../db/ownership.js';

const logger = pino({ name: 'routes:accounts' });
const router = Router();

// Validate UUID on all /:id routes
router.param('id', (req, res, next) => validateParamId(req, res, next));

const createAccountSchema = z.object({
  username: z.string().min(1).max(64),
  microsoft_email: z.string().email(),
});

const updateAccountSchema = z.object({
  username: z.string().min(1).max(64).optional(),
  microsoft_email: z.string().email().optional(),
  auto_reconnect: z.boolean().optional(),
  reconnect_delay_ms: z.number().int().min(1000).max(300_000).optional(),
  max_reconnect_attempts: z.number().int().min(0).max(1000).optional(),
  is_main_account: z.boolean().optional(),
  auto_click_chat: z.boolean().optional(),
});

// GET /api/accounts
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const accounts = await getAllAccounts(userId);
    res.json(accounts);
  } catch (err) {
    logger.error({ err }, 'Failed to get accounts');
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// GET /api/accounts/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const account = await getAccountById(req.params.id, userId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json(account);
  } catch (err) {
    logger.error({ err }, 'Failed to get account');
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// POST /api/accounts
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const account = await createAccount(parsed.data, userId);
    res.status(201).json(account);
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    logger.error({ err }, 'Failed to create account');
    if (e.code === '23505') {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT /api/accounts/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const account = await updateAccount(req.params.id, parsed.data, userId);
    res.json(account);
  } catch (err) {
    logger.error({ err }, 'Failed to update account');
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    await deleteAccount(req.params.id, userId);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, 'Failed to delete account');
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/accounts/:id/auth - trigger Microsoft auth flow
router.post('/:id/auth', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const accountId = req.params.id;
    const account = await getAccountById(accountId, userId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    // Start auth flow - respond immediately with device code info
    let responded = false;

    // Lazy import to avoid circular dependency
    const { io } = await import('../index.js');

    // Helper to emit to the owner's connected sockets
    function emitToOwner(event: string, data: Record<string, unknown>) {
      for (const client of io.sockets.sockets.values()) {
        const clientUserId = client.data.userId;
        if (!clientUserId) continue;
        if (isAdminUserId(clientUserId) || clientUserId === userId) {
          (client as any).emit(event, data);
        }
      }
    }

    authService
      .authenticateAccount(accountId, userId, (userCode, verificationUri) => {
        // Emit device code via socket for any listening clients
        emitToOwner('auth:device_code', {
          account_id: accountId,
          user_code: userCode,
          verification_uri: verificationUri,
        });

        if (!responded) {
          responded = true;
          res.json({ user_code: userCode, verification_uri: verificationUri });
        }
      })
      .then((username) => {
        logger.info({ accountId, username }, 'Auth completed via REST');
        emitToOwner('auth:complete', { account_id: accountId, username });
      })
      .catch((err) => {
        logger.error({ accountId, err }, 'Auth failed');
        emitToOwner('auth:error', {
          account_id: accountId,
          error: 'Authentication failed',
        });
        if (!responded) {
          responded = true;
          res.status(500).json({ error: 'Authentication failed' });
        }
      });
  } catch (err) {
    logger.error({ err }, 'Failed to start auth');
    res.status(500).json({ error: 'Failed to start authentication' });
  }
});

export default router;
