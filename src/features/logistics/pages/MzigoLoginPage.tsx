import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useGlobalAuth } from '@/features/auth/hooks/useGlobalAuth';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const MzigoLoginPage = () => {
  const navigate = useNavigate();
  const { login, user } = useGlobalAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === 'logistics' && user.isAuthenticated) {
      navigate('/mzigo/dashboard', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
      toast.error('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(targetEmail, targetPassword, 'logistics');
      // Navigation handled by useGlobalAuth().login() via getDashboardPath('logistics')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = !err?.response
        ? 'Connection error. Please check your network connection and try again.'
        : err?.response?.data?.message || err?.message || 'Check the Mzigo credentials and try again.';
      toast.error('Login failed', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="auth-page min-h-[100svh] bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#f5f5f5)] transition-colors duration-200"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur-md pt-safe-top">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            <div className="flex flex-1 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-white/75 transition-all duration-200 hover:bg-yellow-100 hover:text-black"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back</span>
              </Button>
            </div>

            <div className="absolute left-1/2 flex min-w-0 max-w-[46%] -translate-x-1/2 items-center justify-center gap-2 text-center sm:max-w-[50%]">
              <Truck className="h-5 w-5 text-yellow-500 dark:text-yellow-400 shrink-0" />
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">Mzigo Ego</h1>
            </div>

            <div className="flex-1" aria-hidden="true" />
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col px-4 py-5 sm:min-h-[calc(100svh-5rem)]">
        <form
          onSubmit={handleSubmit}
          className="my-auto w-full space-y-5 rounded-[2rem] border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.04] p-6 shadow-xl dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
        >
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500 dark:text-yellow-300">Logistics</p>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Welcome back.</h2>
            <p className="text-sm font-medium leading-6 text-slate-600 dark:text-white/55">Door-to-door logistics dashboard.</p>
          </div>

          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            className="h-12 rounded-2xl border-black/10 dark:border-white/10 bg-slate-50 dark:bg-black/45 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
            required
            disabled={isSubmitting}
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
              className="h-12 rounded-2xl border-black/10 dark:border-white/10 bg-slate-50 dark:bg-black/45 pr-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
              required
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-yellow-400 font-bold text-black hover:bg-yellow-300 transition-all duration-200"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Log in to Mzigo'
            )}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default MzigoLoginPage;
