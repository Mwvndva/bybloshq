import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNativeApp } from '@/lib/mobileApp';

interface SellerDashboardHeaderProps {
  sellerFirstName: string;
  onBackHome: () => void;
}

export function SellerDashboardHeader({ sellerFirstName, onBackHome }: SellerDashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-[0_8px_30px_rgba(17,17,17,0.06)]">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 min-h-14 sm:min-h-16">
          {/* Back-to-home is web-only; on native (Android/iOS) rely on system/gesture navigation. Logout now lives in the Settings tab. */}
          {isNativeApp() ? (
            <div aria-hidden="true" />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackHome}
              className="justify-self-start text-stone-700 hover:text-black hover:bg-yellow-100 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Home</span>
            </Button>
          )}

          <h1 className="min-w-0 text-center text-sm sm:text-lg font-medium text-stone-950 tracking-tight truncate">
            Welcome, {sellerFirstName}
          </h1>

          <div aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}
