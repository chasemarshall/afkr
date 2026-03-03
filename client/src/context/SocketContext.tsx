import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { socket } from '@/lib/socket';
import type { BotState, ChatMessage } from '@afkr/shared';

interface SocketContextValue {
  botStates: Map<string, BotState>;
  chatMessages: ChatMessage[];
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  botStates: new Map(),
  chatMessages: [],
  isConnected: false,
});

const MAX_CHAT_MESSAGES = 200;

export function SocketProvider({ children }: { children: ReactNode }) {
  const [botStates, setBotStates] = useState<Map<string, BotState>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  const handleBotState = useCallback((state: BotState) => {
    setBotStates((prev) => {
      const next = new Map(prev);
      next.set(state.account_id, state);
      return next;
    });
  }, []);

  const handleChat = useCallback((msg: ChatMessage) => {
    setChatMessages((prev) => {
      const next = [...prev, msg];
      if (next.length > MAX_CHAT_MESSAGES) {
        return next.slice(next.length - MAX_CHAT_MESSAGES);
      }
      return next;
    });
  }, []);

  const handleAllStates = useCallback((states: BotState[]) => {
    const map = new Map<string, BotState>();
    for (const s of states) {
      map.set(s.account_id, s);
    }
    setBotStates(map);
  }, []);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      socket.emit('bot:request_states');
    }
    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('bot:state', handleBotState);
    socket.on('bot:chat', handleChat);
    socket.on('bot:all_states', handleAllStates);

    // Request initial states if already connected
    if (socket.connected) {
      socket.emit('bot:request_states');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('bot:state', handleBotState);
      socket.off('bot:chat', handleChat);
      socket.off('bot:all_states', handleAllStates);
    };
  }, [handleBotState, handleChat, handleAllStates]);

  return (
    <SocketContext.Provider value={{ botStates, chatMessages, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
