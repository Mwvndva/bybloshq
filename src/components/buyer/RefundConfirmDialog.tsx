import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface RefundConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refundAmount: number;
  onConfirm: () => void;
  isSubmitting: boolean;
  formatCurrency: (value: number) => string;
}

export function RefundConfirmDialog({ open, onOpenChange, refundAmount, onConfirm, isSubmitting, formatCurrency }: RefundConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-stone-200 bg-white text-stone-950 sm:max-w-[500px]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl text-stone-950">Confirm Refund Withdrawal</DialogTitle>
          <p className="text-sm text-stone-500">Review the details before confirming your withdrawal request</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-xl border border-green-400/25 bg-green-500/10 p-6 text-center">
            <p className="mb-2 text-sm font-semibold text-green-800">Amount to withdraw</p>
            <p className="text-4xl font-black text-green-700">
              {formatCurrency(refundAmount)}
            </p>
          </div>

          <div className="rounded-lg border border-blue-400/25 bg-blue-500/10 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-300" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-100">
                  How you'll receive your refund
                </p>
                <p className="text-sm text-blue-100/80">
                  Your refund will be sent to your registered phone number and email address on file.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-300" />
              <div>
                <p className="mb-1 text-xs font-semibold text-amber-100">Processing time</p>
                <p className="text-xs text-amber-100/80">
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
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-stone-200 bg-white px-6 text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-green-600 px-6 text-white hover:bg-green-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
