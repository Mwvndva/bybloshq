import type { LucideIcon } from 'lucide-react';

type BuyerSection = 'shop' | 'shops' | 'wishlist' | 'orders' | 'profile';

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
    <div className="h-[56px] w-full shrink-0 flex items-stretch border-t border-slate-200 dark:border-white/10 bg-white dark:bg-black shadow-[0_-10px_30px_rgba(0,0,0,0.10)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.55)] transition-colors duration-200">
      {navItems.map(item => {
        const isActive = activeNav === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-transparent border-none cursor-pointer relative transition-opacity duration-150 active:scale-95"
          >
            <item.Icon
              size={18}
              className={isActive ? 'text-[#F5C518]' : 'text-slate-500 dark:text-white/50 transition-colors'}
            />
            <span className={`text-[9px] font-semibold transition-colors ${isActive ? 'text-[#F5C518] font-bold' : 'text-slate-500 dark:text-white/50'}`}>
              {item.label}
            </span>
            {item.badge && (
              <div className="absolute top-1.5 right-[50%] translate-x-[10px] w-1.5 h-1.5 rounded-full bg-[#F5C518]" />
            )}
          </button>
        );
      })}
    </div>
  );
}


