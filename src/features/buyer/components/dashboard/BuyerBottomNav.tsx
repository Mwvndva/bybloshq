import type { LucideIcon } from 'lucide-react';

type BuyerSection = 'shop' | 'notifications' | 'wishlist' | 'orders' | 'profile';

interface BuyerNavItem {
  key: BuyerSection;
  label: string;
  Icon: LucideIcon;
  path: string;
  badge?: boolean;
}

interface BuyerBottomNavProps {
  activeNav: BuyerSection;
  navItems: readonly BuyerNavItem[];
  onSelect: (key: BuyerSection) => void;
}

export function BuyerBottomNav({ activeNav, navItems, onSelect }: BuyerBottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--byblos-border,rgba(255,255,255,0.1))] bg-[var(--byblos-surface,#000000)]/95 backdrop-blur transition-colors duration-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Buyer navigation"
    >
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.map(item => {
          const isActive = activeNav === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-transparent border-none cursor-pointer relative py-1.5 transition-opacity duration-150 active:scale-95"
            >
              <item.Icon
                size={18}
                className={isActive ? 'text-[#F5C518]' : 'text-slate-500 dark:text-white/50 transition-colors'}
              />
              <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-[#F5C518] font-bold' : 'text-slate-500 dark:text-white/50'}`}>
                {item.label}
              </span>
              {item.badge && (
                <div className="absolute top-1.5 right-[50%] translate-x-[10px] w-1.5 h-1.5 rounded-full bg-[#F5C518]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}


