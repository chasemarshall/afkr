import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, Users, Gamepad2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const tabs = [
  { to: '/dashboard', label: 'dashboard', Icon: LayoutGrid },
  { to: '/accounts', label: 'accounts', Icon: Users },
  { to: '/controls', label: 'controls', Icon: Gamepad2 },
  { to: '/scheduler', label: 'scheduler', Icon: Clock },
] as const;

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around bg-mantle md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ to, label, Icon }) => {
        const isActive =
          location.pathname === to ||
          (to !== '/dashboard' && location.pathname.startsWith(to));

        return (
          <NavLink
            key={to}
            to={to}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            {isActive && (
              <motion.div
                layoutId="bottom-nav-indicator"
                className="absolute -top-0.5 h-0.5 w-8 rounded-full bg-lavender"
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
            <Icon
              size={20}
              className={isActive ? 'text-lavender' : 'text-overlay1'}
            />
            <span
              className={`text-[10px] leading-none ${
                isActive ? 'text-lavender' : 'text-overlay1'
              }`}
            >
              {label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
