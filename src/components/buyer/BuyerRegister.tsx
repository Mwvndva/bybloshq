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
import { useBuyerRegister } from './useBuyerRegister';
import { checkPasswordStrength, type BuyerRegisterFormData } from './buyerRegisterUtils';

export function BuyerRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    formData,
    setFormData,
    handleInputChange,
    handleSubmit,
    errors,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    currentStep,
    setCurrentStep,
    isRegistered,
    termsAccepted,
    setTermsAccepted,
    isTermsModalOpen,
    setIsTermsModalOpen,
    resendCooldown,
    isResending,
    handleResend,
    isLoading,
  } = useBuyerRegister();

  return (
    <div className="auth-page relative flex min-h-[100svh] w-full flex-col overflow-x-hidden bg-slate-50 dark:bg-[#080808] text-slate-950 dark:text-white transition-colors duration-200"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <header className="bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            {/* Left: Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span>Back</span>
            </Button>

            {/* Center: Title */}
            <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[46%] flex items-center justify-center gap-2 sm:max-w-[50%]">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                <ShoppingBag className="h-4 w-4 text-slate-950" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight truncate">
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
            className="rounded-2xl border border-slate-200 dark:border-white/12 shadow-2xl p-5 sm:p-6 bg-white dark:bg-[#0d0d0d] text-slate-950 dark:text-white transition-colors duration-200"
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <ShoppingBag className="h-6 w-6 text-black" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                {isRegistered ? 'Verification Sent!' : 'Create Account'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                {isRegistered ? 'One more step to join us' : 'Join our buyer community'}
              </p>

              {!isRegistered && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="flex items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep >= 1 ? 'bg-yellow-400 text-black' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                      1
                    </div>
                  </div>
                  <div className={`w-6 h-0.5 ${currentStep >= 2 ? 'bg-yellow-400' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                  <div className="flex items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep >= 2 ? 'bg-yellow-400 text-black' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                      2
                    </div>
                  </div>
                  <div className={`w-6 h-0.5 ${currentStep >= 3 ? 'bg-yellow-400' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                  <div className="flex items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep >= 3 ? 'bg-yellow-400 text-black' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
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


