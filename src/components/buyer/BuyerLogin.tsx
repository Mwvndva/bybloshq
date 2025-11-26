import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import buyerApi from '@/api/buyerApi';

export function BuyerLogin() {
  const { toast } = useToast();
  const { login, isLoading, forgotPassword } = useBuyerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  // Auto-focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  // Validate email format
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Real-time form validation
  useEffect(() => {
    const emailValid = formData.email && validateEmail(formData.email);
    const passwordValid = formData.password.length >= 6;
    setIsFormValid(emailValid && passwordValid);

    // Clear errors when user starts typing
    if (formData.email && errors.email) {
      setErrors(prev => ({ ...prev, email: '' }));
    }
    if (formData.password && errors.password) {
      setErrors(prev => ({ ...prev, password: '' }));
    }
  }, [formData.email, formData.password]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = { email: '', password: '' };
    let isValid = true;

    if (!formData.email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please check your email and password',
        variant: 'destructive',
      });
      return;
    }

    try {
      await login(formData.email, formData.password);
      
      toast({
        title: 'Welcome Back! 🎉',
        description: 'Redirecting to your dashboard...',
        duration: 2000,
      });
      
    } catch (error: any) {
      let errorMessage = 'An error occurred during login. Please try again.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Please verify your email before logging in.';
      } else if (error.response?.status === 429) {
        errorMessage = 'Too many login attempts. Please try again in a few minutes.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    if (!validateEmail(forgotPasswordEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingResetLink(true);
    try {
      await buyerApi.forgotPassword(forgotPasswordEmail);
      
      toast({
        title: 'Check Your Email 📧',
        description: 'If an account exists with this email, you will receive a password reset link.',
        duration: 5000,
      });
      
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to send reset link. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl px-3 py-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg sm:text-xl font-black text-black">Buyer Portal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 sm:p-8 shadow-lg border border-gray-200/50">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl flex items-center justify-center shadow-lg">
                <ShoppingBag className="h-8 w-8 text-yellow-600" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-black mb-2">Welcome Back</h1>
              <p className="text-gray-600 font-medium text-sm sm:text-base">Sign in to your buyer account</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold text-black">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    ref={emailInputRef}
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`pl-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-sm text-red-600 font-medium" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>
            
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-bold text-black">
                    Password
                  </Label>
                  <Button 
                    type="button" 
                    variant="link" 
                    className="px-0 text-xs sm:text-sm text-yellow-600 hover:text-yellow-500 font-medium h-auto" 
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot?
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`pl-12 pr-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-red-600 font-medium" role="alert">
                    {errors.password}
                  </p>
                )}
              </div>
            
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-bold text-base sm:text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !isFormValid}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          
            <div className="mt-6 text-center">
              <p className="text-gray-600 font-medium text-sm sm:text-base">
                Don't have an account?{' '}
                <Link 
                  to="/buyer/register" 
                  className="font-bold text-yellow-600 hover:text-yellow-500 hover:underline"
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
        <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-black text-black">Forgot Password</DialogTitle>
            <DialogDescription className="text-gray-600 font-medium text-sm sm:text-base">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-sm font-bold text-black">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  className="pl-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button 
              type="submit"
              disabled={isSendingResetLink}
              className="w-full h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
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
