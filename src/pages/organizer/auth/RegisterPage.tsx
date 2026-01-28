import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrganizerAuth } from '@/contexts/GlobalAuthContext';
import { Loader2, Eye, EyeOff, User, Mail, Phone, Lock, ArrowLeft, Calendar, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    whatsapp_number: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const { register: registerUser, isAuthenticated, isLoading: isAuthLoading } = useOrganizerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/organizer/dashboard';
  const { toast } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

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

  // Show loading state while checking auth status
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Password strength checker function
  const checkPasswordStrength = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
    };
  };

  const validatePasswords = (password: string, confirmPassword: string, showToast = true): boolean => {
    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      setPasswordError(msg);
      if (showToast) {
        toast({
          title: "Validation Error",
          description: msg,
          variant: 'destructive',
        });
      }
      return false;
    }

    const strength = checkPasswordStrength(password);
    const unmetRequirements: string[] = [];

    if (!strength.minLength) unmetRequirements.push("at least 8 characters");
    if (!strength.hasNumber) unmetRequirements.push("a number");
    if (!strength.hasSpecial) unmetRequirements.push("a special character");
    if (!strength.hasUpper) unmetRequirements.push("an uppercase letter");
    if (!strength.hasLower) unmetRequirements.push("a lowercase letter");

    if (unmetRequirements.length > 0) {
      const msg = `Password needs ${unmetRequirements.join(', ')}`;
      setPasswordError(msg);
      if (showToast) {
        toast({
          title: "Weak Password",
          description: msg,
          variant: 'destructive',
        });
      }
      return false;
    }

    setPasswordError('');
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validate passwords when either field changes
    if (name === 'password' || name === 'confirmPassword') {
      if (formData.password && formData.confirmPassword) {
        validatePasswords(
          name === 'password' ? value : formData.password,
          name === 'confirmPassword' ? value : formData.confirmPassword,
          false // Don't show toast on keyup
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.fullName || !formData.email || !formData.whatsapp_number || !formData.password || !formData.confirmPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: 'destructive',
      });
      return;
    }

    // Validate passwords match
    if (!validatePasswords(formData.password, formData.confirmPassword)) {
      return;
    }

    setIsLoading(true);

    try {
      // Prepare registration data
      const registrationData = {
        full_name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        whatsapp_number: formData.whatsapp_number.trim(),
        password: formData.password,
        passwordConfirm: formData.confirmPassword
      };

      // Call the register function from our auth context
      await registerUser(registrationData);

      // The actual navigation will be handled by the useEffect above
      // when isAuthenticated becomes true

    } catch (error: any) {
      console.error('Registration error:', error);

      let errorMessage = 'An error occurred during registration';
      let errorTitle = 'Registration Failed';

      // Handle structured validation errors
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors) && error.response.data.errors.length > 0) {
        const firstError = error.response.data.errors[0];
        errorTitle = 'Validation Error';
        errorMessage = firstError.message;
      } else {
        errorMessage = error.response?.data?.message ||
          (error instanceof Error ? error.message : errorMessage);
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

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
          <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] items-center gap-3 sm:gap-0 h-auto sm:h-16 py-3 sm:py-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl px-3 py-2 font-normal w-fit justify-self-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Back</span>
            </Button>

            <div className="hidden sm:block" />

            <div className="flex items-center space-x-2 justify-self-start sm:justify-self-end">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-semibold text-white tracking-tight">Organizer Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-6 sm:py-8 md:py-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="w-[90%] sm:w-[95%] md:w-full md:max-w-lg">
          {/* Register Card */}
          <div
            className="rounded-2xl sm:rounded-3xl border shadow-2xl p-4 sm:p-5 md:p-6"
            style={{
              background: 'rgba(18, 18, 18, 0.7)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)'
            }}
          >
            <div className="text-center mb-5 sm:mb-6 md:mb-8">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                <Calendar className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
              </div>
              <h1 className="mobile-heading mb-1.5 sm:mb-2 font-semibold tracking-tight text-white">Create Account</h1>
              <p className="mobile-text text-gray-300 font-normal">Join our organizer community</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium text-gray-200">
                  Full Name
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="pl-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-200">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="pl-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_number" className="text-sm font-medium text-gray-200 flex items-center justify-between">
                  WhatsApp Number
                  <span className="text-[10px] text-yellow-400 font-medium">For Order Notifications</span>
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="whatsapp_number"
                    name="whatsapp_number"
                    type="tel"
                    placeholder="e.g. 0712345678"
                    value={formData.whatsapp_number}
                    onChange={handleInputChange}
                    required
                    className="pl-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-200">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password (min 8 characters)"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="pl-12 pr-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-300 hover:text-gray-300"
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

              {/* Password Strength Checklist */}
              {formData.password && (
                <div className="mt-2 p-3 bg-gray-900/50 rounded-xl border border-gray-800">
                  <p className="text-xs font-semibold text-gray-300 mb-2">Password Requirements:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { label: "At least 8 characters", met: checkPasswordStrength(formData.password).minLength },
                      { label: "At least one number", met: checkPasswordStrength(formData.password).hasNumber },
                      { label: "At least one special char", met: checkPasswordStrength(formData.password).hasSpecial },
                      { label: "Upper & lowercase letters", met: checkPasswordStrength(formData.password).hasUpper && checkPasswordStrength(formData.password).hasLower },
                    ].map((req, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        {req.met ? (
                          <div className="bg-green-100 p-0.5 rounded-full">
                            <Check className="h-3 w-3 text-green-600" />
                          </div>
                        ) : (
                          <div className="bg-gray-800 p-0.5 rounded-full">
                            <X className="h-3 w-3 text-gray-300" />
                          </div>
                        )}
                        <span className={`text-xs ${req.met ? 'text-green-400 font-medium' : 'text-gray-300'}`}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-200">
                  Confirm Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="pl-12 pr-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-300 hover:text-gray-300"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-sm text-red-500 font-medium">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="byblos"
                className="w-full h-12 shadow-lg rounded-xl text-sm transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-300 font-normal text-sm sm:text-base">
                Already have an account?{' '}
                <Link
                  to="/organizer/login"
                  className="font-medium text-yellow-400 hover:text-yellow-300 hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
