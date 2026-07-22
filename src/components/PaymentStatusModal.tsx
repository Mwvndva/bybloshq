import { useCallback, useEffect, useRef, useState } from 'react';
import { useGetOrderStatusMutation } from '@/hooks/buyer/queries/useOrderStatusQuery';
import { useBuyerAuth } from '@/features/auth/contexts';
import { formatCurrency } from '@/lib/utils';
import { isNativeApp, APP_DOWNLOAD_URL } from '@/lib/mobileApp';

type ModalState = 'POLLING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

interface Props {
  isOpen: boolean;
  orderNumber: string | null;
  invoiceId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  isGuest?: boolean;
  email?: string;
  paymentSummary?: {
    productAmount?: number;
    deliveryFee?: number;
    serviceCharge?: number;
    totalAmount?: number;
  };
}

export const PaymentStatusModal = ({
  isOpen,
  orderNumber,
  invoiceId,
  onClose,
  onSuccess,
  isGuest,
  email,
  paymentSummary
}: Props) => {
  const [state, setState] = useState<ModalState>('POLLING');
  const [attempts, setAttempts] = useState(0);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { loginWithToken } = useBuyerAuth();
  const getOrderStatusMutation = useGetOrderStatusMutation();
  // Store the latest mutateAsync in a ref so the polling effect doesn't need it as a dep
  const getOrderStatusRef = useRef(getOrderStatusMutation.mutateAsync);
  getOrderStatusRef.current = getOrderStatusMutation.mutateAsync;
  const MAX_ATTEMPTS = 60;


  useEffect(() => {
    if (isOpen && invoiceId) {
      setState('POLLING');
      setAttempts(0);
      setFailureReason(null);
    }
  }, [isOpen, invoiceId]);

  const handleAutoLogin = useCallback(async (token: string) => {
    try {
      await loginWithToken(token);
    } catch (err) {
      console.error('Auto-login failed:', err);
    }
  }, [loginWithToken]);

  useEffect(() => {
    if (!isOpen || !invoiceId || state !== 'POLLING') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const poll = async () => {
      try {
        const res = (await getOrderStatusRef.current(invoiceId)) as {
          paymentStatus?: string;
          paymentRecordStatus?: string;
          status?: string;
          autoLoginToken?: string;
          failureReason?: string;
        };
        const status = (res.paymentStatus || '').toLowerCase();
        const paymentRecordStatus = (res.paymentRecordStatus || '').toLowerCase();
        const orderStatus = String(res.status || '').toUpperCase();

        const isPaymentSuccess = ['completed', 'success', 'paid'].includes(status)
          || ['completed', 'success', 'paid'].includes(paymentRecordStatus);
        const isOrderPaid = [
          'PAID',
          'FULFILLMENT_PENDING',
          'FULFILLED',
          'DELIVERED',
          'COMPLETED',
          'BOOKED',
          'COLLECTION_PENDING'
        ].includes(orderStatus);
        const isPaymentFailure = ['failed', 'cancelled', 'manual_review_required', 'payment_mapping_failed', 'compensation_required'].includes(status)
          || ['failed', 'cancelled', 'manual_review_required', 'payment_mapping_failed', 'compensation_required'].includes(paymentRecordStatus)
          || ['FAILED', 'CANCELLED', 'COMPENSATION_REQUIRED'].includes(orderStatus);

        if (isPaymentSuccess || isOrderPaid) {
          setState('SUCCESS');
          if (intervalRef.current) clearInterval(intervalRef.current);

          if (isGuest && res.autoLoginToken) {
            await handleAutoLogin(res.autoLoginToken);
          }

          onSuccess?.();
          return;
        }

        if (isPaymentFailure) {
          setFailureReason(res.failureReason || null);
          setState('FAILED');
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }

        setAttempts(prev => {
          if (prev + 1 >= MAX_ATTEMPTS) {
            setState('TIMEOUT');
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
          return prev + 1;
        });
      } catch (err) {
        console.error('Poll error:', err);
        setAttempts(prev => {
          if (prev + 1 >= MAX_ATTEMPTS) {
            setState('TIMEOUT');
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
          return prev + 1;
        });
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, invoiceId, state, isGuest, onSuccess, handleAutoLogin]);

  if (!isOpen) return null;

  const serviceChargeAmount = Number(paymentSummary?.serviceCharge || 0);
  const totalAmount = Number(paymentSummary?.totalAmount || 0);
  const serviceChargeText = serviceChargeAmount > 0
    ? `Your total${totalAmount > 0 ? ` of ${formatCurrency(totalAmount)}` : ''} includes a 2% Byblos service charge of ${formatCurrency(serviceChargeAmount)}.`
    : 'Your total includes Byblos 2% service charge for protected checkout, receipts, and order tracking.';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 dark:bg-black/85 p-4 text-center backdrop-blur-md transition-colors duration-200">
      <div className="flex max-h-[85dvh] w-full max-w-[380px] flex-col justify-center overflow-y-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] p-5 sm:p-6 text-slate-950 dark:text-white shadow-2xl transition-colors duration-200">
        <div className="flex flex-col items-center justify-center">
          {state === 'POLLING' && (
            <>
              <div className="relative mb-4">
                <div className="h-14 w-14 rounded-full border-4 border-slate-200 dark:border-white/10" />
                <div className="absolute left-0 top-0 h-14 w-14 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">Confirming Payment</h2>
              <p className="mb-1 text-xs text-slate-600 dark:text-white/60">Check your phone for an M-Pesa prompt</p>
              {orderNumber && (
                <div className="mt-3 flex items-center gap-2 rounded-full bg-slate-100 dark:bg-white/10 px-3 py-1.5">
                  <span className="text-xs text-slate-500 dark:text-white/50">Order:</span>
                  <span className="font-mono text-sm font-bold text-yellow-600 dark:text-yellow-400">{orderNumber}</span>
                </div>
              )}
              <div className="mt-4 rounded-xl border border-yellow-200 dark:border-yellow-400/20 bg-yellow-50 dark:bg-yellow-400/10 p-3">
                <p className="text-xs leading-relaxed text-yellow-700 dark:text-yellow-100 font-semibold">
                  Please enter your M-Pesa PIN on the prompt sent to confirm your payment.
                </p>
              </div>
              <div className="mt-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-2.5">
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-white/60">{serviceChargeText}</p>
              </div>
            </>
          )}

          {state === 'SUCCESS' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-green-500/20 bg-green-500/20">
                <span className="text-sm font-bold text-green-700 dark:text-green-400">OK</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">Payment Confirmed</h2>
              {orderNumber && (
                <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-white/60">
                  Order <span className="font-mono font-bold text-yellow-600 dark:text-yellow-400">#{orderNumber}</span> has been successfully placed.
                </p>
              )}
              <div className="mb-3 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-2.5">
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-white/60">{serviceChargeText}</p>
              </div>
              {isGuest && !isNativeApp() && (
                <div className="mb-3 w-full rounded-xl border border-yellow-200 dark:border-yellow-400/20 bg-yellow-50 dark:bg-yellow-400/10 p-3 text-left">
                  <p className="text-xs font-bold text-slate-950 dark:text-white">Your Byblos account is ready</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-700 dark:text-white/70">
                    Log in anytime with{email ? <> <span className="font-semibold text-slate-900 dark:text-white">{email}</span></> : ' your email'} and the password you set to track this order.
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-700 dark:text-white/70">
                    Get the app for delivery updates and instant notifications.
                  </p>
                  <a
                    href={APP_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 dark:bg-white text-xs font-bold text-white dark:text-slate-950 transition-all hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98]"
                  >
                    Get it on Google Play
                  </a>
                </div>
              )}
              <div className="mt-2 w-full space-y-2">
                <a
                  href="/buyer/orders"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-yellow-400 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-[0.98]"
                >
                  View My Orders
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 w-full text-sm font-medium text-slate-600 dark:text-white/60 transition-colors hover:text-slate-950 dark:hover:text-white"
                >
                  Return to Shop
                </button>
              </div>
            </>
          )}

          {state === 'FAILED' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/20">
                <span className="text-sm font-bold text-red-700 dark:text-red-400">NO</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">Payment Failed</h2>
              <p className="mb-4 text-xs leading-relaxed text-slate-600 dark:text-white/60">
                {failureReason || 'No charges were made. This could be due to insufficient balance, a wrong M-Pesa PIN, cancellation, or timeout.'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="h-11 w-full rounded-xl bg-yellow-400 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-[0.98]"
              >
                Try Again
              </button>
            </>
          )}

          {state === 'TIMEOUT' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/20">
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">...</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">Still Waiting</h2>
              <p className="mb-1 text-xs text-slate-600 dark:text-white/60">Did the prompt reach your phone?</p>
              <p className="mb-4 text-xs leading-relaxed text-slate-600 dark:text-white/60">
                If you have already entered your PIN, your order will update automatically once confirmed.
              </p>
              <div className="w-full space-y-2">
                <a
                  href="/buyer/orders"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 dark:bg-white text-sm font-bold text-white dark:text-slate-950 transition-all hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98]"
                >
                  Check Order Status
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 w-full text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


