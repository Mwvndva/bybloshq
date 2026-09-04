import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { DollarSign, Loader2, Clock, Wallet, TrendingUp, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { RefundConfirmDialog } from './RefundConfirmDialog';
import { useRefundCard } from '@/features/buyer/hooks/useRefundCard';
import { formatSettlementDate, formatSettlementTimeOnly } from '@/features/buyer/utils/refundUtils';

interface RefundCardProps {
  refundAmount: number;
  compact?: boolean;
  onRefundRequested?: () => void;
}

export default function RefundCard({ refundAmount, compact = false, onRefundRequested }: RefundCardProps) {
  const {
    isDialogOpen,
    setIsDialogOpen,
    isSubmitting,
    pendingRequests,
    isLoadingPending,
    formatCurrency,
    handleWithdrawClick,
    handleConfirmWithdraw,
    handleSetMaxAmount,
    hasPendingRequest,
    totalRefunds,
    availableBalance,
    clearingBalance,
    isClearing,
    nextAvailableAt,
    maxWithdrawable,
    withdrawalAmount,
    setWithdrawalAmount,
    mpesaNumber,
    setMpesaNumber,
    mpesaName,
    setMpesaName,
    withdrawalFee,
    totalDeducted,
    remainingBalance,
    minWithdrawalAmount
  } = useRefundCard(refundAmount, onRefundRequested);

  const formattedClearingDate = nextAvailableAt ? formatSettlementDate(nextAvailableAt) : 'Pending schedule';
  const formattedClearingTime = nextAvailableAt ? formatSettlementTimeOnly(nextAvailableAt) : null;

  if (compact) {
    return (
      <>
        <Card className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#F5C518]/30 bg-[#F5C518]/15">
                  <Wallet className="h-5 w-5 text-[#F5C518]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Refund balance</p>
                  <p className="mt-1 text-xl font-black leading-none text-slate-950 dark:text-white">{formatCurrency(totalRefunds)}</p>
                </div>
              </div>
              <Badge className="shrink-0 border-slate-200 dark:border-white/10 bg-slate-200 dark:bg-zinc-800 text-[10px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-zinc-800">
                {isLoadingPending
                  ? 'Checking'
                  : hasPendingRequest
                  ? 'Pending'
                  : isClearing && availableBalance === 0
                  ? 'Clearing (T+2)'
                  : availableBalance > 0
                  ? 'Available'
                  : 'Empty'}
              </Badge>
            </div>

            {/* Pending Requests Alert */}
            {!isLoadingPending && hasPendingRequest && (
              <div className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                  <Clock className="h-4 w-4" />
                  Awaiting Admin Approval
                </div>
                {pendingRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-200/90 font-medium">
                    <span>{formatCurrency(parseFloat(request.amount.toString()))}</span>
                    <span className="text-right">{format(new Date(request.requested_at), 'MMM d, yyyy')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* T+2 Clearance Banner */}
            {!isLoadingPending && isClearing && (
              <div className="rounded-xl border border-blue-400/25 bg-blue-50 dark:bg-blue-500/10 p-3 space-y-1.5 text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
                  <Clock className="h-3.5 w-3.5" />
                  <span>T+2 Clearance Active</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  <strong>{formatCurrency(clearingBalance)}</strong> is clearing from recent refunds. Funds unlock on{' '}
                  <span className="font-semibold">{formattedClearingDate}</span>
                  {formattedClearingTime ? ` at ${formattedClearingTime}` : ''}.
                </p>
                {availableBalance > 0 && (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Ready to withdraw now: {formatCurrency(availableBalance)}
                  </p>
                )}
              </div>
            )}

            {/* General Balance Note */}
            {!isClearing && !hasPendingRequest && (
              <p className="text-xs leading-5 text-slate-600 dark:text-slate-400 font-medium">
                {availableBalance > 0
                  ? `${formatCurrency(availableBalance)} available for immediate withdrawal.`
                  : 'No refunds available right now.'}
              </p>
            )}

            {/* Fee Policy Informational Tag */}
            <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-white/50">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
              <span>Standard M-Pesa withdrawal fees apply (from KSh 21) and are deducted from your balance.</span>
            </div>

            <Button
              onClick={handleWithdrawClick}
              disabled={hasPendingRequest || isLoadingPending || (availableBalance < minWithdrawalAmount && clearingBalance === 0) || (availableBalance < minWithdrawalAmount && isClearing)}
              className="h-10 w-full bg-[#F5C518] text-xs font-black text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              {isLoadingPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking status...
                </>
              ) : hasPendingRequest ? (
                'Withdrawal Pending'
              ) : isClearing && availableBalance < minWithdrawalAmount ? (
                `Clearing (Available ${formattedClearingDate})`
              ) : availableBalance >= minWithdrawalAmount ? (
                'Withdraw Refund'
              ) : totalRefunds > 0 ? (
                `Min Withdrawal KSh ${minWithdrawalAmount}`
              ) : (
                'No Refunds Available'
              )}
            </Button>
          </CardContent>
        </Card>

        <RefundConfirmDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          availableBalance={availableBalance}
          maxWithdrawable={maxWithdrawable}
          withdrawalAmount={withdrawalAmount}
          onWithdrawalAmountChange={setWithdrawalAmount}
          onSetMaxAmount={handleSetMaxAmount}
          mpesaNumber={mpesaNumber}
          onMpesaNumberChange={setMpesaNumber}
          mpesaName={mpesaName}
          onMpesaNameChange={setMpesaName}
          withdrawalFee={withdrawalFee}
          totalDeducted={totalDeducted}
          remainingBalance={remainingBalance}
          minWithdrawalAmount={minWithdrawalAmount}
          onConfirm={handleConfirmWithdraw}
          isSubmitting={isSubmitting}
          formatCurrency={formatCurrency}
        />
      </>
    );
  }

  return (
    <>
      <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-zinc-800" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-200/20 to-transparent rounded-full blur-2xl" />

        <CardContent className="relative p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Refund Balance
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-green-600 dark:text-green-400">
                  {formatCurrency(totalRefunds)}
                </p>
              </div>
              <div className="text-sm font-medium mt-1">
                {availableBalance > 0 ? (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {formatCurrency(availableBalance)} available for withdrawal
                  </span>
                ) : isClearing ? (
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Clock className="h-4 w-4 animate-pulse" />
                    Clearing under T+2 (unlocks {formattedClearingDate})
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <AlertCircle className="h-4 w-4" />
                    No refunds available
                  </span>
                )}
              </div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* T+2 Clearance Detail Card */}
          {!isLoadingPending && isClearing && (
            <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/80 dark:bg-blue-500/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>T+2 Clearance Holding Period</span>
                </div>
                <Badge className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-0 text-[10px]">
                  T+2 Active
                </Badge>
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                Refunds are held for 2 business days from the moment they are credited before withdrawal to M-Pesa is enabled.
              </p>
              <div className="pt-1 flex items-center justify-between text-xs font-bold text-blue-950 dark:text-blue-100">
                <span>Clearing: {formatCurrency(clearingBalance)}</span>
                <span>Unlocks: {formattedClearingDate}{formattedClearingTime ? ` at ${formattedClearingTime}` : ''}</span>
              </div>
            </div>
          )}

          {/* Pending requests alert */}
          {!isLoadingPending && pendingRequests.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                <span className="text-sm font-bold text-amber-900 dark:text-amber-200">Pending Request</span>
              </div>
              {pendingRequests.map((request) => (
                <div key={request.id} className="space-y-2 bg-white/60 dark:bg-zinc-800/60 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Amount:</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(parseFloat(request.amount.toString()))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Requested:</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {format(new Date(request.requested_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700">
                    <Clock className="h-3 w-3 mr-1" />
                    Awaiting Admin Approval
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Fee Notice */}
          <div className="flex items-start gap-2 rounded-xl bg-slate-100/70 dark:bg-zinc-800/70 p-3 text-xs text-slate-600 dark:text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" />
            <p>
              <strong>Withdrawal Fee:</strong> Carrier payout charges apply (KSh 21 for up to KSh 1,500; KSh 45 for up to KSh 20,000; KSh 63 above). The fee is deducted from your refund balance.
            </p>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleWithdrawClick}
            disabled={pendingRequests.length > 0 || isLoadingPending || (availableBalance < minWithdrawalAmount && isClearing) || availableBalance < minWithdrawalAmount}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed h-12 text-base group/btn"
          >
            {pendingRequests.length > 0 ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-pulse" />
                Withdrawal Pending
              </>
            ) : isClearing && availableBalance < minWithdrawalAmount ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Clearing (Available {formattedClearingDate})
              </>
            ) : availableBalance >= minWithdrawalAmount ? (
              <>
                <TrendingUp className="h-4 w-4 mr-2 group-hover/btn:translate-x-1 transition-transform" />
                Request Withdrawal
              </>
            ) : (
              'No Refunds Available'
            )}
          </Button>
        </CardContent>
      </Card>

      <RefundConfirmDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        availableBalance={availableBalance}
        maxWithdrawable={maxWithdrawable}
        withdrawalAmount={withdrawalAmount}
        onWithdrawalAmountChange={setWithdrawalAmount}
        onSetMaxAmount={handleSetMaxAmount}
        mpesaNumber={mpesaNumber}
        onMpesaNumberChange={setMpesaNumber}
        mpesaName={mpesaName}
        onMpesaNameChange={setMpesaName}
        withdrawalFee={withdrawalFee}
        totalDeducted={totalDeducted}
        remainingBalance={remainingBalance}
        minWithdrawalAmount={minWithdrawalAmount}
        onConfirm={handleConfirmWithdraw}
        isSubmitting={isSubmitting}
        formatCurrency={formatCurrency}
      />
    </>
  );
}



