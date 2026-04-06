import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
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
        <div className="min-h-screen w-full bg-black flex flex-col relative"
            style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                backgroundColor: '#000000',
            }}
        >
            {/* Header */}
            <header className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative flex items-center justify-between h-20">
                        {/* Left: Back Button */}
                        <div className="flex-1 flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/buyer/login')}
                                className="text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-xl px-3 py-2 text-sm -ml-3"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Back</span>
                                <span className="sm:hidden">Back</span>
                            </Button>
                        </div>

                        {/* Center: Title */}
                        <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[50%] flex items-center justify-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shrink-0">
                                <ShoppingBag className="h-4 w-4 text-white" />
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
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
                        className="rounded-2xl border shadow-2xl p-5 sm:p-6"
                        style={{
                            background: 'rgba(17, 17, 17, 0.7)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)'
                        }}
                    >
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                                <ShoppingBag className="h-6 w-6 text-white" />
                            </div>
                            <h1 className="text-xl font-semibold tracking-tight text-white mb-1">Forgot Password</h1>
                            <p className="text-sm text-gray-300 font-normal">Enter your email to reset password</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-medium text-gray-200">
                                    Email Address
                                </Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <Mail className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="Enter your email"
                                        className="pl-10 h-10 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
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
