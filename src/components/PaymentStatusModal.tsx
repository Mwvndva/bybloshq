// src/components/PaymentStatusModal.tsx

import { useEffect, useState, useRef } from 'react';
import buyerApi from '@/api/buyerApi';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';

type ModalState = 'POLLING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

interface Props {
    isOpen: boolean;
    orderNumber: string | null;
    invoiceId: string | null;
    onClose: () => void;
    onSuccess?: () => void;
    isGuest?: boolean;
    email?: string;
}

export const PaymentStatusModal = ({ isOpen, orderNumber, invoiceId, onClose, onSuccess, isGuest, email }: Props) => {
    const [state, setState] = useState<ModalState>('POLLING');
    const [attempts, setAttempts] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const { loginWithToken } = useBuyerAuth();
    const MAX_ATTEMPTS = 60; // 5 minutes at 5s intervals

    // Reset when modal opens
    useEffect(() => {
        if (isOpen && invoiceId) {
            setState('POLLING');
            setAttempts(0);
        }
    }, [isOpen, invoiceId]);

    const handleAutoLogin = async (token: string) => {
        try {
            await loginWithToken(token);
        } catch (err) {
            console.error("Auto-login failed:", err);
        }
    };

    // Start/stop polling
    useEffect(() => {
        if (!isOpen || !invoiceId || state !== 'POLLING') {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        const poll = async () => {
            try {
                const res = await buyerApi.getOrderStatus(invoiceId);
                const status = (res.paymentStatus || '').toLowerCase();
                const orderStatus = res.status;

                // SUCCESS: Payment is confirmed OR order has moved to a post-payment state
                const isPaymentSuccess = ['completed', 'success'].includes(status);
                const isOrderProgressed = orderStatus && !['PENDING', 'RESERVED'].includes(orderStatus);

                if (isPaymentSuccess || isOrderProgressed) {
                    setState('SUCCESS');
                    if (intervalRef.current) clearInterval(intervalRef.current);

                    // If guest and we have autologin token, use it
                    if (isGuest && res.autoLoginToken) {
                        await handleAutoLogin(res.autoLoginToken);
                    }

                    onSuccess?.();
                    return;
                }

                if (status === 'failed') {
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
            }
        };

        poll(); // Poll immediately on start
        intervalRef.current = setInterval(poll, 5000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isOpen, invoiceId, state, isGuest, onSuccess]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/30 backdrop-blur-md transition-all duration-300">
            <div className="bg-white border-x border-t sm:border border-slate-200 
                          rounded-t-[2rem] sm:rounded-2xl p-6 sm:p-8 
                          w-full sm:max-w-sm mx-0 sm:mx-4 
                          h-[85dvh] sm:h-auto
                          flex flex-col justify-center
                          text-center shadow-2xl shadow-slate-300/60">

                <div className="flex-1 flex flex-col items-center justify-center">
                    {state === 'POLLING' && (
                        <>
                            <div className="relative mb-6">
                                <div className="w-20 h-20 border-4 border-slate-200 rounded-full" />
                                <div className="absolute top-0 left-0 w-20 h-20 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                            <h2 className="text-slate-950 text-2xl font-bold mb-3">Confirming Payment</h2>
                            <p className="text-slate-500 text-base mb-1">Check your phone for an M-Pesa prompt</p>
                            {orderNumber && (
                                <div className="bg-slate-100 px-4 py-2 rounded-full mt-4 flex items-center gap-2">
                                    <span className="text-slate-500 text-xs">Order:</span>
                                    <span className="text-yellow-600 font-mono text-sm font-bold">{orderNumber}</span>
                                </div>
                            )}
                            <div className="mt-8 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                                <p className="text-yellow-700 text-sm leading-relaxed">
                                    Please enter your M-Pesa PIN on the prompt sent to confirm your payment.
                                </p>
                            </div>
                        </>
                    )}

                    {state === 'SUCCESS' && (
                        <>
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                                <span className="text-green-400 text-4xl">✓</span>
                            </div>
                            <h2 className="text-slate-950 text-2xl font-bold mb-3">Payment Confirmed!</h2>
                            {orderNumber && (
                                <p className="text-slate-500 text-base mb-6">
                                    Order <span className="text-yellow-600 font-mono font-bold">#{orderNumber}</span> has been successfully placed.
                                </p>
                            )}

                            <div className="w-full space-y-3 mt-4">
                                <a
                                    href="/buyer/orders"
                                    className="flex items-center justify-center w-full h-14 bg-yellow-400 text-black rounded-xl font-bold hover:bg-yellow-300 transition-all active:scale-[0.98]"
                                >
                                    View My Orders
                                </a>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full h-14 text-slate-500 font-medium hover:text-slate-950 transition-colors"
                                >
                                    Return to Shop
                                </button>
                            </div>
                        </>
                    )}

                    {state === 'FAILED' && (
                        <>
                            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                                <span className="text-red-400 text-4xl">✗</span>
                            </div>
                            <h2 className="text-slate-950 text-2xl font-bold mb-3">Payment Failed</h2>
                            <p className="text-slate-500 text-base mb-8">
                                No charges were made. This could be due to a timeout or cancellation.
                            </p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full h-14 bg-yellow-400 text-black rounded-xl font-bold hover:bg-yellow-300 active:scale-[0.98] transition-all"
                            >
                                Try Again
                            </button>
                        </>
                    )}

                    {state === 'TIMEOUT' && (
                        <>
                            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                                <span className="text-amber-400 text-4xl">⏱</span>
                            </div>
                            <h2 className="text-slate-950 text-2xl font-bold mb-3">Still Waiting...</h2>
                            <p className="text-slate-500 text-base mb-2">Did the prompt reach your phone?</p>
                            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                                If you've already entered your PIN, don't worry—your order will update automatically once confirmed.
                            </p>

                            <div className="w-full space-y-3">
                                <a
                                    href="/buyer/orders"
                                    className="flex items-center justify-center w-full h-14 bg-slate-950 text-white rounded-xl font-bold hover:bg-slate-800 active:scale-[0.98] transition-all"
                                >
                                    Check Order Status
                                </a>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full h-12 text-slate-500 font-medium hover:text-slate-800"
                                >
                                    Close
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Mobile Handle */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full sm:hidden" />
            </div>
        </div>
    );
};
