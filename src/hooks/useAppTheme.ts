import { useCallback, useEffect, useState } from 'react';

export type AppTheme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'byblos-app-theme';

function getSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(pref: AppTheme): 'light' | 'dark' {
  if (pref === 'system') return getSystemIsDark() ? 'dark' : 'light';
  return pref;
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved);
}

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as AppTheme) || 'dark';
  });

  // Apply on mount and whenever preference changes
  useEffect(() => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);

    if (theme !== 'system') return;

    // Watch OS preference when set to "system"
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: AppTheme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    applyTheme(resolveTheme(next));
  }, []);

  return { theme, setTheme };
}
