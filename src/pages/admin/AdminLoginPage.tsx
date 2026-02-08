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
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-yellow-600/10 rounded-full blur-[150px]"></div>
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Glassmorphism Card */}
        <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

          <CardHeader className="relative text-center pb-8 pt-12">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-yellow-500/20">
              <Shield className="h-8 w-8 text-black" />
            </div>
            <CardTitle className="text-3xl font-bold text-white mb-2">Admin Portal</CardTitle>
            <CardDescription className="text-gray-400 text-base">
              Secure access for authorized personnel
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="relative space-y-5 px-8">
              {localError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                    {localError}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-300 ml-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@example.com"
                      required
                      className="w-full h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-xl focus:border-yellow-500/50 focus:ring-yellow-500/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-300 ml-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-xl focus:border-yellow-500/50 focus:ring-yellow-500/20 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="relative px-8 pb-8 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-lg rounded-xl shadow-lg shadow-yellow-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-xs uppercase tracking-widest font-medium">
            Restricted Access • System Monitored
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
