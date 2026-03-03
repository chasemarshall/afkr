import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAccount, startAccountAuth } from '@/lib/api';
import { socket } from '@/lib/socket';
import { useToast } from '@/components/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export default function AddAccountModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [deviceCode, setDeviceCode] = useState<{
    user_code: string;
    verification_uri: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: { username: string; microsoft_email: string }) => {
      // Step 1: Create the account
      const account = await createAccount(data);
      setWaitingForAuth(true);

      // Step 2: Start the Microsoft auth flow
      try {
        const authData = await startAccountAuth(account.id);
        // Got the device code from REST — show it
        setDeviceCode({
          user_code: authData.user_code,
          verification_uri: authData.verification_uri,
        });
      } catch {
        // Auth flow might emit device code via socket instead, or it may have
        // cached tokens and completed instantly — keep waiting
      }

      return account;
    },
    onError: (err: unknown) => {
      setWaitingForAuth(false);
      // Extract meaningful error from axios response
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number } };
      const serverMsg = axiosErr?.response?.data?.error;
      toast(serverMsg || 'failed to create account', 'error');
    },
  });

  useEffect(() => {
    if (!open) return;

    function onDeviceCode(data: {
      account_id: string;
      user_code: string;
      verification_uri: string;
    }) {
      setDeviceCode({
        user_code: data.user_code,
        verification_uri: data.verification_uri,
      });
    }

    function onAuthComplete(data: { account_id: string; username: string }) {
      toast(`authenticated as ${data.username}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleClose();
    }

    function onAuthError(data: { account_id: string; error: string }) {
      toast(`auth failed: ${data.error}`, 'error');
      setWaitingForAuth(false);
      setDeviceCode(null);
    }

    socket.on('auth:device_code', onDeviceCode);
    socket.on('auth:complete', onAuthComplete);
    socket.on('auth:error', onAuthError);

    return () => {
      socket.off('auth:device_code', onDeviceCode);
      socket.off('auth:complete', onAuthComplete);
      socket.off('auth:error', onAuthError);
    };
  }, [open, queryClient, toast]);

  function handleClose() {
    setEmail('');
    setDeviceCode(null);
    setCopied(false);
    setWaitingForAuth(false);
    mutation.reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    mutation.mutate({ username: email.split('@')[0] ?? email, microsoft_email: email });
  }

  async function copyCode() {
    if (!deviceCode) return;
    await navigator.clipboard.writeText(deviceCode.user_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-crust/70 backdrop-blur-sm"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          onClick={handleClose}
        >
          <motion.div
            className="w-full max-w-md bg-mantle p-6 shadow-2xl shadow-crust/50"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 30,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">add account</h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClose}
                className="rounded-md p-1 text-overlay1 transition-colors hover:bg-surface0 hover:text-text"
              >
                <X size={18} />
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {!deviceCode ? (
                <motion.form
                  key="email-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSubmit}
                >
                  <label className="mb-1.5 block text-xs text-subtext0">
                    microsoft email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="mb-4 w-full text-sm"
                    required
                    disabled={mutation.isPending || waitingForAuth}
                    autoFocus
                  />
                  <motion.button
                    type="submit"
                    disabled={mutation.isPending || waitingForAuth || !email.trim()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-sm font-medium text-lavender transition-opacity hover:opacity-70 disabled:opacity-40"
                  >
                    {mutation.isPending || waitingForAuth ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        waiting for auth...
                      </span>
                    ) : (
                      'add account'
                    )}
                  </motion.button>
                </motion.form>
              ) : (
                <motion.div
                  key="device-code"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 28,
                  }}
                  className="text-center"
                >
                  <p className="mb-4 text-sm text-subtext0">
                    enter this code at the microsoft login page:
                  </p>
                  <div className="mb-4 flex items-center justify-center gap-2">
                    <motion.code
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                      className="border-b border-lavender/30 px-4 py-2 text-xl font-semibold tracking-widest text-lavender"
                    >
                      {deviceCode.user_code}
                    </motion.code>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={copyCode}
                      className="p-2 text-overlay1 transition-colors hover:text-text"
                    >
                      {copied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                    </motion.button>
                  </div>
                  <a
                    href={deviceCode.verification_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-lavender underline underline-offset-2 transition-colors hover:text-blue"
                  >
                    open microsoft login
                    <ExternalLink size={12} />
                  </a>
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-xs text-subtext0">
                      <Loader2 size={12} className="animate-spin" />
                      waiting for authentication...
                    </div>
                    <p className="text-[11px] text-overlay0">
                      enter the code above, then sign in with your microsoft account
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
