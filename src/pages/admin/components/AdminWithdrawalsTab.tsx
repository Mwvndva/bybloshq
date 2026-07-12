import { Search, Activity, DollarSign, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WithdrawalRequest } from '../adminDashboardTypes';

export interface ProviderHealth {
  payin?: Record<string, unknown>;
  payout?: Record<string, unknown>;
}

interface AdminWithdrawalsTabProps {
  withdrawalRequests: WithdrawalRequest[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeOrders?: number;
  pendingPayoutCount: number;
  pendingPayoutAmount: number;
  providerHealth: ProviderHealth | null;
  providerHealthOk: boolean;
  providerHealthAvailable: boolean;
  formatProviderBalance: (account: unknown) => string;
  formatDate: (dateString: string | null | undefined) => string;
  onAction: (requestId: string, action: 'approved' | 'rejected') => void;
}

export const AdminWithdrawalsTab = ({
  withdrawalRequests,
  searchQuery,
  onSearchChange,
  activeOrders,
  pendingPayoutCount,
  pendingPayoutAmount,
  providerHealth,
  providerHealthOk,
  providerHealthAvailable,
  formatProviderBalance,
  formatDate,
  onAction,
}: AdminWithdrawalsTabProps) => {
  return (
    <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
      <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Liquidity Requests</CardTitle>
          <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Outbound capital movements and merchant payouts</CardDescription>
        </div>
        <div className="relative group w-full md:w-auto">
          <div className="absolute -inset-0.5 bg-green-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-green-500 transition-colors" />
          <Input
            type="text"
            placeholder="Filter transactions..."
            className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-green-500/50 focus:ring-green-500/10 transition-all font-medium text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </CardHeader>
      <div className="grid grid-cols-1 gap-3 border-b border-white/5 bg-white/[0.012] p-5 md:grid-cols-3 md:p-8">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/70">Open orders</p>
            <Activity className="h-4 w-4 text-blue-300" />
          </div>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">{activeOrders?.toLocaleString() || '0'}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-100/50">Paid and not closed</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200/70">Pending payouts</p>
            <DollarSign className="h-4 w-4 text-emerald-300" />
          </div>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">{pendingPayoutCount.toLocaleString()}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-100/50">Awaiting settlement</p>
        </div>
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-200/70">Pending payout value</p>
            <TrendingUp className="h-4 w-4 text-yellow-300" />
          </div>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">KSh {pendingPayoutAmount.toLocaleString()}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-yellow-100/50">Capital waiting to leave</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 border-b border-white/5 bg-white/[0.015] p-5 md:grid-cols-3 md:p-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Provider health</p>
          <div className="mt-3 flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${providerHealthOk ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <p className="text-sm font-black text-white">{providerHealthOk ? 'Connected' : providerHealthAvailable ? 'Check needed' : 'Loading'}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment provider balance/status</p>
          <p className="mt-3 text-sm font-black text-white">{formatProviderBalance(providerHealth?.payin)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Pay-in account</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment provider balance/status</p>
          <p className="mt-3 text-sm font-black text-white">{formatProviderBalance(providerHealth?.payout)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Payout account</p>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="px-5 md:px-8 py-4 md:py-6">Merchant Beneficiary</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-right sm:text-left">Capital Amount</th>
                <th className="px-5 md:px-8 py-4 md:py-6 hidden xl:table-cell">Provider reference</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">Protocol Status</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-right">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {withdrawalRequests?.map((request) => (
                <tr key={request.id} className="hover:bg-white/[0.02] transition-all group">
                  <td className="px-5 md:px-8 py-4 md:py-6">
                    <div className="space-y-1">
                      <p className="text-sm md:text-base font-black text-white tracking-tight">{request.sellerName}</p>
                      <p className="text-[10px] text-gray-500 font-medium italic opacity-60 truncate max-w-[150px]">{request.sellerEmail}</p>
                    </div>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-right sm:text-left">
                    <p className="text-sm md:text-lg font-black text-white tracking-tighter tabular-nums">KSh {request.amount.toLocaleString()}</p>
                    <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50">{formatDate(request.createdAt)}</p>
                  </td>
                  <td className="px-8 py-6 hidden xl:table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                        <DollarSign className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-300 font-mono">{request.providerReference || 'Pending provider reference'}</p>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50">{request.mpesaNumber} · {request.mpesaName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">
                    <Badge className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none
                    ${request.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                        request.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                          request.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                            'bg-blue-500/10 text-blue-400'}`}>
                      {request.status}
                    </Badge>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {request.status === 'pending' ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-green-500 hover:bg-green-500 hover:text-black font-black uppercase tracking-widest text-[9px] border transition-all"
                            onClick={() => onAction(request.id, 'approved')}
                          >
                            <CheckCircle className="h-3 md:h-3.5 w-3 md:w-3.5" />
                            <span className="hidden sm:inline ml-2">Approve</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-red-400 hover:bg-red-500 hover:text-white font-black uppercase tracking-widest text-[9px] border transition-all"
                            onClick={() => onAction(request.id, 'rejected')}
                          >
                            <XCircle className="h-3 md:h-3.5 w-3 md:w-3.5" />
                            <span className="hidden sm:inline ml-2">Veto</span>
                          </Button>
                        </>
                      ) : (
                        <span className="text-[9px] md:text-[10px] font-black text-gray-600 uppercase tracking-widest italic">
                          {request.status}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <CardFooter className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
          Total Liquidity Flow: <span className="text-white ml-2 tabular-nums">{withdrawalRequests?.length || 0} Entries</span>
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Prev</Button>
          <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Next</Button>
        </div>
      </CardFooter>
    </Card>
  );
};
