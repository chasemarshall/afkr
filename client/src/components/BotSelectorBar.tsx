import { useQuery } from '@tanstack/react-query';
import { getAccounts, getServers } from '@/lib/api';
import { useActiveBot } from '@/context/ActiveBotContext';
import { useSocket } from '@/context/SocketContext';
import StatusIndicator from '@/components/StatusIndicator';

export default function BotSelectorBar() {
  const { selectedAccountId, selectedServerId, setSelectedAccount, setSelectedServer } =
    useActiveBot();
  const { botStates } = useSocket();

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

      {activeBotState && (
        <div className="ml-auto flex items-center gap-2">
          <StatusIndicator status={activeBotState.status} />
          <span className="text-[10px] text-subtext0">
            {activeBotState.status}
          </span>
        </div>
      )}
    </div>
  );
}
