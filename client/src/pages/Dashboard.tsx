import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useSocket } from '@/context/SocketContext';
import { getAccounts } from '@/lib/api';
import BotCard from '@/components/BotCard';
import PageTransition from '@/components/PageTransition';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export default function Dashboard() {
  const { botStates } = useSocket();
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    if (accounts) {
      for (const a of accounts) {
        map.set(a.id, a.username);
      }
    }
    return map;
  }, [accounts]);

  const states = Array.from(botStates.values());
  const onlineCount = states.filter((s) => s.status === 'online').length;

  return (
    <PageTransition>
      {/* Header */}
      <div className="mb-8 border-b border-surface0 pb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-text">dashboard</h1>
          {states.length > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-md bg-surface0 px-2 py-0.5 text-xs text-lavender"
            >
              {onlineCount} online
            </motion.span>
          )}
        </div>
        <p className="mt-1 text-xs text-subtext0">
          {states.length > 0
            ? `${states.length} bot${states.length !== 1 ? 's' : ''} tracked`
            : 'no active bots'}
        </p>
      </div>

      {states.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <p className="mb-3 text-sm text-subtext0">no bots connected</p>
          <Link
            to="/controls"
            className="text-sm text-lavender transition-colors hover:text-blue"
          >
            go to controls &rarr;
          </Link>
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence>
            {states.map((state, i) => (
              <BotCard
                key={state.account_id}
                state={state}
                username={accountMap.get(state.account_id) ?? 'unknown'}
                index={i}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </PageTransition>
  );
}
