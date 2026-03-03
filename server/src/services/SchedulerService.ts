import cron from 'node-cron';
import pino from 'pino';
import { getEnabledSchedules, updateSchedule } from '../db/schedules.js';
import { logCommand } from '../db/commands.js';
import { isAdminUserId } from '../db/ownership.js';
import { sanitizeCommand } from '../middleware/validate.js';
import type { ScheduledCommand } from '@afkr/shared';

const logger = pino({ name: 'SchedulerService' });

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_ONE_TIME_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

interface ActiveSchedule {
  schedule: ScheduledCommand;
  stop: () => void;
}

class SchedulerService {
  private activeSchedules = new Map<string, ActiveSchedule>();

  async loadSchedules(): Promise<void> {
    try {
      const schedules = await getEnabledSchedules();
      logger.info({ count: schedules.length }, 'Loading enabled schedules');

      for (const schedule of schedules) {
        this.activate(schedule);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to load schedules');
    }
  }

  addSchedule(schedule: ScheduledCommand): void {
    if (schedule.enabled) {
      this.activate(schedule);
    }
  }

  removeSchedule(id: string, userId: string): void {
    this.deactivate(id, userId);
  }

  toggleSchedule(id: string, enabled: boolean, schedule: ScheduledCommand, userId: string): void {
    if (enabled) {
      if (!isAdminUserId(userId) && schedule.owner_user_id !== userId) {
        return;
      }
      this.activate(schedule);
    } else {
      this.deactivate(id, userId);
    }
  }

  private activate(schedule: ScheduledCommand): void {
    // Deactivate existing if any
    this.deactivate(schedule.id);

    const execute = async () => {
      try {
        // Lazy import to avoid circular dependency
        const { botManager } = await import('./BotManager.js');
        const bot = botManager.getBot(schedule.account_id, schedule.owner_user_id);
        if (!bot || bot.getStatus() !== 'online') {
          logger.warn(
            { scheduleId: schedule.id, accountId: schedule.account_id },
            'Bot not online, skipping scheduled command'
          );
          return;
        }

        const safeCommand = sanitizeCommand(schedule.command);
        if (!safeCommand) {
          logger.warn({ scheduleId: schedule.id }, 'Scheduled command empty after sanitization');
          return;
        }

        bot.sendCommand(safeCommand);

        await logCommand({
          owner_user_id: schedule.owner_user_id,
          account_id: schedule.account_id,
          server_id: schedule.server_id,
          command: safeCommand,
          source: 'scheduled',
          scheduled_command_id: schedule.id,
        });

        await updateSchedule(schedule.id, {
          last_run_at: new Date().toISOString(),
        }, schedule.owner_user_id);

        logger.info(
          { scheduleId: schedule.id, command: schedule.command },
          'Executed scheduled command'
        );
      } catch (err) {
        logger.error({ scheduleId: schedule.id, err }, 'Failed to execute scheduled command');
      }
    };

    let stop: () => void;

    switch (schedule.trigger_type) {
      case 'cron': {
        if (!cron.validate(schedule.trigger_value)) {
          logger.warn(
            { scheduleId: schedule.id, triggerValue: schedule.trigger_value },
            'Invalid cron expression, skipping schedule activation'
          );
          return;
        }

        const task = cron.schedule(schedule.trigger_value, execute);
        stop = () => task.stop();
        break;
      }

      case 'interval': {
        const ms = parseInt(schedule.trigger_value, 10);
        if (!Number.isFinite(ms) || ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS) {
          logger.warn(
            { scheduleId: schedule.id, triggerValue: schedule.trigger_value },
            'Invalid interval trigger value, skipping schedule activation'
          );
          return;
        }

        const interval = setInterval(execute, ms);
        stop = () => clearInterval(interval);
        break;
      }

      case 'delay': {
        const ms = parseInt(schedule.trigger_value, 10);
        if (!Number.isFinite(ms) || ms < MIN_DELAY_MS || ms > MAX_DELAY_MS) {
          logger.warn(
            { scheduleId: schedule.id, triggerValue: schedule.trigger_value },
            'Invalid delay trigger value, skipping schedule activation'
          );
          return;
        }

        const timeout = setTimeout(() => {
          execute();
          this.activeSchedules.delete(schedule.id);
        }, ms);
        stop = () => clearTimeout(timeout);
        break;
      }

      case 'one_time': {
        const targetDate = new Date(schedule.trigger_value);
        const now = Date.now();
        const delayMs = targetDate.getTime() - now;

        if (!Number.isFinite(targetDate.getTime()) || delayMs <= 0 || delayMs > MAX_ONE_TIME_WINDOW_MS) {
          logger.warn(
            { scheduleId: schedule.id, triggerValue: schedule.trigger_value },
            'Invalid one-time trigger value, skipping schedule activation'
          );
          return;
        }

        const timeout = setTimeout(() => {
          execute();
          this.activeSchedules.delete(schedule.id);
        }, delayMs);
        stop = () => clearTimeout(timeout);
        break;
      }

      default:
        logger.warn(
          { scheduleId: schedule.id, triggerType: schedule.trigger_type },
          'Unknown trigger type'
        );
        return;
    }

    this.activeSchedules.set(schedule.id, { schedule, stop });
    logger.info(
      { scheduleId: schedule.id, triggerType: schedule.trigger_type },
      'Schedule activated'
    );
  }

  private deactivate(id: string, userId?: string): void {
    const active = this.activeSchedules.get(id);
    if (active) {
      if (userId && !isAdminUserId(userId) && active.schedule.owner_user_id !== userId) {
        return;
      }
      active.stop();
      this.activeSchedules.delete(id);
      logger.info({ scheduleId: id }, 'Schedule deactivated');
    }
  }
}

export const schedulerService = new SchedulerService();
