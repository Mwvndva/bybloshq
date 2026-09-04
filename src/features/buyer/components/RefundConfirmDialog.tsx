import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { AlertCircle, CheckCircle2, Loader2, Wallet, Info } from 'lucide-react';

interface RefundConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
  maxWithdrawable: number;
  withdrawalAmount: string;
  onWithdrawalAmountChange: (val: string) => void;
  onSetMaxAmount: () => void;
  mpesaNumber: string;
  onMpesaNumberChange: (val: string) => void;
  mpesaName: string;
  onMpesaNameChange: (val: string) => void;
  withdrawalFee: number;
  totalDeducted: number;
  remainingBalance: number;
  minWithdrawalAmount: number;
  onConfirm: () => void;
  isSubmitting: boolean;
  formatCurrency: (value: number) => string;
}

export function RefundConfirmDialog({
  open,
  onOpenChange,
  availableBalance,
  maxWithdrawable,
  withdrawalAmount,
  onWithdrawalAmountChange,
  onSetMaxAmount,
  mpesaNumber,
  onMpesaNumberChange,
  mpesaName,
  onMpesaNameChange,
  withdrawalFee,
  totalDeducted,
  remainingBalance,
  minWithdrawalAmount,
  onConfirm,
  isSubmitting,
  formatCurrency
}: RefundConfirmDialogProps) {
  const parsedAmount = Number.parseFloat(withdrawalAmount) || 0;
  const isAmountValid = parsedAmount >= minWithdrawalAmount && totalDeducted <= availableBalance;
  const isPhoneValid = Boolean(mpesaNumber.trim());
  const isNameValid = Boolean(mpesaName.trim());
  const canSubmit = isAmountValid && isPhoneValid && isNameValid && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] text-slate-950 dark:text-white rounded-3xl p-5 sm:p-6 shadow-2xl transition-colors duration-200">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5C518]/20 text-[#F5C518]">
              <Wallet className="h-4 w-4" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-950 dark:text-white">
              Withdraw Refund Balance
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-600 dark:text-white/60">
            Available cleared balance: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(availableBalance)}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount input & Max button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="withdrawal-amount" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Amount to withdraw (KSh)
              </Label>
              {maxWithdrawable > 0 && (
                <button
                  type="button"
                  onClick={onSetMaxAmount}
                  className="text-[11px] font-bold text-[#F5C518] hover:underline"
                >
                  Max: {formatCurrency(maxWithdrawable)}
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="withdrawal-amount"
                type="number"
                min={minWithdrawalAmount}
                max={maxWithdrawable}
                step="any"
                value={withdrawalAmount}
                onChange={(e) => onWithdrawalAmountChange(e.target.value)}
                placeholder={`Min ${minWithdrawalAmount}`}
                className="h-11 rounded-xl border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-zinc-900 font-bold text-slate-950 dark:text-white pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                KES
              </span>
            </div>
            {parsedAmount > 0 && parsedAmount < minWithdrawalAmount && (
              <p className="text-[11px] font-medium text-red-500">
                Minimum withdrawal amount is KSh {minWithdrawalAmount}
              </p>
            )}
            {totalDeducted > availableBalance && (
              <p className="text-[11px] font-medium text-red-500">
                Total deduction exceeds available balance of {formatCurrency(availableBalance)}
              </p>
            )}
          </div>

          {/* M-Pesa destination fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mpesa-number" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                M-Pesa Phone Number
              </Label>
              <Input
                id="mpesa-number"
                type="tel"
                value={mpesaNumber}
                onChange={(e) => onMpesaNumberChange(e.target.value)}
                placeholder="0712345678"
                className="h-10 rounded-xl border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-zinc-900 text-xs font-medium text-slate-950 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpesa-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Name on M-Pesa
              </Label>
              <Input
                id="mpesa-name"
                type="text"
                value={mpesaName}
                onChange={(e) => onMpesaNameChange(e.target.value)}
                placeholder="Registered name"
                className="h-10 rounded-xl border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-zinc-900 text-xs font-medium text-slate-950 dark:text-white"
              />
            </div>
          </div>

          {/* Fee calculation breakdown card */}
          {parsedAmount > 0 && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-50 dark:bg-amber-500/10 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-700 dark:text-white/80">
                <span>Withdrawal amount to receive</span>
                <span className="font-bold text-slate-950 dark:text-white">{formatCurrency(parsedAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                <span>Withdrawal charge</span>
                <span className="font-bold">+{formatCurrency(withdrawalFee)}</span>
              </div>
              <div className="border-t border-amber-400/20 pt-2 flex items-center justify-between text-sm font-black text-slate-950 dark:text-white">
                <span>Total deducted from refund balance</span>
                <span className="text-amber-600 dark:text-amber-400">{formatCurrency(totalDeducted)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
                <span>Remaining refund balance</span>
                <span>{formatCurrency(remainingBalance)}</span>
              </div>
            </div>
          )}

          {/* Inform the buyer that refunds are charged a withdrawal fee */}
          <div className="rounded-2xl border border-blue-400/30 bg-blue-50 dark:bg-blue-500/10 p-3.5 space-y-1.5">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  Withdrawal Fee Notice
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200/90 leading-relaxed font-medium">
                  Refund withdrawals to M-Pesa are charged a standard transaction fee based on payout tiers:
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-blue-700 dark:text-blue-300/80 font-semibold list-disc list-inside">
                  <li>KSh 50 - KSh 1,500: <strong>KSh 21</strong></li>
                  <li>KSh 1,501 - KSh 19,999: <strong>KSh 45</strong></li>
                  <li>KSh 20,000 and above: <strong>KSh 63</strong></li>
                </ul>
                <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300/80">
                  This fee is automatically deducted from your refund balance.
                </p>
              </div>
            </div>
          </div>

          {/* Processing time notice */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900/60 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong>Schedule:</strong> Withdrawals are reviewed and sent to your M-Pesa within 1-3 business days.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-slate-300 dark:border-white/20 bg-white dark:bg-transparent text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canSubmit}
            className="bg-yellow-400 font-extrabold text-black hover:bg-yellow-300 shadow-sm rounded-xl disabled:opacity-40"
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
