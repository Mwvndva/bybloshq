import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ArrowLeft, Eye, EyeOff, Loader2, Store } from 'lucide-react';
import { useGlobalAuth } from '@/features/auth/contexts';
import { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { VerifyEmailModal } from '@/features/auth/components/VerifyEmailModal';
import { SellerForgotPasswordDialog } from '../components/SellerForgotPasswordDialog';
import { toast } from 'sonner';

export function SellerLogin() {
  const navigate = useNavigate();
  const { login, forgotPassword } = useGlobalAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const loginInFlightRef = useRef(false);

  useEffect(() => {
    void getFreshCsrfToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInFlightRef.current) return;

    let targetEmail = email?.trim().toLowerCase();
    let targetPassword = password?.trim();

    if (!targetEmail) {
      const emailEl = document.querySelector<HTMLInputElement>('input[name="email"], input[type="email"]');
      if (emailEl?.value) targetEmail = emailEl.value.trim().toLowerCase();
    }
    if (!targetPassword) {
      const passEl = document.querySelector<HTMLInputElement>('input[name="password"], input[type="password"]');
      if (passEl?.value) targetPassword = passEl.value;
    }

    if (!targetEmail || !targetPassword) {
      toast.error('Please enter both your email address and password.');
      return;
    }

    loginInFlightRef.current = true;
    setIsLoading(true);
    try {
      await login(targetEmail, targetPassword, 'seller');
      // Navigation handled by useGlobalAuth().login() via getDashboardPath('seller')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; code?: string; email?: string } }; message?: string };
      const apiError = err?.response?.data;
      if (apiError?.code === 'PENDING_VERIFICATION' || apiError?.code === 'EMAIL_NOT_VERIFIED' || apiError?.code === 'TERMS_NOT_ACCEPTED') {
        setUnverifiedEmail(apiError.email || targetEmail);
        setIsVerifyModalOpen(true);
        return;
      }
      // Error toast handled inside useAuthActions
    } finally {
      loginInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast.error('Please enter your email address');
      return;
    }
    setIsSendingResetLink(true);
    try {
      const success = await forgotPassword(forgotPasswordEmail, 'seller');
      if (success) {
        toast.success('Reset link sent', { description: 'If an account exists with this email, you will receive a password reset link.' });
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      } else {
        toast.error('Failed to send reset link. Please try again later.');
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to send reset link. Please try again later.');
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return (
    <main className="auth-page byblos-light-page min-h-[100svh] bg-[#090909] text-white" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            <div className="flex flex-1 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="rounded-xl px-3 py-2 text-sm text-white/75 transition-all duration-200 hover:bg-yellow-100 hover:text-black"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back</span>
              </Button>
            </div>

            <div className="absolute left-1/2 flex min-w-0 max-w-[46%] -translate-x-1/2 items-center justify-center gap-2 text-center sm:max-w-[50%]">
              <Store className="h-5 w-5 text-yellow-400 shrink-0" />
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Seller Portal</h1>
            </div>

            <div className="flex-1" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col px-4 py-5 sm:min-h-[calc(100svh-5rem)]">
        <form onSubmit={handleSubmit} className="my-auto w-full space-y-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Seller program</p>
            <h2 className="text-3xl font-black tracking-tight">Welcome back.</h2>
            <p className="text-sm font-medium leading-6 text-white/55">Manage your shop, products, orders, and withdrawals.</p>
          </div>

          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            className="h-12 rounded-2xl border-white/10 bg-black/45"
            required
            disabled={isLoading}
          />

          <div className="relative">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              className="h-12 rounded-2xl border-white/10 bg-black/45 pr-12"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-full rounded-2xl bg-yellow-400 font-black text-black hover:bg-yellow-300"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
          </Button>

          <p className="text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm font-bold text-white/60 hover:text-yellow-300"
            >
              Forgot password?
            </button>
          </p>
          <p className="text-center text-sm font-medium text-white/50">
            New seller?{' '}
            <Link to="/seller/register" className="font-black text-yellow-300 hover:text-yellow-200">
              Create an account
            </Link>
          </p>
        </form>
      </div>

      <VerifyEmailModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        email={unverifiedEmail}
        role="seller"
      />

      <SellerForgotPasswordDialog
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
        email={forgotPasswordEmail}
        onEmailChange={setForgotPasswordEmail}
        onSubmit={handleForgotPassword}
        isSending={isSendingResetLink}
      />
    </main>
  );
}
