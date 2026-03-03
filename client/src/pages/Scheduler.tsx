import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Loader2, Plus } from 'lucide-react';
import {
  getSchedules,
  createSchedule,
  deleteSchedule,
  toggleSchedule,
  getAccounts,
  getServers,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';
import type { ScheduledCommand } from '@afkr/shared';

const TRIGGER_TYPES = [
  { value: 'delay', label: 'delay (ms)' },
  { value: 'interval', label: 'interval (ms)' },
  { value: 'cron', label: 'cron' },
  { value: 'one_time', label: 'one-time (ISO date)' },
] as const;

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export default function Scheduler() {
  const [showForm, setShowForm] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [serverId, setServerId] = useState('');
  const [command, setCommand] = useState('');
  const [triggerType, setTriggerType] = useState<ScheduledCommand['trigger_type']>('interval');
  const [triggerValue, setTriggerValue] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: getSchedules,
  });
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const { data: servers } = useQuery({ queryKey: ['servers'], queryFn: getServers });

  const createMut = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast('schedule created', 'success');
      resetForm();
    },
    onError: () => toast('failed to create schedule', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast('schedule deleted', 'success');
    },
    onError: () => toast('failed to delete schedule', 'error'),
  });

  const toggleMut = useMutation({
    mutationFn: toggleSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: () => toast('failed to toggle schedule', 'error'),
  });

  function resetForm() {
    setAccountId('');
    setServerId('');
    setCommand('');
    setTriggerType('interval');
    setTriggerValue('');
    setShowForm(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !serverId || !command.trim() || !triggerValue.trim()) {
      toast('fill in all fields', 'error');
      return;
    }
    createMut.mutate({
      account_id: accountId,
      server_id: serverId,
      command: command.trim(),
      trigger_type: triggerType,
      trigger_value: triggerValue.trim(),
    });
  }

  return (
    <PageTransition>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-surface0 pb-6">
        <h1 className="text-lg font-semibold text-text">scheduler</h1>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-lavender transition-opacity hover:opacity-70"
        >
          <motion.span
            animate={{ rotate: showForm ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Plus size={14} />
          </motion.span>
          {showForm ? 'close' : 'add schedule'}
        </motion.button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 },
            }}
            onSubmit={handleSubmit}
            className="mb-8 overflow-hidden"
          >
            <div className="space-y-4 pb-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-overlay1">account</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full text-sm"
                  >
                    <option value="">select account...</option>
                    {accounts?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-overlay1">server</label>
                  <select
                    value={serverId}
                    onChange={(e) => setServerId(e.target.value)}
                    className="w-full text-sm"
                  >
                    <option value="">select server...</option>
                    {servers?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-overlay1">command</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="/say hello"
                  className="w-full text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-overlay1">trigger type</label>
                  <select
                    value={triggerType}
                    onChange={(e) =>
                      setTriggerType(e.target.value as ScheduledCommand['trigger_type'])
                    }
                    className="w-full text-sm"
                  >
                    {TRIGGER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-overlay1">trigger value</label>
                  <input
                    type="text"
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(e.target.value)}
                    placeholder={
                      triggerType === 'cron'
                        ? '*/5 * * * *'
                        : triggerType === 'one_time'
                          ? '2026-03-03T12:00:00Z'
                          : '30000'
                    }
                    className="w-full text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <motion.button
                  type="submit"
                  disabled={createMut.isPending}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-xs font-medium text-lavender transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  create
                </motion.button>
                <motion.button
                  type="button"
                  onClick={resetForm}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-xs text-overlay1 transition-colors hover:text-text"
                >
                  cancel
                </motion.button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Schedule List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-subtext0">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !schedules || schedules.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <p className="text-sm text-subtext0">no scheduled commands</p>
        </motion.div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          <AnimatePresence>
            {schedules.map((sched: ScheduledCommand) => {
              const account = accounts?.find((a) => a.id === sched.account_id);
              const server = servers?.find((s) => s.id === sched.server_id);
              return (
                <motion.div
                  key={sched.id}
                  layout
                  variants={itemVariants}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 28,
                  }}
                  className="group flex items-center justify-between border-b border-surface0 py-4 transition-colors duration-150 hover:bg-surface0/30"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <code className="text-sm font-medium text-text">{sched.command}</code>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs ${
                          sched.enabled
                            ? 'bg-green/10 text-green'
                            : 'bg-surface0 text-overlay0'
                        }`}
                      >
                        {sched.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-overlay1">
                      <span>{account?.username ?? 'unknown'}</span>
                      <span>{server?.name ?? 'unknown'}</span>
                      <span>
                        {sched.trigger_type}: {sched.trigger_value}
                      </span>
                      {sched.last_run_at && (
                        <span>Last: {new Date(sched.last_run_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Toggle */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleMut.mutate(sched.id)}
                      disabled={toggleMut.isPending}
                      className="relative h-5 w-9 rounded-full transition-colors duration-200"
                      style={{
                        backgroundColor: sched.enabled ? '#b4befe' : '#45475a',
                      }}
                      title={sched.enabled ? 'disable' : 'enable'}
                    >
                      <motion.span
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-crust"
                        animate={{
                          left: sched.enabled ? 18 : 2,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => deleteMut.mutate(sched.id)}
                      disabled={deleteMut.isPending}
                      className="rounded p-2 text-overlay1 opacity-0 transition-all group-hover:opacity-100 hover:text-red"
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </PageTransition>
  );
}
