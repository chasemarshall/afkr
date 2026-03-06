import pino from 'pino';
import { getAccountById } from '../db/accounts.js';

const logger = pino({ name: 'ReconnectService' });

class ReconnectService {
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
  private reconnectAttempts = new Map<string, number>();
  // Synchronous lock to prevent duplicate scheduling from concurrent disconnect events
  private scheduling = new Set<string>();
  private _disabled = false;

  private getKey(accountId: string, userId: string): string {
    return `${userId}:${accountId}`;
  }

  /** Disable all reconnects (used during graceful shutdown) */
  disable(): void {
    this._disabled = true;
    // Clear all pending reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();
    this.scheduling.clear();
    logger.info('Reconnect service disabled — all pending reconnects cancelled');
  }

  private static readonly MAIN_ACCOUNT_KICK_PATTERNS = [
    'logged in from another location',
    'you logged in from another location',
    'duplicate login',
  ];

  private isMainAccountKick(reason: string): boolean {
    const lower = reason.toLowerCase();
    return ReconnectService.MAIN_ACCOUNT_KICK_PATTERNS.some((p) => lower.includes(p));
  }

  /** Max backoff delay: 5 minutes */
  private static readonly MAX_BACKOFF_MS = 5 * 60 * 1000;

  async handleDisconnect(accountId: string, serverId: string, userId: string, reason?: string): Promise<void> {
    if (this._disabled) return;

    try {
      const key = this.getKey(accountId, userId);

      // Skip if a reconnect is already pending or being scheduled
      if (this.reconnectTimers.has(key) || this.scheduling.has(key)) {
        logger.info({ accountId }, 'Reconnect already scheduled, skipping');
        return;
      }

      // Claim the slot synchronously before any async work
      this.scheduling.add(key);

      try {
        const account = await getAccountById(accountId, userId);
        if (!account || !account.auto_reconnect) {
          logger.info({ accountId }, 'Auto-reconnect disabled, skipping');
          return;
        }

        // Main account: skip reconnect if kicked for "logged in from another location"
        if (account.is_main_account && reason && this.isMainAccountKick(reason)) {
          logger.info({ accountId, reason }, 'Main account kicked by owner login, skipping reconnect');
          return;
        }

        const attempts = this.reconnectAttempts.get(key) || 0;
        if (account.max_reconnect_attempts > 0 && attempts >= account.max_reconnect_attempts) {
          logger.warn(
            { accountId, attempts },
            'Max reconnect attempts reached'
          );
          this.reconnectAttempts.delete(key);
          return;
        }

        const nextAttempt = attempts + 1;
        this.reconnectAttempts.set(key, nextAttempt);

        // Exponential backoff: base_delay * 2^attempt, capped at MAX_BACKOFF_MS
        const rawDelay = account.reconnect_delay_ms * Math.pow(2, attempts);
        const delay = Math.min(rawDelay, ReconnectService.MAX_BACKOFF_MS);
        logger.info(
          { accountId, attempt: nextAttempt, delayMs: delay },
          'Scheduling reconnect'
        );

        const timer = setTimeout(async () => {
          this.reconnectTimers.delete(key);
          try {
            const { botManager } = await import('./BotManager.js');
            const bot = botManager.getBot(accountId, userId);
            if (bot) {
              bot.setReconnectAttempts(nextAttempt);
            }
            await botManager.connectBot(accountId, serverId, userId);
            this.reconnectAttempts.delete(key);
            logger.info({ accountId }, 'Reconnect successful');
          } catch (err) {
            logger.error({ accountId, err }, 'Reconnect attempt failed, will retry');
            // Re-trigger to schedule the next attempt
            this.handleDisconnect(accountId, serverId, userId, reason);
          }
        }, delay);

        this.reconnectTimers.set(key, timer);
      } finally {
        this.scheduling.delete(key);
      }
    } catch (err) {
      logger.error({ accountId, err }, 'Error in handleDisconnect');
    }
  }

  cancelReconnect(accountId: string, userId: string): void {
    const key = this.getKey(accountId, userId);
    const timer = this.reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }
    this.reconnectAttempts.delete(key);
    this.scheduling.delete(key);
  }
}

export const reconnectService = new ReconnectService();
