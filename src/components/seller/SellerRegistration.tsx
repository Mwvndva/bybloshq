
import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, Lock, Loader2, Eye, EyeOff, ArrowLeft, Store, MapPin, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { sellerApi, checkShopNameAvailability } from '@/api/sellerApi';

interface SellerRegistrationProps {
  onSuccess?: () => void;
}

// Location data with Kenyan cities and their areas
const locationData: Record<string, string[]> = {
  'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka']
};

import { useSellerAuth } from '@/contexts/GlobalAuthContext';

const SellerRegistration = ({ onSuccess }: SellerRegistrationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useSellerAuth();

  // Extract referral code from URL
  const queryParams = new URLSearchParams(location.search);
  const referralCode = queryParams.get('ref') || undefined;

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    shopName: '',
    email: '',
    whatsappNumber: '',
    password: '',
    confirmPassword: '',
    city: 'Nairobi',
    location: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingShopName, setIsCheckingShopName] = useState(false);
  const [shopNameAvailable, setShopNameAvailable] = useState<boolean | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isRegistered, setIsRegistered] = useState(false);
  const { toast } = useToast();

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
      if (showToast) {
        setPasswordError('Passwords do not match');
        toast({
          title: "Validation Error",
          description: "Passwords do not match",
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
      const errorMsg = `Password needs ${unmetRequirements.join(', ')}`;
      setPasswordError(errorMsg);
      if (showToast) {
        toast({
          title: "Weak Password",
          description: errorMsg,
          variant: 'destructive',
        });
      }
      return false;
    }

    setPasswordError('');
    return true;
  };

  // Check shop name availability when shopName changes
  useEffect(() => {
    const checkShopName = async () => {
      const trimmedShopName = formData.shopName.trim();

      if (!trimmedShopName) {
        setShopNameAvailable(null);
        return;
      }

      // Don't check if the shop name is too short
      if (trimmedShopName.length < 3) {
        setShopNameAvailable(null);
        return;
      }

      try {
        setIsCheckingShopName(true);
        const result = await checkShopNameAvailability(trimmedShopName);

        // Make sure we have a valid result before updating state
        if (result && typeof result.available === 'boolean') {
          setShopNameAvailable(result.available);
        } else {
          console.warn('Unexpected response format from server:', result);
          setShopNameAvailable(null);
        }
      } catch (error) {
        console.error('Error checking shop name:', error);
        setShopNameAvailable(false); // Default to not available on error
      } finally {
        setIsCheckingShopName(false);
      }
    };

    const timer = setTimeout(() => {
      checkShopName();
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.shopName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;

    // Disallow spaces in shop name
    if (name === 'shopName') {
      value = value.replace(/\s/g, '');
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear shop name availability when editing the field
    if (name === 'shopName') {
      setShopNameAvailable(null);
    }

    // Validate passwords when either field changes
    if (name === 'password' || name === 'confirmPassword') {
      if (formData.password && formData.confirmPassword) {
        validatePasswords(
          name === 'password' ? value : formData.password,
          name === 'confirmPassword' ? value : formData.confirmPassword,
          false // Don't show toast on every keystroke
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.firstName || !formData.lastName || !formData.shopName || !formData.email || !formData.whatsappNumber || !formData.password || !formData.confirmPassword || !formData.city || !formData.location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including location",
        variant: 'destructive',
      });
      return;
    }

    // Validate shop name is available
    if (shopNameAvailable === false) {
      toast({
        title: "Shop Name Unavailable",
        description: "The shop name you've chosen is already taken. Please choose another one.",
        variant: 'destructive',
      });
      return;
    }

    // Validate shop name is checked
    if (formData.shopName && shopNameAvailable === null) {
      toast({
        title: "Checking Shop Name",
        description: "Please wait while we check the availability of your shop name.",
        variant: 'default',
      });
      return;
    }

    // Validate passwords match
    if (!validatePasswords(formData.password, formData.confirmPassword)) {
      return;
    }

    setIsLoading(true);

    try {
      // Use the auth context register which now supports referralCode
      const result = await register({
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        shopName: formData.shopName.trim(),
        email: formData.email,
        whatsappNumber: formData.whatsappNumber,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        city: formData.city,
        location: formData.location,
        referralCode
      });

      if ((result as any)?.status === 'pending_verification') {
        setIsRegistered(true);
        setIsLoading(false);
        return;
      }

      // Token is handled via HttpOnly cookie, no need to store it manually

      // Welcome toast for already-logged-in (cross-role)
      toast({
        title: "Registration Successful!",
        description: "Welcome to your seller dashboard!",
      });

      // Redirect to shop setup
      navigate('/seller/shop-setup');

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Registration failed:', error);

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


  return (
    <div className="min-h-screen w-full bg-black flex flex-col relative"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: '#000000',
      }}
    >
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-20">
            {/* Left: Back Button */}
            <div className="flex-1 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-xl px-3 py-2 text-sm -ml-3"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </div>

            {/* Center: Title */}
            <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[50%] flex items-center justify-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shrink-0">
                <Store className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                Seller Portal
              </h1>
            </div>

            {/* Right: Empty to balance flex-1 */}
            <div className="flex-1 flex items-center justify-end gap-2">
            </div>
          </div>
        </div>
      </header>



      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[420px]">
          {/* Register Card */}
          <div
            className="rounded-2xl border border-white/10 shadow-2xl p-5 sm:p-6 bg-[rgba(17,17,17,0.7)] backdrop-blur-md"
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <Store className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-white mb-1">Create Account</h1>
              <p className="text-sm text-gray-400">Join our seller community</p>

              {/* Progress Indicator */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 1 ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-400'}`}>
                    1
                  </div>
                </div>
                <div className={`w-6 h-0.5 ${currentStep >= 2 ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 2 ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-400'}`}>
                    2
                  </div>
                </div>
                <div className={`w-6 h-0.5 ${currentStep >= 3 ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 3 ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-400'}`}>
                    3
                  </div>
                </div>
              </div>
            </div>

            {isRegistered ? (
              <div className="text-center py-8 space-y-6">
                <div className="w-20 h-20 mx-auto bg-yellow-400/10 rounded-full flex items-center justify-center border border-yellow-400/20 shadow-[0_0_30px_rgba(250,204,21,0.1)]">
                  <Mail className="h-10 w-10 text-yellow-400 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">Check your email</h2>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto">
                    We've sent a verification link to <span className="text-yellow-400 font-semibold">{formData.email}</span>.
                    Please click the link to activate your shop.
                  </p>
                </div>
                <div className="pt-4 space-y-4">
                  <Button
                    onClick={() => navigate('/seller/login')}
                    className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold h-12 rounded-xl shadow-lg transition-all"
                  >
                    Go to Login
                  </Button>
                  <p className="text-xs text-gray-500">
                    Didn't receive the email? Check your spam folder or try logging in to resend.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-1.5 sm:space-y-4">
                {/* Step 1: Shop & Contact */}
                {currentStep === 1 && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <div className="space-y-0.5 sm:space-y-2">
                        <Label htmlFor="firstName" className="text-[10px] sm:text-sm font-medium text-gray-200">
                          First Name
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                            <User className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                          </div>
                          <Input
                            id="firstName"
                            name="firstName"
                            type="text"
                            placeholder="First Name"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            required
                            className="input-mobile !pl-8 sm:!pl-14 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5 sm:space-y-2">
                        <Label htmlFor="lastName" className="text-[10px] sm:text-sm font-medium text-gray-200">
                          Last Name
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                            <User className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                          </div>
                          <Input
                            id="lastName"
                            name="lastName"
                            type="text"
                            placeholder="Last Name"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            required
                            className="input-mobile !pl-8 sm:!pl-14 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="shopName" className="text-[10px] sm:text-sm font-medium text-gray-200 flex items-center justify-between">
                        Shop Name
                        {formData.shopName.length >= 3 && (
                          <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${shopNameAvailable ? 'text-green-400' : 'text-red-400'}`}>
                            {isCheckingShopName ? 'Checking...' : shopNameAvailable ? 'Available' : 'Taken'}
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Store className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                        </div>
                        <Input
                          id="shopName"
                          name="shopName"
                          type="text"
                          placeholder="Unique shop name"
                          value={formData.shopName}
                          onChange={handleInputChange}
                          required
                          className={`input-mobile !pl-8 sm:!pl-14 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base ${shopNameAvailable === false ? 'border-red-500' : ''}`}
                        />
                      </div>
                      <p className="text-[8px] sm:text-[10px] text-gray-400">Byblos.space/{formData.shopName.toLowerCase() || 'yourshop'}</p>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="email" className="text-[10px] sm:text-sm font-medium text-gray-200">
                        Email Address
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Mail className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                        </div>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="Your email address"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          className="input-mobile !pl-8 sm:!pl-14 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                        />
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="whatsappNumber" className="text-[10px] sm:text-sm font-medium text-gray-200">
                        WhatsApp Number
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Phone className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                        </div>
                        <Input
                          id="whatsappNumber"
                          name="whatsappNumber"
                          type="tel"
                          placeholder="07... or 01..."
                          value={formData.whatsappNumber}
                          onChange={handleInputChange}
                          required
                          className="input-mobile !pl-8 sm:!pl-14 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Step 2: Location */}
                {currentStep === 2 && (
                  <>
                    <div className="space-y-0.5 sm:space-y-2">
                      <Label className="text-[10px] sm:text-sm font-medium text-gray-200">City</Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none z-10">
                          <MapPin className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                        </div>
                        <Select
                          value={formData.city}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, city: value, location: '' }))}
                        >
                          <SelectTrigger className="pl-8 sm:pl-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base">
                            <SelectValue placeholder="Nairobi" className="text-gray-300" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            <SelectItem value="Nairobi" className="text-white hover:bg-gray-700 focus:bg-gray-700 text-xs">
                              Nairobi
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label className="text-[10px] sm:text-sm font-medium text-gray-200">Area/Location</Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none z-10">
                          <MapPin className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                        </div>
                        <Select
                          value={formData.location}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                          disabled={!formData.city}
                        >
                          <SelectTrigger className="pl-8 sm:pl-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400 disabled:opacity-50 text-[10px] sm:text-base">
                            <SelectValue placeholder={formData.city ? 'Select your area' : 'Select city first'} className="text-gray-300" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            {formData.city && locationData[formData.city]?.sort((a, b) => a.localeCompare(b)).map((area) => (
                              <SelectItem key={area} value={area} className="text-white hover:bg-gray-700 focus:bg-gray-700 text-xs">{area}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 3: Security */}
                {currentStep === 3 && (
                  <>
                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="password" className="text-[10px] sm:text-sm font-medium text-gray-200">
                        Password
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                        </div>
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          className="input-mobile !pl-8 sm:!pl-14 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-2 sm:pr-4 flex items-center text-gray-300 hover:text-gray-300"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Password Strength Checklist */}
                    {formData.password && (
                      <div className="mt-2 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                        <p className="text-xs font-semibold text-gray-300 mb-2">Password Requirements:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { label: "8+ chars", met: checkPasswordStrength(formData.password).minLength },
                            { label: "1 Number", met: checkPasswordStrength(formData.password).hasNumber },
                            { label: "1 Special", met: checkPasswordStrength(formData.password).hasSpecial },
                            { label: "Upper/Lower", met: checkPasswordStrength(formData.password).hasUpper && checkPasswordStrength(formData.password).hasLower },
                          ].map((req, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              {req.met ? (
                                <div className="bg-green-500/20 p-0.5 rounded-full">
                                  <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-400" />
                                </div>
                              ) : (
                                <div className="bg-gray-700 p-0.5 rounded-full">
                                  <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-300" />
                                </div>
                              )}
                              <span className={`text-[10px] sm:text-xs ${req.met ? 'text-green-400 font-medium' : 'text-gray-300'}`}>
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="confirmPassword" className="text-[10px] sm:text-sm font-medium text-gray-200">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                        </div>
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          required
                          className="input-mobile !pl-8 sm:!pl-14 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-2 sm:pr-4 flex items-center text-gray-300 hover:text-gray-300"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                          )}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-[10px] sm:text-sm text-red-400 font-medium">{passwordError}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="flex gap-3 mt-4">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="flex-1 bg-gray-700 text-white hover:bg-gray-600 rounded-xl h-11 font-medium tracking-tight transition-all duration-200 text-sm"
                    >
                      Back
                    </Button>
                  )}
                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        // ... currentStep logic ...
                        if (currentStep === 1) {
                          if (!formData.firstName || !formData.lastName || !formData.shopName || !formData.email || !formData.whatsappNumber) {
                            toast({ title: "Missing Information", description: "Please fill in all details", variant: 'destructive' });
                            return;
                          }
                          if (shopNameAvailable === false) {
                            toast({ title: "Shop Name Unavailable", description: "Please choose another name", variant: 'destructive' });
                            return;
                          }
                        } else if (currentStep === 2) {
                          if (!formData.city || !formData.location) {
                            toast({ title: "Missing Information", description: "Please select your location", variant: 'destructive' });
                            return;
                          }
                        }
                        setCurrentStep(currentStep + 1);
                      }}
                      className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl h-11 font-semibold tracking-tight transition-all duration-200 text-sm"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl h-11 font-semibold tracking-tight transition-all duration-200 text-sm"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : 'Register'}
                    </Button>
                  )}
                </div>
              </form>
            )}

            <div className="mt-3 sm:mt-5 text-center">
              <p className="text-gray-300 font-normal text-[10px] sm:text-base">
                Already have an account?{' '}
                <Link
                  to="/seller/login"
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
};

export default SellerRegistration;
