import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { router } from '@/app/router';

type BackHandlerCallback = () => boolean | void;

const modalDismissStack: BackHandlerCallback[] = [];
const subNavigationStack: BackHandlerCallback[] = [];

/**
 * Register a custom modal/sheet/drawer/viewer dismiss handler (Priority 1).
 * Returns an unregister function.
 */
export function registerModalDismiss(handler: BackHandlerCallback): () => void {
  modalDismissStack.push(handler);
  return () => {
    const index = modalDismissStack.indexOf(handler);
    if (index > -1) {
      modalDismissStack.splice(index, 1);
    }
  };
}

/**
 * Register a dashboard sub-view / non-root tab handler (Priority 2).
 * Returns an unregister function.
 */
export function registerSubNavigation(handler: BackHandlerCallback): () => void {
  subNavigationStack.push(handler);
  return () => {
    const index = subNavigationStack.indexOf(handler);
    if (index > -1) {
      subNavigationStack.splice(index, 1);
    }
  };
}

/**
 * Attempts to dismiss the topmost open modal, sheet, or overlay (Priority 1).
 * Returns true if an overlay was dismissed, false otherwise.
 */
export function dismissTopmostOverlay(): boolean {
  // 1. Try explicit registered dismiss handlers (LIFO)
  if (modalDismissStack.length > 0) {
    const handler = modalDismissStack.pop();
    if (handler) {
      const result = handler();
      if (result !== false) {
        return true;
      }
    }
  }

  // 2. Try closing any open Radix UI Dialog / Popover / Sheet in DOM
  const openDialog = document.querySelector('[role="dialog"][data-state="open"]');
  if (openDialog) {
    // Send Escape key event to trigger Radix dismiss
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(escapeEvent);
    return true;
  }

  return false;
}

/**
 * Attempts to handle dashboard in-memory sub-navigation (Priority 2).
 * Returns true if a sub-navigation state was popped, false otherwise.
 */
export function handleSubNavigation(): boolean {
  if (subNavigationStack.length > 0) {
    const handler = subNavigationStack.pop();
    if (handler) {
      const result = handler();
      if (result !== false) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Authenticated dashboard roots for native Android navigation.
 */
const AUTHENTICATED_DASHBOARD_ROOTS = [
  '/buyer/dashboard',
  '/buyer',
  '/seller/dashboard',
  '/seller',
  '/creator/dashboard',
  '/creator',
  '/mzigo/dashboard',
  '/mzigo',
  '/logistics/dashboard',
  '/logistics'
];

/**
 * Checks if a pathname represents an authenticated dashboard root.
 */
export function isAuthenticatedDashboardRoot(pathname: string): boolean {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  return AUTHENTICATED_DASHBOARD_ROOTS.includes(cleanPath);
}

/**
 * Checks if a pathname is a buyer sub-screen / detail screen with a parent.
 */
function handleBuyerRouteBack(pathname: string): boolean {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  // Buyer shop page detail -> return to buyer dashboard
  if (cleanPath.startsWith('/buyer/shop/')) {
    router.navigate('/buyer/dashboard');
    return true;
  }

  // Buyer sub-sections (orders, shops, wishlist, profile) -> return to buyer dashboard root
  if (['/buyer/orders', '/buyer/shops', '/buyer/wishlist', '/buyer/profile'].includes(cleanPath)) {
    router.navigate('/buyer/dashboard');
    return true;
  }

  return false;
}

let isInitialized = false;

/**
 * Global Android Back Button initialization hook.
 * Intercepts physical/gesture back button on Capacitor Android and adheres
 * strictly to the native back navigation hierarchy:
 * 1. Overlays / Modals / Sheets
 * 2. In-memory dashboard subsections / tabs
 * 3. Detail / child routes -> parent dashboard root
 * 4. Authenticated Dashboard Root -> App.exitApp() (never drops to public '/')
 * 5. Public / guest browsing -> normal history or exit
 */
export function useAndroidBackHandler() {
  useEffect(() => {
    if (!isNativeApp() || isInitialized) return;

    isInitialized = true;
    const backListener = App.addListener('backButton', ({ canGoBack }) => {
      // Priority 1: If an overlay/modal is open, dismiss it and STOP.
      const overlayDismissed = dismissTopmostOverlay();
      if (overlayDismissed) {
        return;
      }

      // Priority 2: If a dashboard has an active in-memory non-root sub-view, revert it and STOP.
      const subNavHandled = handleSubNavigation();
      if (subNavHandled) {
        return;
      }

      const currentPathname = router.state.location.pathname;

      // Priority 3: If current screen is a detail / child screen with a known parent, navigate to parent.
      if (handleBuyerRouteBack(currentPathname)) {
        return;
      }

      // Priority 4: If at an authenticated dashboard root, EXIT APP (never go to '/').
      if (isAuthenticatedDashboardRoot(currentPathname)) {
        App.exitApp();
        return;
      }

      // Priority 5: Public / Guest route navigation.
      if (currentPathname === '/' || currentPathname === '') {
        App.exitApp();
        return;
      }

      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    return () => {
      backListener.then(l => l.remove()).catch(() => {});
      isInitialized = false;
    };
  }, []);
}
