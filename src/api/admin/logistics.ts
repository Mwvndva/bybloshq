import { api, AdminLogisticsStatusFilter, AdminLogisticsResponse } from './instance';

export async function getLogisticsRequests({
  status = 'all',
  sort = 'priority',
}: {
  status?: AdminLogisticsStatusFilter;
  sort?: import('@/api/logistics').LogisticsSort;
} = {}) {
  const response = await api.get('/admin/logistics/requests', {
    params: { status, sort },
  });
  return response.data?.data as AdminLogisticsResponse;
}

export async function updateLogisticsLegStatus({
  requestId,
  legType,
  status,
  reason,
}: {
  requestId: number;
  legType: import('@/api/logistics').LogisticsLegType;
  status: import('@/api/logistics').LogisticsStatusUpdate;
  reason?: string;
}) {
  const response = await api.patch(`/admin/logistics/requests/${requestId}/legs/${legType}/status`, {
    status,
    reason,
  });
  return response.data?.data;
}

export async function resolveLogisticsDispute({
  requestId,
  resolution,
  note,
}: {
  requestId: number;
  resolution: 'manual_review' | 'continue_delivery' | 'mark_failed' | 'resolved';
  note?: string;
}) {
  const response = await api.post(`/admin/logistics/requests/${requestId}/disputes/resolve`, {
    resolution,
    note,
  });
  return response.data?.data;
}


