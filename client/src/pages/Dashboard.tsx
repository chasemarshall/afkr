import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Plug, Loader2 } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import { getAccounts, getServers } from '@/lib/api';
import { socket } from '@/lib/socket';
import { useToast } from '@/components/Toast';
import BotCard from '@/components/BotCard';
import Skeleton from '@/components/Skeleton';
import PageTransition from '@/components/PageTransition';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

function BotCardSkeleton() {
  return (
    <div className="border-b border-surface0 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="h-3 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-1 w-full rounded-full" />
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export default function Dashboard() {
  const { botStates } = useSocket();
  const { toast } = useToast();
  const { data: accounts, isLoading } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const { data: servers } = useQuery({ queryKey: ['servers'], queryFn: getServers });

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

  // Find accounts that aren't currently tracked (not connected / not connecting)
  const disconnectedAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => {
      const state = botStates.get(a.id);
      return !state || state.status === 'offline' || state.status === 'error';
    });
  }, [accounts, botStates]);

  function handleQuickConnect(accountId: string, serverId: string) {
    socket.emit('bot:connect', { account_id: accountId, server_id: serverId });
    toast('connecting...', 'info');
  }

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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <BotCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Active bots */}
          {states.length > 0 && (
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

          {/* Quick connect for disconnected accounts */}
          {disconnectedAccounts.length > 0 && servers && servers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
              className={states.length > 0 ? 'mt-8' : ''}
            >
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-subtext0">
                {states.length > 0 ? 'connect more' : 'quick connect'}
              </h2>
              <div className="space-y-0">
                {disconnectedAccounts.map((account) => {
                  const state = botStates.get(account.id);
                  const isConnecting = state?.status === 'connecting';
                  return (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between border-b border-surface0 py-3 transition-colors duration-150 hover:bg-surface0/30"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-text">{account.username}</span>
                        {state?.error && (
                          <span className="text-xs text-red">{state.error}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isConnecting ? (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => socket.emit('bot:disconnect', account.id)}
                            className="flex items-center gap-1.5 text-xs text-yellow transition-colors hover:text-red"
                          >
                            <Loader2 size={12} className="animate-spin" />
                            cancel
                          </motion.button>
                        ) : (
                          servers.map((server) => (
                            <motion.button
                              key={server.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleQuickConnect(account.id, server.id)}
                              className="flex items-center gap-1.5 rounded-md bg-surface0/50 px-2.5 py-1.5 text-xs text-subtext0 transition-colors hover:bg-surface0 hover:text-lavender"
                            >
                              <Plug size={11} />
                              {server.name}
                            </motion.button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Empty state — no accounts at all */}
          {(!accounts || accounts.length === 0) && states.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <p className="mb-1 text-sm text-subtext0">no accounts yet</p>
              <p className="mb-4 text-xs text-overlay0">add an account and a server to get started</p>
              <div className="flex gap-4">
                <Link
                  to="/accounts"
                  className="text-sm text-lavender transition-colors hover:text-blue"
                >
                  add account &rarr;
                </Link>
                <Link
                  to="/controls"
                  className="text-sm text-lavender transition-colors hover:text-blue"
                >
                  add server &rarr;
                </Link>
              </div>
            </motion.div>
          )}

          {/* Has accounts but no servers */}
          {accounts && accounts.length > 0 && (!servers || servers.length === 0) && states.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <p className="mb-1 text-sm text-subtext0">no servers added</p>
              <p className="mb-4 text-xs text-overlay0">add a server to connect your accounts</p>
              <Link
                to="/controls"
                className="text-sm text-lavender transition-colors hover:text-blue"
              >
                add server &rarr;
              </Link>
            </motion.div>
          )}
        </>
      )}
    </PageTransition>
  );
}
