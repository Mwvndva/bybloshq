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
    <div className="mb-6 sm:mb-8 bg-white/10 backdrop-blur-[12px] rounded-2xl p-1.5 shadow-lg border border-white/15 w-full max-w-4xl mx-auto overflow-x-auto">
      <div className="flex items-center justify-start sm:justify-center gap-3 sm:gap-5 min-w-max">
        {tabs.map(({ id, label }) => {
          const Icon = tabIcons[id];

          return (
            <button
              key={id}
              onClick={() => onSelectTab(id)}
              className={`relative flex items-center justify-center flex-shrink-0 space-x-1.5 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 border ${activeTab === id
                ? 'text-black border-yellow-300 bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35)]'
                : 'text-white border-transparent hover:text-black hover:bg-yellow-300'
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
