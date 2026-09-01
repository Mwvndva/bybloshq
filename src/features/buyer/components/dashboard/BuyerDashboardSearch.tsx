import { Search } from 'lucide-react';

interface BuyerDashboardSearchProps {
  activeSection: 'shop' | 'notifications' | 'wishlist' | 'orders' | 'profile';
  productSearchQuery: string;
  onProductSearchChange: (value: string) => void;
}

export function BuyerDashboardSearch({
  activeSection,
  productSearchQuery,
  onProductSearchChange,
}: BuyerDashboardSearchProps) {
  if (activeSection !== 'shop') return null;

  return (
    <div className="w-full px-4 sm:px-6 pb-4 pt-1 flex shrink-0 justify-center">
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] px-3.5 h-10 w-full max-w-[760px] shadow-sm dark:shadow-[0_8px_25px_rgba(0,0,0,0.45)] transition-colors duration-200">
        <Search className="h-4 w-4 text-slate-400 dark:text-white/50 shrink-0" />
        <input
          value={productSearchQuery}
          onChange={event => onProductSearchChange(event.target.value)}
          placeholder="Search products..."
          className="flex-1 bg-transparent border-none outline-none text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 text-xs sm:text-sm font-medium"
        />
      </div>
    </div>
  );
}
