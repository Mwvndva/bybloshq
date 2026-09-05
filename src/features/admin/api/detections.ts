import { api } from './instance';
import type { FlaggedEarning, FlaggedEarningAction } from '../types/detections';

export async function getFlaggedEarnings(limit = 50) {
  const response = await api.get(`/admin/creators/flagged-earnings?limit=${limit}`);
  return response.data as { status: string; results: number; data: FlaggedEarning[] };
}

export async function resolveFlaggedEarning(
  earningType: FlaggedEarning['earning_type'],
  id: number | string,
  data: { action: FlaggedEarningAction; notes?: string },
  headers: Record<string, string>
) {
  const response = await api.patch(
    `/admin/creators/flagged-earnings/${earningType}/${id}/resolve`,
    data,
    { headers }
  );
  return response.data;
}
