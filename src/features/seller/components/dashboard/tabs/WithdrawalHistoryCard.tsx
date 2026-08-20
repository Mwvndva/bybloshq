import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { getWithdrawalFee } from '../dashboardUtils';
import type { ApiWithdrawalRequest } from '@/shared/types/api/withdrawal';
import { formatKes, formatSettlementTime } from './withdrawalsTab.utils';

export function WithdrawalHistoryCard({ request }: { request: ApiWithdrawalRequest }) {
  return (
    <Card key={request.id} className="group transition-all duration-300 bg-[#0a0a0a] border border-white/10 text-white shadow-sm">
                <CardContent className="p-3 sm:p-5 lg:p-6">
                  <div className="flex min-w-0 justify-between items-start">
                    <div className="space-y-2 min-w-0 w-full">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <p className="text-base sm:text-xl font-black text-white truncate">
                          {formatKes(request.amount)}
                        </p>
                        <Badge
                          variant="outline"
                          className={`${request.status === 'processing'
                            ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                            : request.status === 'completed'
                              ? 'bg-green-500/15 text-green-300 border-green-500/30'
                              : request.status === 'failed'
                                ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            } rounded-full px-3 py-1 font-semibold`}
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/60 break-words">
                        M-Pesa: {request.mpesaNumber} ({request.mpesaName})
                      </p>
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Requested</p>
                          <p className="text-xs font-semibold text-white">{new Date(request.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Processed</p>
                          <p className="text-xs font-semibold text-white">{request.processedAt ? new Date(request.processedAt).toLocaleString() : 'Pending'}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Charge</p>
                          <p className="text-xs font-semibold text-white">{formatKes(request.withdrawalFee || getWithdrawalFee(request.amount))}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Provider Ref</p>
                          <p className="truncate text-xs font-semibold text-white">{request.providerReference || 'Pending'}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">M-Pesa Receipt</p>
                          <p className="truncate text-xs font-semibold text-white">{request.mpesaReceipt || 'Pending'}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Processed By</p>
                          <p className="text-xs font-semibold text-white">{request.processedBy || 'System'}</p>
                        </div>
                      </div>
                      {request.status === 'failed' && request.failureReason && (
                        <div className="mt-2 p-2 bg-red-500/15 border border-red-500/30 rounded-lg">
                          <p className="text-xs text-red-300 font-medium flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            Reason: {request.failureReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
  );
}
