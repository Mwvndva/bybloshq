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
    <div className="mb-6 sm:mb-8 bg-white rounded-2xl p-1.5 shadow-[0_12px_35px_rgba(17,17,17,0.08)] border border-stone-200 w-full max-w-4xl mx-auto overflow-x-auto">
      <div className="flex items-center justify-start sm:justify-center gap-3 sm:gap-5 min-w-max">
        {tabs.map(({ id, label }) => {
          const Icon = tabIcons[id];

          return (
            <button
              key={id}
              onClick={() => onSelectTab(id)}
              className={`relative flex items-center justify-center flex-shrink-0 space-x-1.5 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 border ${activeTab === id
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
