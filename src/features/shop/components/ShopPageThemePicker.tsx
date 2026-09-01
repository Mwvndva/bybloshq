import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { cn } from '@/shared/utils/formatting';

export type ShopPageTheme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'byblos-shop-page-theme';

function getSystemIsDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveShopTheme(pref: ShopPageTheme): 'light' | 'dark' {
  if (pref === 'system') return getSystemIsDark() ? 'dark' : 'light';
  return pref;
}

interface ShopPageThemePickerProps {
  theme: ShopPageTheme;
  onThemeChange: (t: ShopPageTheme) => void;
}

/**
 * Clean icon-only theme dropdown for the shop page: displays Sun/Moon icon with
 * a simple dropdown to switch between light and dark modes without 'D' and 'L' text.
 */
export function ShopPageThemePicker({ theme, onThemeChange }: ShopPageThemePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolved = resolveShopTheme(theme);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="fixed right-3 top-[calc(0.75rem+var(--sat,0px))] z-30 sm:right-6 sm:top-6"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Change theme"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-slate-800 shadow-md backdrop-blur-md transition-colors hover:bg-white dark:border-white/15 dark:bg-black/60 dark:text-white dark:hover:bg-black/80"
      >
        {resolved === 'dark' ? (
          <Moon className="h-4 w-4 text-yellow-400" />
        ) : (
          <Sun className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        )}
        <ChevronDown className={cn('h-3 w-3 opacity-60 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 flex flex-col gap-1 rounded-2xl border border-black/10 bg-white/95 p-1 shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-zinc-900/95">
          <button
            type="button"
            onClick={() => {
              onThemeChange('light');
              setIsOpen(false);
            }}
            aria-label="Light mode"
            title="Light mode"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
              resolved === 'light'
                ? 'bg-yellow-400/25 text-yellow-600 dark:text-yellow-400'
                : 'text-slate-600 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10'
            )}
          >
            <Sun className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              onThemeChange('dark');
              setIsOpen(false);
            }}
            aria-label="Dark mode"
            title="Dark mode"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
              resolved === 'dark'
                ? 'bg-yellow-400/25 text-yellow-400'
                : 'text-slate-600 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10'
            )}
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useShopPageTheme() {
  const [theme, setThemeState] = useState<ShopPageTheme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ShopPageTheme) || 'system';
  });

  const setTheme = useCallback((next: ShopPageTheme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const resolved = resolveShopTheme(theme);

  // Listen to OS changes when on "system"
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState('system'); // re-render to recompute
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme, resolved };
}
