import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import buyerApi from '@/api/buyerApi';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide truncate">
                  Refunds
                </p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-green-600">
                  {formatCurrency(refundAmount)}
                </p>
                <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">
                  {refundAmount > 0 ? 'Available' : 'None'}
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
              </div>
            </div>

            {/* Show pending requests */}
            {!isLoadingPending && pendingRequests.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-semibold text-yellow-800">Pending</span>
                </div>
                {pendingRequests.map((request) => (
                  <div key={request.id} className="text-xs text-gray-700 space-y-1">
                    <p>
                      <span className="font-medium">Amount:</span> {formatCurrency(parseFloat(request.amount.toString()))}
                    </p>
                    <p>
                      <span className="font-medium">Requested:</span>{' '}
                      {format(new Date(request.requested_at), 'MMM d, yyyy h:mm a')}
                    </p>
                    <Badge className="bg-yellow-100 text-yellow-800 mt-2">
                      <Clock className="h-3 w-3 mr-1" />
                      Awaiting Approval
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            
            {refundAmount > 0 && (
              <Button 
                onClick={handleWithdrawClick}
                disabled={pendingRequests.length > 0 || isLoadingPending}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingRequests.length > 0 ? 'Withdrawal Pending' : 'Withdraw Refund'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Confirm Refund Withdrawal</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                <span className="font-semibold">Amount to withdraw:</span>
              </p>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(refundAmount)}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                💡 <span className="font-semibold">Refund will be sent to:</span>
              </p>
              <p className="text-sm text-gray-600">
                Your registered phone number and contact details on file.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                ⚠️ Once submitted, this request will be reviewed by our admin team. 
                The refund will be processed to your registered contact details within 1-3 business days.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmWithdraw}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
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

