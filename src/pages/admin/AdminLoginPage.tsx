import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/GlobalAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Shield, Lock, Mail } from 'lucide-react';

export const AdminLoginPage = () => {
  console.log('Rendering AdminLoginPage');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const auth = useAdminAuth();
  const { login, error: authError, loading, isAuthenticated } = auth;
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setLocalError('');
  }, []);

  useEffect(() => {
    if (authError) {
      setLocalError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f7f2] flex items-center justify-center p-4 text-stone-950">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <Card className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_22px_60px_rgba(17,17,17,0.09)]">
          <CardHeader className="px-6 pb-7 pt-10 text-center md:px-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-200 bg-yellow-100 text-black">
              <Shield className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-3xl font-semibold tracking-tight text-stone-950">
              Admin Access
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-stone-500">
              Sign in to manage Byblos operations.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 px-6 md:px-10">
              {localError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {localError}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-stone-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@byblos.hq"
                    required
                    autoComplete="email"
                    className="h-12 rounded-2xl border-stone-200 bg-white pl-11 text-stone-950 placeholder:text-stone-400 focus:border-yellow-400 focus:ring-yellow-400/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-stone-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    className="h-12 rounded-2xl border-stone-200 bg-white pl-11 text-stone-950 placeholder:text-stone-400 focus:border-yellow-400 focus:ring-yellow-400/20"
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

        <p className="mt-6 text-center text-xs text-stone-500">
          Protected access for approved Byblos administrators.
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
