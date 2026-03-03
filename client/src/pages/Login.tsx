import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

type Mode = 'signin' | 'signup';

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-base">
        <span className="text-sm text-subtext0 animate-pulse">loading...</span>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: authError } =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password);

    setSubmitting(false);

    if (authError) {
      setError(authError.message.toLowerCase());
    } else if (mode === 'signup') {
      setSignUpSuccess(true);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setSignUpSuccess(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-base px-6">
      {/* subtle grid */}
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
        className="relative z-10 w-full max-w-sm"
      >
        {/* header */}
        <Link to="/" className="mb-12 block text-center">
          <span className="text-2xl font-bold tracking-tight text-text transition-colors duration-200 hover:text-lavender">
            afkr.
          </span>
        </Link>

        <AnimatePresence mode="wait">
          {signUpSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <p className="text-sm text-green">check your email to confirm your account</p>
              <button
                onClick={() => {
                  setSignUpSuccess(false);
                  setMode('signin');
                }}
                className="mt-6 text-xs text-subtext0 transition-colors hover:text-lavender"
              >
                back to sign in
              </button>
            </motion.div>
          ) : (
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: mode === 'signin' ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'signin' ? 12 : -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSubmit}
              className="flex flex-col gap-6"
            >
              <div>
                <label className="mb-1 block text-[11px] tracking-wider text-overlay0 uppercase">
                  email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] tracking-wider text-overlay0 uppercase">
                  password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'min 6 characters' : '********'}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full"
                />
              </div>

              {/* error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-red"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-lg bg-lavender py-3 text-sm font-semibold text-crust transition-all duration-200 hover:opacity-90 disabled:opacity-50"
              >
                {submitting
                  ? '...'
                  : mode === 'signin'
                    ? 'sign in'
                    : 'create account'}
              </button>

              <p className="text-center text-xs text-overlay0">
                {mode === 'signin' ? "don't have an account?" : 'already have an account?'}{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-subtext0 transition-colors hover:text-lavender"
                >
                  {mode === 'signin' ? 'sign up' : 'sign in'}
                </button>
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
