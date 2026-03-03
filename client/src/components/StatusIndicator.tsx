import type { BotStatus } from '@afkr/shared';

export const BOT_STATUS_COLORS: Record<BotStatus, string> = {
  online: '#a6e3a1',
  connecting: '#89b4fa',
  reconnecting: '#f9e2af',
  error: '#f38ba8',
  offline: '#585b70',
};

const BOT_STATUS_LABELS: Record<BotStatus, string> = {
  online: 'online',
  connecting: 'connecting',
  reconnecting: 'reconnecting',
  error: 'error',
  offline: 'offline',
};

interface Props {
  status: BotStatus;
  showLabel?: boolean;
  size?: number;
}

export default function StatusIndicator({ status, showLabel = false, size = 8 }: Props) {
  const color = BOT_STATUS_COLORS[status];
  const shouldPulse = status === 'online' || status === 'reconnecting';

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={shouldPulse ? 'animate-subtle-pulse' : undefined}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <span className="text-xs" style={{ color }}>
          {BOT_STATUS_LABELS[status]}
        </span>
      )}
    </span>
  );
}
