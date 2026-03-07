import { EventEmitter } from 'events';
import { Socket, connect as openTcpConnection } from 'net';
import mineflayer from 'mineflayer';
import pino from 'pino';
import { authenticateMinecraftClient } from './MinecraftAuth.js';
import type { BotState, BotStatus, MovementDirection, InventoryItem } from '@afkr/shared';

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
  private antiAfkEnabled = true;
  private antiAfkIntervalMs = 25_000;
  private autoClickChat = false;
  private inventory: InventoryItem[] = [];
  private joinCommand: string | undefined;
  private lobbyHeartbeatInterval: NodeJS.Timeout | null = null;
  /** How often to re-run the join command as a safety net (30 min) */
  private static readonly LOBBY_HEARTBEAT_MS = 30 * 60 * 1000;
  /** Delay before running join command after spawn */
  private static readonly JOIN_SPAWN_DELAY_MS = 3_000;
  /** Cooldown between lobby-triggered join commands to avoid spam */
  private static readonly LOBBY_JOIN_COOLDOWN_MS = 10_000;
  private lastLobbyJoinAt = 0;

  public readonly accountId: string;
  public readonly ownerUserId: string;
  public readonly serverHost: string;
  public readonly serverPort: number;
  private readonly connectHost: string;
  private readonly connectPort: number;
  public serverId: string | undefined;
  private version: string | undefined;

  /** Minehut lobby detection patterns (chat messages indicating the bot is in a lobby) */
  private static readonly LOBBY_PATTERNS = [
    /^\s*MH>/i,                          // Minehut lobby chat prefix
    /sending you to/i,                   // "Sending you to a lobby"
    /you have been sent to a lobby/i,
    /server is starting/i,               // Server starting message
    /server is restarting/i,
    /you were moved to a lobby/i,
    /the server you were on went down/i,
    /server closed/i,
    /lobby \d+/i,                        // "Lobby 1", "Lobby 2" etc.
  ];

  constructor(
    accountId: string,
    ownerUserId: string,
    serverHost: string,
    serverPort: number,
    connectHost: string,
    connectPort: number,
    version?: string,
    joinCommand?: string
  ) {
    super();
    this.accountId = accountId;
    this.ownerUserId = ownerUserId;
    this.serverHost = serverHost;
    this.serverPort = serverPort;
    this.connectHost = connectHost;
    this.connectPort = connectPort;
    this.version = version;
    this.joinCommand = joinCommand;
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
          connect: (client: { setSocket: (socket: Socket) => void }) => {
            client.setSocket(openTcpConnection(this.connectPort, this.connectHost));
          },
          username: this.accountId,
          auth: (client, options) => {
            authenticateMinecraftClient(
              this.accountId,
              this.ownerUserId,
              client as unknown as Record<string, unknown>,
              options as unknown as Record<string, unknown>
            ).catch((err) => {
              (client as { emit: (event: string, error: Error) => void }).emit('error', err as Error);
            });
          },
          version: this.version || undefined,
        } as mineflayer.BotOptions & Record<string, unknown>;

        this.bot = mineflayer.createBot(botOptions);

        this.bot.once('spawn', () => {
          logger.info({ accountId: this.accountId }, 'Bot spawned');
          this.connectedAt = new Date().toISOString();
          this.reconnectAttempts = 0;
          this.setStatus('online');
          this.startAntiIdle();
          this.startLobbyWatchdog();

          // Track inventory changes (inventory is only available after spawn)
          if (this.bot?.inventory) {
            this.bot.inventory.on('updateSlot', () => {
              this.updateInventory();
            });
            // Initial inventory may not be populated at spawn — retry a few times
            this.updateInventory();
            setTimeout(() => this.updateInventory(), 1000);
            setTimeout(() => this.updateInventory(), 3000);
            setTimeout(() => this.updateInventory(), 8000);
          }
          // Also refresh on collect events
          this.bot?.on('playerCollect', () => {
            setTimeout(() => this.updateInventory(), 100);
          });

          // Auto-click chat: execute run_command click events from chat messages
          this.bot?.on('message', (jsonMsg: unknown) => {
            if (!this.autoClickChat) return;
            const commands = this.extractClickCommands(jsonMsg)
              .filter((cmd) => this.isSafeAutoClickCommand(cmd));
            if (commands.length === 0) return;
            logger.info(
              { accountId: this.accountId, count: commands.length },
              'Auto-clicking approved chat commands'
            );
            let delay = 0;
            for (const cmd of commands) {
              setTimeout(() => {
                try { this.bot?.chat(cmd); } catch { /* noop */ }
              }, delay);
              delay += 500;
            }
          });

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

  /** Walk a ChatMessage tree and extract unique run_command click event values */
  private extractClickCommands(msg: unknown): string[] {
    const seen = new Set<string>();
    const commands: string[] = [];
    function walk(node: unknown): void {
      if (!node || typeof node !== 'object') return;
      const obj = node as Record<string, unknown>;
      if (obj.clickEvent && typeof obj.clickEvent === 'object') {
        const ce = obj.clickEvent as Record<string, unknown>;
        if (ce.action === 'run_command' && typeof ce.value === 'string' && !seen.has(ce.value)) {
          seen.add(ce.value);
          commands.push(ce.value);
        }
      }
      if (Array.isArray(obj.extra)) {
        for (const child of obj.extra) walk(child);
      }
      if (Array.isArray(obj.with)) {
        for (const child of obj.with) walk(child);
      }
    }
    walk(msg);
    return commands;
  }

  private isSafeAutoClickCommand(command: string): boolean {
    if (!this.joinCommand) {
      return false;
    }

    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
    return normalize(command) === normalize(this.joinCommand);
  }

  private updateInventory(): void {
    if (!this.bot) return;
    try {
      const items = this.bot.inventory.items();
      this.inventory = items.map((item) => ({
        slot: item.slot,
        name: item.name,
        count: item.count,
        display_name: item.displayName || item.name,
      }));
      // Also include items from slots array as fallback (armor, offhand)
      if (this.inventory.length === 0 && this.bot.inventory.slots) {
        const slotItems = this.bot.inventory.slots
          .filter((s): s is NonNullable<typeof s> => s != null && s.count > 0)
          .map((item) => ({
            slot: item.slot,
            name: item.name,
            count: item.count,
            display_name: item.displayName || item.name,
          }));
        if (slotItems.length > 0) {
          this.inventory = slotItems;
        }
      }
      this.emit('stateChange', this.getState());
    } catch {
      // Ignore inventory errors during transitions
    }
  }

  /** Run the join command if set (with cooldown to avoid spam) */
  private runJoinCommand(source: string): void {
    if (!this.joinCommand || !this.bot || this.status !== 'online') return;
    const now = Date.now();
    if (now - this.lastLobbyJoinAt < BotInstance.LOBBY_JOIN_COOLDOWN_MS) return;
    this.lastLobbyJoinAt = now;
    logger.info({ accountId: this.accountId, source }, 'Running join command');
    try {
      this.bot.chat(this.joinCommand);
    } catch {
      // ignore errors if bot is in a bad state
    }
  }

  /** Check if a chat message matches known lobby patterns */
  private isLobbyMessage(text: string): boolean {
    return BotInstance.LOBBY_PATTERNS.some((p) => p.test(text));
  }

  private startLobbyWatchdog(): void {
    this.stopLobbyWatchdog();
    if (!this.joinCommand) return;

    // Run join command shortly after spawn
    setTimeout(() => this.runJoinCommand('spawn'), BotInstance.JOIN_SPAWN_DELAY_MS);

    // Periodic heartbeat: re-run join command every 30 min as safety net
    this.lobbyHeartbeatInterval = setInterval(() => {
      this.runJoinCommand('heartbeat');
    }, BotInstance.LOBBY_HEARTBEAT_MS);

    // Listen for lobby chat patterns
    this.bot?.on('messagestr', (message: string) => {
      if (this.isLobbyMessage(message)) {
        logger.warn({ accountId: this.accountId, message }, 'Lobby detected, rejoining');
        // Small delay to let the lobby fully load
        setTimeout(() => this.runJoinCommand('lobby_detected'), 2_000);
      }
    });

    // Detect dimension/world changes (proxy moving player to lobby)
    this.bot?.on('respawn', () => {
      if (!this.joinCommand) return;
      logger.info({ accountId: this.accountId }, 'Respawn detected, will re-run join command');
      setTimeout(() => this.runJoinCommand('respawn'), 3_000);
    });

    logger.info({ accountId: this.accountId }, 'Lobby watchdog started');
  }

  private stopLobbyWatchdog(): void {
    if (this.lobbyHeartbeatInterval) {
      clearInterval(this.lobbyHeartbeatInterval);
      this.lobbyHeartbeatInterval = null;
    }
  }

  private startAntiIdle(): void {
    this.stopAntiIdle();
    if (!this.antiAfkEnabled) return;
    this.antiIdleInterval = setInterval(() => {
      if (!this.bot || this.status !== 'online') return;
      try {
        this.bot.swingArm('right');
        // ~50 degree random yaw rotation (0.87 rad)
        const yaw = this.bot.entity.yaw + (Math.random() - 0.5) * 1.74;
        this.bot.look(yaw, this.bot.entity.pitch);
        // Occasional jump
        this.bot.setControlState('jump', true);
        setTimeout(() => {
          try { this.bot?.setControlState('jump', false); } catch { /* noop */ }
        }, 200);
      } catch {
        // Ignore errors if bot is in a bad state
      }
    }, this.antiAfkIntervalMs);
  }

  private stopAntiIdle(): void {
    if (this.antiIdleInterval) {
      clearInterval(this.antiIdleInterval);
      this.antiIdleInterval = null;
    }
  }

  setAntiAfk(enabled: boolean, intervalMs?: number): void {
    this.antiAfkEnabled = enabled;
    if (intervalMs !== undefined) {
      this.antiAfkIntervalMs = Math.min(Math.max(intervalMs, 5000), 120_000);
    }
    if (enabled && this.status === 'online') {
      this.startAntiIdle();
    } else {
      this.stopAntiIdle();
    }
    this.emit('stateChange', this.getState());
    logger.info({ accountId: this.accountId, antiAfk: enabled, interval: this.antiAfkIntervalMs }, 'Anti-AFK updated');
  }

  setAutoClickChat(enabled: boolean): void {
    this.autoClickChat = enabled;
    this.emit('stateChange', this.getState());
    logger.info({ accountId: this.accountId, autoClickChat: enabled }, 'Auto-click chat updated');
  }

  disconnect(): void {
    this.stopAntiIdle();
    this.stopLobbyWatchdog();
    this.autoClickChat = false;
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

  move(direction: MovementDirection, durationMs = 400): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    this.bot.setControlState(direction, true);
    setTimeout(() => {
      try { this.bot?.setControlState(direction, false); } catch { /* noop */ }
    }, durationMs);
  }

  jump(): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    this.bot.setControlState('jump', true);
    setTimeout(() => {
      try { this.bot?.setControlState('jump', false); } catch { /* noop */ }
    }, 300);
  }

  look(yawDelta: number, pitchDelta: number): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    const newYaw = this.bot.entity.yaw + yawDelta;
    const newPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.bot.entity.pitch + pitchDelta));
    this.bot.look(newYaw, newPitch);
  }

  sendCommand(cmd: string): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    this.bot.chat(cmd);
  }

  attack(): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    this.bot.swingArm('right');
  }

  useItem(hand: 'right' | 'left' = 'right'): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    this.bot.activateItem(hand === 'left');
  }

  placeBlock(): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    // Activate item on the main hand (equivalent to right-click to place)
    this.bot.activateItem(false);
  }

  setSneaking(enabled: boolean): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    this.bot.setControlState('sneak', enabled);
  }

  setSprinting(enabled: boolean): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    this.bot.setControlState('sprint', enabled);
  }

  swapHands(): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    // Swap main hand and offhand
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const swapSlot = (this.bot as any)._client;
    if (swapSlot && typeof swapSlot.write === 'function') {
      swapSlot.write('held_item_slot', { slotId: 40 }); // offhand slot
    }
  }

  dropItem(slot?: number, all = false): void {
    if (!this.bot || this.status !== 'online') {
      throw new Error('Bot is not connected');
    }
    if (slot !== undefined) {
      this.bot.tossStack(this.bot.inventory.slots[slot] as never).catch(() => { /* noop */ });
    } else if (all) {
      const items = this.bot.inventory.items();
      for (const item of items) {
        this.bot.tossStack(item as never).catch(() => { /* noop */ });
      }
    } else {
      // Drop currently held item
      const held = this.bot.heldItem;
      if (held) {
        this.bot.tossStack(held as never).catch(() => { /* noop */ });
      }
    }
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
      anti_afk: this.antiAfkEnabled,
      anti_afk_interval: this.antiAfkIntervalMs,
      auto_click_chat: this.autoClickChat,
      inventory: this.inventory,
    };
  }

  getStatus(): BotStatus {
    return this.status;
  }
}
