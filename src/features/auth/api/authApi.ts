import buyerApi from '@/api/buyer';
import { sellerApi } from '@/api/seller';
import adminApi from '@/api/admin';
import creatorApi from '@/api/creator';
import type { UserRole } from '../types/authTypes';

export const getApiForRole = (role: UserRole): unknown => {
  switch (role) {
    case 'buyer':
      return buyerApi;
    case 'seller':
      return sellerApi;
    case 'admin':
      return adminApi;
    case 'creator':
      return creatorApi;
    default:
      throw new Error(`Unknown role: ${role}`);
  }
};


