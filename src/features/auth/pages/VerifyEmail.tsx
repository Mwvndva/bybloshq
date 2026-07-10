import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useBuyerVerifyEmailMutation, useBuyerResendVerificationMutation } from '@/hooks/buyer/mutations/useBuyerAuthMutations';
import { useSellerVerifyEmailMutation, useSellerResendVerificationMutation } from '@/hooks/seller/mutations/useSellerAuthMutations';
import { useCreatorVerifyEmailMutation, useCreatorResendVerificationMutation } from '@/hooks/creator/mutations/useCreatorAuthMutations';

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'check-email'>('loading');
    const [message, setMessage] = useState('Verifying your email...');

    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const type = searchParams.get('type') as 'buyer' | 'seller' | 'creator' | null;

    const buyerVerify = useBuyerVerifyEmailMutation();
    const buyerResend = useBuyerResendVerificationMutation();
    const sellerVerify = useSellerVerifyEmailMutation();
    const sellerResend = useSellerResendVerificationMutation();
    const creatorVerify = useCreatorVerifyEmailMutation();
    const creatorResend = useCreatorResendVerificationMutation();

    // Store latest mutateAsync in refs so the effect doesn't need the mutation objects as deps
    const buyerVerifyRef = React.useRef(buyerVerify.mutateAsync);
    const sellerVerifyRef = React.useRef(sellerVerify.mutateAsync);
    const creatorVerifyRef = React.useRef(creatorVerify.mutateAsync);
    buyerVerifyRef.current = buyerVerify.mutateAsync;
    sellerVerifyRef.current = sellerVerify.mutateAsync;
    creatorVerifyRef.current = creatorVerify.mutateAsync;

    useEffect(() => {
        const verify = async () => {
            if (!email || !type) {
                setStatus('error');
                setMessage('Invalid verification link. Email and account type are required.');
                return;
            }

            if (!token) {
                // If no token, it's a redirect from login, not a link click.
                setStatus('check-email');
                setMessage('Verification required. Please check your inbox for the verification link or resend it below.');
                return;
            }

            try {
                let result;
                if (type === 'seller') {
                    result = await sellerVerifyRef.current({ email, token });
                } else if (type === 'creator') {
                    result = await creatorVerifyRef.current({ token, email });
                } else {
                    result = await buyerVerifyRef.current({ email, token });
                }

                setStatus('success');
                setMessage((result as { message?: string })?.message || 'Email verified successfully! You can now login.');
                toast.success('Email Verified', { description: 'Your account is ready.' });
            } catch (error) {
                const err = error as Error;
                setStatus('error');
                setMessage(err.message || 'Verification failed. The link may have expired.');
                toast.error('Verification Failed', { description: err.message });
            }
        };

        verify();
    }, [token, email, type]);

    const [resending, setResending] = useState(false);

    const handleBackToLogin = () => {
        const loginPath = type === 'seller' ? '/seller/login' : type === 'creator' ? '/creator/login' : '/buyer/login';
        navigate(loginPath);
    };

    const handleResend = async () => {
        if (!email || !type) return;
        setResending(true);
        try {
            if (type === 'seller') {
                await sellerResend.mutateAsync(email);
            } else if (type === 'creator') {
                await creatorResend.mutateAsync(email);
            } else {
                await buyerResend.mutateAsync(email);
            }
            toast.success('Email Sent', { description: 'A new verification link has been sent to your inbox.' });
        } catch (error) {
            const err = error as Error;
            toast.error('Resend Failed', { description: err.message });
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8f7f2] flex items-center justify-center p-4 relative overflow-hidden"
            style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="max-w-md w-full bg-white border border-stone-200 p-8 rounded-3xl shadow-[0_18px_45px_rgba(17,17,17,0.08)] relative z-10 text-center"
            >
                <div className="mb-8 flex justify-center">
                    {status === 'loading' && (
                        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center relative">
                            <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
                            <div className="absolute inset-0 rounded-full border-2 border-yellow-200" />
                        </div>
                    )}
                    {status === 'success' && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center"
                        >
                            <CheckCircle className="w-12 h-12 text-green-500" />
                        </motion.div>
                    )}
                    {status === 'error' && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center"
                        >
                            <XCircle className="w-12 h-12 text-red-500" />
                        </motion.div>
                    )}
                    {status === 'check-email' && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center"
                        >
                            <Mail className="w-12 h-12 text-yellow-600" />
                        </motion.div>
                    )}
                </div>

                <h1 className="text-3xl font-semibold text-stone-950 mb-4 tracking-tight">
                    {status === 'loading' ? 'Verifying Account' :
                        status === 'success' ? 'Verification Success' :
                            status === 'check-email' ? 'Action Required' : 'Verification Issue'}
                </h1>

                <p className="text-stone-600 text-lg mb-8 leading-relaxed">
                    {message}
                </p>

                <div className="space-y-4">
                    {status !== 'loading' && (
                        <Button
                            onClick={handleBackToLogin}
                            className={`w-full h-12 text-lg font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${status === 'success' || status === 'check-email'
                                ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                                : 'bg-white text-stone-950 hover:bg-stone-50 border border-stone-200'
                                }`}
                        >
                            {status === 'success' || status === 'check-email' ? 'Go to Login' : 'Try Again'}
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    )}

                    {status !== 'success' && email && type && (
                        <Button
                            onClick={handleResend}
                            disabled={resending}
                            variant="ghost"
                            className="w-full text-stone-700 hover:text-black hover:bg-yellow-50"
                        >
                            {resending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Resend verification email
                        </Button>
                    )}

                    <button
                        onClick={() => navigate('/')}
                        className="text-stone-500 hover:text-stone-950 transition-colors text-sm font-medium"
                    >
                        Back to Homepage
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmail;


