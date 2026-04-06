import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import buyerApi from '@/api/buyerApi';
import sellerApi from '@/api/sellerApi';

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your email...');

    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const type = searchParams.get('type') as 'buyer' | 'seller' | null;

    useEffect(() => {
        const verify = async () => {
            if (!token || !email || !type) {
                setStatus('error');
                setMessage('Invalid verification link. Token, email, and account type are required.');
                return;
            }

            try {
                let result;
                if (type === 'seller') {
                    result = await sellerApi.verifyEmail(email, token);
                } else {
                    result = await buyerApi.verifyEmail(email, token);
                }

                setStatus('success');
                setMessage(result.message || 'Email verified successfully! You can now login.');
                toast.success('Email Verified', { description: 'Your account is ready.' });
            } catch (error: any) {
                setStatus('error');
                setMessage(error.message || 'Verification failed. The link may have expired.');
                toast.error('Verification Failed', { description: error.message });
            }
        };

        verify();
    }, [token, email, type]);

    const handleBackToLogin = () => {
        const loginPath = type === 'seller' ? '/seller/login' : '/buyer/login';
        navigate(loginPath);
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden"
            style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
        >
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="max-w-md w-full bg-[#111111]/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10 text-center"
            >
                <div className="mb-8 flex justify-center">
                    {status === 'loading' && (
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center relative">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                            <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                        </div>
                    )}
                    {status === 'success' && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center"
                        >
                            <CheckCircle className="w-12 h-12 text-green-500" />
                        </motion.div>
                    )}
                    {status === 'error' && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center"
                        >
                            <XCircle className="w-12 h-12 text-red-500" />
                        </motion.div>
                    )}
                </div>

                <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">
                    {status === 'loading' ? 'Verifying Account' :
                        status === 'success' ? 'Verification Success' : 'Verification Issue'}
                </h1>

                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                    {message}
                </p>

                <div className="space-y-4">
                    {status !== 'loading' && (
                        <Button
                            onClick={handleBackToLogin}
                            className={`w-full h-12 text-lg font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${status === 'success'
                                    ? 'bg-white text-black hover:bg-gray-200'
                                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                                }`}
                        >
                            {status === 'success' ? 'Go to Login' : 'Try Again'}
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    )}

                    <button
                        onClick={() => navigate('/')}
                        className="text-gray-500 hover:text-white transition-colors text-sm font-medium"
                    >
                        Back to Homepage
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmail;
