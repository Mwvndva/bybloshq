import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, ShieldCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminLogisticsStatusFilter } from '@/api/admin';
import { adminQueryKeys } from '@/api/queryKeys';
import type {
  LogisticsLeg,
  LogisticsLegType,
  LogisticsRequestCard,
  LogisticsSort,
  LogisticsStatusUpdate,
} from '@/api/logistics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STATUS_FILTERS, SORT_OPTIONS, label } from './adminLogisticsTab.utils';
import { LogisticsAdminCard } from './adminLogisticsTab.components';

export function AdminLogisticsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AdminLogisticsStatusFilter>('all');
  const [sort, setSort] = useState<LogisticsSort>('priority');
  const [draftStatuses, setDraftStatuses] = useState<Record<string, LogisticsStatusUpdate>>({});
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const logisticsQuery = useQuery({
    queryKey: adminQueryKeys.logistics(status, sort),
    queryFn: () => adminApi.getLogisticsRequests({ status, sort }),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: adminApi.updateLogisticsLegStatus,
    onSuccess: () => {
      toast.success('Logistics status updated');
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Status update failed', {
        description: err?.response?.data?.message || err?.message || 'The logistics status was not updated.',
      });
    },
    onSettled: () => setUpdatingKey(null),
  });

  const disputeMutation = useMutation({
    mutationFn: adminApi.resolveLogisticsDispute,
    onSuccess: () => {
      toast.success('Dispute action recorded');
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Dispute action failed', {
        description: err?.response?.data?.message || err?.message || 'The dispute action was not recorded.',
      });
    },
  });

  const dashboard = logisticsQuery.data;
  const requests = useMemo(() => dashboard?.requests || [], [dashboard]);

  const handleDraftStatus = (key: string, nextStatus: LogisticsStatusUpdate) => {
    setDraftStatuses((current) => ({ ...current, [key]: nextStatus }));
  };

  const handleOverride = (requestId: number, legType: LogisticsLegType, nextStatus: LogisticsStatusUpdate) => {
    const reason = window.prompt('Reason for admin logistics override?') || '';
    setUpdatingKey(`${requestId}:${legType}`);
    statusMutation.mutate({ requestId, legType, status: nextStatus, reason });
  };

  const handleResolveDispute = (
    requestId: number,
    resolution: 'manual_review' | 'continue_delivery' | 'mark_failed' | 'resolved'
  ) => {
    const note = window.prompt('Add an admin note for the tracking history.') || '';
    disputeMutation.mutate({ requestId, resolution, note });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/10 bg-[#0A0A0A] text-white">
          <CardContent className="p-4">
            <Truck className="mb-3 h-5 w-5 text-yellow-300" />
            <p className="text-xs uppercase tracking-widest text-white/50">Total</p>
            <p className="text-2xl font-semibold">{dashboard?.count || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-300/20 bg-red-500/10 text-white">
          <CardContent className="p-4">
            <AlertTriangle className="mb-3 h-5 w-5 text-red-300" />
            <p className="text-xs uppercase tracking-widest text-white/50">Failed</p>
            <p className="text-2xl font-semibold">{dashboard?.summary?.failed || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-300/20 bg-yellow-300/10 text-white">
          <CardContent className="p-4">
            <Clock className="mb-3 h-5 w-5 text-yellow-300" />
            <p className="text-xs uppercase tracking-widest text-white/50">Delayed</p>
            <p className="text-2xl font-semibold">{dashboard?.summary?.delayed || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-300/20 bg-cyan-300/10 text-white">
          <CardContent className="p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-cyan-200" />
            <p className="text-xs uppercase tracking-widest text-white/50">Review</p>
            <p className="text-2xl font-semibold">{dashboard?.summary?.manualReview || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#0A0A0A]/70 text-white">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl text-white">Logistics Oversight</CardTitle>
            <p className="mt-1 text-sm text-white/60">Delivered completes logistics only. Escrow release stays under order completion rules.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                onClick={() => setStatus(filter.value)}
                className={status === filter.value ? 'bg-yellow-300 text-black hover:bg-yellow-200' : 'bg-white/5 text-white hover:bg-white hover:text-black'}
              >
                {filter.label}
              </Button>
            ))}
            <select
              className="h-9 rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
              value={sort}
              onChange={(event) => setSort(event.target.value as LogisticsSort)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {logisticsQuery.isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => <div key={item} className="h-80 animate-pulse rounded-3xl bg-white/5" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-black p-8 text-center text-white/60">
              No logistics requests match this filter.
            </div>
          ) : (
            <div className="grid gap-5">
              {requests.map((request) => (
                <LogisticsAdminCard
                  key={request.id}
                  request={request}
                  draftStatuses={draftStatuses}
                  onDraftStatus={handleDraftStatus}
                  onOverride={handleOverride}
                  onResolveDispute={handleResolveDispute}
                  updatingKey={updatingKey}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


