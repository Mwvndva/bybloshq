import { cn } from '@/lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        className
      )}
      role="status"
      aria-label="Loading..."
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
