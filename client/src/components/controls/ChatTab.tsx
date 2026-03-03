import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { getAccounts } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';
import { usePersistedState } from '@/hooks/usePersistedState';

export default function ChatTab() {
  const [chatAccount, setChatAccount] = usePersistedState('chat-account', '');
  const chatRef = useRef<HTMLDivElement>(null);
  const { chatMessages } = useSocket();

  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });

  const filteredChat = chatAccount
    ? chatMessages.filter((m) => m.account_id === chatAccount)
    : chatMessages;

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [filteredChat.length]);

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="mb-4 flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-subtext0">
          <MessageSquare size={12} />
          chat
        </h2>
        <select
          value={chatAccount}
          onChange={(e) => setChatAccount(e.target.value)}
          className="text-xs"
        >
          <option value="">all accounts</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>{a.username}</option>
          ))}
        </select>
      </div>

      <div ref={chatRef} className="flex-1 overflow-y-auto">
        {filteredChat.length === 0 ? (
          <p className="py-8 text-center text-xs text-overlay1">no chat messages yet</p>
        ) : (
          <div>
            {filteredChat.map((msg, i) => {
              const account = accounts?.find((a) => a.id === msg.account_id);
              return (
                <div
                  key={`${msg.timestamp}-${i}`}
                  className={`flex gap-3 px-3 py-1.5 text-xs ${
                    i % 2 === 0 ? 'bg-transparent' : 'bg-surface0/30'
                  }`}
                >
                  <span className="shrink-0 text-overlay0">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  {accounts && accounts.length > 1 && (
                    <span className="shrink-0 text-overlay1">
                      [{account?.username ?? '?'}]
                    </span>
                  )}
                  <span className="text-lavender">&lt;{msg.username ?? '?'}&gt;</span>
                  <span className="text-text">{msg.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
