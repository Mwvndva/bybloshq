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

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Clear error when component mounts
  useEffect(() => {
    setLocalError('');
  }, []);

  // Update local error when auth error changes
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
      await login(email, password); // Updated signature in context/api
    } catch (err) {
      // Error handling is managed by context via authError
      console.error("Login failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Pulse */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] bg-yellow-500/10 rounded-full blur-[160px] animate-pulse duration-7000"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[900px] h-[900px] bg-yellow-600/10 rounded-full blur-[180px] animate-pulse duration-10000"></div>
      </div>

      <div className="relative w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-1000">
        {/* Superior Glassmorphism Card */}
        <Card className="bg-[#0A0A0A]/40 backdrop-blur-3xl border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-[3rem] overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none"></div>

          <CardHeader className="relative text-center pb-10 pt-16 px-10">
            <div className="mx-auto w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-700">
              <Shield className="h-10 w-10 text-yellow-500" />
            </div>
            <CardTitle className="text-4xl font-black text-white mb-3 tracking-tighter italic">ADMIN<span className="text-yellow-500">.</span></CardTitle>
            <CardDescription className="text-gray-500 font-bold uppercase tracking-[0.2em] text-[10px]">
              Secure Protocol Access
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="relative space-y-6 px-10">
              {localError && (
                <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-[11px] font-black uppercase tracking-widest backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    {localError}
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 opacity-60">
                    Identification
                  </label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ACCESS_ID@BYBLOS.HQ"
                      required
                      className="w-full h-14 px-6 bg-white/[0.03] border-white/10 text-white placeholder:text-gray-700 rounded-2xl focus:border-yellow-500/50 focus:ring-yellow-500/10 transition-all font-bold tracking-tight text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 opacity-60">
                    Secret Key
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full h-14 px-6 bg-white/[0.03] border-white/10 text-white placeholder:text-gray-700 rounded-2xl focus:border-yellow-500/50 focus:ring-yellow-500/10 transition-all font-bold tracking-tight text-base"
                    />
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="relative px-10 pb-16 pt-8">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-[0_20px_40px_rgba(234,179,8,0.15)] hover:shadow-[0_20px_60px_rgba(234,179,8,0.25)] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed group-hover:translate-y-[-2px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    AUTENTICATING...
                  </>
                ) : (
                  'Establish Connection'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center mt-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
          <p className="text-gray-600 text-[9px] uppercase tracking-[0.3em] font-black opacity-40">
            Encrypted Session • Node {Math.floor(Math.random() * 1000)} • Layer-7 Protection
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
