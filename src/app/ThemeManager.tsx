import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  applyResolvedTheme,
  readScopePref,
  resolveTheme,
  type ThemeScope,
} from '@/hooks/useAppTheme';

/**
 * A scope is only actively managed once its surface renders correctly in both
 * light and dark. Until then ThemeManager applies a fixed fallback that preserves
 * the surface's current look, so the migration never regresses.
 *   seller -> flips true in Stage B (dark-locked until then)
 *   shop   -> flips true in Stage C (left untouched until then)
 */
const SCOPE_READY: Record<ThemeScope, boolean> = {
  default: true,
  buyer: true,
  ambassador: true,
  seller: true,
  shop: false,
};

function scopeForPath(pathname: string): ThemeScope {
  if (pathname.startsWith('/seller')) return 'seller';
  if (pathname.startsWith('/creator')) return 'ambassador';
  if (pathname.startsWith('/buyer')) return 'buyer'; // includes /buyer/shop/*
  if (pathname.startsWith('/shop/')) return 'shop';  // public storefront
  return 'default';
}

function applyForPath(pathname: string): void {
  const scope = scopeForPath(pathname);
  if (!SCOPE_READY[scope]) {
    // Seller is hardcoded dark until Stage B; shop keeps its accent-driven look
    // until Stage C (leave <html> as-is).
    if (scope === 'seller') applyResolvedTheme('dark');
    return;
  }
  applyResolvedTheme(resolveTheme(readScopePref(scope)));
}

/**
 * Owns <html>'s theme for the whole app. Maps the active route to a theme scope
 * and applies that scope's preference, so every surface, its modals, and the
 * global toasts follow the right per-scope theme. Mounted once, inside the router.
 */
export function ThemeManager() {
  const { pathname } = useLocation();

  // Apply on route change, and follow the OS while the active scope is on 'system'.
  useEffect(() => {
    applyForPath(pathname);

    const scope = scopeForPath(pathname);
    if (!SCOPE_READY[scope] || readScopePref(scope) !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyForPath(pathname);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [pathname]);

  // Cross-tab: re-apply when a theme preference changes in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('byblos-theme-')) applyForPath(window.location.pathname);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}

export default ThemeManager;
