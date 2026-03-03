import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { BotInstance } from './BotInstance.js';
import { reconnectService } from './ReconnectService.js';
import { getAccountById } from '../db/accounts.js';
import { getServerById } from '../db/servers.js';
import { createSession, endSession } from '../db/sessions.js';
import { logCommand } from '../db/commands.js';
import { isAdminUserId } from '../db/ownership.js';
import type { BotState, ChatMessage, MovementDirection } from '@afkr/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '../../.bot-state.json');

const logger = pino({ name: 'BotManager' });

class BotManager extends EventEmitter {
  private bots = new Map<string, BotInstance>();

  async connectBot(accountId: string, serverId: string, userId: string): Promise<void> {
    if (this.bots.has(accountId)) {
      const existing = this.bots.get(accountId)!;
      if (!isAdminUserId(userId) && existing.ownerUserId !== userId) {
        throw new Error('Unauthorized access to bot');
      }
      if (existing.getStatus() === 'online' || existing.getStatus() === 'connecting') {
        throw new Error('Bot is already connected');
      }
      existing.disconnect();
      this.bots.delete(accountId);
    }

    const account = await getAccountById(accountId, userId);
    if (!account) throw new Error('Account not found');

    const server = await getServerById(serverId, userId);
    if (!server) throw new Error('Server not found');

    const instance = new BotInstance(
      accountId,
      account.owner_user_id,
      server.host,
      server.port,
      server.version
    );
    instance.serverId = serverId;

    // Create session
    const session = await createSession(accountId, serverId, instance.ownerUserId);
    instance.setSessionId(session.id);

    // Forward events
    instance.on('stateChange', (state: BotState) => {
      this.emit('bot:state', { ownerUserId: instance.ownerUserId, state });
    });

    instance.on('chat', (msg: ChatMessage) => {
      this.emit('bot:chat', { ownerUserId: instance.ownerUserId, message: msg });
    });

    instance.on('disconnected', async (accId: string, reason: string) => {
      const sessionId = instance.getSessionId();
      if (sessionId) {
        try {
          await endSession(sessionId, instance.ownerUserId, reason);
        } catch (err) {
          logger.error({ err }, 'Failed to end session');
        }
      }

      // Trigger reconnect if applicable
      reconnectService.handleDisconnect(accId, serverId, instance.ownerUserId);
    });

    this.bots.set(accountId, instance);

    try {
      await instance.connect();
      logger.info({ accountId, serverId }, 'Bot connected');
    } catch (err) {
      logger.error({ accountId, err }, 'Bot connection failed');
      this.bots.delete(accountId);
      throw err;
    }
  }

  disconnectBot(accountId: string, userId: string): void {
    const instance = this.getOwnedBot(accountId, userId);
    if (!instance) return;

    // Cancel any pending reconnect
    reconnectService.cancelReconnect(accountId, instance.ownerUserId);

    instance.disconnect();
    this.bots.delete(accountId);
    logger.info({ accountId }, 'Bot disconnected');
  }

  async sendCommand(accountId: string, cmd: string, userId: string): Promise<void> {
    const instance = this.getOwnedBot(accountId, userId);
    if (!instance) {
      throw new Error('Bot not found');
    }

    instance.sendCommand(cmd);

    // Log the command
    try {
      await logCommand({
        owner_user_id: instance.ownerUserId,
        account_id: accountId,
        server_id: instance.serverId!,
        command: cmd,
        source: 'manual',
      });
    } catch (err) {
      logger.error({ err }, 'Failed to log command');
    }
  }

  moveBot(accountId: string, direction: MovementDirection, userId: string, durationMs?: number): void {
    const instance = this.getOwnedBot(accountId, userId);
    if (!instance) throw new Error('Bot not found');
    instance.move(direction, durationMs);
  }

  jumpBot(accountId: string, userId: string): void {
    const instance = this.getOwnedBot(accountId, userId);
    if (!instance) throw new Error('Bot not found');
    instance.jump();
  }

  lookBot(accountId: string, yawDelta: number, pitchDelta: number, userId: string): void {
    const instance = this.getOwnedBot(accountId, userId);
    if (!instance) throw new Error('Bot not found');
    instance.look(yawDelta, pitchDelta);
  }

  setAntiAfk(accountId: string, enabled: boolean, userId: string, intervalMs?: number): void {
    const instance = this.getOwnedBot(accountId, userId);
    if (!instance) return;
    instance.setAntiAfk(enabled, intervalMs);
  }

  getBot(accountId: string, userId: string): BotInstance | undefined {
    return this.getOwnedBot(accountId, userId);
  }

  getAllStates(userId: string): BotState[] {
    const states: BotState[] = [];
    for (const instance of this.bots.values()) {
      if (!isAdminUserId(userId) && instance.ownerUserId !== userId) {
        continue;
      }
      states.push(instance.getState());
    }
    return states;
  }

  /** Gracefully disconnect all bots (used during shutdown). Saves state for restore on restart. */
  shutdownAll(): void {
    reconnectService.disable();

    // Save which bots were online so we can restore after restart
    const activeBots: { accountId: string; serverId: string; userId: string }[] = [];
    for (const [accountId, instance] of this.bots) {
      if (instance.serverId) {
        activeBots.push({
          accountId,
          serverId: instance.serverId,
          userId: instance.ownerUserId,
        });
      }
    }

    try {
      writeFileSync(STATE_FILE, JSON.stringify(activeBots), 'utf-8');
      logger.info({ count: activeBots.length }, 'Saved bot state for restore');
    } catch (err) {
      logger.error({ err }, 'Failed to save bot state');
    }

    // Disconnect all bots
    const count = this.bots.size;
    for (const [accountId, instance] of this.bots) {
      try {
        instance.disconnect();
      } catch {
        // ignore errors during shutdown
      }
      this.bots.delete(accountId);
    }
    logger.info({ count }, 'All bots disconnected for shutdown');
  }

  /** Restore bots that were online before last shutdown */
  async restoreAll(): Promise<void> {
    let saved: { accountId: string; serverId: string; userId: string }[];
    try {
      const raw = readFileSync(STATE_FILE, 'utf-8');
      saved = JSON.parse(raw);
      unlinkSync(STATE_FILE);
    } catch {
      // No state file = nothing to restore
      return;
    }

    if (!saved || saved.length === 0) return;

    logger.info({ count: saved.length }, 'Restoring bots from previous session');

    for (const { accountId, serverId, userId } of saved) {
      try {
        await this.connectBot(accountId, serverId, userId);
        logger.info({ accountId }, 'Bot restored successfully');
      } catch (err) {
        logger.error({ accountId, err }, 'Failed to restore bot');
      }
    }
  }

  private getOwnedBot(accountId: string, userId: string): BotInstance | undefined {
    const instance = this.bots.get(accountId);
    if (!instance) return undefined;
    if (isAdminUserId(userId)) return instance;
    if (instance.ownerUserId !== userId) return undefined;
    return instance;
  }
}

export const botManager = new BotManager();
