import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface SellerDashboardErrorStateProps {
  error: string | null;
  onRetry: () => void;
}

export function SellerDashboardLoadingState() {
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        {/* Hero */}
        <Skeleton className="mb-6 h-56 w-full rounded-3xl sm:h-64" />

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-xl" />
          ))}
        </div>

        {/* Stat grid */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>

        {/* Panels */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function SellerDashboardErrorState({ error, onRetry }: SellerDashboardErrorStateProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center space-y-6 p-8">
        <div className="w-24 h-24 mx-auto bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center">
          <RefreshCw className="h-12 w-12 text-red-500" />
        </div>
        <h3 className="text-2xl font-black text-white mb-3">Unable to load dashboard</h3>
        <p className="text-white/60 text-base font-medium max-w-md mx-auto mb-6">
          {error || 'Something went wrong while loading your dashboard data. Please try again.'}
        </p>
        <Button
          onClick={onRetry}
          className="px-8 py-3 rounded-xl font-black"
          style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
