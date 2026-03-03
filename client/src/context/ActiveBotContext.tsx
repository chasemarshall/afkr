import { createContext, useContext, type ReactNode } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';

interface ActiveBotContextValue {
  selectedAccountId: string | null;
  selectedServerId: string | null;
  setSelectedAccount: (id: string | null) => void;
  setSelectedServer: (id: string | null) => void;
}

const ActiveBotContext = createContext<ActiveBotContextValue>({
  selectedAccountId: null,
  selectedServerId: null,
  setSelectedAccount: () => {},
  setSelectedServer: () => {},
});

export function ActiveBotProvider({ children }: { children: ReactNode }) {
  const [selectedAccountId, setSelectedAccount] = usePersistedState<string | null>(
    'active-account',
    null,
  );
  const [selectedServerId, setSelectedServer] = usePersistedState<string | null>(
    'active-server',
    null,
  );

  return (
    <ActiveBotContext.Provider
      value={{
        selectedAccountId,
        selectedServerId,
        setSelectedAccount,
        setSelectedServer,
      }}
    >
      {children}
    </ActiveBotContext.Provider>
  );
}

export function useActiveBot(): ActiveBotContextValue {
  return useContext(ActiveBotContext);
}
