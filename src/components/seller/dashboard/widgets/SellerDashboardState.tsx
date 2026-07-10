import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface SellerDashboardErrorStateProps {
  error: string | null;
  onRetry: () => void;
}

export function SellerDashboardLoadingState() {
  return (
    <div className="min-h-screen bg-[#f8f7f2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center mb-8">
          <Skeleton className="h-32 w-96" />
        </div>

        <div className="flex space-x-2 mb-12 bg-white p-2 rounded-2xl shadow-[0_18px_45px_rgba(17,17,17,0.08)] border border-stone-200 w-fit mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-24 rounded-xl" />
          ))}
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SellerDashboardErrorState({ error, onRetry }: SellerDashboardErrorStateProps) {
  return (
    <div className="min-h-screen bg-[#f8f7f2] flex items-center justify-center px-4">
      <div className="text-center space-y-6 p-8">
        <div className="w-24 h-24 mx-auto bg-red-50 border border-red-100 rounded-3xl flex items-center justify-center shadow-sm">
          <RefreshCw className="h-12 w-12 text-red-600" />
        </div>
        <h3 className="text-2xl font-semibold text-stone-950 mb-3">Unable to load dashboard</h3>
        <p className="text-stone-600 text-base font-medium max-w-md mx-auto mb-6">
          {error || 'Something went wrong while loading your dashboard data. Please try again.'}
        </p>
        <Button
          onClick={onRetry}
          className="bg-yellow-400 text-black hover:bg-yellow-300 px-8 py-3 rounded-xl font-semibold"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Try Again
        </Button>
      </div>
    </div>
  );
}


