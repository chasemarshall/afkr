import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';
import { getAccounts } from '@/lib/api';
import { socket } from '@/lib/socket';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/components/Toast';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { MovementDirection } from '@afkr/shared';

const SENSITIVITY = 0.003;
const LOOK_THROTTLE_MS = 50;

export default function MoveTab() {
  const [moveAccount, setMoveAccount] = usePersistedState('move-account', '');
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const [mouseLook, setMouseLook] = useState(false);
  const keysHeldRef = useRef(new Set<string>());
  const dpadRef = useRef<HTMLDivElement>(null);
  const lookAccum = useRef({ yaw: 0, pitch: 0 });
  const lookTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { botStates } = useSocket();
  const { toast } = useToast();

  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });

  const getMoveTargets = useCallback((): string[] => {
    if (moveAccount === '__all__') {
      return (accounts ?? [])
        .filter((a) => botStates.get(a.id)?.status === 'online')
        .map((a) => a.id);
    }
    return moveAccount ? [moveAccount] : [];
  }, [moveAccount, accounts, botStates]);

  function handleMove(direction: MovementDirection): void {
    const targets = getMoveTargets();
    if (targets.length === 0) {
      toast('select an online account', 'error');
      return;
    }
    setActiveDir(direction);
    setTimeout(() => setActiveDir(null), 200);
    for (const id of targets) {
      socket.emit('bot:move', { account_id: id, direction });
    }
  }

  function handleJump(): void {
    const targets = getMoveTargets();
    if (targets.length === 0) {
      toast('select an online account', 'error');
      return;
    }
    setActiveDir('jump');
    setTimeout(() => setActiveDir(null), 200);
    for (const id of targets) {
      socket.emit('bot:jump', { account_id: id });
    }
  }

  function handleToggleAntiAfk(accountId: string, enabled: boolean): void {
    socket.emit('bot:anti_afk', { account_id: accountId, enabled });
  }

  function handleAntiAfkInterval(accountId: string, intervalMs: number): void {
    socket.emit('bot:anti_afk', { account_id: accountId, enabled: true, interval_ms: intervalMs });
  }

  // Mouse look: accumulate deltas and send throttled
  function flushLook(): void {
    const { yaw, pitch } = lookAccum.current;
    if (yaw === 0 && pitch === 0) return;
    const targets = getMoveTargets();
    for (const id of targets) {
      socket.emit('bot:look', { account_id: id, yaw_delta: yaw, pitch_delta: pitch });
    }
    lookAccum.current = { yaw: 0, pitch: 0 };
  }

  function handleMouseLook(e: MouseEvent): void {
    lookAccum.current.yaw += -e.movementX * SENSITIVITY;
    lookAccum.current.pitch += -e.movementY * SENSITIVITY;
    if (!lookTimer.current) {
      lookTimer.current = setTimeout(() => {
        flushLook();
        lookTimer.current = null;
      }, LOOK_THROTTLE_MS);
    }
  }

  function toggleMouseLook(): void {
    if (mouseLook) {
      document.exitPointerLock();
    } else if (dpadRef.current) {
      dpadRef.current.requestPointerLock();
    }
  }

  // Pointer lock change listener
  useEffect(() => {
    function onLockChange(): void {
      const locked = document.pointerLockElement !== null;
      setMouseLook(locked);
      if (!locked) {
        flushLook();
        if (lookTimer.current) {
          clearTimeout(lookTimer.current);
          lookTimer.current = null;
        }
      }
    }
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  // Mouse move listener when pointer locked
  useEffect(() => {
    if (mouseLook) {
      document.addEventListener('mousemove', handleMouseLook);
      return () => document.removeEventListener('mousemove', handleMouseLook);
    }
  }, [mouseLook, moveAccount, accounts, botStates]);

  // Keyboard controls for WASD/arrows/space
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;
      const map: Record<string, MovementDirection> = { w: 'forward', s: 'back', a: 'left', d: 'right' };
      const arrowMap: Record<string, MovementDirection> = { ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right' };
      const dir = map[e.key.toLowerCase()] || arrowMap[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
        keysHeldRef.current.add(e.key.toLowerCase());
      }
      if (e.key === ' ') {
        e.preventDefault();
        handleJump();
      }
    }
    function onKeyUp(e: KeyboardEvent): void {
      keysHeldRef.current.delete(e.key.toLowerCase());
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Account selector + anti-AFK */}
        <div className="space-y-3 sm:w-48">
          <div>
            <label className="mb-1.5 block text-xs text-overlay1">account</label>
            <select
              value={moveAccount}
              onChange={(e) => setMoveAccount(e.target.value)}
              className="w-full text-sm"
            >
              <option value="">select...</option>
              <option value="__all__">all online</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.username}</option>
              ))}
            </select>
          </div>

          {/* Anti-AFK toggles with interval */}
          <div className="space-y-1.5">
            <span className="block text-xs text-overlay1">anti-afk</span>
            {accounts?.filter((a) => botStates.get(a.id)?.status === 'online').map((a) => {
              const state = botStates.get(a.id);
              const isOn = state?.anti_afk !== false;
              const interval = state?.anti_afk_interval ?? 25000;
              return (
                <div key={a.id} className="space-y-1 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-subtext0">{a.username}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleToggleAntiAfk(a.id, !isOn)}
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
                        isOn ? 'bg-green/30' : 'bg-surface1'
                      }`}
                    >
                      <motion.div
                        animate={{ x: isOn ? 16 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`absolute top-0.5 h-4 w-4 rounded-full transition-colors duration-200 ${
                          isOn ? 'bg-green' : 'bg-overlay0'
                        }`}
                      />
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {isOn && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={5000}
                            max={120000}
                            step={1000}
                            value={interval}
                            onChange={(e) => handleAntiAfkInterval(a.id, Number(e.target.value))}
                            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface1 accent-lavender [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-lavender"
                          />
                          <span className="shrink-0 text-[10px] text-overlay0 tabular-nums">
                            {Math.round(interval / 1000)}s
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {(!accounts || accounts.filter((a) => botStates.get(a.id)?.status === 'online').length === 0) && (
              <p className="text-xs text-overlay0">no bots online</p>
            )}
          </div>
        </div>

        {/* D-Pad + Mouse Look */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div ref={dpadRef} className="grid grid-cols-3 grid-rows-3 gap-1 w-[150px] h-[150px] sm:w-[132px] sm:h-[132px]">
            <div />
            <motion.button
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => handleMove('forward')}
              className={`flex items-center justify-center rounded transition-colors ${
                activeDir === 'forward' ? 'bg-lavender/20 text-lavender' : 'bg-surface0/50 text-overlay1 hover:bg-surface0 hover:text-text'
              }`}
            >
              <ChevronUp size={20} />
            </motion.button>
            <div />

            <motion.button
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => handleMove('left')}
              className={`flex items-center justify-center rounded transition-colors ${
                activeDir === 'left' ? 'bg-lavender/20 text-lavender' : 'bg-surface0/50 text-overlay1 hover:bg-surface0 hover:text-text'
              }`}
            >
              <ChevronLeft size={20} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => handleJump()}
              className={`flex items-center justify-center rounded text-xs transition-colors ${
                activeDir === 'jump' ? 'bg-blue/20 text-blue' : 'bg-surface0/50 text-overlay1 hover:bg-surface0 hover:text-text'
              }`}
            >
              <ArrowUp size={16} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => handleMove('right')}
              className={`flex items-center justify-center rounded transition-colors ${
                activeDir === 'right' ? 'bg-lavender/20 text-lavender' : 'bg-surface0/50 text-overlay1 hover:bg-surface0 hover:text-text'
              }`}
            >
              <ChevronRight size={20} />
            </motion.button>

            <div />
            <motion.button
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => handleMove('back')}
              className={`flex items-center justify-center rounded transition-colors ${
                activeDir === 'back' ? 'bg-lavender/20 text-lavender' : 'bg-surface0/50 text-overlay1 hover:bg-surface0 hover:text-text'
              }`}
            >
              <ChevronDown size={20} />
            </motion.button>
            <div />
          </div>

          {/* Mouse look toggle — hidden on touch devices */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleMouseLook}
            className={`hidden items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors sm:flex ${
              mouseLook
                ? 'bg-lavender/20 text-lavender'
                : 'bg-surface0/50 text-overlay1 hover:bg-surface0 hover:text-text'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            {mouseLook ? 'mouse look active (esc to exit)' : 'mouse look'}
          </motion.button>
        </div>

        {/* Keyboard hint */}
        <div className="hidden text-xs text-overlay0 sm:block sm:w-32">
          <p className="mb-2 text-overlay1">keyboard</p>
          <div className="space-y-1">
            <p><span className="text-subtext0">wasd</span> move</p>
            <p><span className="text-subtext0">arrows</span> move</p>
            <p><span className="text-subtext0">space</span> jump</p>
            <p><span className="text-subtext0">mouse</span> look</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
