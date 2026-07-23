import apiClient from '@/lib/apiClient';

export interface MembershipStatus {
  isMember: boolean;
  memberNumber: number | null;
  joinedAt: string | null;
}

export async function getMembership(): Promise<MembershipStatus> {
  const response = await apiClient.get<{ data: MembershipStatus }>('/buyers/membership');
  return response.data?.data ?? { isMember: false, memberNumber: null, joinedAt: null };
}

export async function joinMembership(): Promise<MembershipStatus> {
  const response = await apiClient.post<{ data: MembershipStatus }>('/buyers/membership/join');
  return response.data?.data ?? { isMember: true, memberNumber: null, joinedAt: new Date().toISOString() };
}
