import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Loader2, Plus, Play } from 'lucide-react';
import {
  getScripts,
  createScript,
  updateScript,
  deleteScript,
  toggleScript,
  runScript,
  getAccounts,
  getServers,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageTransition from '@/components/PageTransition';
import ScriptBuilder from '@/components/ScriptBuilder';
import type { Script, CreateScriptPayload } from '@afkr/shared';

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export default function Scripts() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editTarget, setEditTarget] = useState<Script | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: scripts, isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: getScripts,
  });
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const { data: servers } = useQuery({ queryKey: ['servers'], queryFn: getServers });

  const createMut = useMutation({
    mutationFn: createScript,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      toast('script created', 'success');
      setShowBuilder(false);
      setEditTarget(null);
    },
    onError: () => toast('failed to create script', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateScriptPayload> }) =>
      updateScript(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      toast('script updated', 'success');
      setShowBuilder(false);
      setEditTarget(null);
    },
    onError: () => toast('failed to update script', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteScript,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      toast('script deleted', 'success');
    },
    onError: () => toast('failed to delete script', 'error'),
  });

  const toggleMut = useMutation({
    mutationFn: toggleScript,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
    },
    onError: () => toast('failed to toggle script', 'error'),
  });

  const runMut = useMutation({
    mutationFn: runScript,
    onSuccess: () => {
      toast('script started', 'success');
    },
    onError: () => toast('failed to run script', 'error'),
  });

  function handleSave(payload: CreateScriptPayload) {
    if (editTarget) {
      updateMut.mutate({ id: editTarget.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function openEdit(script: Script) {
    setEditTarget(script);
    setShowBuilder(true);
  }

  function openCreate() {
    setEditTarget(null);
    setShowBuilder(true);
  }

  return (
    <PageTransition>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-surface0 pb-6">
        <h1 className="text-lg font-semibold text-text">scripts</h1>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-lavender transition-opacity hover:opacity-70"
        >
          <Plus size={14} />
          new script
        </motion.button>
      </div>

      {/* Script List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-subtext0">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !scripts || scripts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <p className="text-sm text-subtext0">no scripts yet</p>
          <p className="mt-1 text-xs text-overlay0">
            create a script to automate bot actions
          </p>
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
            {scripts.map((script: Script) => {
              const account = accounts?.find((a) => a.id === script.account_id);
              const server = servers?.find((s) => s.id === script.server_id);
              return (
                <motion.div
                  key={script.id}
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
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => openEdit(script)}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium text-text">
                        {script.name}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs ${
                          script.enabled
                            ? 'bg-green/10 text-green'
                            : 'bg-surface0 text-overlay0'
                        }`}
                      >
                        {script.enabled ? 'enabled' : 'disabled'}
                      </span>
                      <span className="rounded-md bg-surface0 px-1.5 py-0.5 text-xs text-overlay1">
                        {script.steps.length} step{script.steps.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-overlay1">
                      {script.description && (
                        <span className="text-subtext0">{script.description}</span>
                      )}
                      <span>{account?.username ?? 'unknown'}</span>
                      <span>{server?.name ?? 'unknown'}</span>
                      <span>{script.trigger_type}{script.trigger_value ? `: ${script.trigger_value}` : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Run */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => runMut.mutate(script.id)}
                      disabled={runMut.isPending}
                      className="rounded p-2 text-lavender opacity-60 transition-all hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      title="run now"
                    >
                      <Play size={14} />
                    </motion.button>

                    {/* Toggle */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleMut.mutate(script.id)}
                      disabled={toggleMut.isPending}
                      className="relative h-5 w-9 rounded-full transition-colors duration-200"
                      style={{
                        backgroundColor: script.enabled ? '#b4befe' : '#45475a',
                      }}
                      title={script.enabled ? 'disable' : 'enable'}
                    >
                      <motion.span
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-crust"
                        animate={{
                          left: script.enabled ? 18 : 2,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    </motion.button>

                    {/* Delete */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setDeleteTarget(script)}
                      disabled={deleteMut.isPending}
                      className="rounded p-2 text-overlay1 opacity-60 transition-all hover:opacity-100 hover:text-red sm:opacity-0 sm:group-hover:opacity-100"
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

      {/* Script Builder Modal */}
      <ScriptBuilder
        open={showBuilder}
        onClose={() => {
          setShowBuilder(false);
          setEditTarget(null);
        }}
        onSave={handleSave}
        editScript={editTarget}
        isPending={createMut.isPending || updateMut.isPending}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.id);
        }}
        title="delete script"
        message={`are you sure you want to delete "${deleteTarget?.name}"? this cannot be undone.`}
        confirmLabel="delete"
        variant="danger"
      />
    </PageTransition>
  );
}
