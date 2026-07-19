import apiClient from '@/lib/apiClient';

export interface MembershipStatus {
  isMember: boolean;
  memberNumber: number | null;
  joinedAt: string | null;
}

/** Current buyer's membership status — drives whether the opt-in prompt shows. */
export const getMembership = async (): Promise<MembershipStatus> => {
  const res = await apiClient.get('/buyers/membership');
  return res.data?.data as MembershipStatus;
};

/** Opt the buyer into Byblos membership and mint their membership number. */
export const joinMembership = async (): Promise<MembershipStatus> => {
  const res = await apiClient.post('/buyers/membership/join');
  return res.data?.data as MembershipStatus;
};
