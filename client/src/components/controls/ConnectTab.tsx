import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Check, X, Plug, Unplug } from 'lucide-react';
import { getAccounts, getServers, createServer, deleteServer, updateServer } from '@/lib/api';
import { socket } from '@/lib/socket';
import { useSocket } from '@/context/SocketContext';
import { useActiveBot } from '@/context/ActiveBotContext';
import { useToast } from '@/components/Toast';
import StatusIndicator from '@/components/StatusIndicator';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { Server } from '@afkr/shared';

const MC_VERSIONS = [
  '1.21.11', '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5',
  '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
  '1.18.2', '1.18.1', '1.18',
  '1.17.1', '1.17',
  '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
  '1.12.2', '1.8.9',
];

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function ConnectTab() {
  const { selectedAccountId, selectedServerId, setSelectedAccount, setSelectedServer } = useActiveBot();
  const [showAddServer, setShowAddServer] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [serverVersion, setServerVersion] = useState('');
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHost, setEditHost] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Server | null>(null);
  const queryClient = useQueryClient();
  const { botStates } = useSocket();
  const { toast } = useToast();

  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const { data: servers } = useQuery({ queryKey: ['servers'], queryFn: getServers });

  const createServerMut = useMutation({
    mutationFn: createServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast('server added', 'success');
      setServerName('');
      setServerHost('');
      setServerVersion('');
      setShowAddServer(false);
    },
    onError: () => toast('failed to add server', 'error'),
  });

  const deleteServerMut = useMutation({
    mutationFn: deleteServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast('server deleted', 'success');
    },
    onError: () => toast('failed to delete server', 'error'),
  });

  const updateServerMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateServer>[1] }) =>
      updateServer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast('server updated', 'success');
      setEditingServer(null);
    },
    onError: () => toast('failed to update server', 'error'),
  });

  function handleConnect(): void {
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

  function handleDisconnect(): void {
    if (!selectedAccountId) {
      toast('select an account', 'error');
      return;
    }
    socket.emit('bot:disconnect', selectedAccountId);
    toast('disconnecting...', 'info');
  }

  function startEditServer(s: Server): void {
    setEditingServer(s.id);
    setEditName(s.name);
    setEditHost(s.host);
    setEditVersion(s.version || '');
  }

  function handleSaveServer(id: string): void {
    if (!editName.trim() || !editHost.trim()) {
      toast('name and host are required', 'error');
      return;
    }
    updateServerMut.mutate({
      id,
      data: {
        name: editName.trim(),
        host: editHost.trim(),
        port: 25565,
        version: editVersion || undefined,
      },
    });
  }

  function handleAddServer(e: React.FormEvent): void {
    e.preventDefault();
    if (!serverName.trim() || !serverHost.trim()) {
      toast('name and host are required', 'error');
      return;
    }
    createServerMut.mutate({
      name: serverName.trim(),
      host: serverHost.trim(),
      port: 25565,
      version: serverVersion || undefined,
    });
  }

  return (
    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
    >
      {/* Servers */}
      <motion.section variants={sectionVariants} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-subtext0">servers</h2>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddServer(!showAddServer)}
            className="inline-flex items-center gap-1.5 text-xs text-lavender transition-colors hover:text-blue"
          >
            <motion.span
              animate={{ rotate: showAddServer ? 45 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Plus size={14} />
            </motion.span>
            {showAddServer ? 'close' : 'add server'}
          </motion.button>
        </div>

        <AnimatePresence>
          {showAddServer && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
              onSubmit={handleAddServer}
              className="mb-4 overflow-hidden"
            >
              <div className="space-y-3 py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-overlay1">name</label>
                    <input
                      type="text"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      placeholder="my server"
                      className="w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-overlay1">host</label>
                    <input
                      type="text"
                      value={serverHost}
                      onChange={(e) => setServerHost(e.target.value)}
                      placeholder="mc.example.com"
                      className="w-full text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-overlay1">version</label>
                  <select
                    value={serverVersion}
                    onChange={(e) => setServerVersion(e.target.value)}
                    className="w-full text-sm"
                  >
                    <option value="">auto-detect</option>
                    {MC_VERSIONS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <motion.button
                  type="submit"
                  disabled={createServerMut.isPending}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-xs font-medium text-lavender transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {createServerMut.isPending ? 'adding...' : 'add server'}
                </motion.button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {servers && servers.length > 0 ? (
          <div>
            {servers.map((s: Server) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b border-surface0 py-3 transition-colors duration-150 hover:bg-surface0/30"
              >
                <AnimatePresence mode="wait">
                  {editingServer === s.id ? (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="name"
                          className="w-full text-xs"
                          autoFocus
                        />
                        <input
                          value={editHost}
                          onChange={(e) => setEditHost(e.target.value)}
                          placeholder="host"
                          className="w-full text-xs"
                        />
                      </div>
                      <select
                        value={editVersion}
                        onChange={(e) => setEditVersion(e.target.value)}
                        className="w-full text-xs"
                      >
                        <option value="">auto-detect</option>
                        {MC_VERSIONS.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveServer(s.id)}
                          disabled={updateServerMut.isPending}
                          className="inline-flex items-center gap-1 text-xs text-green transition-opacity hover:opacity-70 disabled:opacity-40"
                        >
                          <Check size={12} />
                          save
                        </button>
                        <button
                          onClick={() => setEditingServer(null)}
                          className="inline-flex items-center gap-1 text-xs text-overlay1 transition-colors hover:text-text"
                        >
                          <X size={12} />
                          cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group flex items-center justify-between"
                    >
                      <div>
                        <span className="text-sm text-text">{s.name}</span>
                        <span className="ml-3 text-xs text-overlay1">
                          {s.host}
                          {s.version && <span className="ml-2 text-lavender">v{s.version}</span>}
                        </span>
                      </div>
                      <div className="flex gap-1 opacity-60 transition-all sm:opacity-0 sm:group-hover:opacity-100">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => startEditServer(s)}
                          className="rounded p-1.5 text-overlay1 hover:text-lavender"
                        >
                          <Pencil size={14} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setDeleteTarget(s)}
                          className="rounded p-1.5 text-overlay1 hover:text-red"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-overlay1">no servers added yet</p>
        )}
      </motion.section>

      <div className="border-t border-surface0" />

      {/* Connect */}
      <motion.section variants={sectionVariants} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-subtext0">connect</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs text-overlay1">account</label>
            <select
              value={selectedAccountId ?? ''}
              onChange={(e) => setSelectedAccount(e.target.value || null)}
              className="w-full text-sm"
            >
              <option value="">select account...</option>
              {accounts?.map((a) => {
                const state = botStates.get(a.id);
                return (
                  <option key={a.id} value={a.id}>
                    {a.username} {state ? `(${state.status})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-overlay1">server</label>
            <select
              value={selectedServerId ?? ''}
              onChange={(e) => setSelectedServer(e.target.value || null)}
              className="w-full text-sm"
            >
              <option value="">select server...</option>
              {servers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.host}) {s.version ? `[${s.version}]` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedAccountId && botStates.get(selectedAccountId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="mt-3 flex items-center gap-2 text-xs text-subtext0"
          >
            <StatusIndicator status={botStates.get(selectedAccountId)!.status} />
            <span>{botStates.get(selectedAccountId)!.status}</span>
          </motion.div>
        )}

        <div className="mt-4 flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConnect}
            className="inline-flex items-center gap-2 text-xs font-medium text-lavender transition-opacity hover:opacity-70"
          >
            <Plug size={14} />
            connect
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDisconnect}
            className="inline-flex items-center gap-2 text-xs font-medium text-overlay1 transition-colors hover:text-text"
          >
            <Unplug size={14} />
            disconnect
          </motion.button>
        </div>
      </motion.section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteServerMut.mutate(deleteTarget.id);
        }}
        title="delete server"
        message={`are you sure you want to delete "${deleteTarget?.name}"? this cannot be undone.`}
        confirmLabel="delete"
        variant="danger"
      />
    </motion.div>
  );
}
