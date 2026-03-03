import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { getAccounts, deleteAccount } from '@/lib/api';
import type { Account } from '@afkr/shared';
import AddAccountModal from '@/components/AddAccountModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Skeleton from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export default function Accounts() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const deleteMut = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast('account deleted', 'success');
    },
    onError: () => {
      toast('failed to delete account', 'error');
    },
  });

  return (
    <PageTransition>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-surface0 pb-6">
        <h1 className="text-lg font-semibold text-text">accounts</h1>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setModalOpen(true)}
          className="text-xs font-medium text-lavender transition-opacity hover:opacity-70"
        >
          add account
        </motion.button>
      </div>

      {isLoading ? (
        <div className="space-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-surface0 py-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <p className="mb-3 text-sm text-subtext0">no accounts yet</p>
          <button
            onClick={() => setModalOpen(true)}
            className="text-sm text-lavender transition-colors hover:text-blue"
          >
            add your first account
          </button>
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
            {accounts.map((account: Account) => (
              <motion.div
                key={account.id}
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
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-text">
                      {account.username}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-overlay1">
                    auto-reconnect:{' '}
                    <span className={account.auto_reconnect ? 'text-green' : 'text-overlay0'}>
                      {account.auto_reconnect ? 'on' : 'off'}
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setDeleteTarget(account)}
                  disabled={deleteMut.isPending}
                  className="rounded p-2 text-overlay1 opacity-60 transition-all hover:opacity-100 hover:text-red sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AddAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.id);
        }}
        title="delete account"
        message={`are you sure you want to delete "${deleteTarget?.username}"? this cannot be undone.`}
        confirmLabel="delete"
        variant="danger"
      />
    </PageTransition>
  );
}
