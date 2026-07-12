import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Mail, User, Phone, Lock, ArrowLeft, ShoppingBag, MapPin, Check, X, RefreshCw } from 'lucide-react';
import { useBuyerAuth } from '@/features/auth/contexts';
import { locationData } from '@/lib/constants';
import TermsModal from '@/components/TermsModal';
import { useBuyerResendVerificationMutation } from '@/hooks/buyer/mutations/useBuyerAuthMutations';
import { BuyerRegisterSteps } from './BuyerRegisterSteps';
import { checkPasswordStrength, type BuyerRegisterFormData } from './buyerRegisterUtils';

export function BuyerRegister() {
  const { toast } = useToast();
  const { register, isLoading } = useBuyerAuth();
  const navigate = useNavigate();
  const resendVerificationMutation = useBuyerResendVerificationMutation();

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

  const [formData, setFormData] = useState<BuyerRegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    mobilePayment: '',
    whatsappNumber: '',
    password: '',
    confirmPassword: '',
    city: 'Nairobi',
    location: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [isRegistered, setIsRegistered] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  // Resend verification state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const startResendCooldown = useCallback(() => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await resendVerificationMutation.mutateAsync(formData.email);
      toast({ title: 'Email Sent', description: 'A new verification link has been sent to your inbox.' });
      startResendCooldown();
    } catch (err) {
      const error = err as Error;
      toast({ title: 'Error', description: error.message || 'Failed to resend email.', variant: 'destructive' });
    } finally {
      setIsResending(false);
    }
  };

  const validatePasswords = (password: string, confirmPassword: string): boolean => {
    const newErrors: { [key: string]: string } = {};
    let isValid = true;

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: 'destructive',
      });
    }

    const strength = checkPasswordStrength(password);
    const unmetRequirements: string[] = [];

    if (!strength.minLength) unmetRequirements.push("at least 8 characters");
    if (!strength.hasNumber) unmetRequirements.push("a number");
    if (!strength.hasSpecial) unmetRequirements.push("a special character");
    if (!strength.hasUpper) unmetRequirements.push("an uppercase letter");
    if (!strength.hasLower) unmetRequirements.push("a lowercase letter");

    if (unmetRequirements.length > 0) {
      newErrors.password = `Password needs ${unmetRequirements.join(', ')}`;
      isValid = false;
      toast({
        title: "Weak Password",
        description: `Password needs ${unmetRequirements.join(', ')}`,
        variant: 'destructive',
      });
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return isValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({}); // Clear previous errors

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobilePayment || !formData.whatsappNumber || !formData.password || !formData.confirmPassword || !formData.city || !formData.location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including location and phone numbers",
        variant: 'destructive',
      });
      return;
    }

    if (!/^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: 'destructive',
      });
      return;
    }

    if (!validatePasswords(formData.password, formData.confirmPassword)) {
      return;
    }

    try {
      const result = await register({
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        mobilePayment: formData.mobilePayment,
        whatsappNumber: formData.whatsappNumber,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        city: formData.city,
        location: formData.location,
        termsAccepted: termsAccepted
      });

      if ((result as Record<string, unknown>)?.status === 'pending_verification') {
        setIsRegistered(true);
        return;
      }

      // Registration success and navigation is handled by the auth context
    } catch (error) {
      // Handle structured validation errors
      if (error.response?.status === 400 && error.response?.data?.errors) {
        const validationErrors: { field: string; message: string }[] = error.response.data.errors;
        const newErrors: { [key: string]: string } = {};

        validationErrors.forEach(err => {
          newErrors[err.field] = err.message;
        });

        setErrors(newErrors);
      }
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-stone-700 hover:text-black hover:bg-yellow-100 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span>Back</span>
            </Button>

            {/* Center: Title */}
            <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[46%] flex items-center justify-center gap-2 sm:max-w-[50%]">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shrink-0">
                <ShoppingBag className="h-4 w-4 text-slate-950" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-950 tracking-tight truncate">
                Buyer Portal
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
            className="rounded-2xl border border-white/15 shadow-xl p-5 sm:p-6"
            style={{
              background: '#ffffff',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid #e7e2d6',
              boxShadow: '0 18px 45px rgba(17, 17, 17, 0.08)',
            }}
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <ShoppingBag className="h-6 w-6 text-black" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-950">
                {isRegistered ? 'Verification Sent!' : 'Create Account'}
              </h1>
              <p className="text-stone-500 font-normal text-sm">
                {isRegistered ? 'One more step to join us' : 'Join our buyer community'}
              </p>

              {!isRegistered && (
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
                </div>
              )}
            </div>

            {isRegistered ? (
              <div className="text-center py-4 space-y-6">
                <div className="w-20 h-20 mx-auto bg-yellow-400/10 rounded-full flex items-center justify-center border border-yellow-400/20 shadow-[0_0_30px_rgba(250,204,21,0.1)]">
                  <Mail className="h-10 w-10 text-yellow-400 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">Check your email</h2>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    We've sent a verification link to <br />
                    <span className="text-yellow-400 font-semibold">{formData.email}</span>
                  </p>
                  <p className="text-gray-500 text-xs mt-2">
                    Please click the link in your email to activate your account.
                  </p>
                </div>
                <div className="pt-4 space-y-3">
                  <Button
                    onClick={() => navigate('/buyer/login')}
                    className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold h-12 rounded-xl shadow-lg transition-all"
                  >
                    Go to Login
                  </Button>
                  <Button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                    variant="ghost"
                    className="w-full text-gray-400 hover:text-white border border-white/10 hover:border-white/30 h-11 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {isResending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend"}
                  </Button>
                  <p className="text-[10px] text-gray-600">Also check your spam / junk folder.</p>
                </div>
              </div>
            ) : (

              <form onSubmit={handleSubmit} className="space-y-4">
                <BuyerRegisterSteps
                  currentStep={currentStep}
                  formData={formData}
                  handleInputChange={handleInputChange}
                  setFormData={setFormData}
                  errors={errors}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  showConfirmPassword={showConfirmPassword}
                  setShowConfirmPassword={setShowConfirmPassword}
                  termsAccepted={termsAccepted}
                  setTermsAccepted={setTermsAccepted}
                  setIsTermsModalOpen={setIsTermsModalOpen}
                />

                {/* Navigation Buttons */}
                <div className="flex gap-2 sm:gap-3 pt-2">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="flex-1 bg-gray-700 text-white hover:bg-gray-600 rounded-lg sm:rounded-xl font-medium tracking-tight transition-all duration-200 h-8 sm:h-10 text-xs sm:text-sm"
                    >
                      Back
                    </Button>
                  )}
                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        // Validate current step before proceeding
                        if (currentStep === 1) {
                          if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobilePayment) {
                            toast({
                              title: "Missing Information",
                              description: "Please fill in all personal details",
                              variant: 'destructive',
                            });
                            return;
                          }
                        } else if (currentStep === 2) {
                          if (!formData.city || !formData.location) {
                            toast({
                              title: "Missing Information",
                              description: "Please select your city and area",
                              variant: 'destructive',
                            });
                            return;
                          }
                        }
                        setCurrentStep(currentStep + 1);
                      }}
                      className={`${currentStep === 1 ? 'flex-1' : 'flex-1'} bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold tracking-tight transition-all duration-200 h-11 text-sm`}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold tracking-tight transition-all duration-200 h-11 text-sm"
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

            {!isRegistered && (
              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-gray-300 font-normal text-xs sm:text-base">
                  Already have an account?{' '}
                  <Link
                    to="/buyer/login"
                    className="font-medium text-yellow-400 hover:text-yellow-300 hover:underline"
                  >
                    Sign In
                  </Link>
                </p>
              </div>
            )}
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
}


