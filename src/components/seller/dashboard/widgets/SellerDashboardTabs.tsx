import { BarChart3, Package, Settings, ShoppingBag, Wallet } from 'lucide-react';
import type { SellerTabId } from '../types';

const tabIcons = {
  overview: BarChart3,
  products: Package,
  orders: ShoppingBag,
  withdrawals: Wallet,
  settings: Settings
};

const tabs: Array<{ id: SellerTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'settings', label: 'Settings' },
];

interface SellerDashboardTabsProps {
  activeTab: SellerTabId;
  hasUnreadOrders: boolean;
  onSelectTab: (tab: SellerTabId) => void;
}

export function SellerDashboardTabs({ activeTab, hasUnreadOrders, onSelectTab }: SellerDashboardTabsProps) {
  return (
    <div className="sticky top-14 z-40 -mx-4 mb-5 border-y border-stone-200 bg-[#f8f7f2]/95 px-4 py-2 backdrop-blur sm:top-16 sm:-mx-6 sm:mb-7 sm:px-6 lg:static lg:mx-auto lg:mb-8 lg:w-full lg:max-w-4xl lg:rounded-2xl lg:border lg:bg-white lg:p-1.5 lg:shadow-[0_12px_35px_rgba(17,17,17,0.08)]">
      <div className="flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:gap-3 lg:justify-center lg:overflow-visible lg:pb-0">
        {tabs.map(({ id, label }) => {
          const Icon = tabIcons[id];

          return (
            <button
              key={id}
              onClick={() => onSelectTab(id)}
              className={`relative flex min-h-10 flex-shrink-0 items-center justify-center space-x-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all duration-300 sm:space-x-2 sm:px-4 sm:text-sm lg:min-h-0 lg:px-5 lg:py-2.5 ${activeTab === id
                ? 'text-black border-yellow-300 bg-yellow-400 shadow-[0_8px_22px_rgba(245,197,24,0.25)]'
                : 'text-stone-600 border-transparent hover:text-black hover:bg-stone-100'
                } ${activeTab === id ? 'seller-tab-selected' : ''}`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              <span>{label}</span>

              {id === 'orders' && hasUnreadOrders && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 sm:h-3 sm:w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


