import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, PartyPopper, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import buyerApi from '@/api/buyerApi';

interface PaymentStatusModalProps {
    isOpen: boolean;
    orderNumber: string;
    onClose: () => void;
    isGuest: boolean;
    email?: string;
}

export function PaymentStatusModal({ isOpen, orderNumber, onClose, isGuest, email }: PaymentStatusModalProps) {
    const [status, setStatus] = useState<'polling' | 'success' | 'failed'>('polling');
    const [isConverting, setIsConverting] = useState(false);
    const navigate = useNavigate();
    const { setToken, setBuyer } = useBuyerAuth();

    useEffect(() => {
        let pollInterval: any;
        if (isOpen && status === 'polling') {
            pollInterval = setInterval(async () => {
                try {
                    const res = await buyerApi.getOrderStatus(orderNumber);
                    if (res.paymentStatus === 'success' || res.status !== 'PENDING') {
                        setStatus('success');
                        clearInterval(pollInterval);

                        // If guest, attempt auto-conversion/login
                        if (isGuest && res.autoLoginToken) {
                            handleAutoLogin(res.autoLoginToken);
                        }
                    } else if (res.paymentStatus === 'failed') {
                        setStatus('failed');
                        clearInterval(pollInterval);
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }, 3000);
        }
        return () => clearInterval(pollInterval);
    }, [isOpen, orderNumber, status, isGuest]);

    const handleAutoLogin = async (token: string) => {
        setIsConverting(true);
        try {
            const res = await buyerApi.autoLogin(token);
            if (res.status === 'success') {
                setToken(token);
                setBuyer(res.data.buyer);
            }
        } catch (err) {
            console.error("Auto-login failed:", err);
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && status !== 'polling' && onClose()}>
            <DialogContent className="bg-[#0A0A0A] border-white/10 text-white p-8 rounded-3xl max-w-sm mx-auto">
                <div className="flex flex-col items-center text-center space-y-6">
                    {status === 'polling' && (
                        <>
                            <div className="relative">
                                <div className="h-20 w-20 rounded-full border-4 border-yellow-400/20 flex items-center justify-center">
                                    <Loader2 className="h-10 w-10 text-yellow-400 animate-spin" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <DialogTitle className="text-xl font-black">AWAITING PAYMENT</DialogTitle>
                                <p className="text-sm text-gray-400">Please complete the M-Pesa prompt on your phone...</p>
                            </div>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="h-20 w-20 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                <PartyPopper className="h-10 w-10 text-green-500" />
                            </div>
                            <div className="space-y-2">
                                <DialogTitle className="text-2xl font-black text-white">PAYMENT SUCCESS!</DialogTitle>
                                <p className="text-sm text-gray-400">Your order has been confirmed.</p>
                                {isGuest && (
                                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
                                        <UserCheck className="h-4 w-4 text-blue-400" />
                                        <p className="text-[11px] text-blue-300 font-medium text-left">Account created! Check {email} to verify and claim your rewards.</p>
                                    </div>
                                )}
                            </div>
                            <Button
                                onClick={() => navigate('/buyer/orders')}
                                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black h-12 rounded-xl"
                            >
                                GO TO MY ORDERS
                            </Button>
                        </>
                    )}

                    {status === 'failed' && (
                        <>
                            <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/20">
                                <XCircle className="h-10 w-10 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <DialogTitle className="text-xl font-black text-white">PAYMENT FAILED</DialogTitle>
                                <p className="text-sm text-gray-400">We couldn't confirm your payment. Please try again or contact support.</p>
                            </div>
                            <Button
                                onClick={onClose}
                                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold h-12 rounded-xl"
                            >
                                CLOSE & RETRY
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
