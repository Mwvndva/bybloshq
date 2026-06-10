import { useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGlobalAuth } from '@/contexts/AuthCoreContext';

export default function CreatorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useGlobalAuth();

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
    <main className="auth-page byblos-light-page min-h-screen bg-[#090909] px-4 py-5 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-md flex-col">
        <div className="flex justify-start">
          <Link to="/" className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </div>

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
