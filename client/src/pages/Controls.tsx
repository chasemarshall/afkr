import { AnimatePresence, motion } from 'framer-motion';
import { Plug, Gamepad2, Terminal, MessageSquare } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import TabStrip from '@/components/TabStrip';
import ConnectTab from '@/components/controls/ConnectTab';
import MoveTab from '@/components/controls/MoveTab';
import CommandTab from '@/components/controls/CommandTab';
import ChatTab from '@/components/controls/ChatTab';
import { usePersistedState } from '@/hooks/usePersistedState';

const TABS = [
  { key: 'connect', label: 'connect', icon: Plug },
  { key: 'move', label: 'move', icon: Gamepad2 },
  { key: 'command', label: 'command', icon: Terminal },
  { key: 'chat', label: 'chat', icon: MessageSquare },
] as const;

const tabVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function ActiveTab({ tab }: { tab: string }) {
  switch (tab) {
    case 'connect':
      return <ConnectTab />;
    case 'move':
      return <MoveTab />;
    case 'command':
      return <CommandTab />;
    case 'chat':
      return <ChatTab />;
    default:
      return <ConnectTab />;
  }
}

export default function Controls() {
  const [activeTab, setActiveTab] = usePersistedState('controls-tab', 'connect');

  return (
    <PageTransition>
      <div className="mb-6 border-b border-surface0 pb-4">
        <h1 className="mb-4 text-lg font-semibold text-text">controls</h1>
        <TabStrip
          tabs={[...TABS]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <ActiveTab tab={activeTab} />
        </motion.div>
      </AnimatePresence>
    </PageTransition>
  );
}
