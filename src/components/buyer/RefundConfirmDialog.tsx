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
      <DialogContent className="w-[92vw] sm:max-w-[440px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] text-slate-950 dark:text-white rounded-3xl p-5 sm:p-6 shadow-2xl transition-colors duration-200">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-slate-950 dark:text-white">Confirm Refund Withdrawal</DialogTitle>
          <p className="text-xs text-slate-600 dark:text-white/60">Review the details before confirming your withdrawal request</p>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-5 text-center">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Amount to withdraw</p>
            <p className="text-3xl font-black text-emerald-700 dark:text-emerald-200">
              {formatCurrency(refundAmount)}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-400/30 bg-blue-50 dark:bg-blue-500/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  How you'll receive your refund
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-200/80 leading-relaxed font-medium">
                  Your refund will be sent to your registered phone number and email address on file.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="mb-0.5 text-xs font-bold text-amber-900 dark:text-amber-100">Processing time</p>
                <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed font-medium">
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
            className="border-slate-300 dark:border-white/20 bg-white dark:bg-transparent text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-yellow-400 font-extrabold text-black hover:bg-yellow-300 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Confirm Withdrawal'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
