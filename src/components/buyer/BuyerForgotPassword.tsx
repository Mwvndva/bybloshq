import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuyerAuth } from '@/features/auth/contexts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, Loader2, ShoppingBag } from 'lucide-react';

export function BuyerForgotPassword() {
    const { toast } = useToast();
    const { forgotPassword, isLoading } = useBuyerAuth();
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
            await forgotPassword(email);
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
        <div className="auth-page min-h-screen w-full bg-slate-50 dark:bg-[#080808] text-slate-950 dark:text-white flex flex-col relative transition-colors duration-200"
            style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
        >
            {/* Header */}
            <header className="bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="relative flex items-center justify-between h-20">
                        {/* Left: Back Button */}
                        <div className="flex-1 flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/buyer/login')}
                                className="text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Back</span>
                                <span className="sm:hidden">Back</span>
                            </Button>
                        </div>

                        {/* Center: Title */}
                        <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[50%] flex items-center justify-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                                <ShoppingBag className="h-4 w-4 text-slate-950" />
                            </div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight truncate">
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
                    {/* Forgot Password Card */}
                    <div
                        className="rounded-2xl border border-slate-200 dark:border-white/12 shadow-2xl p-5 sm:p-6 bg-white dark:bg-[#0d0d0d] text-slate-950 dark:text-white transition-colors duration-200"
                    >
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                                <ShoppingBag className="h-6 w-6 text-black" />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white mb-1">Forgot Password</h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Enter your email to reset password</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                    Email Address
                                </Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                        <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="Enter your email"
                                        className="!pl-12 h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold tracking-tight transition-all duration-200 text-sm mt-2"
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
                            <p className="text-gray-300 font-normal text-sm">
                                Remember your password?{' '}
                                <button
                                    onClick={() => navigate('/buyer/login')}
                                    className="font-medium text-yellow-400 hover:text-yellow-300 hover:underline"
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


