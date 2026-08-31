import { type ChangeEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/shared/utils/formatting';
import type { AppTheme } from '@/shared/hooks/useAppTheme';

interface ThemeSegmentedPillProps {
  value: AppTheme;
  onChange: (theme: AppTheme) => void;
  /** false = icon-only compact variant (for tight headers). Default true. */
  showLabels?: boolean;
  className?: string;
}

type ExplicitTheme = 'light' | 'dark';

const OPTIONS: { value: ExplicitTheme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

/** Resolve a possibly-'system' preference to the concrete theme shown to the user. */
function resolveTheme(value: AppTheme): ExplicitTheme {
  if (value === 'light' || value === 'dark') return value;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

/**
 * The one consistent theme selector across the app: a compact vertical dropdown
 * offering only Dark / Light (System was removed — the app no longer follows the
 * OS after an explicit choice). Rendered as a native <select> so it never clips
 * inside tight headers and stays accessible on web and Android. Presentational —
 * wire `value` / `onChange` to a scope via `useThemeScope`; ThemeManager remains
 * the single source of truth.
 */
export function ThemeSegmentedPill({ value, onChange, showLabels = true, className }: ThemeSegmentedPillProps) {
  const resolved = resolveTheme(value);
  const Icon = resolved === 'dark' ? Moon : Sun;

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as AppTheme);
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center rounded-full border border-slate-200 bg-slate-100 text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white',
        className,
      )}
    >
      <Icon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-500 dark:text-white/60" aria-hidden="true" />
      <select
        aria-label="Theme"
        value={resolved}
        onChange={handleChange}
        className={cn(
          'cursor-pointer appearance-none rounded-full bg-transparent py-1.5 pl-7 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#f5c518)]/50',
          showLabels ? 'pr-7' : 'pr-6',
        )}
      >
        {OPTIONS.map(({ value: optionValue, label }) => (
          <option key={optionValue} value={optionValue} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
            {showLabels ? label : label.charAt(0)}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 h-3 w-3 text-slate-500 dark:text-white/60"
        viewBox="0 0 12 12" fill="none" aria-hidden="true"
      >
        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default ThemeSegmentedPill;
