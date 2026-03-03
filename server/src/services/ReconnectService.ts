import pino from 'pino';
import { getAccountById } from '../db/accounts.js';

const logger = pino({ name: 'ReconnectService' });

class ReconnectService {
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
  private reconnectAttempts = new Map<string, number>();

  private getKey(accountId: string, userId: string): string {
    return `${userId}:${accountId}`;
  }

  async handleDisconnect(accountId: string, serverId: string, userId: string): Promise<void> {
    try {
      const key = this.getKey(accountId, userId);

      // Skip if a reconnect timer is already pending for this account
      if (this.reconnectTimers.has(key)) {
        logger.info({ accountId }, 'Reconnect already scheduled, skipping');
        return;
      }

      const account = await getAccountById(accountId, userId);
      if (!account || !account.auto_reconnect) {
        logger.info({ accountId }, 'Auto-reconnect disabled, skipping');
        return;
      }

      const attempts = this.reconnectAttempts.get(key) || 0;
      if (attempts >= account.max_reconnect_attempts) {
        logger.warn(
          { accountId, attempts },
          'Max reconnect attempts reached'
        );
        this.reconnectAttempts.delete(key);
        return;
      }

      const nextAttempt = attempts + 1;
      this.reconnectAttempts.set(key, nextAttempt);

      // Exponential backoff: base_delay * 2^attempt
      const delay = account.reconnect_delay_ms * Math.pow(2, attempts);
      logger.info(
        { accountId, attempt: nextAttempt, delay },
        'Scheduling reconnect'
      );

      const timer = setTimeout(async () => {
        this.reconnectTimers.delete(key);
        try {
          // Lazy import to avoid circular dependency
          const { botManager } = await import('./BotManager.js');
          const bot = botManager.getBot(accountId, userId);
          if (bot) {
            bot.setReconnectAttempts(nextAttempt);
          }
          await botManager.connectBot(accountId, serverId, userId);
          this.reconnectAttempts.delete(key);
          logger.info({ accountId }, 'Reconnect successful');
        } catch (err) {
          logger.error({ accountId, err }, 'Reconnect attempt failed');
          // handleDisconnect will be called again by the BotManager disconnect event
        }
      }, delay);

      this.reconnectTimers.set(key, timer);
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
  }
}

export const reconnectService = new ReconnectService();
