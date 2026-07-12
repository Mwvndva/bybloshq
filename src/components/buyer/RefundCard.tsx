import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Loader2, Clock, Wallet, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { usePendingRefundsQuery } from '@/hooks/buyer/queries/usePendingRefundsQuery';
import { useRefundRequestMutation } from '@/hooks/buyer/mutations/useRefundRequestMutation';
import { RefundConfirmDialog } from './RefundConfirmDialog';
import { useRefundCard } from './useRefundCard';

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
    hasPendingRequest,
  } = useRefundCard(refundAmount, onRefundRequested);


  if (compact) {
    return (
      <>
        <Card className="overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-950 shadow-none">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#F5C518]/30 bg-[#F5C518]/15">
                  <Wallet className="h-5 w-5 text-[#F5C518]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Refund balance</p>
                  <p className="mt-1 text-xl font-black leading-none text-stone-950">{formatCurrency(refundAmount)}</p>
                </div>
              </div>
              <Badge className="shrink-0 border-stone-200 bg-stone-100 text-[10px] font-semibold text-stone-700 hover:bg-stone-100">
                {isLoadingPending ? 'Checking' : hasPendingRequest ? 'Pending' : refundAmount > 0 ? 'Available' : 'Empty'}
              </Badge>
            </div>

            {!isLoadingPending && hasPendingRequest ? (
              <div className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                  <Clock className="h-4 w-4" />
                  Awaiting Admin Approval
                </div>
                {pendingRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-3 text-xs text-amber-100/80">
                    <span>{formatCurrency(parseFloat(request.amount.toString()))}</span>
                    <span className="text-right">{format(new Date(request.requested_at), 'MMM d, yyyy')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-stone-500">
                {refundAmount > 0 ? 'Available for withdrawal.' : 'No refunds available right now.'}
              </p>
            )}

            <Button
              onClick={handleWithdrawClick}
              disabled={hasPendingRequest || isLoadingPending || refundAmount <= 0}
              className="h-9 w-full bg-[#F5C518] text-xs font-bold text-black hover:bg-[#e4b70f] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {hasPendingRequest ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Withdrawal Pending
                </>
              ) : refundAmount > 0 ? (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Request Withdrawal
                </>
              ) : (
                'No Refunds Available'
              )}
            </Button>
          </CardContent>
        </Card>

        <RefundConfirmDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} refundAmount={refundAmount} onConfirm={handleConfirmWithdraw} isSubmitting={isSubmitting} formatCurrency={formatCurrency} />
      </>
    );
  }

  return (
    <>
      <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-200/20 to-transparent rounded-full blur-2xl" />

        <CardContent className="relative p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-green-600" />
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Refund Balance
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-green-600">
                  KSh {refundAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-sm text-gray-600 font-medium mt-1">
                {refundAmount > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Available for withdrawal
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-gray-300" />
                    No refunds available
                  </span>
                )}
              </p>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* Pending requests alert */}
          {!isLoadingPending && pendingRequests.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                <span className="text-sm font-bold text-amber-900">Pending Request</span>
              </div>
              {pendingRequests.map((request) => (
                <div key={request.id} className="space-y-2 bg-white/60 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Amount:</span>
                    <span className="text-sm font-bold text-green-600">
                      {formatCurrency(parseFloat(request.amount.toString()))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Requested:</span>
                    <span className="text-xs text-gray-600">
                      {format(new Date(request.requested_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                    <Clock className="h-3 w-3 mr-1" />
                    Awaiting Admin Approval
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleWithdrawClick}
            disabled={pendingRequests.length > 0 || isLoadingPending || refundAmount <= 0}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed h-12 text-base group/btn"
          >
            {pendingRequests.length > 0 ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-pulse" />
                Withdrawal Pending
              </>
            ) : refundAmount > 0 ? (
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl">Confirm Refund Withdrawal</DialogTitle>
            <p className="text-sm text-gray-600">Review the details before confirming your withdrawal request</p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount display */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-2">Amount to withdraw</p>
              <p className="text-4xl font-black text-green-600">
                {formatCurrency(refundAmount)}
              </p>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-900">
                    How you'll receive your refund
                  </p>
                  <p className="text-sm text-blue-700">
                    Your refund will be sent to your registered phone number and email address on file.
                  </p>
                </div>
              </div>
            </div>

            {/* Warning box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 mb-1">Processing time</p>
                  <p className="text-xs text-amber-800">
                    Once submitted, your request will be reviewed by our admin team.
                    The refund will be processed within 1-3 business days.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmWithdraw}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 px-6"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}



