import { Monitor, Moon, Sun } from 'lucide-react';
import { useAppTheme, type AppTheme } from '@/hooks/useAppTheme';

const OPTIONS: { value: AppTheme; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
];

export function AppThemeToggle() {
  const { theme, setTheme } = useAppTheme();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-[var(--theme-accent,#f5c518)]/30 bg-[var(--theme-accent,#f5c518)]/15 p-2">
          <Sun className="h-5 w-5 text-[var(--theme-accent,#f5c518)]" />
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-white sm:text-lg">App Theme</h3>
          <p className="mt-0.5 seller-subtext">
            Choose how the dashboard looks. Light follows your OS when set to System.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              id={`app-theme-${value}`}
              onClick={() => setTheme(value)}
              className={[
                'flex flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 transition-all duration-200 sm:py-5',
                active
                  ? 'border-[var(--theme-accent,#f5c518)] bg-[var(--theme-accent,#f5c518)]/15 ring-2 ring-[var(--theme-accent,#f5c518)]/30'
                  : 'border-white/10 bg-white/[0.04] hover:border-white/20',
              ].join(' ')}
              aria-pressed={active}
            >
              <Icon
                className={`h-5 w-5 sm:h-6 sm:w-6 ${active ? 'text-[var(--theme-accent,#f5c518)]' : 'text-white/40'}`}
              />
              <span
                className={`text-xs font-bold sm:text-sm ${active ? 'text-white' : 'text-white/60'}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
