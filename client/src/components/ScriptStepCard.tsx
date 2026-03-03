import { motion } from 'framer-motion';
import { Trash2, GripVertical } from 'lucide-react';
import type { ScriptStep, ScriptAction } from '@afkr/shared';

const ACTION_OPTIONS: { value: ScriptAction; label: string }[] = [
  { value: 'move', label: 'move' },
  { value: 'jump', label: 'jump' },
  { value: 'look', label: 'look' },
  { value: 'command', label: 'command' },
  { value: 'wait', label: 'wait' },
  { value: 'attack', label: 'attack' },
  { value: 'use', label: 'use item' },
  { value: 'place', label: 'place' },
  { value: 'sneak', label: 'sneak' },
  { value: 'sprint', label: 'sprint' },
  { value: 'swap_hands', label: 'swap hands' },
  { value: 'drop', label: 'drop' },
  { value: 'loop', label: 'loop' },
];

const DIRECTION_OPTIONS = ['forward', 'back', 'left', 'right'] as const;

interface Props {
  step: ScriptStep;
  index: number;
  onChange: (index: number, step: ScriptStep) => void;
  onRemove: (index: number) => void;
}

export default function ScriptStepCard({ step, index, onChange, onRemove }: Props) {
  function updateParam(key: string, value: unknown) {
    onChange(index, {
      ...step,
      params: { ...step.params, [key]: value },
    });
  }

  function updateAction(action: ScriptAction) {
    // Reset params when action changes
    const defaults: Record<ScriptAction, Record<string, unknown>> = {
      move: { direction: 'forward', duration_ms: 400 },
      jump: {},
      look: { yaw_delta: 0, pitch_delta: 0 },
      command: { text: '' },
      wait: { ms: 1000 },
      attack: {},
      use: { hand: 'right' },
      place: {},
      sneak: { enabled: true, duration_ms: 1000 },
      sprint: { enabled: true, duration_ms: 1000 },
      swap_hands: {},
      drop: { all: false },
      loop: { times: 2, steps: [] },
    };
    onChange(index, { action, params: defaults[action] ?? {} });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex items-start gap-2 rounded-lg border border-surface0 bg-mantle p-3"
    >
      <div className="mt-1 cursor-grab text-overlay0">
        <GripVertical size={14} />
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-overlay0 tabular-nums">
            #{index + 1}
          </span>
          <select
            value={step.action}
            onChange={(e) => updateAction(e.target.value as ScriptAction)}
            className="flex-1 text-xs"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Contextual param inputs */}
        {step.action === 'move' && (
          <div className="flex gap-2">
            <select
              value={String(step.params.direction || 'forward')}
              onChange={(e) => updateParam('direction', e.target.value)}
              className="flex-1 text-xs"
            >
              {DIRECTION_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              type="number"
              value={Number(step.params.duration_ms) || 400}
              onChange={(e) => updateParam('duration_ms', Number(e.target.value))}
              placeholder="ms"
              min={100}
              max={5000}
              className="w-20 text-xs"
            />
          </div>
        )}

        {step.action === 'look' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] text-overlay0">yaw</label>
              <input
                type="number"
                step={0.1}
                value={Number(step.params.yaw_delta) || 0}
                onChange={(e) => updateParam('yaw_delta', Number(e.target.value))}
                className="w-full text-xs"
              />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] text-overlay0">pitch</label>
              <input
                type="number"
                step={0.1}
                value={Number(step.params.pitch_delta) || 0}
                onChange={(e) => updateParam('pitch_delta', Number(e.target.value))}
                className="w-full text-xs"
              />
            </div>
          </div>
        )}

        {step.action === 'command' && (
          <input
            type="text"
            value={String(step.params.text || '')}
            onChange={(e) => updateParam('text', e.target.value)}
            placeholder="/say hello"
            className="w-full text-xs"
          />
        )}

        {step.action === 'wait' && (
          <input
            type="number"
            value={Number(step.params.ms) || 1000}
            onChange={(e) => updateParam('ms', Number(e.target.value))}
            placeholder="milliseconds"
            min={0}
            max={60000}
            className="w-full text-xs"
          />
        )}

        {step.action === 'use' && (
          <select
            value={String(step.params.hand || 'right')}
            onChange={(e) => updateParam('hand', e.target.value)}
            className="w-full text-xs"
          >
            <option value="right">right hand</option>
            <option value="left">left hand</option>
          </select>
        )}

        {step.action === 'sneak' && (
          <div className="flex gap-2">
            <select
              value={step.params.enabled ? 'true' : 'false'}
              onChange={(e) => updateParam('enabled', e.target.value === 'true')}
              className="flex-1 text-xs"
            >
              <option value="true">start</option>
              <option value="false">stop</option>
            </select>
            <input
              type="number"
              value={Number(step.params.duration_ms) || ''}
              onChange={(e) => updateParam('duration_ms', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="duration (ms)"
              min={100}
              max={10000}
              className="w-28 text-xs"
            />
          </div>
        )}

        {step.action === 'sprint' && (
          <div className="flex gap-2">
            <select
              value={step.params.enabled ? 'true' : 'false'}
              onChange={(e) => updateParam('enabled', e.target.value === 'true')}
              className="flex-1 text-xs"
            >
              <option value="true">start</option>
              <option value="false">stop</option>
            </select>
            <input
              type="number"
              value={Number(step.params.duration_ms) || ''}
              onChange={(e) => updateParam('duration_ms', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="duration (ms)"
              min={100}
              max={10000}
              className="w-28 text-xs"
            />
          </div>
        )}

        {step.action === 'drop' && (
          <div className="flex gap-2">
            <input
              type="number"
              value={step.params.slot !== undefined ? Number(step.params.slot) : ''}
              onChange={(e) => updateParam('slot', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="slot (optional)"
              min={0}
              max={44}
              className="flex-1 text-xs"
            />
            <label className="flex items-center gap-1 text-xs text-overlay1">
              <input
                type="checkbox"
                checked={Boolean(step.params.all)}
                onChange={(e) => updateParam('all', e.target.checked)}
                className="h-3 w-3"
              />
              all
            </label>
          </div>
        )}

        {step.action === 'loop' && (
          <div>
            <input
              type="number"
              value={Number(step.params.times) || 2}
              onChange={(e) => updateParam('times', Number(e.target.value))}
              placeholder="iterations"
              min={1}
              max={100}
              className="w-full text-xs"
            />
            <p className="mt-1 text-[10px] text-overlay0">
              {Array.isArray(step.params.steps) ? (step.params.steps as unknown[]).length : 0} inner steps
            </p>
          </div>
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onRemove(index)}
        className="mt-1 rounded p-1 text-overlay0 transition-colors hover:text-red"
      >
        <Trash2 size={14} />
      </motion.button>
    </motion.div>
  );
}
