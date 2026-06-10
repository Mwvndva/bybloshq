import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react';
import adminApi from '@/api/adminApi';
import { authStateManager } from '@/lib/authState';
import { getApiForRole } from './authApi';
import {
  AUTH_REVALIDATION_TTL_MS,
  getRoleFromRoute,
  isPublicRoute,
} from './authRouting';
import { clearRoleSession, markRoleSessionActive } from './authSession';
import type { GlobalUser, UserRole } from './authTypes';

interface UseAuthRevalidationOptions {
  pathname: string;
  user: GlobalUser | null;
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setInitializing: Dispatch<SetStateAction<boolean>>;
}

export function useAuthRevalidation({
  pathname,
  user,
  setUser,
  setIsLoading,
  setInitializing,
}: UseAuthRevalidationOptions) {
  const authCheckInProgress = useRef(false);
  const initialized = useRef(false);
  const lastCheckRef = useRef<number>(0);
  const lastRouteRoleRef = useRef<UserRole | null>(null);

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
      const api = getApiForRole(currentRole);
      const profileData = currentRole === 'admin'
        ? await adminApi.getMe()
        : await api.getProfile();

      if (!profileData) {
        setUser(null);
        await clearRoleSession(currentRole);
        return;
      }

      setUser({
        role: currentRole,
        profile: profileData,
        isAuthenticated: true
      });

      await markRoleSessionActive(currentRole);
      markAuthChecked();
    } catch (error: any) {
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
  }, [markAuthChecked, pathname, setInitializing, setIsLoading, setUser, user]);

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

  return { markAuthChecked };
}
