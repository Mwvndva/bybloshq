import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';

interface SellerDashboardHeaderProps {
  sellerFirstName: string;
}

export function SellerDashboardHeader({ sellerFirstName }: SellerDashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-[var(--byblos-bg,#000000)]/90 backdrop-blur-md border-b border-black/[0.08] dark:border-white/10 shadow-sm dark:shadow-none pt-safe-top transition-colors duration-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 min-h-14 sm:min-h-16">
          <div className="justify-self-start">
            <NotificationBell />
          </div>

          <h1 className="min-w-0 text-center text-sm sm:text-lg font-semibold text-slate-900 dark:text-white tracking-tight truncate">
            Welcome, {sellerFirstName}
          </h1>

          <div className="justify-self-end">
            <AccountSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
