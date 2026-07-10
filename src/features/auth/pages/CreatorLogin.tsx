import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGlobalAuth } from '@/features/auth/contexts';

export default function CreatorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useGlobalAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password, 'creator');
    } catch (error: unknown) {
      // Error is handled inside useAuthActions with a toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page byblos-light-page min-h-screen bg-[#090909] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md">
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

            <div className="absolute left-1/2 flex min-w-0 max-w-[46%] -translate-x-1/2 items-center justify-center text-center sm:max-w-[50%]">
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Creator Portal</h1>
            </div>

            <div className="flex-1" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col px-4 py-5 sm:min-h-[calc(100svh-5rem)]">
        <form onSubmit={handleSubmit} className="my-auto w-full space-y-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Creator program</p>
            <h1 className="text-3xl font-black tracking-tight">Welcome back.</h1>
            <p className="text-sm font-medium leading-6 text-white/55">Track shop links, sales, seller referrals, and M-Pesa withdrawals.</p>
          </div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="h-12 rounded-2xl border-white/10 bg-black/45" required />
          <div className="relative">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Password" className="h-12 rounded-2xl border-white/10 bg-black/45 pr-12" required />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button disabled={loading} className="h-12 w-full rounded-2xl bg-yellow-400 font-black text-black hover:bg-yellow-300">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log in'}
          </Button>
          <p className="text-center text-sm font-medium text-white/50">
            New creator?{' '}
            <Link to="/creator/register" className="font-black text-yellow-300 hover:text-yellow-200">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}


