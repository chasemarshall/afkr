import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AppShell from '@/components/AppShell';
import Dashboard from '@/pages/Dashboard';
import Accounts from '@/pages/Accounts';
import Controls from '@/pages/Controls';
import Scheduler from '@/pages/Scheduler';

export default function App() {
  const location = useLocation();

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/controls" element={<Controls />} />
          <Route path="/scheduler" element={<Scheduler />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
}
