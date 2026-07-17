import apiClient from '@/lib/apiClient';

export type SwitchableRole = 'buyer' | 'seller' | 'creator';

export interface MyAccounts {
  current: 'buyer' | 'seller' | 'creator' | 'admin';
  accounts: Record<SwitchableRole, boolean>;
}

/** Which account types (buyer / seller / ambassador) the signed-in user owns. */
export const getMyAccounts = async (): Promise<MyAccounts> => {
  const res = await apiClient.get('/auth/accounts');
  return res.data?.data as MyAccounts;
};

/** Mint a token for another role the user owns and switch into that account. */
export const switchAccountRequest = async (
  role: SwitchableRole,
): Promise<{ token?: string; refreshToken?: string; role: SwitchableRole }> => {
  const res = await apiClient.post('/auth/switch', { role });
  return res.data?.data;
};
