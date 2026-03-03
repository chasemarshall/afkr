import { EventEmitter } from 'events';
import mineflayer from 'mineflayer';
import pino from 'pino';
import type { BotState, BotStatus } from '@afkr/shared';

const logger = pino({ name: 'BotInstance' });

export class BotInstance extends EventEmitter {
  private bot: mineflayer.Bot | null = null;
  private status: BotStatus = 'offline';
  private health = 0;
  private food = 0;
  private position: { x: number; y: number; z: number } | undefined;
  private connectedAt: string | undefined;
  private sessionId: string | undefined;
  private errorMessage: string | undefined;
  private reconnectAttempts = 0;

  public readonly accountId: string;
  public readonly ownerUserId: string;
  public readonly serverHost: string;
  public readonly serverPort: number;
  public serverId: string | undefined;
  private version: string | undefined;

  constructor(
    accountId: string,
    ownerUserId: string,
    serverHost: string,
    serverPort: number,
    version?: string
  ) {
    super();
    this.accountId = accountId;
    this.ownerUserId = ownerUserId;
    this.serverHost = serverHost;
    this.serverPort = serverPort;
    this.version = version;
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  setReconnectAttempts(count: number) {
    this.reconnectAttempts = count;
  }

  private setStatus(status: BotStatus, error?: string) {
    this.status = status;
    this.errorMessage = error;
    this.emit('stateChange', this.getState());
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.setStatus('connecting');

        const botOptions: mineflayer.BotOptions = {
          host: this.serverHost,
          port: this.serverPort,
          username: this.accountId,
          auth: 'microsoft' as const,
          version: this.version || undefined,
        };

        this.bot = mineflayer.createBot(botOptions);

        this.bot.once('spawn', () => {
          logger.info({ accountId: this.accountId }, 'Bot spawned');
          this.connectedAt = new Date().toISOString();
          this.reconnectAttempts = 0;
          this.setStatus('online');
          resolve();
        });

        this.bot.on('health', () => {
          if (this.bot) {
            this.health = this.bot.health;
            this.food = this.bot.food;
            this.emit('stateChange', this.getState());
          }
        });

        this.bot.on('move', () => {
          if (this.bot?.entity) {
            this.position = {
              x: Math.round(this.bot.entity.position.x * 100) / 100,
              y: Math.round(this.bot.entity.position.y * 100) / 100,
              z: Math.round(this.bot.entity.position.z * 100) / 100,
            };
          }
        });

        this.bot.on('chat', (username: string, message: string) => {
          this.emit('chat', {
            account_id: this.accountId,
            message,
            timestamp: new Date().toISOString(),
            username,
          });
        });

        this.bot.on('kicked', (reason: string) => {
          logger.warn({ accountId: this.accountId, reason }, 'Bot kicked');
          this.setStatus('error', `Kicked: ${reason}`);
          this.emit('disconnected', this.accountId, `Kicked: ${reason}`);
        });

        this.bot.on('error', (err: Error) => {
          logger.error({ accountId: this.accountId, err }, 'Bot error');
          this.setStatus('error', err.message);
          reject(err);
        });

        this.bot.on('end', (reason: string) => {
          logger.info({ accountId: this.accountId, reason }, 'Bot disconnected');
          if (this.status !== 'error') {
            this.setStatus('offline');
          }
          this.emit('disconnected', this.accountId, reason || 'Connection ended');
        });
      } catch (err) {
        this.setStatus('error', (err as Error).message);
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.bot) {
      this.bot.quit();
      this.bot.removeAllListeners();
      this.bot = null;
    }
    this.setStatus('offline');
    this.connectedAt = undefined;
    this.position = undefined;
    this.health = 0;
    this.food = 0;
  }

  sendCommand(cmd: string): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    this.bot.chat(cmd);
  }

  getState(): BotState {
    return {
      account_id: this.accountId,
      status: this.status,
      server_id: this.serverId,
      health: this.health,
      food: this.food,
      position: this.position,
      connected_at: this.connectedAt,
      error: this.errorMessage,
      reconnect_attempts: this.reconnectAttempts,
    };
  }

  getStatus(): BotStatus {
    return this.status;
  }
}
