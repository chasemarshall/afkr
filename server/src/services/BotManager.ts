import { EventEmitter } from 'events';
import pino from 'pino';
import { BotInstance } from './BotInstance.js';
import { reconnectService } from './ReconnectService.js';
import { getAccountById } from '../db/accounts.js';
import { getServerById } from '../db/servers.js';
import { createSession, endSession } from '../db/sessions.js';
import { logCommand } from '../db/commands.js';
import { isAdminUserId } from '../db/ownership.js';
import type { BotState, ChatMessage } from '@afkr/shared';

const logger = pino({ name: 'BotManager' });

class BotManager extends EventEmitter {
  private bots = new Map<string, BotInstance>();

  async connectBot(accountId: string, serverId: string, userId: string): Promise<void> {
    if (this.bots.has(accountId)) {
      const existing = this.bots.get(accountId)!;
      if (!isAdminUserId(userId) && existing.ownerUserId !== userId) {
        throw new Error(`Unauthorized access to bot ${accountId}`);
      }
      if (existing.getStatus() === 'online' || existing.getStatus() === 'connecting') {
        throw new Error(`Bot for account ${accountId} is already connected`);
      }
      existing.disconnect();
      this.bots.delete(accountId);
    }

    const account = await getAccountById(accountId, userId);
    if (!account) throw new Error(`Account ${accountId} not found`);

    const server = await getServerById(serverId, userId);
    if (!server) throw new Error(`Server ${serverId} not found`);

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
    if (!instance) {
      throw new Error(`No bot found for account ${accountId}`);
    }

    // Cancel any pending reconnect
    reconnectService.cancelReconnect(accountId, instance.ownerUserId);

    instance.disconnect();
    this.bots.delete(accountId);
    logger.info({ accountId }, 'Bot disconnected');
  }

  async sendCommand(accountId: string, cmd: string, userId: string): Promise<void> {
    const instance = this.getOwnedBot(accountId, userId);
    if (!instance) {
      throw new Error(`No bot found for account ${accountId}`);
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

  private getOwnedBot(accountId: string, userId: string): BotInstance | undefined {
    const instance = this.bots.get(accountId);
    if (!instance) return undefined;
    if (isAdminUserId(userId)) return instance;
    if (instance.ownerUserId !== userId) return undefined;
    return instance;
  }
}

export const botManager = new BotManager();
