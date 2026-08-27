import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ArrowLeft, Eye, EyeOff, Loader2, ShoppingBag } from 'lucide-react';
import { useGlobalAuth } from '@/features/auth/contexts';
import { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { VerifyEmailModal } from '@/features/auth/components/VerifyEmailModal';
import { toast } from 'sonner';

export function BuyerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const { login } = useGlobalAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    void getFreshCsrfToken();
  }, []);

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      toast(state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await login(targetEmail, targetPassword, 'buyer');
      // Navigation handled by useGlobalAuth().login() via getDashboardPath('buyer')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; code?: string; email?: string } }; message?: string };
      const apiError = err?.response?.data;
      if (apiError?.code === 'PENDING_VERIFICATION' || apiError?.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(apiError.email || targetEmail);
        setIsVerifyModalOpen(true);
        return;
      }
      // Error toast is handled inside useAuthActions
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-page min-h-[100svh] bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#ffffff)] transition-colors duration-200" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header className="sticky top-0 z-30 border-b border-black/[0.08] dark:border-white/10 bg-[var(--byblos-bg,#000000)]/90 backdrop-blur-md pt-safe-top transition-colors duration-200">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            <div className="flex flex-1 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-white/75 transition-all duration-200 hover:bg-yellow-400 hover:text-black"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back</span>
              </Button>
            </div>

            <div className="absolute left-1/2 flex min-w-0 max-w-[46%] -translate-x-1/2 items-center justify-center gap-2 text-center sm:max-w-[50%]">
              <ShoppingBag className="h-5 w-5 text-yellow-400 shrink-0" />
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">Buyer Portal</h1>
            </div>

            <div className="flex-1" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col px-4 py-5 sm:min-h-[calc(100svh-5rem)]">
        <form onSubmit={handleSubmit} className="my-auto w-full space-y-5 rounded-[2rem] border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)] transition-colors duration-200">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500 dark:text-yellow-300">Byblos Marketplace</p>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Welcome back.</h2>
            <p className="text-sm font-medium leading-6 text-slate-600 dark:text-white/55">Browse products, manage orders, and track deliveries.</p>
          </div>

          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            className="h-12 rounded-2xl border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/45 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400"
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
              className="h-12 rounded-2xl border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/45 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400 pr-12"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 dark:text-white/45 transition hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
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
            <Link to="/buyer/forgot-password" className="text-sm font-bold text-slate-600 dark:text-white/60 hover:text-yellow-500 dark:hover:text-yellow-300">
              Forgot password?
            </Link>
          </p>
          <p className="text-center text-sm font-medium text-slate-500 dark:text-white/50">
            New to Byblos?{' '}
            <Link to="/buyer/register" className="font-black text-yellow-500 dark:text-yellow-300 hover:text-yellow-400 dark:hover:text-yellow-200">
              Create an account
            </Link>
          </p>
        </form>
      </div>

      <VerifyEmailModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        email={unverifiedEmail}
        role="buyer"
      />
    </main>
  );
}
