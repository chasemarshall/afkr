import { EventEmitter } from 'events';
import mineflayer from 'mineflayer';
import pino from 'pino';
import type { BotState, BotStatus } from '@afkr/shared';

const logger = pino({ name: 'BotInstance' });

/** Extract human-readable text from mineflayer kick reason (can be string or ChatMessage object) */
function parseKickReason(reason: unknown): string {
  if (typeof reason === 'string') {
    try {
      const parsed = JSON.parse(reason);
      return parseKickReason(parsed);
    } catch {
      return reason;
    }
  }
  if (reason && typeof reason === 'object') {
    const obj = reason as Record<string, unknown>;
    // ChatMessage with .text or .value.text
    if (typeof obj.text === 'string' && obj.text) return obj.text;
    if (obj.value && typeof obj.value === 'object') {
      const val = obj.value as Record<string, unknown>;
      if (val.text && typeof val.text === 'object') {
        const t = val.text as Record<string, unknown>;
        if (typeof t.value === 'string') return t.value;
      }
      if (typeof val.text === 'string') return val.text;
    }
    // Try extra array
    if (Array.isArray(obj.extra)) {
      return obj.extra.map((e: unknown) => parseKickReason(e)).join('');
    }
    // Fallback: stringify
    return JSON.stringify(reason);
  }
  return String(reason);
}

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
  private antiIdleInterval: NodeJS.Timeout | null = null;

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
          this.startAntiIdle();
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

        // Auto-accept server resource packs (required by some servers like Minehut)
        this.bot.on('resourcePack', () => {
          logger.info({ accountId: this.accountId }, 'Accepting server resource pack');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.bot as any)?.acceptResourcePack();
        });

        this.bot.on('chat', (username: string, message: string) => {
          this.emit('chat', {
            account_id: this.accountId,
            message,
            timestamp: new Date().toISOString(),
            username,
          });
        });

        this.bot.on('kicked', (reason: unknown) => {
          const parsed = parseKickReason(reason);
          logger.warn({ accountId: this.accountId, reason: parsed }, 'Bot kicked');
          this.setStatus('error', `kicked: ${parsed}`);
          this.emit('disconnected', this.accountId, `kicked: ${parsed}`);
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

  private startAntiIdle(): void {
    this.stopAntiIdle();
    // Every 30s: swing arm + slight look rotation to avoid AFK kicks
    this.antiIdleInterval = setInterval(() => {
      if (!this.bot || this.status !== 'online') return;
      try {
        this.bot.swingArm('right');
        // Small random yaw rotation to simulate activity
        const yaw = this.bot.entity.yaw + (Math.random() - 0.5) * 0.5;
        this.bot.look(yaw, this.bot.entity.pitch);
      } catch {
        // Ignore errors if bot is in a bad state
      }
    }, 30_000);
  }

  private stopAntiIdle(): void {
    if (this.antiIdleInterval) {
      clearInterval(this.antiIdleInterval);
      this.antiIdleInterval = null;
    }
  }

  disconnect(): void {
    this.stopAntiIdle();
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
