import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/GlobalAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Shield, Lock } from 'lucide-react';

export const AdminLoginPage = () => {
  console.log('Rendering AdminLoginPage');
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState('');
  const auth = useAdminAuth();
  const { login, error: authError, loading } = auth;
  const navigate = useNavigate();

  console.log('Auth context:', {
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loading,
    error: auth.error
  });

  // Clear error when component mounts
  useEffect(() => {
    console.log('AdminLoginPage mounted');
    setLocalError('');
  }, []);

  // Update local error when auth error changes
  useEffect(() => {
    console.log('Auth error changed:', authError);
    if (authError) {
      setLocalError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!pin) {
      setLocalError('Please enter a PIN');
      return;
    }

    await login(pin);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Glassmorphism Card */}
        <Card className="bg-white/10 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-yellow-600/5"></div>

          <CardHeader className="relative text-center pb-8 pt-12">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-black text-white mb-2">Admin Portal</CardTitle>
            <CardDescription className="text-gray-300 text-lg">
              Enter your secure PIN to access the dashboard
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="relative space-y-6 px-8">
              {localError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl text-sm backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    {localError}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label htmlFor="pin" className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-yellow-400" />
                  Admin PIN
                </label>
                <Input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your 6-digit PIN"
                  required
                  className="w-full h-14 bg-white/5 border-white/20 text-white placeholder:text-gray-300 rounded-2xl px-6 text-lg font-medium focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all duration-300"
                />
              </div>
            </CardContent>

            <CardFooter className="relative px-8 pb-8">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="mr-3 h-5 w-5" />
                    Access Dashboard
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-300 text-sm">
            Secure admin access • Protected by encryption
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
