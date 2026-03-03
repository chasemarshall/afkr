import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface Tab {
  key: string;
  label: string;
  icon?: LucideIcon;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export default function TabStrip({ tabs, activeTab, onTabChange }: Props) {
  return (
    <div className="flex gap-1 border-b border-surface0">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${
              isActive ? 'text-lavender' : 'text-overlay1 hover:text-subtext0'
            }`}
          >
            {Icon && <Icon size={12} />}
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="tab-underline"
                className="absolute inset-x-0 -bottom-px h-px bg-lavender"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
