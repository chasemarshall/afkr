import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Confirm from '@/pages/Confirm';
import Dashboard from '@/pages/Dashboard';
import Accounts from '@/pages/Accounts';
import Controls from '@/pages/Controls';
import Scheduler from '@/pages/Scheduler';
import Scripts from '@/pages/Scripts';

function AuthenticatedApp() {
  const location = useLocation();

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/controls" element={<Controls />} />
          <Route path="/scheduler" element={<Scheduler />} />
          <Route path="/scripts" element={<Scripts />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-base">
        <span className="text-sm text-subtext0 animate-pulse">loading...</span>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/confirm" element={<Confirm />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AuthenticatedApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}
