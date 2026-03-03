interface Props {
  className?: string;
  variant?: 'text' | 'card' | 'circle';
}

const baseClass = 'animate-shimmer bg-gradient-to-r from-surface0 via-surface1 to-surface0 bg-[length:400%_100%]';

const variantClasses: Record<NonNullable<Props['variant']>, string> = {
  text: 'h-3 w-full rounded',
  card: 'h-32 w-full rounded-md',
  circle: 'h-8 w-8 rounded-full',
};

export default function Skeleton({ className = '', variant = 'text' }: Props) {
  return (
    <div className={`${baseClass} ${variantClasses[variant]} ${className}`} />
  );
}
