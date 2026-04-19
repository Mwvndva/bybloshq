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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-8 w-full max-w-sm mx-4 text-center">

                {state === 'POLLING' && (
                    <>
                        <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <h2 className="text-white text-xl font-bold mb-2">Waiting for Payment</h2>
                        <p className="text-gray-400 text-sm mb-1">Check your phone for an M-Pesa prompt</p>
                        {orderNumber && (
                            <p className="text-gray-500 text-xs mt-3">Order: <span className="text-yellow-400 font-mono">{orderNumber}</span></p>
                        )}
                        <p className="text-gray-600 text-xs mt-4">Enter your M-Pesa PIN to confirm payment</p>
                    </>
                )}

                {state === 'SUCCESS' && (
                    <>
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-green-400 text-3xl">✓</span>
                        </div>
                        <h2 className="text-white text-xl font-bold mb-2">Payment Confirmed!</h2>
                        {orderNumber && (
                            <p className="text-gray-400 text-sm mb-4">Order <span className="text-yellow-400 font-mono">{orderNumber}</span> is being processed.</p>
                        )}
                        <p className="text-gray-400 text-sm mb-6">Login to track your order and view updates.</p>

                        <a
                            href="/buyer/orders"
                            className="block w-full py-3 bg-yellow-400 text-black rounded-lg font-bold hover:bg-yellow-300 transition-colors"
                        >
                            View My Orders
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full mt-3 py-2 text-gray-500 hover:text-gray-300 text-sm"
                        >
                            Close
                        </button>
                    </>
                )}

                {state === 'FAILED' && (
                    <>
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-red-400 text-3xl">✗</span>
                        </div>
                        <h2 className="text-white text-xl font-bold mb-2">Payment Failed</h2>
                        <p className="text-gray-400 text-sm mb-6">No charges were made. Please try again.</p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-3 bg-yellow-400 text-black rounded-lg font-bold hover:bg-yellow-300"
                        >
                            Try Again
                        </button>
                    </>
                )}

                {state === 'TIMEOUT' && (
                    <>
                        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-amber-400 text-3xl">⏱</span>
                        </div>
                        <h2 className="text-white text-xl font-bold mb-2">Still Waiting...</h2>
                        <p className="text-gray-400 text-sm mb-2">Check your M-Pesa messages for a prompt.</p>
                        <p className="text-gray-500 text-xs mb-6">If you completed payment, your order will update automatically.</p>
                        <a href="/buyer/orders" className="block w-full py-3 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 mb-3">
                            Check My Orders
                        </a>
                        <button type="button" onClick={onClose} className="w-full py-2 text-gray-500 text-sm">
                            Close
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
