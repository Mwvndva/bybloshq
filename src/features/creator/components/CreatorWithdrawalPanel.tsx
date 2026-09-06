import { useState } from 'react';
import { Clock, Info, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useCreatorWithdrawalMutation } from '@/features/creator/hooks/mutations/useCreatorWithdrawalMutation';
import {
  money,
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  getWithdrawalFee,
  getMaxWithdrawableAmount,
  formatSettlementDate,
  formatSettlementTimeOnly,
  getErrorMessage,
  type CreatorProfile,
  type CreatorClearance,
  type WithdrawalRow
} from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorWithdrawalPanelProps {
  creator: CreatorProfile;
  clearance?: CreatorClearance;
  withdrawals: WithdrawalRow[];
}

export function CreatorWithdrawalPanel({ creator, clearance, withdrawals }: CreatorWithdrawalPanelProps) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const withdrawalMutation = useCreatorWithdrawalMutation();

  const totalBalance = Number(clearance?.totalBalance ?? creator.balance ?? 0);
  const availableBalance = Number(clearance?.availableBalance ?? creator.balance ?? 0);
  const clearingBalance = Number(clearance?.clearingBalance ?? 0);
  const isClearing = Boolean(clearance?.isClearing);
  const nextAvailableAt = clearance?.nextAvailableAt;
  const formattedClearingDate = nextAvailableAt ? formatSettlementDate(nextAvailableAt) : 'Pending schedule';
  const formattedClearingTime = nextAvailableAt ? formatSettlementTimeOnly(nextAvailableAt) : '';
  const maxWithdrawable = getMaxWithdrawableAmount(availableBalance);

  const commissionEarnings = Number(clearance?.commissionEarnings ?? 0);
  const referralEarnings = Number(clearance?.referralEarnings ?? 0);

  const requestedAmount = Number(withdrawalAmount || 0);
  const withdrawalFee = getWithdrawalFee(requestedAmount);
  const totalDeduction = requestedAmount >= MIN_WITHDRAWAL_AMOUNT ? requestedAmount + withdrawalFee : 0;
  const hasEnoughBalance = availableBalance >= totalDeduction;

  const handleWithdrawal = async () => {
    const amount = Number(withdrawalAmount);
    const fee = getWithdrawalFee(amount);
    const deduction = amount + fee;
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
      toast.error(`Minimum withdrawal is KSh ${MIN_WITHDRAWAL_AMOUNT}.`);
      return;
    }
    if (availableBalance < deduction) {
      if (isClearing && totalBalance >= deduction) {
        toast.error(`Funds are currently clearing under standard T+2 holding. Available to withdraw now: KSh ${availableBalance.toLocaleString()}`);
      } else {
        toast.error(`Your available balance must cover the withdrawal and KSh ${fee} charge.`);
      }
      return;
    }

    setWithdrawing(true);
    try {
      await withdrawalMutation.mutateAsync(amount);
      toast.success('Withdrawal request sent.');
      setWithdrawalAmount('');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Could not request withdrawal.'));
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-4 sm:p-5 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/15">
            <Wallet className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950 dark:text-white">Get paid</h2>
            <p className="text-xs text-slate-500 dark:text-white/50">To {creator.mpesaNumber || 'your registered M-Pesa'}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">Available</div>
          <div className="text-base font-black text-emerald-600 dark:text-emerald-400">{money(availableBalance)}</div>
        </div>
      </div>

      {/* Earnings split: commission vs invited-business — lifetime earned, not
          the withdrawable balance (which nets out past withdrawals + T+2 holds). */}
      <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">Earned to date</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">Commission</p>
          <p className="mt-0.5 text-sm font-black text-slate-900 dark:text-white">{money(commissionEarnings)}</p>
          <p className="text-[10px] text-slate-400 dark:text-white/40">From promoted shops</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">Invited business</p>
          <p className="mt-0.5 text-sm font-black text-slate-900 dark:text-white">{money(referralEarnings)}</p>
          <p className="text-[10px] text-slate-400 dark:text-white/40">From businesses you invited</p>
        </div>
      </div>

      {isClearing ? (
        <div className="mt-4 rounded-2xl border border-blue-400/25 bg-blue-50/80 dark:bg-blue-500/10 p-3.5 space-y-2 text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
              <span>T+2 Clearance Active (2 Business Days)</span>
            </div>
            <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">T+2 Holding</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            <strong>{money(clearingBalance)}</strong> is clearing from recent earnings. Funds unlock for withdrawal on{' '}
            <span className="font-semibold text-blue-950 dark:text-white">{formattedClearingDate}</span>
            {formattedClearingTime ? ` at ${formattedClearingTime}` : ''}.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-white/40">
          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>Earnings unlock 2 business days (T+2) after each sale or referral.</span>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-3 text-xs">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 dark:text-white">M-Pesa Withdrawal Fees</span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-white/60">Min: KSh {MIN_WITHDRAWAL_AMOUNT}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
              {WITHDRAWAL_FEE_TIERS.map((tier) => (
                <div key={tier.label} className="rounded-xl border border-yellow-400/20 bg-white/70 dark:bg-black/30 p-1.5 text-slate-800 dark:text-white">
                  <div className="text-[9px] text-slate-500 dark:text-white/50">{tier.label}</div>
                  <div className="mt-0.5 text-yellow-600 dark:text-yellow-300 font-black">Fee: KSh {tier.fee}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="relative">
          <Input
            type="number"
            min={MIN_WITHDRAWAL_AMOUNT}
            value={withdrawalAmount}
            onChange={(event) => setWithdrawalAmount(event.target.value)}
            placeholder="Amount in KSh"
            className="h-11 pr-16 border-slate-300 dark:border-white/10 bg-white dark:bg-black/40 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 font-bold"
          />
          {maxWithdrawable > 0 && (
            <button
              type="button"
              onClick={() => setWithdrawalAmount(String(maxWithdrawable))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-yellow-400/20 hover:bg-yellow-400/30 px-2 py-1 text-[11px] font-black text-yellow-700 dark:text-yellow-300 transition-colors"
            >
              Max
            </button>
          )}
        </div>

        {requestedAmount >= MIN_WITHDRAWAL_AMOUNT && (
          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-xs font-bold space-y-1.5">
            <div className="flex justify-between gap-3">
              <span className="text-slate-600 dark:text-white/55">Withdrawal charge</span>
              <span className="text-slate-950 dark:text-white">{money(withdrawalFee)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-600 dark:text-white/55">Total deducted</span>
              <span className={hasEnoughBalance ? 'text-yellow-600 dark:text-yellow-100 font-extrabold' : 'text-red-600 dark:text-red-300 font-extrabold'}>
                {money(totalDeduction)}
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={handleWithdrawal}
          disabled={withdrawing || requestedAmount < MIN_WITHDRAWAL_AMOUNT || !hasEnoughBalance || availableBalance < MIN_WITHDRAWAL_AMOUNT}
          className="h-11 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {withdrawing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          ) : isClearing && availableBalance < MIN_WITHDRAWAL_AMOUNT ? (
            `Clearing (Available ${formattedClearingDate})`
          ) : availableBalance >= MIN_WITHDRAWAL_AMOUNT ? (
            'Withdraw to M-Pesa'
          ) : totalBalance > 0 ? (
            `Min Withdrawal KSh ${MIN_WITHDRAWAL_AMOUNT}`
          ) : (
            'No Balance Available'
          )}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {(withdrawals || []).slice(0, 3).map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-3 text-xs text-slate-950 dark:text-white">
            <div className="flex justify-between gap-3 font-bold">
              <span>{money(item.amount)}</span>
              <span className="uppercase text-yellow-600 dark:text-yellow-200">{item.status}</span>
            </div>
            <p className="mt-1 text-slate-500 dark:text-white/40">Charge {money(item.withdrawal_fee)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
