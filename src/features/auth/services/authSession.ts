import type { UserRole } from '../types/authTypes';
import { storage, authStorage, BYBLOS_AUTH_KEYS } from '@/infrastructure/storage/storage';
import apiClient from '@/infrastructure/http/apiClient';

const ALL_ROLES: UserRole[] = ['buyer', 'seller', 'admin', 'creator', 'logistics', 'marketing'];

export const ACTIVE_ROLE_KEY = BYBLOS_AUTH_KEYS.ACTIVE_ROLE;

export const getSessionKey = (role: UserRole): string => `${role}SessionActive`;

export const markRoleSessionActive = async (role: UserRole): Promise<void> => {
  await storage.set(getSessionKey(role), 'true');
};

export const clearRoleSession = async (role: UserRole): Promise<void> => {
  await storage.remove(getSessionKey(role));
};

export const setActiveRole = async (role: UserRole): Promise<void> => {
  await authStorage.setActiveRole(role);
};

export const getActiveRole = async (): Promise<UserRole | null> => {
  const value = await authStorage.getActiveRole();
  return value && ALL_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
};

export const clearActiveRole = async (): Promise<void> => {
  await storage.remove(BYBLOS_AUTH_KEYS.ACTIVE_ROLE);
};

/**
 * Enforce a single active account on the device.
 * 1. Evicts legacy storage keys across all 6 roles.
 * 2. Collects previous JWT tokens for all roles other than activeRole.
 * 3. Revokes previous tokens on the server via POST /auth/revoke-token.
 * 4. Removes token, refresh token and session marker for every role OTHER than active.
 * 5. Records active role under byblos.auth.active_role.
 */
export const enforceSingleActiveRole = async (activeRole: UserRole): Promise<void> => {
  const tokensToRevoke: string[] = [];

  for (const role of ALL_ROLES) {
    if (role === activeRole) continue;
    const oldToken = await storage.get(`${role}Token`);
    if (oldToken && typeof oldToken === 'string') {
      tokensToRevoke.push(oldToken);
    }
  }

  await authStorage.purgeLegacyAndInactiveKeys(activeRole);

  for (const role of ALL_ROLES) {
    if (role === activeRole) continue;
    await storage.remove(getSessionKey(role));
    await storage.remove(`${role}Token`);
    await storage.remove(`${role}RefreshToken`);
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
  await authStorage.clearAuth();
  for (const role of ALL_ROLES) {
    await storage.remove(`${role}SessionActive`);
    await storage.remove(`${role}Token`);
    await storage.remove(`${role}RefreshToken`);
  }
};
