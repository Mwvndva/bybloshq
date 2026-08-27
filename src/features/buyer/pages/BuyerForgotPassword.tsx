import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalAuth } from '@/features/auth/contexts';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { Mail, ArrowLeft, Loader2, ShoppingBag, KeyRound } from 'lucide-react';

export function BuyerForgotPassword() {
    const { toast } = useToast();
    const { forgotPassword, isLoading } = useGlobalAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast({
                title: 'Error',
                description: 'Please enter your email address',
                variant: 'destructive',
            });
            return;
        }

        try {
            await forgotPassword(email, 'buyer');
            navigate('/buyer/login', {
                state: {
                    message: 'If an account exists with this email, you will receive a password reset link.'
                }
            });
        } catch (error) {
            // Error is already handled by the auth context
        }
    };

    return (
        <div className="auth-page min-h-screen w-full bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#ffffff)] flex flex-col relative transition-colors duration-200"
            style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
        >
            {/* Header */}
            <header className="bg-[var(--byblos-bg,#000000)]/90 backdrop-blur-md border-b border-black/[0.08] dark:border-white/10 sticky top-0 z-30 pt-safe-top transition-colors duration-200">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="relative flex items-center justify-between h-20">
                        {/* Left: Back Button */}
                        <div className="flex-1 flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/buyer/login')}
                                className="text-slate-700 dark:text-white/75 hover:text-slate-950 dark:hover:text-white hover:bg-yellow-400 hover:text-black dark:hover:bg-yellow-400/20 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Back</span>
                                <span className="sm:hidden">Back</span>
                            </Button>
                        </div>

                        {/* Center: Title */}
                        <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[50%] flex items-center justify-center gap-2">
                            <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                                <ShoppingBag className="h-4 w-4 text-slate-950" />
                            </div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                Buyer Portal
                            </h1>
                        </div>

                        {/* Right: Empty to balance flex-1 */}
                        <div className="flex-1 flex items-center justify-end gap-2">
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-[400px]">
                    <div className="bg-white dark:bg-[#0a0a0a] border border-black/[0.08] dark:border-white/10 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)] p-6 sm:p-8 transition-colors duration-200">
                        {/* Title Section */}
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 mx-auto mb-3 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg">
                                <KeyRound className="h-6 w-6 text-black" />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                                Forgot Password?
                            </h2>
                            <p className="text-slate-600 dark:text-white/60 text-sm leading-relaxed">
                                Enter your email address and we&apos;ll send you a link to reset your password.
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-white/70">
                                    Email Address
                                </Label>
                                <div className="relative flex items-center">
                                    <div className="absolute left-4 pointer-events-none text-slate-400 dark:text-slate-500">
                                        <Mail className="h-4 w-4" />
                                    </div>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="Enter your email"
                                        className="!pl-12 h-11 rounded-xl bg-slate-50 dark:bg-black/45 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 mt-2 rounded-xl bg-yellow-400 font-black text-black hover:bg-yellow-300 transition"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : 'Send Reset Link'}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-slate-600 dark:text-gray-400 font-normal text-sm">
                                Remember your password?{' '}
                                <button
                                    onClick={() => navigate('/buyer/login')}
                                    className="font-bold text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 hover:underline"
                                >
                                    Sign In
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BuyerForgotPassword;


