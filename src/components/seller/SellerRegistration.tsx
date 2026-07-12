
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, Lock, Loader2, Eye, EyeOff, ArrowLeft, Store, MapPin, Check, X, Globe, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { sellerApi, checkShopNameAvailability } from '@/api/seller';
import ShopLocationPicker from './ShopLocationPicker';
import TermsModal from '@/components/TermsModal';
import { useSellerResendVerificationMutation } from '@/hooks/seller/mutations/useSellerAuthMutations';
import { SellerRegistrationSteps } from './SellerRegistrationSteps';
import { checkPasswordStrength, type SellerRegistrationFormData } from './sellerRegistrationUtils';

interface SellerRegistrationProps {
  onSuccess?: () => void;
}

import { useSellerAuth } from '@/features/auth/contexts';

const SellerRegistration = ({ onSuccess }: SellerRegistrationProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useSellerAuth();
  const referralCode = searchParams.get('ref') || '';

  const [formData, setFormData] = useState<SellerRegistrationFormData>({
    firstName: '',
    lastName: '',
    shopName: '',
    email: '',
    whatsappNumber: '',
    password: '',
    confirmPassword: '',
    city: 'Nairobi',
    location: '',
    physicalAddress: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingShopName, setIsCheckingShopName] = useState(false);
  const [shopNameAvailable, setShopNameAvailable] = useState<boolean | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [hasPhysicalShop, setHasPhysicalShop] = useState<boolean | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  // Resend verification state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();
  const resendVerificationMutation = useSellerResendVerificationMutation();

  // Keep the standalone auth route aligned with the light app shell.
  useEffect(() => {
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    document.body.style.cssText = 'margin: 0; padding: 0; background-color: #f8f7f2; overflow-x: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; background-color: #f8f7f2; overflow-x: hidden;';

    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
    };
  }, []);

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
    const { name } = e.target;
    let { value } = e.target;

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

    // Validate form - Check all required fields (physicalAddress is only required if hasPhysicalShop is true)
    const isPhysicalAddressRequired = hasPhysicalShop === true;
    const isMissingFields = !formData.firstName || !formData.lastName || !formData.shopName || !formData.email ||
      !formData.whatsappNumber || !formData.password || !formData.confirmPassword ||
      !formData.city || !formData.location || (isPhysicalAddressRequired && !formData.physicalAddress);

    if (isMissingFields) {
      toast({
        title: "Missing Information",
        description: isPhysicalAddressRequired
          ? "Please fill in all required fields including your shop address"
          : "Please fill in all required fields",
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
      // Use the auth context register for seller profile creation.
      const result = await register({
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        shopName: formData.shopName.trim(),
        email: formData.email,
        whatsappNumber: formData.whatsappNumber,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        city: formData.city,
        location: formData.location,
        physicalAddress: formData.physicalAddress,
        latitude: formData.latitude,
        longitude: formData.longitude,
        referralCode,
        termsAccepted: true
      });

      if ((result as Record<string, unknown>)?.status === 'pending_verification') {
        setIsRegistered(true);
        setIsLoading(false);
        return;
      }

      // Token is handled via HttpOnly cookie, no need to store it manually

      // Welcome toast for already-logged-in (cross-role)
      toast({
        title: "Registration Successful!",
        description: "Welcome to Byblos!",
      });

      // Redirect to dashboard
      navigate('/seller/dashboard');

      if (onSuccess) onSuccess();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string; errors?: Array<{ message: string }> } }; message?: string };
      if (err.response?.status === 409) return;
      console.error('Registration failed:', error);

      let errorMessage = 'An error occurred during registration';
      let errorTitle = 'Registration Failed';

      // Handle structured validation errors
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors) && err.response.data.errors.length > 0) {
        const firstError = err.response.data.errors[0];
        errorTitle = 'Validation Error';
        errorMessage = firstError.message;
      } else {
        errorMessage = err.response?.data?.message ||
          (err instanceof Error ? err.message : errorMessage);
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
    <div className="auth-page relative flex min-h-[100svh] w-full flex-col overflow-x-hidden"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: '#f8f7f2',
      }}
    >
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            {/* Left: Back Button */}
            <div className="flex-1 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-stone-700 hover:text-black hover:bg-yellow-100 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </div>

            {/* Center: Title */}
            <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[46%] flex items-center justify-center gap-2 sm:max-w-[50%]">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shrink-0">
                <Store className="h-4 w-4 text-slate-950" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-950 tracking-tight truncate">
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
      <div className="flex flex-1 items-start justify-center px-4 py-5 sm:items-center sm:px-6 sm:py-8 lg:px-8">
        <div className="w-full max-w-[420px]">
          {/* Register Card */}
          <div
            className="rounded-2xl border border-stone-200 shadow-[0_18px_45px_rgba(17,17,17,0.08)] p-5 sm:p-6 bg-white backdrop-blur-md"
          >
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex items-center justify-center">
                <Store className="h-12 w-12 text-yellow-500" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-950 mb-1">Create Account</h1>
              <p className="text-sm text-stone-500">Join our seller community</p>

              {/* Progress Indicator */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 1 ? 'bg-yellow-400 text-black' : 'bg-stone-200 text-stone-500'}`}>
                    1
                  </div>
                </div>
                <div className={`w-6 h-0.5 ${currentStep >= 2 ? 'bg-yellow-400' : 'bg-stone-200'}`} />
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 2 ? 'bg-yellow-400 text-black' : 'bg-stone-200 text-stone-500'}`}>
                    2
                  </div>
                </div>
                <div className={`w-6 h-0.5 ${currentStep >= 3 ? 'bg-yellow-400' : 'bg-stone-200'}`} />
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 3 ? 'bg-yellow-400 text-black' : 'bg-stone-200 text-stone-500'}`}>
                    3
                  </div>
                </div>
                <div className={`w-6 h-0.5 ${currentStep >= 4 ? 'bg-yellow-400' : 'bg-stone-200'}`} />
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 4 ? 'bg-yellow-400 text-black' : 'bg-stone-200 text-stone-500'}`}>
                    4
                  </div>
                </div>
              </div>
            </div>

            {isRegistered ? (
              <div className="text-center py-8 space-y-6">
                <div className="mx-auto flex items-center justify-center pb-2">
                  <Mail className="h-16 w-16 text-yellow-500 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">Check your email</h2>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto">
                    We've sent a verification link to <span className="text-yellow-400 font-semibold">{formData.email}</span>.
                    Please click the link to activate your shop.
                  </p>
                </div>
                <div className="pt-4 space-y-3">
                  <Button
                    onClick={() => navigate('/seller/login')}
                    className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold h-12 rounded-xl shadow-lg transition-all"
                  >
                    Go to Login
                  </Button>
                  <Button
                    onClick={async () => {
                      if (resendCooldown > 0 || isResending) return;
                      setIsResending(true);
                      try {
                        await resendVerificationMutation.mutateAsync(formData.email);
                        toast({ title: 'Email Sent', description: 'A new verification link has been sent to your inbox.' });
                        setResendCooldown(60);
                        const interval = setInterval(() => {
                          setResendCooldown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
                        }, 1000);
                      } catch (err: unknown) {
                        const error = err as Error;
                        toast({ title: 'Error', description: error.message || 'Failed to resend email.', variant: 'destructive' });
                      } finally {
                        setIsResending(false);
                      }
                    }}
                    disabled={resendCooldown > 0 || isResending}
                    variant="ghost"
                    className="w-full text-gray-400 hover:text-white border border-white/10 hover:border-white/30 h-11 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend"}
                  </Button>
                  <p className="text-[10px] text-gray-600">Also check your spam / junk folder.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-1.5 sm:space-y-4">
                <SellerRegistrationSteps
                  currentStep={currentStep}
                  formData={formData}
                  handleInputChange={handleInputChange}
                  setFormData={setFormData}
                  shopNameAvailable={shopNameAvailable}
                  isCheckingShopName={isCheckingShopName}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  showConfirmPassword={showConfirmPassword}
                  setShowConfirmPassword={setShowConfirmPassword}
                  passwordError={passwordError}
                  hasPhysicalShop={hasPhysicalShop}
                  setHasPhysicalShop={setHasPhysicalShop}
                  setCurrentStep={setCurrentStep}
                  termsAccepted={termsAccepted}
                  setTermsAccepted={setTermsAccepted}
                  setIsTermsModalOpen={setIsTermsModalOpen}
                />

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
                  {currentStep < 4 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        // Validate current step
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
                        } else if (currentStep === 3) {
                          // Must have made a choice
                          if (hasPhysicalShop === null) {
                            toast({ title: "Selection Required", description: "Please select whether you have a physical shop or operate online only.", variant: 'destructive' });
                            return;
                          }
                          // If they have a shop, must have a specific address (not the default/empty)
                          if (hasPhysicalShop && !formData.physicalAddress) {
                            toast({ title: "Shop Address Required", description: "Please provide a specific shop address or location on the map.", variant: 'destructive' });
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
                      disabled={isLoading || !termsAccepted}
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
            <TermsModal
              isOpen={isTermsModalOpen}
              onClose={() => setIsTermsModalOpen(false)}
              onAccept={() => setTermsAccepted(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerRegistration;


