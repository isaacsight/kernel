interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
};

const gapMap = {
  sm: 'gap-1',
  md: 'gap-1.5',
  lg: 'gap-2',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const dotSize = sizeMap[size];
  const gap = gapMap[size];

  return (
    <div className={`flex items-center ${gap} ${className}`} role="status" aria-label="Loading">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`${dotSize} rounded-full bg-[--rubin-slate]`}
          style={{
            animation: 'pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}
