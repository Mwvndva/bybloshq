import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SellerDashboardHeaderProps {
  sellerFirstName: string;
  onBackHome: () => void;
  onLogout: () => void;
}

export function SellerDashboardHeader({ sellerFirstName, onBackHome, onLogout }: SellerDashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-[0_8px_30px_rgba(17,17,17,0.06)]">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 min-h-14 sm:min-h-16">
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

          <h1 className="min-w-0 text-center text-sm sm:text-lg font-medium text-stone-950 tracking-tight truncate">
            Welcome, {sellerFirstName}
          </h1>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="justify-self-end text-stone-700 hover:text-black hover:bg-yellow-100 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
