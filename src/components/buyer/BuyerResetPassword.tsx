import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Lock, ArrowLeft, ShoppingBag } from 'lucide-react';

export function BuyerResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const { toast } = useToast();
    const { resetPassword, isLoading } = useBuyerAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

    // Verify token on component mount
    useEffect(() => {
        console.log('Token from URL:', token);

        if (!token) {
            console.error('No token found in URL');
            setIsValidToken(false);
            toast({
                title: 'Invalid Token',
                description: 'No reset token provided. Please use the link from your email.',
                variant: 'destructive',
            });
            return;
        }

        // For buyer tokens, we'll check if it looks like a valid hex token (not JWT)
        const isValidHexToken = /^[a-f0-9]{64}$/.test(token);
        console.log('Token is valid hex format:', isValidHexToken);

        setIsValidToken(isValidHexToken);

        if (!isValidHexToken) {
            console.error('Invalid token format');
            toast({
                title: 'Invalid Token',
                description: 'Invalid reset token format. Please use the link from your email.',
                variant: 'destructive',
            });
        }
    }, [token, toast]);

    const validatePasswords = (password: string, confirmPassword: string): boolean => {
        if (password !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return false;
        }
        if (password.length < 8) {
            setPasswordError('Password must be at least 8 characters long');
            return false;
        }
        setPasswordError('');
        return true;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token || !isValidToken) {
            toast({
                title: 'Invalid Token',
                description: 'Please use the reset link from your email.',
                variant: 'destructive',
            });
            return;
        }

        if (!formData.password || !formData.confirmPassword) {
            toast({
                title: 'Error',
                description: 'Please fill in all fields',
                variant: 'destructive',
            });
            return;
        }

        if (!validatePasswords(formData.password, formData.confirmPassword)) {
            return;
        }

        if (!token) {
            toast({
                title: 'Error',
                description: 'Invalid reset token',
                variant: 'destructive',
            });
            return;
        }

        try {
            await resetPassword(token, formData.password);
        } catch (error) {
            // Error is already handled by the auth context
        }
    };

    // Show loading state while validating token
    if (isValidToken === null) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-black text-white">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-yellow-400" />
                    <p className="text-gray-300 font-medium">Validating reset token...</p>
                </div>
            </div>
        );
    }

    // Show error state if token is invalid
    if (isValidToken === false) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-black">
                <div
                    className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
                    style={{
                        background: 'rgba(17, 17, 17, 0.7)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)'
                    }}
                >
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 mx-auto mb-3 bg-red-500/20 rounded-xl flex items-center justify-center shadow-lg border border-red-500/30">
                            <Lock className="h-6 w-6 text-red-500" />
                        </div>
                        <h1 className="text-xl font-semibold tracking-tight text-white mb-1">Invalid Link</h1>
                        <p className="text-sm text-gray-300 font-normal">This reset link is invalid or has expired.</p>
                    </div>
                    <Button
                        onClick={() => navigate('/buyer/login')}
                        className="w-full h-11 bg-gray-800 text-white hover:bg-gray-700 rounded-xl font-medium transition-all"
                    >
                        Back to Login
                    </Button>
                </div>
            </div>
        );
    }

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
                    {/* Reset Password Card */}
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
                            <h1 className="text-xl font-semibold tracking-tight text-white mb-1">Reset Password</h1>
                            <p className="text-sm text-gray-300 font-normal">Enter your new password below</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-xs font-medium text-gray-200 whitespace-nowrap">
                                    New Password
                                </Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className="!pl-11 !pr-11 h-10 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-200 whitespace-nowrap">
                                    Confirm New Password
                                </Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <Input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className="!pl-11 !pr-11 h-10 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {passwordError && (
                                    <p className="text-xs text-red-500 font-medium px-1 leading-tight">{passwordError}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold tracking-tight transition-all duration-200 text-sm mt-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting...
                                    </>
                                ) : 'Reset Password'}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <button
                                onClick={() => navigate('/buyer/login')}
                                className="font-medium text-yellow-400 hover:text-yellow-300 hover:underline text-sm"
                            >
                                Back to Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BuyerResetPassword;
