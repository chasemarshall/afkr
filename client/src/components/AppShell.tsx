import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, Users, Gamepad2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';
import BotSelectorBar from '@/components/BotSelectorBar';

const navItems = [
  { to: '/dashboard', label: 'dashboard', Icon: LayoutGrid },
  { to: '/accounts', label: 'accounts', Icon: Users },
  { to: '/controls', label: 'controls', Icon: Gamepad2 },
  { to: '/scheduler', label: 'scheduler', Icon: Clock },
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  const { isConnected } = useSocket();
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar -- hidden on mobile */}
      <aside className="hidden w-48 shrink-0 flex-col bg-mantle md:flex">
        {/* App name */}
        <div className="px-5 py-5">
          <span className="text-sm font-semibold tracking-wide text-text">
            afkr.
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          {navItems.map(({ to, label, Icon }, i) => {
            const isActive =
              location.pathname === to ||
              (to !== '/dashboard' && location.pathname.startsWith(to));

            return (
              <NavLink
                key={to}
                to={to}
                end
                className="relative flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors duration-150"
              >
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={`inline-flex items-center gap-2.5 ${
                    isActive
                      ? 'text-lavender'
                      : 'text-subtext0 hover:text-text'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </motion.span>

                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-lavender"
                    transition={{
                      type: 'spring',
                      stiffness: 350,
                      damping: 30,
                    }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Connection status + sign out */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <motion.span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: isConnected ? '#a6e3a1' : '#f38ba8',
                }}
                animate={{
                  scale: isConnected ? [1, 1.2, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: isConnected ? Infinity : 0,
                  ease: 'easeInOut',
                }}
              />
              <span className={isConnected ? 'text-green' : 'text-red'}>
                {isConnected ? 'connected' : 'disconnected'}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-[11px] text-overlay0 transition-colors hover:text-red"
            >
              sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Bot selector bar */}
        <BotSelectorBar />

        {/* Content -- extra bottom padding on mobile for BottomNav */}
        <main className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 lg:p-10 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
