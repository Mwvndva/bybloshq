import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface ProductPaymentStatusDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceId: string;
    onSuccess: () => void;
}

export function ProductPaymentStatusDialog({
    isOpen,
    onOpenChange,
    invoiceId,
    onSuccess
}: ProductPaymentStatusDialogProps) {
    const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');
    const [message, setMessage] = useState('Please check your phone to complete the payment.');

    useEffect(() => {
        let pollInterval: NodeJS.Timeout;

        if (isOpen && invoiceId && status === 'pending') {
            const checkStatus = async () => {
                try {
                    // Poll the status endpoint
                    const response = await api.get(`/payments/status/${invoiceId}`);

                    if ((response as any).data?.data) {
                        const paymentData = (response as any).data.data;
                        const paymentState = paymentData.state || paymentData.status;

                        if (paymentState === 'completed' || paymentState === 'success') {
                            setStatus('success');
                            // Don't close immediately, show success message first
                            setTimeout(() => {
                                onSuccess();
                            }, 2000);
                        } else if (paymentState === 'failed') {
                            setStatus('failed');
                            setMessage('Payment failed. Please try again.');
                        }
                    }
                } catch (error) {
                    console.error('Error polling payment status:', error);
                }
            };

            // Poll every 3 seconds
            pollInterval = setInterval(checkStatus, 3000);

            // Initial check
            checkStatus();
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [isOpen, invoiceId, status, onSuccess]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl rounded-3xl max-w-sm p-8 text-center">
                {status === 'pending' && (
                    <div className="space-y-6">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100 shadow-inner animate-pulse">
                            <Loader2 className="h-10 w-10 text-yellow-600 animate-spin" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-black mb-2">Processing Payment</h3>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                Please check your phone and enter your M-Pesa PIN to complete the purchase.
                            </p>
                        </div>
                        <div className="pt-2">
                            <p className="text-sm text-gray-400 font-medium">Do not close this window</p>
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-6">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-200 shadow-inner">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-black mb-2">Payment Successful!</h3>
                            <p className="text-gray-600 text-lg">
                                Your order has been confirmed. Redirecting...
                            </p>
                        </div>
                    </div>
                )}

                {status === 'failed' && (
                    <div className="space-y-6">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 shadow-inner">
                            <AlertCircle className="h-10 w-10 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-black mb-2">Payment Failed</h3>
                            <p className="text-gray-600 text-lg mb-4">
                                {message}
                            </p>
                        </div>
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="w-full bg-gray-900 text-white hover:bg-black shadow-lg px-6 py-6 rounded-xl font-bold text-lg"
                        >
                            Try Again
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
