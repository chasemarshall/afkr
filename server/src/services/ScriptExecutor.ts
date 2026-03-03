import pino from 'pino';
import { BotInstance } from './BotInstance.js';
import type { ScriptStep, MovementDirection } from '@afkr/shared';

const logger = pino({ name: 'ScriptExecutor' });

const MAX_STEPS = 200;
const MAX_TOTAL_WAIT_MS = 60_000;
const MAX_LOOP_DEPTH = 5;
const MAX_LOOP_ITERATIONS = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countSteps(steps: ScriptStep[]): number {
  let count = 0;
  for (const step of steps) {
    count += 1;
    if (step.action === 'loop' && Array.isArray(step.params.steps)) {
      count += countSteps(step.params.steps as ScriptStep[]);
    }
  }
  return count;
}

function countTotalWait(steps: ScriptStep[]): number {
  let total = 0;
  for (const step of steps) {
    if (step.action === 'wait') {
      total += Math.max(0, Number(step.params.ms) || 0);
    }
    if (step.action === 'move') {
      total += Math.max(0, Number(step.params.duration_ms) || 400);
    }
    if (step.action === 'sneak' && step.params.duration_ms) {
      total += Math.max(0, Number(step.params.duration_ms) || 0);
    }
    if (step.action === 'sprint' && step.params.duration_ms) {
      total += Math.max(0, Number(step.params.duration_ms) || 0);
    }
    if (step.action === 'loop' && Array.isArray(step.params.steps)) {
      const times = Math.min(Number(step.params.times) || 1, MAX_LOOP_ITERATIONS);
      total += countTotalWait(step.params.steps as ScriptStep[]) * times;
    }
  }
  return total;
}

export interface ScriptProgress {
  step: number;
  total: number;
}

export type ProgressCallback = (progress: ScriptProgress) => void;

export class ScriptExecutor {
  private stepIndex = 0;
  private totalSteps = 0;
  private onProgress: ProgressCallback | null = null;

  validate(steps: ScriptStep[]): string | null {
    const stepCount = countSteps(steps);
    if (stepCount > MAX_STEPS) {
      return `script exceeds maximum of ${MAX_STEPS} steps (has ${stepCount})`;
    }

    const totalWait = countTotalWait(steps);
    if (totalWait > MAX_TOTAL_WAIT_MS) {
      return `script exceeds maximum total wait of ${MAX_TOTAL_WAIT_MS}ms (has ${totalWait}ms)`;
    }

    return null;
  }

  async execute(
    bot: BotInstance,
    steps: ScriptStep[],
    progressCb?: ProgressCallback
  ): Promise<void> {
    const validationError = this.validate(steps);
    if (validationError) {
      throw new Error(validationError);
    }

    this.stepIndex = 0;
    this.totalSteps = countSteps(steps);
    this.onProgress = progressCb ?? null;

    await this.runSteps(bot, steps, 0);
  }

  private async runSteps(
    bot: BotInstance,
    steps: ScriptStep[],
    depth: number
  ): Promise<void> {
    for (const step of steps) {
      if (bot.getStatus() !== 'online') {
        throw new Error('Bot disconnected during script execution');
      }

      await this.executeStep(bot, step, depth);
      this.stepIndex++;
      this.onProgress?.({ step: this.stepIndex, total: this.totalSteps });
    }
  }

  private async executeStep(
    bot: BotInstance,
    step: ScriptStep,
    depth: number
  ): Promise<void> {
    switch (step.action) {
      case 'move': {
        const direction = String(step.params.direction || 'forward') as MovementDirection;
        const duration = Math.min(Math.max(Number(step.params.duration_ms) || 400, 100), 5000);
        bot.move(direction, duration);
        await delay(duration);
        break;
      }

      case 'jump': {
        bot.jump();
        await delay(300);
        break;
      }

      case 'look': {
        const yaw = Number(step.params.yaw_delta) || 0;
        const pitch = Number(step.params.pitch_delta) || 0;
        bot.look(yaw, pitch);
        break;
      }

      case 'command': {
        const text = String(step.params.text || '');
        if (text) bot.sendCommand(text);
        break;
      }

      case 'wait': {
        const ms = Math.min(Math.max(Number(step.params.ms) || 0, 0), MAX_TOTAL_WAIT_MS);
        await delay(ms);
        break;
      }

      case 'attack': {
        bot.attack();
        break;
      }

      case 'use': {
        const hand = step.params.hand === 'left' ? 'left' : 'right';
        bot.useItem(hand);
        break;
      }

      case 'place': {
        bot.placeBlock();
        break;
      }

      case 'sneak': {
        const enabled = Boolean(step.params.enabled);
        bot.setSneaking(enabled);
        if (step.params.duration_ms) {
          const dur = Math.min(Math.max(Number(step.params.duration_ms), 100), 10000);
          await delay(dur);
          bot.setSneaking(false);
        }
        break;
      }

      case 'sprint': {
        const sprintEnabled = Boolean(step.params.enabled);
        bot.setSprinting(sprintEnabled);
        if (step.params.duration_ms) {
          const dur = Math.min(Math.max(Number(step.params.duration_ms), 100), 10000);
          await delay(dur);
          bot.setSprinting(false);
        }
        break;
      }

      case 'swap_hands': {
        bot.swapHands();
        break;
      }

      case 'drop': {
        const slot = step.params.slot !== undefined ? Number(step.params.slot) : undefined;
        const all = Boolean(step.params.all);
        bot.dropItem(slot, all);
        break;
      }

      case 'loop': {
        if (depth >= MAX_LOOP_DEPTH) {
          throw new Error(`Maximum loop nesting depth of ${MAX_LOOP_DEPTH} exceeded`);
        }
        const times = Math.min(Math.max(Number(step.params.times) || 1, 1), MAX_LOOP_ITERATIONS);
        const innerSteps = Array.isArray(step.params.steps) ? step.params.steps as ScriptStep[] : [];
        for (let i = 0; i < times; i++) {
          await this.runSteps(bot, innerSteps, depth + 1);
        }
        break;
      }

      default:
        logger.warn({ action: step.action }, 'Unknown script action, skipping');
    }
  }
}
