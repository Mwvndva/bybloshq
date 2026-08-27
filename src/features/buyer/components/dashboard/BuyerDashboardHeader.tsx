import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';

export function BuyerDashboardHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[var(--byblos-bg,#000000)] pt-safe-top transition-colors duration-200">
      <div className="w-full px-4 py-3 sm:px-6 sm:py-4">
        <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3">
          <div className="justify-self-start">
            <NotificationBell />
          </div>
          <span className="justify-self-center text-sm font-bold text-slate-900 dark:text-white tracking-tight sm:text-base">
            Trusted Businesses
          </span>
          <div className="justify-self-end">
            <AccountSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
