import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Send, X, Plus } from 'lucide-react';
import { getAccounts, getCommandHistory } from '@/lib/api';
import { socket } from '@/lib/socket';
import { useActiveBot } from '@/context/ActiveBotContext';
import { useToast } from '@/components/Toast';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { CommandHistoryEntry } from '@afkr/shared';

const DEFAULT_QUICK_COMMANDS = ['/list', '/tps', '/say hi'];

export default function CommandTab() {
  const { selectedAccountId } = useActiveBot();
  const [command, setCommand] = useState('');
  const [newQuickCmd, setNewQuickCmd] = useState('');
  const [showAddQuick, setShowAddQuick] = useState(false);
  const [quickCommands, setQuickCommands] = usePersistedState<string[]>(
    'quick-commands',
    DEFAULT_QUICK_COMMANDS,
  );
  const logRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['commandHistory'],
    queryFn: getCommandHistory,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [history]);

  function handleSendCommand(e: React.FormEvent): void {
    e.preventDefault();
    if (!selectedAccountId || !command.trim()) {
      toast('select an account and enter a command', 'error');
      return;
    }
    socket.emit('bot:command', { account_id: selectedAccountId, command: command.trim() });
    setCommand('');
    toast('command sent', 'success');
  }

  function handleQuickCommand(cmd: string): void {
    if (!selectedAccountId) {
      toast('select an account first', 'error');
      return;
    }
    socket.emit('bot:command', { account_id: selectedAccountId, command: cmd });
    toast('command sent', 'success');
  }

  function handleAddQuickCommand(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = newQuickCmd.trim();
    if (!trimmed) return;
    if (quickCommands.includes(trimmed)) {
      toast('command already exists', 'error');
      return;
    }
    setQuickCommands([...quickCommands, trimmed]);
    setNewQuickCmd('');
    setShowAddQuick(false);
  }

  function handleRemoveQuickCommand(cmd: string): void {
    setQuickCommands(quickCommands.filter((c) => c !== cmd));
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* Command input */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-subtext0">command</h2>
          {selectedAccountId ? (
            <span className="text-xs text-lavender">
              sending to: {accounts?.find((a) => a.id === selectedAccountId)?.username ?? 'unknown'}
            </span>
          ) : (
            <span className="text-xs text-yellow">
              select an account in the top bar
            </span>
          )}
        </div>
        <form onSubmit={handleSendCommand} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={selectedAccountId ? '/say hello' : 'select an account first...'}
            disabled={!selectedAccountId}
            className="w-full flex-1 text-sm disabled:opacity-40"
          />
          <motion.button
            type="submit"
            disabled={!selectedAccountId}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center gap-2 text-xs font-medium text-lavender transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            <Send size={14} />
            send
          </motion.button>
        </form>
      </div>

      {/* Quick commands */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-subtext0">quick commands</span>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddQuick(!showAddQuick)}
            className="inline-flex items-center gap-1 text-xs text-lavender transition-colors hover:text-blue"
          >
            <motion.span
              animate={{ rotate: showAddQuick ? 45 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Plus size={12} />
            </motion.span>
            add
          </motion.button>
        </div>

        {showAddQuick && (
          <form onSubmit={handleAddQuickCommand} className="mb-3 flex gap-2">
            <input
              type="text"
              value={newQuickCmd}
              onChange={(e) => setNewQuickCmd(e.target.value)}
              placeholder="/command"
              className="w-full flex-1 text-xs"
              autoFocus
            />
            <motion.button
              type="submit"
              whileTap={{ scale: 0.95 }}
              className="text-xs text-lavender transition-opacity hover:opacity-70"
            >
              add
            </motion.button>
          </form>
        )}

        <div className="flex flex-wrap gap-1.5">
          {quickCommands.map((cmd) => (
            <div
              key={cmd}
              className="group inline-flex items-center gap-1 rounded-full bg-surface0/50 px-2.5 py-1 text-xs text-subtext0 transition-colors hover:bg-surface0"
            >
              <button
                onClick={() => handleQuickCommand(cmd)}
                className="transition-colors hover:text-lavender"
              >
                {cmd}
              </button>
              <button
                onClick={() => handleRemoveQuickCommand(cmd)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={10} className="text-overlay0 hover:text-red" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-surface0" />

      {/* History */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-subtext0">
          history
          {historyLoading && <Loader2 size={12} className="animate-spin text-overlay1" />}
        </h2>
        <div ref={logRef} className="max-h-72 overflow-y-auto">
          {!history || history.length === 0 ? (
            <p className="py-8 text-center text-xs text-overlay1">no commands executed yet</p>
          ) : (
            <div>
              {history.map((entry: CommandHistoryEntry, i: number) => {
                const account = accounts?.find((a) => a.id === entry.account_id);
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className={`flex gap-3 px-3 py-2 text-xs ${
                      i % 2 === 0 ? 'bg-transparent' : 'bg-surface0/30'
                    }`}
                  >
                    <span className="shrink-0 text-overlay0">
                      {new Date(entry.executed_at).toLocaleTimeString()}
                    </span>
                    <span className="shrink-0 text-lavender">
                      {account?.username ?? 'unknown'}
                    </span>
                    <span
                      className={`shrink-0 ${
                        entry.source === 'scheduled' ? 'text-yellow' : 'text-green'
                      }`}
                    >
                      {entry.source}
                    </span>
                    <span className="text-text">{entry.command}</span>
                    {entry.response && (
                      <span className="text-overlay1">&rarr; {entry.response}</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
