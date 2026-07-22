import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Lock, ArrowLeft, ShoppingBag, Check, X } from 'lucide-react';
import { RouteFallback } from '@/components/common/RouteFallback';
import { useBuyerResetPassword } from './useBuyerResetPassword';


export function BuyerResetPassword() {
    const navigate = useNavigate();
    const {
        isValidToken,
        formData,
        handleInputChange,
        handleSubmit,
        showPassword,
        setShowPassword,
        showConfirmPassword,
        setShowConfirmPassword,
        passwordError,
        isLoading,
        strength,
    } = useBuyerResetPassword();

    // Show loading state while validating token
    if (isValidToken === null) {
        return <RouteFallback message="Validating reset token" />;
    }

    // Show error state if token is invalid
    if (isValidToken === false) {
        return (
            <div className="auth-page min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#080808] text-slate-950 dark:text-white transition-colors duration-200">
                <div
                    className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/12 p-6 bg-white dark:bg-[#0d0d0d] shadow-xl text-slate-950 dark:text-white"
                >
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 mx-auto mb-3 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                            <Lock className="h-6 w-6 text-red-500" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-950 dark:text-white mb-1">Invalid Link</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">This reset link is invalid or has expired.</p>
                    </div>
                    <Button
                        onClick={() => navigate('/buyer/login')}
                        className="w-full h-11 bg-slate-200 dark:bg-zinc-800 text-slate-950 dark:text-white hover:bg-slate-300 dark:hover:bg-zinc-700 rounded-xl font-bold transition-all"
                    >
                        Back to Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page min-h-screen w-full bg-slate-50 dark:bg-[#080808] text-slate-950 dark:text-white flex flex-col relative transition-colors duration-200"
            style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
        >
            {/* Header */}
            <header className="bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30">
                <div className="w-full px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/buyer/login')}
                        className="text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        <span>Back</span>
                    </Button>

                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                            <ShoppingBag className="h-4 w-4 text-slate-950" />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                            Buyer Portal
                        </h1>
                    </div>

                    <div className="w-20 hidden sm:block" />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-[400px]">
                    <div
                        className="rounded-2xl border border-slate-200 dark:border-white/12 shadow-2xl p-6 bg-white dark:bg-[#0d0d0d] text-slate-950 dark:text-white transition-colors duration-200"
                    >
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                                <Lock className="h-6 w-6 text-black" />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white mb-1">Reset Password</h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Enter your new password below</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-xs font-semibold text-slate-800 dark:text-slate-200">New Password</Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                        <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className="!pl-12 !pr-11 h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors"
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

                            {/* Password Requirements */}
                            {formData.password && (
                                <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                                    <p className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider">Security Requirements:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: "8+ chars", met: strength.minLength },
                                            { label: "1 Number", met: strength.hasNumber },
                                            { label: "1 Special", met: strength.hasSpecial },
                                            { label: "Upper/Lower", met: strength.hasUpper && strength.hasLower },
                                        ].map((req, index) => (
                                            <div key={index} className="flex items-center space-x-2">
                                                {req.met ? (
                                                    <div className="bg-green-500/20 p-0.5 rounded-full">
                                                        <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-300 dark:bg-gray-700 p-0.5 rounded-full">
                                                        <X className="h-2.5 w-2.5 text-slate-600 dark:text-gray-300" />
                                                    </div>
                                                )}
                                                <span className={`text-[10px] ${req.met ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-slate-600 dark:text-gray-300'}`}>{req.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-800 dark:text-slate-200">Confirm Password</Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                        <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <Input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className="!pl-12 !pr-11 h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors"
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
                                    <p className="text-[11px] text-red-500 font-semibold px-1 leading-tight">{passwordError}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-xl rounded-xl font-bold transition-all duration-200 mt-2"
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
                                className="font-medium text-yellow-400 hover:text-yellow-300 hover:underline text-sm transition-all"
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


