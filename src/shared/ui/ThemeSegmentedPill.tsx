import { type ComponentType, type KeyboardEvent } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/shared/utils/formatting';
import type { AppTheme } from '@/shared/hooks/useAppTheme';

interface ThemeSegmentedPillProps {
  value: AppTheme;
  onChange: (theme: AppTheme) => void;
  /** false = icon-only compact variant (for tight headers). Default true. */
  showLabels?: boolean;
  className?: string;
}

const SEGMENTS: { value: AppTheme; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/**
 * The one consistent theme selector across the app: a segmented "long pill" with
 * three inner segments (System / Light / Dark). Presentational — wire `value` and
 * `onChange` to a scope via `useThemeScope`. Theme-aware, so it looks right on any
 * surface in either mode.
 */
export function ThemeSegmentedPill({ value, onChange, showLabels = true, className }: ThemeSegmentedPillProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = SEGMENTS.findIndex((segment) => segment.value === value);
    const delta = event.key === 'ArrowRight' ? 1 : SEGMENTS.length - 1;
    onChange(SEGMENTS[(index + delta) % SEGMENTS.length].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-white/10 dark:bg-white/[0.04]',
        className,
      )}
    >
      {SEGMENTS.map(({ value: segmentValue, label, Icon }) => {
        const active = value === segmentValue;
        return (
          <button
            key={segmentValue}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(segmentValue)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#f5c518)]/50',
              showLabels ? 'px-3' : 'px-2.5',
              active
                ? 'bg-white text-slate-950 shadow-sm dark:bg-white/15 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-white/55 dark:hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {showLabels && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSegmentedPill;
