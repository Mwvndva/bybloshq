import type { UserRole } from '../types/authTypes';

export const AUTH_REVALIDATION_TTL_MS = 5 * 60 * 1000;

export const getLoginPath = (role: UserRole): string => `/${role}/login`;

export const getDashboardPath = (role: UserRole): string => `/${role}/dashboard`;

export const getRoleFromRoute = (pathname: string): UserRole | null => {
  if (pathname.startsWith('/buyer')) return 'buyer';
  if (pathname.startsWith('/seller')) return 'seller';
  if (pathname.startsWith('/creator')) return 'creator';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
};

export const isPublicRoute = (pathname: string): boolean => {
  if (!pathname || pathname === '/') return true;

  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/marketing'];
  return publicPaths.some(path => pathname.includes(path));
};
