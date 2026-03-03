import { type ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/context/SocketContext';

const navItems = [
  { to: '/', label: 'dashboard' },
  { to: '/accounts', label: 'accounts' },
  { to: '/controls', label: 'controls' },
  { to: '/scheduler', label: 'scheduler' },
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  const { isConnected } = useSocket();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-30 bg-crust/60 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed z-40 flex h-full w-60 shrink-0 flex-col border-r border-surface0 bg-mantle transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* App name */}
        <div className="flex items-center justify-between border-b border-surface0 px-6 py-5">
          <span className="text-sm font-semibold tracking-wide text-text">
            afkr.
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-subtext0 transition-colors hover:text-text md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          {navItems.map((item, i) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className="relative flex items-center px-3 py-2.5 text-sm transition-colors duration-150"
              >
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={
                    isActive
                      ? 'text-lavender'
                      : 'text-subtext0 hover:text-text'
                  }
                >
                  {item.label}
                </motion.span>

                {/* Active indicator bar */}
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-lavender"
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

        {/* Connection status */}
        <div className="border-t border-surface0 px-6 py-4">
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
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex items-center border-b border-surface0 px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-subtext0 transition-colors hover:text-text"
          >
            <Menu size={20} />
          </button>
          <span className="ml-3 text-sm font-semibold text-text">afkr.</span>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
