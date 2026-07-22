import { BarChart3, Package, Settings, ShoppingBag, Wallet } from 'lucide-react';
import { isNativeApp } from '@/lib/mobileApp';
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
  // On the native app the tabs live in a fixed bottom navigation bar and show
  // icons only. It is `fixed`, so it never pushes or overlaps page content — the
  // dashboard adds matching bottom padding (see SellerDashboard) so the last
  // items stay above the bar. The web layout is unchanged.
  if (isNativeApp()) {
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Dashboard sections"
      >
        <div className="flex items-stretch justify-around px-1.5 py-1">
          {tabs.map(({ id, label }) => {
            const Icon = tabIcons[id];
            const selected = activeTab === id;

            return (
              <button
                key={id}
                onClick={() => onSelectTab(id)}
                aria-label={label}
                aria-current={selected ? 'page' : undefined}
                className={`relative flex flex-1 items-center justify-center rounded-xl py-2.5 transition-colors ${
                  selected
                    ? 'text-[var(--theme-accent,#facc15)]'
                    : 'text-white/45 hover:text-white/80'
                }`}
              >
                <span
                  className={`flex items-center justify-center rounded-xl p-2 transition-colors ${
                    selected ? 'bg-white/10' : ''
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </span>

                {id === 'orders' && hasUnreadOrders && (
                  <span className="absolute right-1/2 top-1 h-2.5 w-2.5 translate-x-3.5 rounded-full border-2 border-black bg-red-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <div className="sticky top-14 z-40 -mx-4 mb-5 border-y border-slate-200/60 bg-[#f8f7f2]/95 px-4 py-2 backdrop-blur sm:top-16 sm:-mx-6 sm:mb-7 sm:px-6 lg:static lg:mx-auto lg:mb-8 lg:w-full lg:max-w-4xl lg:rounded-2xl lg:border lg:border-slate-200/60 lg:bg-white lg:p-1.5 lg:shadow-[0_12px_35px_rgba(17,17,17,0.08)]">
      <div className="flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:gap-3 lg:justify-center lg:overflow-visible lg:pb-0">
        {tabs.map(({ id, label }) => {
          const Icon = tabIcons[id];

          return (
            <button
              key={id}
              onClick={() => onSelectTab(id)}
              className={`relative flex min-h-10 flex-shrink-0 items-center justify-center space-x-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all duration-300 sm:space-x-2 sm:px-4 sm:text-sm lg:min-h-0 lg:px-5 lg:py-2.5 ${activeTab === id
                ? 'bg-[var(--theme-button-bg,#facc15)] text-[var(--theme-button-text,#000000)] border-[var(--theme-accent,#facc15)] shadow-[0_8px_22px_rgba(0,0,0,0.18)]'
                : 'text-slate-600 border-transparent hover:text-slate-950 hover:bg-slate-100'
                } ${activeTab === id ? 'seller-tab-selected' : ''}`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              <span>{label}</span>

              {id === 'orders' && hasUnreadOrders && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 sm:h-3 sm:w-3 bg-red-500 rounded-full border-2 border-black animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
