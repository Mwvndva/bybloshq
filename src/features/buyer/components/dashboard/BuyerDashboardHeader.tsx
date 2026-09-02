import { ChevronDown, MapPin } from 'lucide-react';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';

const SUPPORTED_CITIES = ['Nairobi'] as const;

export function BuyerDashboardHeader() {
  const cities = SUPPORTED_CITIES;
  const isSingleCity = cities.length <= 1;

  return (
    <header className="sticky top-0 z-50 bg-[var(--byblos-bg,#000000)] pt-safe-top transition-colors duration-200">
      <div className="w-full px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          {/* City selector — with a single supported city it renders disabled (null behavior). */}
          <div className="relative inline-flex items-center rounded-full border border-slate-200 bg-slate-100 text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
            <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-500 dark:text-white/60" aria-hidden="true" />
            <select
              aria-label="City"
              defaultValue={cities[0]}
              disabled={isSingleCity}
              className="cursor-pointer appearance-none rounded-full bg-transparent py-1.5 pl-7 pr-7 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#f5c518)]/50 disabled:cursor-default"
            >
              {cities.map((city) => (
                <option key={city} value={city} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                  {city}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-500 dark:text-white/60" aria-hidden="true" />
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell variant="default" />
            <AccountSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
