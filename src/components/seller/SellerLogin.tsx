import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSellerAuth } from '@/contexts/GlobalAuthContext';
import { Eye, EyeOff, Loader2, Mail, ArrowLeft, Store, Lock } from 'lucide-react';

export function SellerLogin() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login, forgotPassword } = useSellerAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);

  // Ensure body and html have black background and no margins/padding
  useEffect(() => {
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    document.body.style.cssText = 'margin: 0; padding: 0; background-color: #000000; overflow-x: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; background-color: #000000; overflow-x: hidden;';

    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({ email: formData.email, password: formData.password });
      navigate('/seller/dashboard');
      toast({
        title: 'Success',
        description: 'Successfully logged in',
      });
    } catch (error: any) {
      // Extract the actual error message from the API response
      const errorMessage = error?.response?.data?.message || error?.message || 'Invalid email or password';

      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast({
        title: 'Error',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingResetLink(true);
    try {
      // Call the forgot password from context
      const success = await forgotPassword(forgotPasswordEmail);

      if (success) {
        toast({
          title: 'Reset link sent',
          description: 'If an account exists with this email, you will receive a password reset link.',
        });
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to send reset link. Please try again later.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error sending reset link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reset link. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-black flex flex-col relative"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: '#000000',
      }}
    >
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-3">
          <div className="flex justify-between items-center h-14">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl px-2 h-9 font-normal"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span className="text-xs sm:text-sm">Back</span>
            </Button>
            <div className="flex items-center space-x-1.5">
              <div className="w-7 h-7 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                <Store className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold text-white tracking-tight">Seller Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[400px]">
          {/* Login Card */}
          <div
            className="rounded-2xl border shadow-2xl p-5 sm:p-6"
            style={{
              background: 'rgba(17, 17, 17, 0.7)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)'
            }}
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <Store className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-white mb-1">Welcome Back</h1>
              <p className="text-sm text-gray-300 font-normal">Sign in to your seller account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-gray-200">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="!pl-11 h-10 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password" className="text-xs font-medium text-gray-200 whitespace-nowrap">
                    Password
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-yellow-400 hover:text-yellow-300 font-normal"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot password?
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="!pl-11 !pr-11 h-10 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold tracking-tight transition-all duration-200 text-sm mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-300 font-normal text-sm">
                Don't have an account?{' '}
                <Link
                  to="/seller/register"
                  className="font-medium text-yellow-400 hover:text-yellow-300 hover:underline"
                >
                  Create Account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent
          className="w-[90%] sm:w-[95%] sm:max-w-[425px] rounded-2xl border shadow-2xl mx-4 sm:mx-auto"
          style={{
            background: 'rgba(17, 17, 17, 0.7)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)'
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-white tracking-tight">Forgot Password</DialogTitle>
            <DialogDescription className="text-gray-300 font-normal">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-medium text-gray-200">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  className="pl-11 h-10 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSendingResetLink}
              className="w-full h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold tracking-tight transition-all duration-200 text-sm"
            >
              {isSendingResetLink ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : 'Send Reset Link'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
