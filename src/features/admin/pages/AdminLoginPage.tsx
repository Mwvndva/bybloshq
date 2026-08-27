import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalAuth } from '@/features/auth/hooks/useGlobalAuth';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card';
import { Loader2, Shield, Lock, Mail } from 'lucide-react';

export const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const { login, isLoading: loading, user } = useGlobalAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin' && user.isAuthenticated) {
      navigate('/admin/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    setLocalError('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password, 'admin');
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      const reqErr = err as { response?: unknown; message?: string };
      if (!reqErr?.response) {
        setLocalError('Connection error. Please check your network connection and try again.');
      } else {
        setLocalError(reqErr.message || 'Invalid email or password');
      }
    }
  };

  return (
    <div className="auth-page flex min-h-[100svh] items-start justify-center overflow-x-hidden bg-[var(--byblos-bg,#000000)] px-4 py-6 text-[var(--byblos-text,#f5f5f5)] sm:items-center sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <Card className="overflow-hidden rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] shadow-xl dark:shadow-[0_22px_60px_rgba(0,0,0,0.45)]">
          <CardHeader className="px-6 pb-7 pt-10 text-center md:px-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/15 text-yellow-500">
              <Shield className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
            </div>
            <CardTitle className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Admin Access
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-slate-500 dark:text-white/50">
              Sign in to manage Byblos operations.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 px-6 md:px-10">
              {localError && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-300">
                  {localError}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-white/80">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@byblos.hq"
                    required
                    autoComplete="email"
                    className="h-12 rounded-2xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/45 pl-11 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-white/80">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    className="h-12 rounded-2xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/45 pl-11 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400/20"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="px-6 pb-10 pt-6 md:px-10">
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-yellow-400 text-sm font-semibold text-black shadow-none transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-white/40">
          Protected access for approved Byblos administrators.
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;


