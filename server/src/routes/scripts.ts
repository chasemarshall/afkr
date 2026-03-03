import { Router, Request, Response } from 'express';
import { z } from 'zod';
import cron from 'node-cron';
import pino from 'pino';
import {
  getAllScripts,
  getScriptById,
  getScriptCount,
  createScript,
  updateScript,
  deleteScript,
} from '../db/scripts.js';
import { getAccountById } from '../db/accounts.js';
import { getServerById } from '../db/servers.js';
import { botManager } from '../services/BotManager.js';
import { ScriptExecutor } from '../services/ScriptExecutor.js';
import { requireAuthenticatedUserId } from '../middleware/auth.js';
import { validateParamId } from '../middleware/validate.js';
import { io } from '../index.js';
import { isAdminUserId } from '../db/ownership.js';
import type { ScriptStep } from '@afkr/shared';

const logger = pino({ name: 'routes:scripts' });
const router = Router();

const MAX_SCRIPTS_PER_USER = 20;
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;

router.param('id', (req, res, next) => validateParamId(req, res, next));

const scriptStepSchema: z.ZodType<ScriptStep> = z.lazy(() =>
  z.object({
    action: z.enum([
      'move', 'jump', 'look', 'command', 'wait', 'attack', 'use',
      'place', 'sneak', 'sprint', 'swap_hands', 'drop', 'loop',
    ]),
    params: z.record(z.unknown()),
  })
);

const createScriptSchema = z.object({
  account_id: z.string().uuid(),
  server_id: z.string().uuid(),
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  steps: z.array(scriptStepSchema).max(200),
  trigger_type: z.enum(['manual', 'interval', 'cron']),
  trigger_value: z.string().max(128).optional(),
});

const updateScriptSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).optional(),
  steps: z.array(scriptStepSchema).max(200).optional(),
  enabled: z.boolean().optional(),
  trigger_type: z.enum(['manual', 'interval', 'cron']).optional(),
  trigger_value: z.string().max(128).optional(),
});

function validateTriggerValue(
  triggerType: 'manual' | 'interval' | 'cron',
  triggerValue?: string
): string | null {
  if (triggerType === 'manual') return null;

  if (!triggerValue || !triggerValue.trim()) {
    return `${triggerType} trigger requires a value`;
  }

  const value = triggerValue.trim();

  if (triggerType === 'cron') {
    return cron.validate(value) ? null : 'invalid cron expression';
  }

  if (triggerType === 'interval') {
    if (!/^\d+$/.test(value)) {
      return 'interval trigger must be an integer in milliseconds';
    }
    const ms = Number.parseInt(value, 10);
    if (!Number.isFinite(ms) || ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS) {
      return `interval must be between ${MIN_INTERVAL_MS} and ${MAX_INTERVAL_MS} ms`;
    }
    return null;
  }

  return null;
}

function emitScriptStatus(
  ownerUserId: string,
  accountId: string,
  scriptId: string,
  status: 'running' | 'completed' | 'error',
  step?: number,
  error?: string
) {
  for (const client of io.sockets.sockets.values()) {
    const clientUserId = client.data.userId;
    if (!clientUserId) continue;
    if (isAdminUserId(clientUserId) || clientUserId === ownerUserId) {
      client.emit('bot:script_status', {
        account_id: accountId,
        script_id: scriptId,
        status,
        step,
        error,
      });
    }
  }
}

// GET /api/scripts
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const scripts = await getAllScripts(userId);
    res.json(scripts);
  } catch (err) {
    logger.error({ err }, 'Failed to get scripts');
    res.status(500).json({ error: 'Failed to get scripts' });
  }
});

// GET /api/scripts/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const script = await getScriptById(req.params.id, userId);
    if (!script) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }
    res.json(script);
  } catch (err) {
    logger.error({ err }, 'Failed to get script');
    res.status(500).json({ error: 'Failed to get script' });
  }
});

