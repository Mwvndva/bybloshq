import { Download, Info, Loader2, Wallet, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { exportWithdrawalsToCSV } from '@/utils/exportUtils';
import { getWithdrawalFee, MIN_WITHDRAWAL_AMOUNT, WITHDRAWAL_FEE_TIERS } from '../dashboardUtils';
import type { WithdrawalRequest } from '../types';

interface WithdrawalsTabProps {
  balance: number;
  pendingSettlementBalance?: number;
  withdrawalReservedBalance?: number;
  refundReservedBalance?: number;
  nextSettlementAt?: string | null;
  endDate: string;
  filteredWithdrawals: WithdrawalRequest[];
  handleWithdrawalRequest: (event: React.FormEvent) => Promise<void>;
  isRequestingWithdrawal: boolean;
  setEndDate: (date: string) => void;
  setShowWithdrawalForm: (show: boolean) => void;
  setStartDate: (date: string) => void;
  setWithdrawalForm: React.Dispatch<React.SetStateAction<{ amount: string; mpesaNumber: string; mpesaName: string }>>;
  showWithdrawalForm: boolean;
  startDate: string;
  withdrawalForm: { amount: string; mpesaNumber: string; mpesaName: string };
  withdrawalRequests: WithdrawalRequest[];
}

const formatKes = (amount: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
};

export function WithdrawalsTab({
  balance,
  pendingSettlementBalance = 0,
  withdrawalReservedBalance = 0,
  refundReservedBalance = 0,
  nextSettlementAt = null,
  endDate,
  filteredWithdrawals,
  handleWithdrawalRequest,
  isRequestingWithdrawal,
  setEndDate,
  setShowWithdrawalForm,
  setStartDate,
  setWithdrawalForm,
  showWithdrawalForm,
  startDate,
  withdrawalForm,
  withdrawalRequests
}: WithdrawalsTabProps) {
  const requestedAmount = Number.parseFloat(withdrawalForm.amount || '0');
  const withdrawalFee = getWithdrawalFee(requestedAmount);
  const totalDeducted = Number.isFinite(requestedAmount) && requestedAmount >= MIN_WITHDRAWAL_AMOUNT
    ? requestedAmount + withdrawalFee
    : 0;
  const nextSettlementLabel = nextSettlementAt
    ? new Date(nextSettlementAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Pending schedule';

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="text-center px-2 sm:px-0">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950 mb-1.5">Withdrawal Management</h2>
        <p className="text-slate-700 text-xs sm:text-sm lg:text-base font-medium">Request and track your withdrawal requests</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-sm border border-slate-200">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-950">Ready to Withdraw</h3>
              <p className="text-slate-700 text-[10px] sm:text-xs font-medium mt-0.5">Money you can send to M-Pesa now.</p>
            </div>
            <p className="text-lg sm:text-xl md:text-2xl font-black text-green-800">
              {formatKes(balance)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-sm border border-slate-200">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-950">Preparing for Withdrawal</h3>
              <p className="text-slate-700 text-[10px] sm:text-xs font-medium mt-0.5">Paid orders being prepared before they can be withdrawn.</p>
            </div>
            <div>
              <p className="text-lg sm:text-xl md:text-2xl font-black text-yellow-700">
                {formatKes(pendingSettlementBalance)}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-slate-500">Next: {nextSettlementLabel}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-sm border border-slate-200">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-950">Being Sent to You</h3>
              <p className="text-slate-700 text-[10px] sm:text-xs font-medium mt-0.5">Money already removed from your balance while M-Pesa transfer is processing.</p>
            </div>
            <p className="text-lg sm:text-xl md:text-2xl font-black text-slate-800">
              {formatKes(withdrawalReservedBalance)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-sm border border-slate-200">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-950">Held for Refunds</h3>
              <p className="text-slate-700 text-[10px] sm:text-xs font-medium mt-0.5">Money kept aside for approved buyer refunds before it can be withdrawn.</p>
            </div>
            <p className="text-lg sm:text-xl md:text-2xl font-black text-slate-800">
              {formatKes(refundReservedBalance)}
            </p>
          </div>
        </div>
      </div>

      <div className="withdrawal-minimum-note bg-yellow-400 border border-yellow-300 rounded-xl p-2.5 sm:p-3 flex items-start gap-2 sm:gap-3">
        <div className="bg-black/10 border border-black/15 rounded-full p-0.5 sm:p-1 mt-0.5 flex-shrink-0">
          <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-black text-[10px] sm:text-xs">Minimum: KSh {MIN_WITHDRAWAL_AMOUNT}</h4>
          <p className="text-black text-[9px] sm:text-[10px] mt-0.5 leading-tight">
            Withdrawal charges are deducted from your available balance together with the requested amount.
          </p>
          <div className="mt-2 grid gap-1 text-[9px] sm:text-[10px] font-semibold text-black sm:grid-cols-3">
            {WITHDRAWAL_FEE_TIERS.map((tier) => (
              <span key={tier.label} className="rounded-lg bg-black/10 px-2 py-1">
                {tier.label}: KSh {tier.fee}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div>
        {!showWithdrawalForm ? (
          <Button
            onClick={() => setShowWithdrawalForm(true)}
            className="gap-1.5 sm:gap-2 bg-yellow-400 text-black hover:bg-yellow-500 shadow-lg px-4 sm:px-5 md:px-6 py-2.5 sm:py-2.5 md:py-3 rounded-xl font-bold text-xs sm:text-sm w-full sm:w-auto h-11 sm:h-auto"
            disabled={balance < MIN_WITHDRAWAL_AMOUNT}
          >
            <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Request Withdrawal
          </Button>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-6 md:p-8 shadow-sm">
            <h4 className="text-lg sm:text-xl font-bold text-slate-950 mb-4">Request Withdrawal</h4>
            <form onSubmit={handleWithdrawalRequest} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount" className="text-xs font-semibold text-slate-700 mb-2 block">
                    Amount (KSh)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={withdrawalForm.amount}
                    onChange={(e) => setWithdrawalForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount"
                    min={MIN_WITHDRAWAL_AMOUNT}
                    max={balance}
                    className="h-10 sm:h-11 text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400"
                    required
                  />
                  <p className="text-xs text-slate-700 mt-1">
                    Max: {formatKes(balance)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="mpesaNumber" className="text-xs font-semibold text-slate-700 mb-2 block">
                    M-Pesa Number
                  </Label>
                  <Input
                    id="mpesaNumber"
                    type="tel"
                    value={withdrawalForm.mpesaNumber}
                    onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaNumber: e.target.value }))}
                    placeholder="0712345678"
                    className="h-10 sm:h-11 text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="mpesaName" className="text-xs font-semibold text-slate-700 mb-2 block">
                  Name on M-Pesa Number
                </Label>
                <Input
                  id="mpesaName"
                  type="text"
                  value={withdrawalForm.mpesaName}
                  onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaName: e.target.value }))}
                  placeholder="Enter name as registered on M-Pesa"
                  className="h-10 sm:h-11 text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400"
                  required
                />
              </div>
              {totalDeducted > 0 && (
                <div className="withdrawal-fee-summary rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold">
                  <div className="flex items-center justify-between gap-3">
                    <span>Withdrawal charge</span>
                    <span>{formatKes(withdrawalFee)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm font-black">
                    <span>Total deducted from balance</span>
                    <span>{formatKes(totalDeducted)}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3 sm:pt-4">
                <Button
                  type="submit"
                  disabled={isRequestingWithdrawal}
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-4 py-2 h-10 sm:h-8 text-xs rounded-lg font-semibold w-full sm:w-auto"
                  size="sm"
                >
                  {isRequestingWithdrawal ? (
                    <>
                      <Loader2 className="h-2.5 w-2.5 mr-1.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Wallet className="h-2.5 w-2.5 mr-1.5" />
                      Submit Request
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowWithdrawalForm(false);
                    setWithdrawalForm({
                      amount: '',
                      mpesaNumber: '',
                      mpesaName: ''
                    });
                  }}
                  className="px-4 py-2 h-10 sm:h-8 text-xs rounded-lg bg-white border-slate-200 text-slate-700 hover:bg-slate-50 w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 md:p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
          <div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-950">Withdrawal Requests</h3>
            <p className="text-slate-700 text-xs sm:text-sm font-medium mt-1">Track your withdrawal request history</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 bg-white border-slate-200 text-slate-950 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                placeholder="Start date"
              />
            </div>
            <span className="hidden sm:flex items-center text-slate-700 text-sm">to</span>
            <div className="relative flex-1">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 bg-white border-slate-200 text-slate-950 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                placeholder="End date"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                variant="outline"
                size="icon"
                className="border-slate-200 text-slate-700 hover:bg-slate-50 h-10 w-full sm:w-10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Button
            onClick={() => exportWithdrawalsToCSV(withdrawalRequests)}
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 h-10 w-full lg:w-auto"
            disabled={withdrawalRequests.length === 0}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>

        {filteredWithdrawals.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {filteredWithdrawals.map((request) => (
              <Card key={request.id} className="group hover:shadow-xl transition-all duration-300 bg-white border border-slate-200">
                <CardContent className="p-3 sm:p-5 lg:p-6">
                  <div className="flex min-w-0 justify-between items-start">
                    <div className="space-y-2 min-w-0 w-full">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <p className="text-base sm:text-xl font-black text-slate-950 truncate">
                          {formatKes(request.amount)}
                        </p>
                        <Badge
                          variant="outline"
                          className={`${request.status === 'processing'
                            ? 'bg-yellow-50 text-yellow-900 border-yellow-200'
                            : request.status === 'completed'
                              ? 'bg-green-50 text-green-900 border-green-200'
                              : request.status === 'failed'
                                ? 'bg-red-50 text-red-900 border-red-200'
                                : 'bg-blue-50 text-blue-900 border-blue-200'
                            } rounded-full px-3 py-1 font-semibold`}
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-700 break-words">
                        M-Pesa: {request.mpesaNumber} ({request.mpesaName})
                      </p>
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Requested</p>
                          <p className="text-xs font-semibold text-slate-950">{new Date(request.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Processed</p>
                          <p className="text-xs font-semibold text-slate-950">{request.processedAt ? new Date(request.processedAt).toLocaleString() : 'Pending'}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Charge</p>
                          <p className="text-xs font-semibold text-slate-950">{formatKes(request.withdrawalFee || getWithdrawalFee(request.amount))}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Provider Ref</p>
                          <p className="truncate text-xs font-semibold text-slate-950">{request.providerReference || 'Pending'}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">M-Pesa Receipt</p>
                          <p className="truncate text-xs font-semibold text-slate-950">{request.mpesaReceipt || 'Pending'}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Processed By</p>
                          <p className="text-xs font-semibold text-slate-950">{request.processedBy || 'System'}</p>
                        </div>
                      </div>
                      {request.status === 'failed' && request.failureReason && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-400/20 rounded-lg">
                          <p className="text-xs text-red-800 font-medium flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            Reason: {request.failureReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-8 bg-slate-50 border border-slate-200 rounded-3xl flex items-center justify-center shadow-sm">
              <Wallet className="h-12 w-12 text-slate-500" />
            </div>
            <h3 className="text-xl font-black text-slate-950 mb-3">No withdrawal requests</h3>
            <p className="text-slate-700 text-lg font-medium max-w-md mx-auto mb-6">You haven't made any withdrawal requests yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
