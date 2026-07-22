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
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-2">
          <Sun className="h-5 w-5 text-yellow-700" />
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">App Theme</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-600 sm:text-sm">
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
                  ? 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-300/30 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
              ].join(' ')}
              aria-pressed={active}
            >
              <Icon
                className={`h-5 w-5 sm:h-6 sm:w-6 ${active ? 'text-yellow-600' : 'text-slate-400'}`}
              />
              <span
                className={`text-xs font-bold sm:text-sm ${active ? 'text-yellow-700' : 'text-slate-600'}`}
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
