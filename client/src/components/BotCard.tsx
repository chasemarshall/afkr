import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { BotState } from '@afkr/shared';
import StatusIndicator from '@/components/StatusIndicator';

interface Props {
  state: BotState;
  username: string;
  index?: number;
}

export default function BotCard({ state, username, index = 0 }: Props) {
  const [showInventory, setShowInventory] = useState(false);
  const healthPct = Math.max(0, Math.min(100, (state.health / 20) * 100));
  const foodPct = Math.max(0, Math.min(100, (state.food / 20) * 100));
  const items = state.inventory ?? [];

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
      className="group cursor-default border-b border-surface0 p-5 transition-colors duration-200 hover:bg-surface0/30"
    >
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
            className="h-full rounded-full bg-red"
            initial={false}
            animate={{ width: `${healthPct}%` }}
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
            className="h-full rounded-full bg-peach"
            initial={false}
            animate={{ width: `${foodPct}%` }}
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
                  <div className="mt-2 grid grid-cols-9 gap-0.5">
                    {items.map((item) => (
                      <motion.div
                        key={item.slot}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(item.slot * 0.01, 0.3) }}
                        title={`${item.display_name ?? item.name} x${item.count}`}
                        className="group/item relative flex aspect-square items-center justify-center bg-surface0/40 text-[9px] text-subtext0 transition-colors hover:bg-surface0"
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
