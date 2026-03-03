import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { BotState } from '@afkr/shared';
import StatusIndicator from '@/components/StatusIndicator';

interface Props {
  state: BotState;
  username: string;
  index?: number;
}

// catppuccin mocha hex values
const COLORS = {
  green: '#a6e3a1',
  yellow: '#f9e2af',
  red: '#f38ba8',
  peach: '#fab387',
  overlay0: '#6c7086',
  transparent: 'transparent',
} as const;

function getBarColor(pct: number, highColor: string): string {
  if (pct > 60) return highColor;
  if (pct >= 30) return COLORS.yellow;
  return COLORS.red;
}

const STATUS_FLASH: Record<string, string> = {
  online: COLORS.green,
  error: COLORS.red,
  offline: COLORS.overlay0,
};

export default function BotCard({ state, username, index = 0 }: Props) {
  const [showInventory, setShowInventory] = useState(false);
  const healthPct = Math.max(0, Math.min(100, (state.health / 20) * 100));
  const foodPct = Math.max(0, Math.min(100, (state.food / 20) * 100));
  const items = state.inventory ?? [];
  const borderControls = useAnimationControls();
  const prevStatusRef = useRef(state.status);

  // flash card border on status change
  useEffect(() => {
    if (prevStatusRef.current !== state.status) {
      const flashColor = STATUS_FLASH[state.status] ?? COLORS.overlay0;
      borderControls.start({
        boxShadow: [`0 0 0 1px ${flashColor}`, `0 0 12px 2px ${flashColor}`, '0 0 0 0px transparent'],
        transition: { duration: 0.8, ease: 'easeOut' },
      });
      prevStatusRef.current = state.status;
    }
  }, [state.status, borderControls]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 28,
        delay: index * 0.06,
      }}
      whileHover={{
        y: -2,
        transition: { type: 'spring', stiffness: 400, damping: 20 },
      }}
      className="group relative cursor-default border-b border-surface0 p-5 transition-colors duration-200 hover:bg-surface0/30"
    >
      {/* status flash overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={borderControls}
      />
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{username}</h3>
        <StatusIndicator status={state.status} showLabel />
      </div>

      {/* Server */}
      {state.server_name && (
        <p className="mb-3 text-xs text-subtext0">{state.server_name}</p>
      )}

      {/* Error */}
      {state.error && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-3 text-xs text-red"
        >
          {state.error}
        </motion.p>
      )}

      {/* Health */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-subtext0">health</span>
          <span className="text-xs text-subtext0">{state.health.toFixed(1)}/20</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-crust">
          <motion.div
            className="h-full rounded-full"
            initial={false}
            animate={{
              width: `${healthPct}%`,
              backgroundColor: getBarColor(healthPct, COLORS.green),
            }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          />
        </div>
      </div>

      {/* Food */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-subtext0">food</span>
          <span className="text-xs text-subtext0">{state.food.toFixed(1)}/20</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-crust">
          <motion.div
            className="h-full rounded-full"
            initial={false}
            animate={{
              width: `${foodPct}%`,
              backgroundColor: getBarColor(foodPct, COLORS.peach),
            }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          />
        </div>
      </div>

      {/* Position */}
      {state.position && (
        <div className="mb-3 text-xs text-overlay1">
          {state.position.x.toFixed(0)}, {state.position.y.toFixed(0)},{' '}
          {state.position.z.toFixed(0)}
        </div>
      )}

      {/* Inventory */}
      {state.status === 'online' && (
        <div>
          <button
            onClick={() => setShowInventory(!showInventory)}
            className="flex w-full items-center gap-1.5 text-xs text-overlay1 transition-colors hover:text-subtext0"
          >
            <motion.span
              animate={{ rotate: showInventory ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <ChevronDown size={12} />
            </motion.span>
            inventory
            {items.length > 0 && (
              <span className="text-overlay0">({items.length})</span>
            )}
          </button>
          <AnimatePresence>
            {showInventory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30, opacity: { duration: 0.15 } }}
                className="overflow-hidden"
              >
                {items.length === 0 ? (
                  <p className="py-3 text-xs text-overlay0">empty</p>
                ) : (
                  <div className="mt-2 grid grid-cols-6 gap-0.5 sm:grid-cols-9">
                    {items.map((item) => (
                      <motion.div
                        key={item.slot}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(item.slot * 0.01, 0.3) }}
                        title={`${item.display_name ?? item.name} x${item.count}`}
                        className="group/item relative flex aspect-square min-h-[32px] items-center justify-center bg-surface0/40 text-[10px] text-subtext0 transition-colors hover:bg-surface0 sm:min-h-0 sm:text-[9px]"
                      >
                        <span className="truncate px-0.5 leading-tight">{item.name.replace(/_/g, ' ').split(' ').pop()}</span>
                        {item.count > 1 && (
                          <span className="absolute bottom-0 right-0.5 text-[8px] text-lavender">
                            {item.count}
                          </span>
                        )}
                        {/* Tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-crust px-2 py-1 text-[10px] text-text opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100">
                          {item.display_name ?? item.name} x{item.count}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
