import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

type Status = 'verifying' | 'success' | 'error';

export default function Confirm() {
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function handleConfirmation() {
      // supabase auth will automatically pick up the token_hash and type
      // from the URL fragment/query params when using PKCE or token-based confirmation
      const { error } = await supabase.auth.getSession();

      if (error) {
        setStatus('error');
        setErrorMsg(error.message.toLowerCase());
        return;
      }

      // check if the hash contains access_token (implicit flow redirect)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // supabase client auto-handles this via onAuthStateChange
        setStatus('success');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
        return;
      }

      // check for token_hash in query params (PKCE / email confirmation)
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type = params.get('type');

      if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'email' | 'signup' | 'recovery',
        });

        if (verifyError) {
          setStatus('error');
          setErrorMsg(verifyError.message.toLowerCase());
        } else {
          setStatus('success');
          setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
        }
        return;
      }

      // if we got here with no tokens, check if already logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setStatus('success');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      } else {
        setStatus('error');
        setErrorMsg('invalid or expired confirmation link');
      }
    }

    handleConfirmation();
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-base px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-surface1) 1px, transparent 1px), linear-gradient(90deg, var(--color-surface1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm text-center"
      >
        <Link to="/" className="mb-12 block">
          <span className="text-2xl font-bold tracking-tight text-text transition-colors duration-200 hover:text-lavender">
            afkr.
          </span>
        </Link>

        {status === 'verifying' && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="mx-auto mb-4 h-5 w-5 animate-spin rounded-full border-2 border-surface1 border-t-lavender" />
            <p className="text-sm text-subtext0">verifying your email...</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-green/10"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <p className="text-sm text-green">email confirmed</p>
            <p className="mt-2 text-xs text-subtext0">redirecting to dashboard...</p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red/10"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </motion.div>
            <p className="text-sm text-red">{errorMsg || 'confirmation failed'}</p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <Link
                to="/login"
                className="text-xs text-subtext0 transition-colors hover:text-lavender"
              >
                back to sign in
              </Link>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
