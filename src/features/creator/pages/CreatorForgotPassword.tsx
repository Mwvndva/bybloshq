import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useForgotPasswordMutation } from '@/features/auth/hooks/useAuthMutations';

export default function CreatorForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const forgotMut = useForgotPasswordMutation('creator');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await forgotMut.mutateAsync(email.trim());
      setSent(true);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Request failed', {
        description: err.response?.data?.message || err.message || 'Please try again in a moment.',
      });
    }
  };

  return (
    <main className="auth-page min-h-screen bg-[#090909] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md pt-safe-top">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/creator/login')}
              className="rounded-xl px-3 py-2 text-sm text-white/75 transition-all duration-200 hover:bg-yellow-100 hover:text-black"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back</span>
            </Button>
            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Creator Portal</h1>
            </div>
            <div className="flex-1" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col px-4 py-5 sm:min-h-[calc(100svh-5rem)]">
        <div className="my-auto w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          {sent ? (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </span>
              <h1 className="text-2xl font-black tracking-tight">Check your email</h1>
              <p className="text-sm font-medium leading-6 text-white/55">
                If an account exists for <span className="font-bold text-white/80">{email}</span>, we&apos;ve sent a link
                to reset your password. It expires in 1 hour.
              </p>
              <Link
                to="/creator/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-yellow-400 font-black text-black transition hover:bg-yellow-300"
              >
                Back to log in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Creator program</p>
                <h1 className="text-3xl font-black tracking-tight">Forgot password?</h1>
                <p className="text-sm font-medium leading-6 text-white/55">
                  Enter your account email and we&apos;ll send you a link to set a new password.
                </p>
              </div>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Email"
                className="h-12 rounded-2xl border-white/10 bg-black/45"
                required
              />
              <Button
                disabled={forgotMut.isPending}
                className="h-12 w-full rounded-2xl bg-yellow-400 font-black text-black hover:bg-yellow-300"
              >
                {forgotMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
              </Button>
              <p className="text-center text-sm font-medium text-white/50">
                Remembered it?{' '}
                <Link to="/creator/login" className="font-black text-yellow-300 hover:text-yellow-200">
                  Log in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
