import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import buyerApi from '@/api/buyerApi';
import { sellerApi } from '@/api/sellerApi';

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

    const handleResend = async () => {
        if (resendCooldown > 0 || isResending) return;

        setIsResending(true);
        setIsSuccess(false);
        try {
            if (role === 'seller') {
                await sellerApi.resendVerification(email);
            } else {
                await buyerApi.resendVerification(email);
            }

            setIsSuccess(true);
            toast({
                title: 'Verification Link Sent',
                description: `A new link has been sent to ${email}. Please check your inbox.`,
            });
            setResendCooldown(60);
        } catch (error: any) {
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
            <DialogContent className="sm:max-w-[420px] bg-white border-slate-200 text-slate-950 rounded-3xl overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600" />

                <DialogHeader className="pt-6">
                    <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
                        {isSuccess ? (
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        ) : (
                            <Mail className="h-8 w-8 text-yellow-500" />
                        )}
                    </div>
                    <DialogTitle className="text-2xl font-bold text-center text-slate-950">
                        Verify Your Email
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-500 pt-2 text-base">
                        Your {role} account is almost ready. We've sent a verification link to:
                        <br />
                        <span className="text-slate-950 font-semibold mt-1 block">{email}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-6">
                    <p className="text-sm text-slate-500 text-center leading-relaxed">
                        Please click the link in the email to activate your account. If you don't see it, check your spam folder.
                    </p>

                    <Button
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || isResending}
                        className={`w-full h-12 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${isSuccess
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                            : 'bg-yellow-500 text-black hover:bg-yellow-600'
                            }`}
                    >
                        {isResending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isSuccess ? (
                            <RefreshCw className="h-4 w-4" />
                        ) : (
                            <Mail className="h-4 w-4" />
                        )}
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="w-full text-slate-500 hover:text-slate-950 hover:bg-slate-100 h-11 rounded-xl"
                    >
                        Close and go back
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
