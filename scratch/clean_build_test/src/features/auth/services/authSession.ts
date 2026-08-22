import type { UserRole } from '../types/authTypes';
import { storage } from '@/infrastructure/storage/storage';
import apiClient from '@/infrastructure/http/apiClient';

const ALL_ROLES: UserRole[] = ['buyer', 'seller', 'admin', 'creator', 'logistics', 'marketing'];

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
 * Enforce a single active account on the device.
 * 1. Collects previous JWT tokens for all roles other than activeRole.
 * 2. Revokes previous tokens on the server via POST /auth/revoke-token.
 * 3. Removes the token, refresh token and session marker for every role OTHER than the active one.
 * 4. Records active role.
 */
export const enforceSingleActiveRole = async (activeRole: UserRole): Promise<void> => {
  const tokensToRevoke: string[] = [];

  for (const role of ALL_ROLES) {
    if (role === activeRole) continue;
    const oldToken = await storage.get(`${role}Token`);
    if (oldToken && typeof oldToken === 'string') {
      tokensToRevoke.push(oldToken);
    }
    await storage.remove(getSessionKey(role));
    await storage.remove(`${role}Token`);
    await storage.remove(`${role}RefreshToken`);
    try { localStorage.removeItem(getSessionKey(role)); } catch { /* ignore */ }
  }

  if (tokensToRevoke.length > 0) {
    try {
      await apiClient.post('/auth/revoke-token', { tokens: tokensToRevoke });
    } catch {
      // Ignore network errors during background token revocation
    }
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
