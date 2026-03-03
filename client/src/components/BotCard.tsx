import { motion } from 'framer-motion';
import type { BotState } from '@afkr/shared';
import StatusIndicator from '@/components/StatusIndicator';

interface Props {
  state: BotState;
  username: string;
  index?: number;
}

export default function BotCard({ state, username, index = 0 }: Props) {
  const healthPct = Math.max(0, Math.min(100, (state.health / 20) * 100));
  const foodPct = Math.max(0, Math.min(100, (state.food / 20) * 100));

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
        <div className="text-xs text-overlay1">
          {state.position.x.toFixed(0)}, {state.position.y.toFixed(0)},{' '}
          {state.position.z.toFixed(0)}
        </div>
      )}
    </motion.div>
  );
}
