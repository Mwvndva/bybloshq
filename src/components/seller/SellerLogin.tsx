import { useState, useEffect, useRef } from 'react';
import { SellerForgotPasswordDialog } from './SellerForgotPasswordDialog';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSellerAuth } from '@/features/auth/contexts';
import { Eye, EyeOff, Loader2, Mail, ArrowLeft, Store, Lock, RefreshCw, AlertCircle } from 'lucide-react';
import { sellerApi } from '@/api/seller';
import { VerifyEmailModal } from '../auth/VerifyEmailModal';
import { useSellerLogin } from './useSellerLogin';

export function SellerLogin() {
  const navigate = useNavigate();
  const {
    formData,
    handleInputChange,
    handleSubmit,
    error,
    isLoading,
    showPassword,
    setShowPassword,
    isVerifyModalOpen,
    setIsVerifyModalOpen,
    unverifiedEmail,
    showForgotPassword,
    setShowForgotPassword,
    forgotPasswordEmail,
    setForgotPasswordEmail,
    handleForgotPassword,
    isSendingResetLink,
  } = useSellerLogin();

  return (
    <div
      className="auth-page relative flex min-h-[100svh] w-full flex-col overflow-x-hidden bg-slate-50 dark:bg-[#080808] text-slate-950 dark:text-white transition-colors duration-200"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <header className="bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            {/* Left: Back Button */}
            <div className="flex-1 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </div>

            {/* Center: Title */}
            <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[46%] flex items-center justify-center gap-2 sm:max-w-[50%]">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                <Store className="h-4 w-4 text-slate-950" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight truncate">
                Seller Portal
              </h1>
            </div>

            {/* Right: Empty to balance flex-1 */}
            <div className="flex-1 flex items-center justify-end gap-2">
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 items-start justify-center px-4 py-5 sm:items-center sm:px-6 sm:py-8 lg:px-8">
        <div className="w-full max-w-[400px]">
          {/* Login Card */}
          <div
            className="rounded-2xl border border-slate-200 dark:border-white/12 shadow-2xl p-5 sm:p-6 bg-white dark:bg-[#0d0d0d] text-slate-950 dark:text-white transition-colors duration-200"
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <Store className="h-6 w-6 text-black" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white mb-1">Welcome Back</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Sign in to your seller account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2 px-3 border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-200 font-medium">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

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
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="!pl-12 h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    Password
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-yellow-600 dark:text-yellow-400 hover:underline font-semibold"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot password?
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="!pl-12 !pr-11 h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
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

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-bold tracking-tight transition-all duration-200 text-sm mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                Don't have an account?{' '}
                <Link
                  to="/seller/register"
                  className="font-bold text-yellow-600 dark:text-yellow-400 hover:underline"
                >
                  Create Account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <VerifyEmailModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        email={unverifiedEmail}
        role="seller"
      />

      {/* Forgot Password Dialog */}
      <SellerForgotPasswordDialog open={showForgotPassword} onOpenChange={setShowForgotPassword} email={forgotPasswordEmail} onEmailChange={setForgotPasswordEmail} onSubmit={handleForgotPassword} isSending={isSendingResetLink} />
    </div>
  );
}


