import { Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MIN_WITHDRAWAL_AMOUNT } from '../dashboardUtils';
import { formatKes } from './withdrawalsTab.utils';

interface WithdrawalRequestFormProps {
  balance: number;
  showWithdrawalForm: boolean;
  setShowWithdrawalForm: (show: boolean) => void;
  handleWithdrawalRequest: (event: React.FormEvent) => Promise<void>;
  withdrawalForm: { amount: string; mpesaNumber: string; mpesaName: string };
  setWithdrawalForm: React.Dispatch<React.SetStateAction<{ amount: string; mpesaNumber: string; mpesaName: string }>>;
  isRequestingWithdrawal: boolean;
  withdrawalFee: number;
  totalDeducted: number;
}

const inputClass = 'h-10 sm:h-11 text-sm bg-[#141414] border-white/10 text-white placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400';

export function WithdrawalRequestForm({
  balance,
  showWithdrawalForm,
  setShowWithdrawalForm,
  handleWithdrawalRequest,
  withdrawalForm,
  setWithdrawalForm,
  isRequestingWithdrawal,
  withdrawalFee,
  totalDeducted,
}: WithdrawalRequestFormProps) {
  return (
      <div>
        {!showWithdrawalForm ? (
          <Button
            onClick={() => setShowWithdrawalForm(true)}
            className="gap-1.5 sm:gap-2 shadow-lg px-4 sm:px-5 md:px-6 py-2.5 sm:py-2.5 md:py-3 rounded-xl font-black text-xs sm:text-sm w-full sm:w-auto h-11 sm:h-auto"
            style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
            disabled={balance < MIN_WITHDRAWAL_AMOUNT}
          >
            <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Request Withdrawal
          </Button>
        ) : (
          <div className="border border-white/10 bg-[#0a0a0a] rounded-xl sm:rounded-2xl p-3 sm:p-6 md:p-8 shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
            <h4 className="text-lg sm:text-xl font-black text-white mb-4">Request Withdrawal</h4>
            <form onSubmit={handleWithdrawalRequest} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount" className="text-xs font-semibold text-white/70 mb-2 block">
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
                    className={inputClass}
                    required
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Max: {formatKes(balance)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="mpesaNumber" className="text-xs font-semibold text-white/70 mb-2 block">
                    M-Pesa Number
                  </Label>
                  <Input
                    id="mpesaNumber"
                    type="tel"
                    value={withdrawalForm.mpesaNumber}
                    onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaNumber: e.target.value }))}
                    placeholder="0712345678"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="mpesaName" className="text-xs font-semibold text-white/70 mb-2 block">
                  Name on M-Pesa Number
                </Label>
                <Input
                  id="mpesaName"
                  type="text"
                  value={withdrawalForm.mpesaName}
                  onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaName: e.target.value }))}
                  placeholder="Enter name as registered on M-Pesa"
                  className={inputClass}
                  required
                />
              </div>
              {totalDeducted > 0 && (
                <div className="rounded-xl border border-yellow-400/25 bg-yellow-400/10 p-3 text-xs font-semibold text-white">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/70">Withdrawal charge</span>
                    <span>{formatKes(withdrawalFee)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm font-black">
                    <span>Total deducted from balance</span>
                    <span style={{ color: 'var(--theme-accent, #f5c518)' }}>{formatKes(totalDeducted)}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3 sm:pt-4">
                <Button
                  type="submit"
                  disabled={isRequestingWithdrawal}
                  className="shadow-lg px-4 py-2 h-10 sm:h-8 text-xs rounded-lg font-black w-full sm:w-auto"
                  style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
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
                  className="px-4 py-2 h-10 sm:h-8 text-xs rounded-lg border-white/10 bg-white/[0.04] text-white hover:bg-white/10 w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
  );
}
