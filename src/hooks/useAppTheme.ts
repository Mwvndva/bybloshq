import { useCallback, useEffect, useState } from 'react';

export type AppTheme = 'system' | 'light' | 'dark';
export type ThemeScope = 'buyer' | 'seller' | 'ambassador' | 'shop' | 'default';

const LEGACY_KEY = 'byblos-app-theme';
const keyFor = (scope: ThemeScope) => `byblos-theme-${scope}`;

function getSystemIsDark(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: AppTheme): 'light' | 'dark' {
  if (pref === 'system') return getSystemIsDark() ? 'dark' : 'light';
  return pref;
}

/** Apply a resolved theme to <html> — the single place that touches the class/attr. */
export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.setAttribute('data-theme', resolved);
  el.classList.toggle('dark', resolved === 'dark');
  el.classList.toggle('light', resolved === 'light');
}

function isAppTheme(v: unknown): v is AppTheme {
  return v === 'system' || v === 'light' || v === 'dark';
}

/** Read a scope's preference, seeding from the legacy global key, defaulting to 'system'. */
export function readScopePref(scope: ThemeScope): AppTheme {
  try {
    const v = localStorage.getItem(keyFor(scope));
    if (isAppTheme(v)) return v;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (isAppTheme(legacy)) return legacy;
  } catch { /* localStorage unavailable */ }
  return 'system';
}

export function writeScopePref(scope: ThemeScope, pref: AppTheme): void {
  try { localStorage.setItem(keyFor(scope), pref); } catch { /* ignore */ }
}

/**
 * Read/write one scope's theme preference. A scope's selector only renders on its
 * own surface (the active route), so `setTheme` applies to <html> immediately and
 * the effect keeps <html> in sync while the surface is mounted, following the OS
 * when the preference is 'system'.
 */
export function useThemeScope(scope: ThemeScope): { theme: AppTheme; setTheme: (t: AppTheme) => void } {
  const [theme, setThemeState] = useState<AppTheme>(() => readScopePref(scope));

  useEffect(() => {
    applyResolvedTheme(resolveTheme(theme));
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyResolvedTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: AppTheme) => {
    writeScopePref(scope, next);
    setThemeState(next);
    applyResolvedTheme(resolveTheme(next));
  }, [scope]);

  return { theme, setTheme };
}

/** Back-compat: existing callers act on the default (non-dashboard) scope. */
export function useAppTheme() {
  return useThemeScope('default');
}
