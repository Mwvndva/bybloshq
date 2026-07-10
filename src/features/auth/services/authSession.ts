import type { UserRole } from '../types/authTypes';
import { storage } from '@/lib/storage';

export const getSessionKey = (role: UserRole): string => `${role}SessionActive`;

export const markRoleSessionActive = async (role: UserRole): Promise<void> => {
  await storage.set(getSessionKey(role), 'true');
};

export const clearRoleSession = async (role: UserRole): Promise<void> => {
  await storage.remove(getSessionKey(role));
};

export const clearRoleSessionMarkers = async (): Promise<void> => {
  const roles: UserRole[] = ['buyer', 'seller', 'admin', 'creator'];
  for (const role of roles) {
    await storage.remove(`${role}SessionActive`);
    await storage.remove(`${role}Token`);
  }
};


