import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Loader2, Clock, Wallet, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import buyerApi from '@/api/buyerApi';
import { useAsyncLock } from '@/hooks/useAsyncLock';

interface RefundCardProps {
  refundAmount: number;
  onRefundRequested?: () => void;
}

interface PendingRequest {
  id: number;
  amount: number;
  status: string;
  requested_at: string;
}

export default function RefundCard({ refundAmount, onRefundRequested }: RefundCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // FIX (Task 16): Prevent duplicate refund submissions via synchronous lock
  const { runWithLock, isLocked: isSubmitting } = useAsyncLock();
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);

  // Fetch pending refund requests
  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    setIsLoadingPending(true);
    try {
      const data = await buyerApi.getPendingRefundRequests();
      setPendingRequests(data.pendingRequests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setIsLoadingPending(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return `KSh ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleWithdrawClick = () => {
    if (refundAmount <= 0) {
      toast.error('No refunds available to withdraw');
      return;
    }
    if (pendingRequests.length > 0) {
      toast.error('You already have a pending refund request');
      return;
    }
    setIsDialogOpen(true);
  };

  const handleConfirmWithdraw = async () => {
    // FIX (Task 16): Prevents duplicate refund submission
    await runWithLock(async () => {
      try {
        await buyerApi.requestRefund({
          amount: refundAmount
        });

        toast.success('Refund request submitted successfully! Admin will review it shortly.');
        setIsDialogOpen(false);

        // Refresh pending requests
        await fetchPendingRequests();

        // Notify parent to refresh data
        if (onRefundRequested) {
          onRefundRequested();
        }
      } catch (error: any) {
        console.error('Error requesting refund:', error);
        toast.error(error.message || 'Failed to submit refund request');
      }
    });
  };

  return (
    <>
      <Card className="relative overflow-hidden border border-white/5 bg-[#141414] rounded-2xl shadow-xl transition-all duration-300 group">
        {/* Subtle Accent Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />

        <CardContent className="relative p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-emerald-500/60" />
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  Refund Balance
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-emerald-500">
                  KES {refundAmount.toLocaleString()}
                </p>
              </div>
              <p className="text-[10px] font-bold mt-1 uppercase tracking-tight">
                {refundAmount > 0 ? (
                  <span className="flex items-center gap-1.5 text-emerald-500/60">
                    <CheckCircle2 className="h-3 w-3" />
                    Available for withdrawal
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-white/20">
                    <AlertCircle className="h-3 w-3" />
                    No funds available
                  </span>
                )}
              </p>
            </div>
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 group-hover:border-emerald-500/30 transition-all">
              <DollarSign className="h-6 w-6 text-emerald-500/40 group-hover:text-emerald-500" />
            </div>
          </div>

          {/* Pending requests alert */}
          {!isLoadingPending && pendingRequests.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Withdrawal Status</span>
              </div>
              {pendingRequests.map((request) => (
                <div key={request.id} className="space-y-2 bg-black/20 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/20 uppercase">Amount:</span>
                    <span className="text-xs font-black text-emerald-500">
                      {formatCurrency(parseFloat(request.amount.toString()))}
                    </span>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] uppercase font-bold py-0 h-5">
                    Awaiting Approval
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleWithdrawClick}
            disabled={pendingRequests.length > 0 || isLoadingPending || refundAmount <= 0}
            className="w-full bg-white/5 hover:bg-emerald-500 hover:text-black border border-white/10 text-white font-bold h-11 rounded-xl transition-all disabled:opacity-20"
          >
            {pendingRequests.length > 0 ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-pulse" />
                PENDING REVIEW
              </>
            ) : refundAmount > 0 ? (
              <>
                <TrendingUp className="h-3.5 w-3.5 mr-2" />
                WITHDRAW FUNDS
              </>
            ) : (
              'OUT OF CREDIT'
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

