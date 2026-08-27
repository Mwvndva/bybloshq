import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Lock, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useResetPasswordMutation } from '@/features/auth/hooks/useAuthMutations';

export default function CreatorResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const navigate = useNavigate();
  const resetMut = useResetPasswordMutation('creator');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const longEnough = password.length >= 8;
  const matches = password.length > 0 && password === confirm;
  const linkValid = Boolean(token && email);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!linkValid) {
      toast.error('Invalid link', { description: 'This reset link is missing its token or email. Request a new one.' });
      return;
    }
    if (!longEnough) {
      toast.error('Weak password', { description: 'Use at least 8 characters.' });
      return;
    }
    if (!matches) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await resetMut.mutateAsync({ token, newPassword: password, email });
      toast.success('Password updated', { description: 'You can now log in with your new password.' });
      navigate('/creator/login', { replace: true });
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Reset failed', {
        description: err.response?.data?.message || err.message || 'The link may be invalid or expired.',
      });
    }
  };

  return (
    <main className="auth-page min-h-screen bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#ffffff)] transition-colors duration-200">
      <header className="sticky top-0 z-30 border-b border-black/[0.08] dark:border-white/10 bg-[var(--byblos-bg,#000000)]/90 backdrop-blur-md pt-safe-top transition-colors duration-200">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/creator/login')}
              className="rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-white/75 transition-all duration-200 hover:bg-yellow-400 hover:text-black"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back</span>
            </Button>
            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">Creator Portal</h1>
            </div>
            <div className="flex-1" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col px-4 py-5 sm:min-h-[calc(100svh-5rem)]">
        <form
          onSubmit={handleSubmit}
          className="my-auto w-full space-y-5 rounded-[2rem] border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)] transition-colors duration-200"
        >
          <div className="space-y-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-500/15 dark:bg-yellow-400/15">
              <Lock className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
            </span>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Set a new password</h1>
            <p className="text-sm font-medium leading-6 text-slate-600 dark:text-white/55">Choose a strong password for your creator account.</p>
          </div>

          <div className="relative">
            <Input
              id="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? 'text' : 'password'}
              placeholder="New password"
              className="h-12 rounded-2xl border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/45 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400 pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 dark:text-white/45 transition hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Input
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            className="h-12 rounded-2xl border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/45 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400"
            required
          />

          {password.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
              <Requirement met={longEnough} label="At least 8 characters" />
              <Requirement met={matches} label="Passwords match" />
            </div>
          )}

          <Button
            type="submit"
            disabled={resetMut.isPending}
            className="h-12 w-full rounded-2xl bg-yellow-400 font-black text-black hover:bg-yellow-300"
          >
            {resetMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
          </Button>
        </form>
      </div>
    </main>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <span className={met ? 'flex items-center gap-1 text-emerald-600 dark:text-emerald-400' : 'flex items-center gap-1 text-slate-400 dark:text-white/45'}>
      {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