// POST /api/scripts
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = createScriptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    // Check script limit
    const count = await getScriptCount(userId);
    if (count >= MAX_SCRIPTS_PER_USER) {
      res.status(400).json({ error: `maximum of ${MAX_SCRIPTS_PER_USER} scripts reached` });
      return;
    }

    // Validate trigger
    const triggerError = validateTriggerValue(
      parsed.data.trigger_type,
      parsed.data.trigger_value
    );
    if (triggerError) {
      res.status(400).json({ error: triggerError });
      return;
    }

    // Validate steps with executor
    const executor = new ScriptExecutor();
    const stepsError = executor.validate(parsed.data.steps);
    if (stepsError) {
      res.status(400).json({ error: stepsError });
      return;
    }

    // Check resource ownership
    const account = await getAccountById(parsed.data.account_id, userId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const server = await getServerById(parsed.data.server_id, userId);
    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const script = await createScript(parsed.data, userId);
    res.status(201).json(script);
  } catch (err) {
    logger.error({ err }, 'Failed to create script');
    res.status(500).json({ error: 'Failed to create script' });
  }
});

// PUT /api/scripts/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const existing = await getScriptById(req.params.id, userId);
    if (!existing) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }

    const parsed = updateScriptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    // Validate trigger if changed
    const nextTriggerType = parsed.data.trigger_type ?? existing.trigger_type;
    const nextTriggerValue = parsed.data.trigger_value ?? existing.trigger_value;
    const triggerError = validateTriggerValue(nextTriggerType, nextTriggerValue);
    if (triggerError) {
      res.status(400).json({ error: triggerError });
      return;
    }

    // Validate steps if changed
    if (parsed.data.steps) {
      const executor = new ScriptExecutor();
      const stepsError = executor.validate(parsed.data.steps);
      if (stepsError) {
        res.status(400).json({ error: stepsError });
        return;
      }
    }

    const script = await updateScript(req.params.id, {
      ...parsed.data,
      trigger_type: nextTriggerType,
      trigger_value: nextTriggerValue,
    }, userId);

    res.json(script);
  } catch (err) {
    logger.error({ err }, 'Failed to update script');
    res.status(500).json({ error: 'Failed to update script' });
  }
});

// DELETE /api/scripts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    await deleteScript(req.params.id, userId);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, 'Failed to delete script');
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

// POST /api/scripts/:id/toggle
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const existing = await getScriptById(req.params.id, userId);
    if (!existing) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }

    const enabled = !existing.enabled;
    const script = await updateScript(req.params.id, { enabled }, userId);
    res.json(script);
  } catch (err) {
    logger.error({ err }, 'Failed to toggle script');
    res.status(500).json({ error: 'Failed to toggle script' });
  }
});

// POST /api/scripts/:id/run — manual script execution
router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const script = await getScriptById(req.params.id, userId);
    if (!script) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }

    const bot = botManager.getBot(script.account_id, userId);
    if (!bot || bot.getStatus() !== 'online') {
      res.status(400).json({ error: 'Bot is not online' });
      return;
    }

    // Respond immediately, run async
    res.json({ status: 'started', script_id: script.id });

    // Execute in background
    const executor = new ScriptExecutor();
    emitScriptStatus(userId, script.account_id, script.id, 'running', 0);

    executor
      .execute(bot, script.steps, (progress) => {
        emitScriptStatus(userId, script.account_id, script.id, 'running', progress.step);
      })
      .then(() => {
        emitScriptStatus(userId, script.account_id, script.id, 'completed');
        logger.info({ scriptId: script.id }, 'Script completed');
      })
      .catch((err: Error) => {
        emitScriptStatus(userId, script.account_id, script.id, 'error', undefined, err.message);
        logger.error({ scriptId: script.id, err }, 'Script execution failed');
      });
  } catch (err) {
    logger.error({ err }, 'Failed to run script');
    res.status(500).json({ error: 'Failed to run script' });
  }
});

export default router;
