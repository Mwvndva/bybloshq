import buyerApi from '@/features/buyer/api';
import { sellerApi } from '@/features/seller/api';
import adminApi from '@/features/admin/api';
import creatorApi from '@/features/creator/api';
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


