/**
 * Router bridge for non-React modules.
 *
 * Modules that live outside the React tree — the axios interceptor, the native
 * push-notification handler — used to route by assigning `window.location.href`
 * / `window.location.assign`. That is a HARD navigation: it reloads the whole
 * SPA, wipes the in-memory auth state, and on native (Capacitor, served from
 * `https://localhost/`) cold-reboots the WebView. The visible symptom was users
 * being bounced straight back to the login screen right after signing in.
 *
 * Instead, the app registers its React Router `navigate` here once it is mounted,
 * and those modules call `appNavigate` / `emitSessionExpired` to move around
 * client-side (History API, no reload). A hard navigation is only used as a
 * fallback during very early boot, before the router has mounted.
 *
 * This module has NO imports on purpose — it is a leaf, so importing it from
 * `apiClient`, `AuthCoreContext`, and `mobileNotifications` cannot create a
 * circular dependency.
 */

export const SESSION_EXPIRED_EVENT = 'byblos:session-expired';

export interface SessionExpiredDetail {
  /** Login route the user should land on (role-specific). */
  redirectPath: string;
}

type NavigateOptions = { replace?: boolean };
type AppNavigate = (path: string, options?: NavigateOptions) => void;

let appNavigator: AppNavigate | null = null;

/** Called once by the auth provider (which has `useNavigate`) after mount. */
export function registerAppNavigator(navigate: AppNavigate): void {
  appNavigator = navigate;
}

/** Cleanup on unmount; only clears if the same navigator is still registered. */
export function clearAppNavigator(navigate: AppNavigate): void {
  if (appNavigator === navigate) {
    appNavigator = null;
  }
}

/** True once the app router is mounted and can handle client-side navigation. */
export function isAppNavigatorReady(): boolean {
  return appNavigator !== null;
}

/**
 * Navigate via the app's React Router instance (client-side, no page reload).
 * Returns `false` when the router is not mounted yet, so the caller can fall
 * back to a hard navigation for the early-boot edge case.
 */
export function appNavigate(path: string, options?: NavigateOptions): boolean {
  if (!appNavigator) return false;
  appNavigator(path, options);
  return true;
}

/**
 * Signal that the session has expired. The auth provider listens for this,
 * clears the in-memory user, and routes to `redirectPath` client-side — no
 * reload, so native does not cold-reboot the WebView. Returns `false` when the
 * router is not mounted yet so the caller can hard-navigate as a last resort.
 */
export function emitSessionExpired(redirectPath: string): boolean {
  if (!isAppNavigatorReady()) return false;
  globalThis.dispatchEvent(
    new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
      detail: { redirectPath },
    }),
  );
  return true;
}
