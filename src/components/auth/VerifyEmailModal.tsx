import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBuyerResendVerificationMutation } from '@/hooks/buyer/mutations/useBuyerAuthMutations';
import { useSellerResendVerificationMutation } from '@/hooks/seller/mutations/useSellerAuthMutations';

interface VerifyEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    role: 'buyer' | 'seller';
}

export function VerifyEmailModal({ isOpen, onClose, email, role }: VerifyEmailModalProps) {
    const { toast } = useToast();
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [resendCooldown]);

    const buyerResend = useBuyerResendVerificationMutation();
    const sellerResend = useSellerResendVerificationMutation();

    const handleResend = async () => {
        if (resendCooldown > 0 || isResending) return;

        setIsResending(true);
        setIsSuccess(false);
        try {
            if (role === 'seller') {
                await sellerResend.mutateAsync(email);
            } else {
                await buyerResend.mutateAsync(email);
            }

            setIsSuccess(true);
            toast({
                title: 'Verification Link Sent',
                description: `A new link has been sent to ${email}. Please check your inbox.`,
            });
            setResendCooldown(60);
        } catch (error) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to resend verification email.',
                variant: 'destructive',
            });
        } finally {
            setIsResending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[92vw] sm:max-w-[420px] bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 text-slate-950 dark:text-white rounded-3xl overflow-hidden shadow-2xl transition-colors duration-200">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600" />

                <DialogHeader className="pt-6">
                    <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
                        {isSuccess ? (
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        ) : (
                            <Mail className="h-8 w-8 text-yellow-500" />
                        )}
                    </div>
                    <DialogTitle className="text-2xl font-bold text-center text-slate-950 dark:text-white">
                        Verify Your Email
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-600 dark:text-white/60 pt-2 text-base">
                        Your {role} account is almost ready. We've sent a verification link to:
                        <br />
                        <span className="text-slate-950 dark:text-white font-semibold mt-1 block">{email}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-6">
                    <p className="text-sm text-slate-600 dark:text-white/60 text-center leading-relaxed">
                        Please click the link in the email to activate your account. If you don't see it, check your spam folder.
                    </p>

                    <Button
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || isResending}
                        className={`w-full h-12 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${isSuccess
                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30 border border-green-500/30'
                            : 'bg-yellow-400 text-black hover:bg-yellow-300 font-extrabold'
                            }`}
                    >
                        {isResending ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Resending...
                            </>
                        ) : resendCooldown > 0 ? (
                            `Resend in ${resendCooldown}s`
                        ) : (
                            <>
                                <RefreshCw className="h-5 w-5" />
                                Resend Verification Email
                            </>
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="w-full text-slate-500 hover:text-slate-950 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-white h-11 rounded-xl"
                    >
                        Close and go back
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}


