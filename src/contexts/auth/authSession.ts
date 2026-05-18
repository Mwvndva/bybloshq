import type { UserRole } from './authTypes';

export const getSessionKey = (role: UserRole): string => `${role}SessionActive`;

export const markRoleSessionActive = (role: UserRole): void => {
  localStorage.setItem(getSessionKey(role), 'true');
};

export const clearRoleSession = (role: UserRole): void => {
  localStorage.removeItem(getSessionKey(role));
};

export const clearRoleSessionMarkers = (): void => {
  (['buyer', 'seller', 'admin', 'creator'] as UserRole[]).forEach(role => {
    localStorage.removeItem(`${role}SessionActive`);
    localStorage.removeItem(`${role}Token`);
  });
};
