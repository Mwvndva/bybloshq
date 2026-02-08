import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentLoadingModalProps {
    isOpen: boolean;
    onClose: () => void;
    paymentReference?: string;
    clientPhone?: string;
    onSuccess?: () => void;
    onFailure?: () => void;
}

export default function PaymentLoadingModal({
    isOpen,
    onClose,
    paymentReference,
    clientPhone,
    onSuccess,
    onFailure
}: PaymentLoadingModalProps) {
    const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
    const [countdown, setCountdown] = useState(120); // 2 minutes timeout

    useEffect(() => {
        if (!isOpen) {
            setStatus('loading');
            setCountdown(120);
            return;
        }

        // Countdown timer
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setStatus('failed');
                    onFailure?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, onFailure]);

    // Poll for payment status
    useEffect(() => {
        if (!isOpen || !paymentReference) return;

        const pollInterval = setInterval(async () => {
            try {
                // Check payment status via API
                const response = await fetch(`/api/payments/status/${paymentReference}`);
                const data = await response.json();

                if (data.status === 'success' && data.data) {
                    const paymentStatus = data.data.status;

                    // Check if payment completed
                    if (paymentStatus === 'completed' || paymentStatus === 'success') {
                        setStatus('success');
                        onSuccess?.();
                        clearInterval(pollInterval);
                    }
                    // Check if payment failed
                    else if (paymentStatus === 'failed') {
                        setStatus('failed');
                        onFailure?.();
                        clearInterval(pollInterval);
                    }
                }
            } catch (error) {
                console.error('Error polling payment status:', error);
            }
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(pollInterval);
    }, [isOpen, paymentReference, onSuccess, onFailure]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCancel = () => {
        if (status === 'loading') {
            // User cancelled while waiting
            setStatus('failed');
            onFailure?.();
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleCancel}>
            <DialogContent className="w-[92%] sm:max-w-md bg-[#0a0a0a] border-white/10 p-0 gap-0 overflow-hidden rounded-2xl">
                <DialogTitle className="sr-only">Payment Status</DialogTitle>
                {/* Close button */}
                {status !== 'loading' && (
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10"
                    >
                        <X className="h-4 w-4 text-white" />
                        <span className="sr-only">Close</span>
                    </button>
                )}

                <div className="flex flex-col items-center justify-center py-10 px-6 sm:py-12">
                    {status === 'loading' && (
                        <>
                            <div className="mb-8 flex items-center justify-center relative">
                                <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl animate-pulse"></div>
                                <Loader2 className="w-12 h-12 text-blue-500 animate-spin relative z-10" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 text-center">
                                Waiting for Payment
                            </h3>
                            <div className="flex flex-col items-center gap-1 mb-8">
                                <p className="text-sm text-gray-400 text-center">
                                    STK push sent to
                                </p>
                                <p className="text-base font-semibold text-blue-400">
                                    {clientPhone}
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-6 w-full">
                                <div className="px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
                                    <span className="text-xs font-mono text-gray-400 tabular-nums">
                                        {formatTime(countdown)}
                                    </span>
                                </div>
                                <Button
                                    onClick={handleCancel}
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-500 hover:text-white hover:bg-white/5 transition-colors font-medium"
                                >
                                    Cancel Request
                                </Button>
                            </div>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="mb-8 relative">
                                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl"></div>
                                <CheckCircle2 className="w-24 h-24 text-green-400 relative z-10" />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-3 text-center">
                                Payment Successful!
                            </h3>
                            <p className="text-sm text-gray-400 text-center mb-8 max-w-sm">
                                The order has been completed and your balance has been updated.
                            </p>
                            <Button
                                onClick={onClose}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-base"
                            >
                                Done
                            </Button>
                        </>
                    )}

                    {status === 'failed' && (
                        <>
                            <div className="mb-8 relative">
                                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl"></div>
                                <XCircle className="w-24 h-24 text-red-400 relative z-10" />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-3 text-center">
                                Payment Timeout
                            </h3>
                            <p className="text-sm text-gray-400 text-center mb-8 max-w-sm">
                                The payment request has expired. You can send a new prompt if needed.
                            </p>
                            <Button
                                onClick={onClose}
                                className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-6 text-base border border-white/20"
                            >
                                Close
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
