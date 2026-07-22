import { NotificationBell } from '@/features/notifications/NotificationBell';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useAppTheme } from '@/hooks/useAppTheme';

export function BuyerDashboardHeader() {
  const { theme, setTheme } = useAppTheme();

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div style={{
      padding: '16px 18px 14px',
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ justifySelf: 'start' }}>
        <NotificationBell />
      </div>
      <span style={{ justifySelf: 'center', fontSize: 15, fontWeight: 700, color: 'var(--byblos-text, #ffffff)', letterSpacing: '-0.2px' }}>
        Trusted Businesses
      </span>
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={toggleTheme}
          title={`App Theme: ${theme.toUpperCase()} (Click to toggle)`}
          aria-label="Toggle App Theme"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 transition-all duration-200 shadow-sm"
        >
          <ThemeIcon className="h-4 w-4 text-yellow-500" />
        </button>
        <AccountSwitcher />
      </div>
    </div>
  );
}
