import { useQuery } from '@tanstack/react-query';
import { Plug, Unplug, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAccounts, getServers } from '@/lib/api';
import { useActiveBot } from '@/context/ActiveBotContext';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/components/Toast';
import { socket } from '@/lib/socket';
import StatusIndicator from '@/components/StatusIndicator';

export default function BotSelectorBar() {
  const { selectedAccountId, selectedServerId, setSelectedAccount, setSelectedServer } =
    useActiveBot();
  const { botStates } = useSocket();
  const { toast } = useToast();

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: getServers,
  });

  const activeBotState = selectedAccountId
    ? botStates.get(selectedAccountId)
    : undefined;

  const isOnline = activeBotState?.status === 'online';
  const isConnecting = activeBotState?.status === 'connecting';

  function handleConnect() {
    if (!selectedAccountId || !selectedServerId) {
      toast('select an account and server', 'error');
      return;
    }
    socket.emit('bot:connect', {
      account_id: selectedAccountId,
      server_id: selectedServerId,
    });
    toast('connecting...', 'info');
  }

  function handleDisconnect() {
    if (!selectedAccountId) return;
    socket.emit('bot:disconnect', selectedAccountId);
    toast('disconnecting...', 'info');
  }

  return (
    <div className="flex items-center gap-3 border-b border-surface0/50 bg-mantle/50 px-4 py-2 lg:px-6">
      <select
        value={selectedAccountId ?? ''}
        onChange={(e) => setSelectedAccount(e.target.value || null)}
        className="max-w-[140px] truncate bg-transparent text-xs text-text outline-none"
      >
        <option value="">account...</option>
        {accounts?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.username}
          </option>
        ))}
      </select>

      <span className="text-overlay0">/</span>

      <select
        value={selectedServerId ?? ''}
        onChange={(e) => setSelectedServer(e.target.value || null)}
        className="max-w-[140px] truncate bg-transparent text-xs text-text outline-none"
      >
        <option value="">server...</option>
        {servers?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-3">
        {activeBotState && (
          <div className="flex items-center gap-1.5">
            <StatusIndicator status={activeBotState.status} />
            <span className="text-[10px] text-subtext0">{activeBotState.status}</span>
          </div>
        )}

        {selectedAccountId && (
          isOnline ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDisconnect}
              title="disconnect"
              className="flex items-center gap-1 text-[10px] text-overlay1 transition-colors hover:text-red"
            >
              <Unplug size={12} />
              <span className="hidden sm:inline">disconnect</span>
            </motion.button>
          ) : isConnecting ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDisconnect}
              title="cancel connection"
              className="flex items-center gap-1 text-[10px] text-yellow transition-colors hover:text-red"
            >
              <Loader2 size={12} className="animate-spin" />
              <span className="hidden sm:inline">cancel</span>
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleConnect}
              title="connect"
              className="flex items-center gap-1 text-[10px] text-lavender transition-colors hover:text-blue"
            >
              <Plug size={12} />
              <span className="hidden sm:inline">connect</span>
            </motion.button>
          )
        )}
      </div>
    </div>
  );
}
