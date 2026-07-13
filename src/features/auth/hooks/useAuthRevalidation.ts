import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authStateManager } from '@/lib/authState';
import { storage } from '@/lib/storage';
import {
  AUTH_REVALIDATION_TTL_MS,
  getDashboardPath,
  getRoleFromRoute,
  isPublicRoute,
} from '../utils/authRouting';
import { clearRoleSession, getSessionKey, markRoleSessionActive } from '../services/authSession';
import type { GlobalUser, UserRole } from '../types/authTypes';
import {
  buyerProfileQueryOptions,
  sellerProfileQueryOptions,
  adminProfileQueryOptions,
  creatorProfileQueryOptions,
} from '@/hooks/auth/useAuthQueries';

interface UseAuthRevalidationOptions {
  pathname: string;
  user: GlobalUser | null;
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setInitializing: Dispatch<SetStateAction<boolean>>;
  navigate: NavigateFunction;
}

export function useAuthRevalidation({
  pathname,
  user,
  setUser,
  setIsLoading,
  setInitializing,
  navigate,
}: UseAuthRevalidationOptions) {
  const authCheckInProgress = useRef(false);
  const initialized = useRef(false);
  const lastCheckRef = useRef<number>(0);
  const lastRouteRoleRef = useRef<UserRole | null>(null);
  const queryClient = useQueryClient();

  const markAuthChecked = useCallback(() => {
    lastCheckRef.current = Date.now();
  }, []);

  const checkAuth = useCallback(async (force = false) => {
    if (authCheckInProgress.current && !force) return;

    const currentRole = getRoleFromRoute(pathname);
    const isStale = Date.now() - lastCheckRef.current > AUTH_REVALIDATION_TTL_MS;

    if (!force && user && user.role === currentRole && user.isAuthenticated && !isStale) {
      setIsLoading(false);
      setInitializing(false);
      return;
    }

    if (!currentRole || isPublicRoute(pathname)) {
      setIsLoading(false);
      setInitializing(false);
      return;
    }

    authCheckInProgress.current = true;
    setIsLoading(true);
    authStateManager.setRehydrating(true);

    try {
      let queryOpts;
      if (currentRole === 'buyer') {
        queryOpts = buyerProfileQueryOptions;
      } else if (currentRole === 'seller') {
        queryOpts = sellerProfileQueryOptions;
      } else if (currentRole === 'admin') {
        queryOpts = adminProfileQueryOptions;
      } else {
        queryOpts = creatorProfileQueryOptions;
      }

      // Fetch or get query data
      const profileData = await queryClient.fetchQuery(queryOpts);

      if (!profileData) {
        setUser(null);
        await clearRoleSession(currentRole);
        return;
      }

      setUser({
        role: currentRole,
        profile: profileData as import("@/features/auth/types/authTypes").UserProfile,
        isAuthenticated: true
      });

      await markRoleSessionActive(currentRole);
      markAuthChecked();
    } catch (error) {
      if (currentRole === 'buyer' && (error.response?.status === 404 || error.response?.status === 401)) {
        // Preserve the previous cross-role behavior: seller sessions should not be cleared by a buyer route probe.
      } else {
        setUser(null);
        await clearRoleSession(currentRole);
      }
    } finally {
      authStateManager.setRehydrating(false);
      setIsLoading(false);
      setInitializing(false);
      authCheckInProgress.current = false;
    }
  }, [markAuthChecked, pathname, setInitializing, setIsLoading, setUser, user, queryClient]);

  useEffect(() => {
    const currentRole = getRoleFromRoute(pathname);
    const routeRoleChanged = lastRouteRoleRef.current !== currentRole;
    const isStale = Date.now() - lastCheckRef.current > AUTH_REVALIDATION_TTL_MS;
    lastRouteRoleRef.current = currentRole;

    if (!initialized.current || routeRoleChanged || isStale) {
      initialized.current = true;
      checkAuth(routeRoleChanged || isStale);
    }
  }, [pathname, checkAuth]);

  useEffect(() => {
    const revalidateOnResume = () => {
      const currentRole = getRoleFromRoute(pathname);
      if (!currentRole || isPublicRoute(pathname)) return;
      const isStale = Date.now() - lastCheckRef.current > AUTH_REVALIDATION_TTL_MS;
      if (isStale) {
        checkAuth(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateOnResume();
      }
    };

    window.addEventListener('focus', revalidateOnResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', revalidateOnResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname, checkAuth]);

  // Cold-start session restore. On native the app relaunches at "/" (a public
  // route), so the route-based checkAuth never re-fetches the profile and a
  // still-valid persisted token looks logged-out. If a role's session marker
  // survived, restore that session from its stored token and land on its
  // dashboard so the user is not forced to log in again.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bootPath = pathname;
      if (getRoleFromRoute(bootPath) || !isPublicRoute(bootPath)) return;
      if (user) return;
      if (['/reset-password', '/forgot-password', '/payment', '/checkout'].some((p) => bootPath.includes(p))) return;

      const roles: UserRole[] = ['seller', 'buyer', 'creator', 'admin'];
      let activeRole: UserRole | null = null;
      for (const r of roles) {
        if ((await storage.get(getSessionKey(r))) === 'true') {
          activeRole = r;
          break;
        }
      }
      if (!activeRole || cancelled) return;

      let queryOpts;
      if (activeRole === 'buyer') queryOpts = buyerProfileQueryOptions;
      else if (activeRole === 'seller') queryOpts = sellerProfileQueryOptions;
      else if (activeRole === 'admin') queryOpts = adminProfileQueryOptions;
      else queryOpts = creatorProfileQueryOptions;

      try {
        const profileData = await queryClient.fetchQuery(queryOpts);
        if (cancelled) return;
        if (!profileData) {
          await clearRoleSession(activeRole);
          return;
        }
        setUser({
          role: activeRole,
          profile: profileData as import('@/features/auth/types/authTypes').UserProfile,
          isAuthenticated: true,
        });
        await markRoleSessionActive(activeRole);
        markAuthChecked();
        if (bootPath === '/') navigate(getDashboardPath(activeRole), { replace: true });
      } catch {
        // Token invalid/expired — drop the marker and leave the user on the landing page.
        if (!cancelled) await clearRoleSession(activeRole);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Boot-only: run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { markAuthChecked };
}


