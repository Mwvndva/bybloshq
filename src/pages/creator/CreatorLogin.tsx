import { useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import creatorApi from '@/api/creatorApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGlobalAuth } from '@/contexts/AuthCoreContext';

type ApiError = {
  response?: { data?: { message?: string } };
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
};

export default function CreatorLogin() {
  const navigate = useNavigate();
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
    <main className="auth-page byblos-light-page min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 w-full px-2">
          <Link to="/" className="inline-flex items-center text-sm font-medium text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </div>
        <form onSubmit={handleSubmit} className="w-full space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Byblos creators</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Creator login</h1>
            <p className="mt-2 text-sm font-medium text-white/50">Track your shop links, completed sales, and referral earnings.</p>
          </div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="h-11 border-white/10 bg-black/40" required />
          <div className="relative">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Password" className="h-11 border-white/10 bg-black/40 pr-12" required />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button disabled={loading} className="h-11 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300">
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
