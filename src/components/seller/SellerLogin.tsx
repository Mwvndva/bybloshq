import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSellerAuth } from '@/contexts/SellerAuthContext';
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
      className="fixed top-0 left-0 right-0 bottom-0 w-full h-full bg-black overflow-y-auto" 
      style={{ 
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        margin: 0,
        padding: 0,
        backgroundColor: '#000000',
        width: '100vw',
        minHeight: '100vh'
      }}
    >
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 h-auto sm:h-16 py-3 sm:py-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl px-3 py-2 font-normal w-fit self-start sm:self-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                <Store className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-semibold text-white tracking-tight">Seller Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-6 sm:py-8 md:py-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="w-[90%] sm:w-[95%] md:w-full md:max-w-md">
          {/* Login Card */}
          <div 
            className="rounded-2xl sm:rounded-3xl border shadow-2xl p-4 sm:p-5 md:p-6"
            style={{
              background: 'rgba(17, 17, 17, 0.7)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)'
            }}
          >
            <div className="text-center mb-5 sm:mb-6 md:mb-8">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                <Store className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
              </div>
              <h1 className="mobile-heading mb-1.5 sm:mb-2 font-semibold tracking-tight text-white">Welcome Back</h1>
              <p className="mobile-text text-gray-400 font-normal">Sign in to your seller account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-200">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-500" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="input-mobile !pl-14 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-200 whitespace-nowrap">
                    Password
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 text-xs sm:text-sm text-yellow-400 hover:text-yellow-300 font-normal whitespace-nowrap"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot password?
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-500" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="!pl-14 !pr-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="button-mobile w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-medium tracking-tight transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing In...
                  </>
                ) : 'Sign In'}
              </Button>
            </form>

            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-gray-400 font-normal text-sm sm:text-base">
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
            <DialogDescription className="text-gray-400 font-normal">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-200">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  className="pl-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSendingResetLink}
              className="w-full h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-medium tracking-tight"
            >
              {isSendingResetLink ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
