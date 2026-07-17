import type { UserRole } from '../types/authTypes';
import { storage } from '@/lib/storage';

const ALL_ROLES: UserRole[] = ['buyer', 'seller', 'admin', 'creator'];

// Points at the single account that is currently signed in on this device. Both
// the request interceptor and the cold-start restore consult this so they bind
// to the account the user actually logged into — not whichever role token
// happens to come first in a hardcoded priority list.
export const ACTIVE_ROLE_KEY = 'activeRole';

export const getSessionKey = (role: UserRole): string => `${role}SessionActive`;

export const markRoleSessionActive = async (role: UserRole): Promise<void> => {
  await storage.set(getSessionKey(role), 'true');
};

export const clearRoleSession = async (role: UserRole): Promise<void> => {
  await storage.remove(getSessionKey(role));
};

export const setActiveRole = async (role: UserRole): Promise<void> => {
  await storage.set(ACTIVE_ROLE_KEY, role);
};

export const getActiveRole = async (): Promise<UserRole | null> => {
  const value = await storage.get(ACTIVE_ROLE_KEY);
  return value && ALL_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
};

export const clearActiveRole = async (): Promise<void> => {
  await storage.remove(ACTIVE_ROLE_KEY);
};

/**
 * Enforce a single active account on the device. Removes the token, refresh
 * token and session marker for every role OTHER than the one just signed in, so
 * a leftover session from a different account can never be picked up by the
 * request interceptor or the cold-start restore. Records the active role.
 */
export const enforceSingleActiveRole = async (activeRole: UserRole): Promise<void> => {
  for (const role of ALL_ROLES) {
    if (role === activeRole) continue;
    await storage.remove(getSessionKey(role));
    await storage.remove(`${role}Token`);
    await storage.remove(`${role}RefreshToken`);
    try { localStorage.removeItem(getSessionKey(role)); } catch { /* ignore */ }
  }
  await setActiveRole(activeRole);
};

export const clearRoleSessionMarkers = async (): Promise<void> => {
  for (const role of ALL_ROLES) {
    await storage.remove(`${role}SessionActive`);
    await storage.remove(`${role}Token`);
    await storage.remove(`${role}RefreshToken`);
  }
  await clearActiveRole();
};


