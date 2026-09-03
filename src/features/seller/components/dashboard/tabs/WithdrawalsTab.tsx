import { Download, Info, Wallet, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { exportWithdrawalsToCSV } from '@/shared/utils/exportUtils';
import { getWithdrawalFee, MIN_WITHDRAWAL_AMOUNT, WITHDRAWAL_FEE_TIERS } from '../dashboardUtils';
import type { ApiWithdrawalRequest } from '@/shared/types/api/withdrawal';
import { formatKes, formatSettlementDate, formatSettlementTimeOnly } from './withdrawalsTab.utils';
import { WithdrawalHistoryCard } from './WithdrawalHistoryCard';
import { WithdrawalRequestForm } from './WithdrawalRequestForm';

interface WithdrawalsTabProps {
  balance: number;
  pendingSettlementBalance?: number;
  withdrawalReservedBalance?: number;
  refundReservedBalance?: number;
  nextSettlementAt?: string | null;
  endDate: string;
  filteredWithdrawals: ApiWithdrawalRequest[];
  handleWithdrawalRequest: (event: React.FormEvent) => Promise<void>;
  isRequestingWithdrawal: boolean;
  setEndDate: (date: string) => void;
  setShowWithdrawalForm: (show: boolean) => void;
  setStartDate: (date: string) => void;
  setWithdrawalForm: React.Dispatch<React.SetStateAction<{ amount: string; mpesaNumber: string; mpesaName: string }>>;
  showWithdrawalForm: boolean;
  startDate: string;
  withdrawalForm: { amount: string; mpesaNumber: string; mpesaName: string };
  withdrawalRequests: ApiWithdrawalRequest[];
}

const cardClass = 'rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 border border-white/10 bg-[#0a0a0a] shadow-[0_12px_35px_rgba(0,0,0,0.45)]';

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
  const nextSettlementDate = nextSettlementAt
    ? formatSettlementDate(nextSettlementAt)
    : 'Pending schedule';
  const nextSettlementTime = nextSettlementAt
    ? formatSettlementTimeOnly(nextSettlementAt)
    : null;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="text-center px-2 sm:px-0">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-1.5">Withdrawal Management</h2>
        <p className="text-white/60 text-xs sm:text-sm lg:text-base font-medium">Request and track your withdrawal requests</p>
      </div>

      {/* ── Primary Hero Balance ────────────────────────────────────────── */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/10 bg-[#0a0a0a] shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white/50">Ready to Withdraw</h3>
            </div>
            <p className="mt-1 text-2xl sm:text-3xl md:text-4xl font-black text-emerald-400 tracking-tight tabular-nums">
              {formatKes(balance)}
            </p>
            <p className="mt-0.5 text-xs text-white/60 font-medium">Available to send to M-Pesa immediately</p>
          </div>

          {!showWithdrawalForm && (
            <div className="w-full sm:w-auto shrink-0">
              <Button
                onClick={() => setShowWithdrawalForm(true)}
                className="gap-2 shadow-lg px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm w-full sm:w-auto h-11 sm:h-12"
                style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
                disabled={balance < MIN_WITHDRAWAL_AMOUNT}
              >
                <Wallet className="h-4 w-4" />
                Request Withdrawal
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Supporting Compact Balances ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-white/10 bg-[#0a0a0a] shadow-sm flex flex-col justify-between min-w-0">
          <div>
            <h4 className="text-[10px] sm:text-xs font-bold text-white/50 uppercase tracking-wider truncate" title="Preparing for Withdrawal">
              Preparing
            </h4>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-base md:text-xl font-black truncate tabular-nums" style={{ color: 'var(--theme-accent, #f5c518)' }}>
              {formatKes(pendingSettlementBalance)}
            </p>
          </div>
          <div className="mt-1 text-[9px] sm:text-[10px] font-semibold text-white/40 min-w-0" title={`Next: ${nextSettlementDate}${nextSettlementTime ? ` at ${nextSettlementTime}` : ''}`}>
            <p className="truncate">Next: {nextSettlementDate}</p>
            {nextSettlementTime && (
              <p className="truncate text-white/60 font-medium">at {nextSettlementTime}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-white/10 bg-[#0a0a0a] shadow-sm flex flex-col justify-between min-w-0">
          <div>
            <h4 className="text-[10px] sm:text-xs font-bold text-white/50 uppercase tracking-wider truncate" title="Being Sent to You">
              In Transit
            </h4>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-base md:text-xl font-black text-white truncate tabular-nums">
              {formatKes(withdrawalReservedBalance)}
            </p>
          </div>
          <p className="mt-1 text-[9px] sm:text-[10px] font-semibold text-white/40 truncate">
            Processing
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-white/10 bg-[#0a0a0a] shadow-sm flex flex-col justify-between min-w-0">
          <div>
            <h4 className="text-[10px] sm:text-xs font-bold text-white/50 uppercase tracking-wider truncate" title="Held for Refunds">
              Held for Refunds
            </h4>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-base md:text-xl font-black text-white truncate tabular-nums">
              {formatKes(refundReservedBalance)}
            </p>
          </div>
          <p className="mt-1 text-[9px] sm:text-[10px] font-semibold text-white/40 truncate">
            Dispute hold
          </p>
        </div>
      </div>

      {/* ── Fee Information ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-yellow-400/25 bg-yellow-400/10 p-2.5 sm:p-3 flex items-start gap-2 sm:gap-3">
        <div className="rounded-full border p-0.5 sm:p-1 mt-0.5 flex-shrink-0" style={{ borderColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.35)', backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.15)' }}>
          <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-white text-[10px] sm:text-xs">Minimum: KSh {MIN_WITHDRAWAL_AMOUNT}</h4>
          <p className="text-white/60 text-[9px] sm:text-[10px] mt-0.5 leading-tight">
            Withdrawal charges are deducted from your available balance together with the requested amount.
          </p>
          <div className="mt-2 grid gap-1 text-[9px] sm:text-[10px] font-black text-white sm:grid-cols-3">
            {WITHDRAWAL_FEE_TIERS.map((tier) => (
              <span key={tier.label} className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1">
                {tier.label}: KSh {tier.fee}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Withdrawal Form ─────────────────────────────────────────────── */}
      {showWithdrawalForm && (
        <WithdrawalRequestForm
          balance={balance}
          showWithdrawalForm={showWithdrawalForm}
          setShowWithdrawalForm={setShowWithdrawalForm}
          handleWithdrawalRequest={handleWithdrawalRequest}
          withdrawalForm={withdrawalForm}
          setWithdrawalForm={setWithdrawalForm}
          isRequestingWithdrawal={isRequestingWithdrawal}
          withdrawalFee={withdrawalFee}
          totalDeducted={totalDeducted}
        />
      )}

      <div className="rounded-2xl sm:rounded-3xl p-3 sm:p-6 md:p-8 border border-white/10 bg-[#0a0a0a] shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
          <div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white">Withdrawal Requests</h3>
            <p className="text-white/60 text-xs sm:text-sm font-medium mt-1">Track your withdrawal request history</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 bg-[#141414] border-white/10 text-white focus:border-yellow-500/50 focus:ring-yellow-500/20"
                placeholder="Start date"
              />
            </div>
            <span className="hidden sm:flex items-center text-white/60 text-sm">to</span>
            <div className="relative flex-1">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 bg-[#141414] border-white/10 text-white focus:border-yellow-500/50 focus:ring-yellow-500/20"
                placeholder="End date"
              />
            </div>
            {(startDate || endDate) && (
              <IconButton
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                variant="outline"
                aria-label="Clear date filters"
                className="border-white/10 bg-white/[0.04] text-white hover:bg-white/10 h-11 w-full sm:w-11"
              >
                <X className="h-4 w-4" />
              </IconButton>
            )}
          </div>

          <Button
            onClick={() => exportWithdrawalsToCSV(withdrawalRequests)}
            variant="outline"
            className="border-white/10 bg-white/[0.04] text-white hover:bg-white/10 gap-2 h-10 w-full lg:w-auto"
            disabled={withdrawalRequests.length === 0}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>

        {filteredWithdrawals.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {filteredWithdrawals.map((request) => (
              <WithdrawalHistoryCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-8 border border-white/10 bg-white/[0.04] rounded-3xl flex items-center justify-center">
              <Wallet className="h-12 w-12 text-white/40" />
            </div>
            <h3 className="text-xl font-black text-white mb-3">No withdrawal requests</h3>
            <p className="text-white/60 text-lg font-medium max-w-md mx-auto mb-6">You haven't made any withdrawal requests yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
