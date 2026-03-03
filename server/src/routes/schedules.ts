import { Router, Request, Response } from 'express';
import { z } from 'zod';
import cron from 'node-cron';
import pino from 'pino';
import {
  getAllSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../db/schedules.js';
import { getAccountById } from '../db/accounts.js';
import { getServerById } from '../db/servers.js';
import { schedulerService } from '../services/SchedulerService.js';
import { requireAuthenticatedUserId } from '../middleware/auth.js';
import { validateParamId, sanitizeCommand } from '../middleware/validate.js';

const logger = pino({ name: 'routes:schedules' });
const router = Router();

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_ONE_TIME_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

router.param('id', (req, res, next) => validateParamId(req, res, next));

const createScheduleSchema = z.object({
  account_id: z.string().uuid(),
  server_id: z.string().uuid(),
  command: z.string().min(1).max(512),
  trigger_type: z.enum(['delay', 'interval', 'cron', 'one_time']),
  trigger_value: z.string().min(1).max(128),
});

const updateScheduleSchema = z.object({
  command: z.string().min(1).max(512).optional(),
  trigger_type: z.enum(['delay', 'interval', 'cron', 'one_time']).optional(),
  trigger_value: z.string().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
});

function validateTriggerValue(
  triggerType: 'delay' | 'interval' | 'cron' | 'one_time',
  triggerValue: string
): string | null {
  const value = triggerValue.trim();

  if (triggerType === 'cron') {
    return cron.validate(value) ? null : 'invalid cron expression';
  }

  if (triggerType === 'delay' || triggerType === 'interval') {
    if (!/^\d+$/.test(value)) {
      return `${triggerType} trigger must be an integer in milliseconds`;
    }

    const ms = Number.parseInt(value, 10);
    if (!Number.isFinite(ms)) {
      return `${triggerType} trigger must be numeric`;
    }

    if (triggerType === 'delay' && (ms < MIN_DELAY_MS || ms > MAX_DELAY_MS)) {
      return `delay must be between ${MIN_DELAY_MS} and ${MAX_DELAY_MS} ms`;
    }

    if (triggerType === 'interval' && (ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS)) {
      return `interval must be between ${MIN_INTERVAL_MS} and ${MAX_INTERVAL_MS} ms`;
    }

    return null;
  }

  const oneTimeDate = new Date(value);
  const timestamp = oneTimeDate.getTime();
  const now = Date.now();
  if (!Number.isFinite(timestamp)) {
    return 'one_time trigger must be a valid ISO date';
  }
  if (timestamp <= now) {
    return 'one_time trigger must be in the future';
  }
  if (timestamp > now + MAX_ONE_TIME_WINDOW_MS) {
    return 'one_time trigger is too far in the future';
  }

  return null;
}

// GET /api/schedules
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const schedules = await getAllSchedules(userId);
    res.json(schedules);
  } catch (err) {
    logger.error({ err }, 'Failed to get schedules');
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

// GET /api/schedules/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const schedule = await getScheduleById(req.params.id, userId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (err) {
    logger.error({ err }, 'Failed to get schedule');
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// POST /api/schedules
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = createScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const safeCommand = sanitizeCommand(parsed.data.command);
    if (!safeCommand) {
      res.status(400).json({ error: 'command is empty after sanitization' });
      return;
    }

    const triggerValue = parsed.data.trigger_value.trim();
    const triggerError = validateTriggerValue(parsed.data.trigger_type, triggerValue);
    if (triggerError) {
      res.status(400).json({ error: triggerError });
      return;
    }

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

    const schedule = await createSchedule({
      ...parsed.data,
      command: safeCommand,
      trigger_value: triggerValue,
    }, userId);
    schedulerService.addSchedule(schedule);
    res.status(201).json(schedule);
  } catch (err) {
    logger.error({ err }, 'Failed to create schedule');
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// PUT /api/schedules/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const existing = await getScheduleById(req.params.id, userId);
    if (!existing) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const parsed = updateScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const nextTriggerType = parsed.data.trigger_type ?? existing.trigger_type;
    const nextTriggerValue = (parsed.data.trigger_value ?? existing.trigger_value).trim();
    const triggerError = validateTriggerValue(nextTriggerType, nextTriggerValue);
    if (triggerError) {
      res.status(400).json({ error: triggerError });
      return;
    }

    let safeCommand: string | undefined;
    if (parsed.data.command !== undefined) {
      safeCommand = sanitizeCommand(parsed.data.command);
      if (!safeCommand) {
        res.status(400).json({ error: 'command is empty after sanitization' });
        return;
      }
    }

    const schedule = await updateSchedule(req.params.id, {
      ...parsed.data,
      ...(safeCommand !== undefined && { command: safeCommand }),
      trigger_type: nextTriggerType,
      trigger_value: nextTriggerValue,
    }, userId);

    // Re-sync the scheduler
    if (schedule.enabled) {
      schedulerService.addSchedule(schedule);
    } else {
      schedulerService.removeSchedule(schedule.id, userId);
    }

    res.json(schedule);
  } catch (err) {
    logger.error({ err }, 'Failed to update schedule');
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    schedulerService.removeSchedule(req.params.id, userId);
    await deleteSchedule(req.params.id, userId);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, 'Failed to delete schedule');
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// POST /api/schedules/:id/toggle
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const existing = await getScheduleById(req.params.id, userId);
    if (!existing) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const enabled = !existing.enabled;
    const schedule = await updateSchedule(req.params.id, { enabled }, userId);
    schedulerService.toggleSchedule(schedule.id, enabled, schedule, userId);

    res.json(schedule);
  } catch (err) {
    logger.error({ err }, 'Failed to toggle schedule');
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

export default router;
