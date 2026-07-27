import { useCallback, useEffect, useState } from 'react';
import { ThemeSegmentedPill } from '@/components/common/ThemeSegmentedPill';

export type ShopPageTheme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'byblos-shop-page-theme';

function getSystemIsDark(): boolean {
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
 * Visitor's light/dark/system toggle for the storefront — the same consistent
 * ThemeSegmentedPill used across the app, floated top-right. Wrapped in `dark` so
 * the control keeps its glassy dark look over any storefront (the shop page is
 * prop-themed, not `.dark`-scoped, so the pill doesn't otherwise track it).
 */
export function ShopPageThemePicker({ theme, onThemeChange }: ShopPageThemePickerProps) {
  return (
    <div className="dark fixed right-3 top-3 z-30 rounded-full bg-black/40 p-0.5 shadow-lg backdrop-blur-md sm:right-6 sm:top-6">
      <ThemeSegmentedPill value={theme} onChange={onThemeChange} showLabels={false} />
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
