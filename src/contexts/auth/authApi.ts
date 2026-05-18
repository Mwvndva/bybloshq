import buyerApi from '@/api/buyerApi';
import { sellerApi } from '@/api/sellerApi';
import adminApi from '@/api/adminApi';
import creatorApi from '@/api/creatorApi';
import type { UserRole } from './authTypes';

export const getApiForRole = (role: UserRole): any => {
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
