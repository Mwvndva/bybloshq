
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { User, Mail, Phone, Lock, Loader2, Eye, EyeOff, ArrowLeft, Store, MapPin, Check, X, Globe, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useToast } from '@/shared/hooks/use-toast';
import { sellerApi, checkShopNameAvailability } from '@/features/seller/api';
import TermsModal from '@/shared/components/TermsModal';
import { useSellerResendVerificationMutation } from '@/features/seller/hooks/mutations/useSellerAuthMutations';
import { SellerRegistrationSteps } from '../components/SellerRegistrationSteps';
import { useSellerRegistration } from '../hooks/useSellerRegistration';
import { checkPasswordStrength, type SellerRegistrationFormData } from '../utils/sellerRegistrationUtils';

interface SellerRegistrationProps {
  onSuccess?: () => void;
}




const SellerRegistration = ({ onSuccess }: SellerRegistrationProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    formData,
    setFormData,
    handleInputChange,
    handleSubmit,
    isLoading,
    isCheckingShopName,
    shopNameAvailable,
    passwordError,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    currentStep,
    setCurrentStep,
    hasPhysicalShop,
    setHasPhysicalShop,
    isRegistered,
    termsAccepted,
    setTermsAccepted,
    isTermsModalOpen,
    setIsTermsModalOpen,
    resendCooldown,
    isResending,
    handleResend,
  } = useSellerRegistration(onSuccess);

  return (
    <main className="auth-page min-h-screen bg-[#090909] text-white"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md pt-safe-top">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            {/* Left: Back Button */}
            <div className="flex flex-1 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="rounded-xl px-3 py-2 text-xs text-white/75 transition-all duration-200 hover:bg-yellow-100 hover:text-black"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back</span>
              </Button>
            </div>

            {/* Center: Title */}
            <div className="absolute left-1/2 flex min-w-0 max-w-[46%] -translate-x-1/2 items-center justify-center text-center sm:max-w-[50%]">
              <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                Seller Portal
              </h1>
            </div>

            {/* Right: Empty to balance flex-1 */}
            <div className="flex-1" aria-hidden="true" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col px-4 py-5 sm:min-h-[calc(100svh-5rem)]">
        <div className="my-auto w-full space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="space-y-1.5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Seller Community</p>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Create Account</h2>
            <p className="text-xs font-medium text-white/55">Join our seller community</p>

            {/* Progress Indicator */}
            <div className="pt-2 flex items-center justify-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${currentStep >= 1 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/40'}`}>
                1
              </div>
              <div className={`h-0.5 w-6 ${currentStep >= 2 ? 'bg-yellow-400' : 'bg-white/10'}`} />
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${currentStep >= 2 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/40'}`}>
                2
              </div>
              <div className={`h-0.5 w-6 ${currentStep >= 3 ? 'bg-yellow-400' : 'bg-white/10'}`} />
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${currentStep >= 3 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/40'}`}>
                3
              </div>
              <div className={`h-0.5 w-6 ${currentStep >= 4 ? 'bg-yellow-400' : 'bg-white/10'}`} />
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${currentStep >= 4 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/40'}`}>
                4
              </div>
            </div>
          </div>

          {isRegistered ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex items-center justify-center pb-2">
                <Mail className="h-14 w-14 text-yellow-400 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-white tracking-tight">Check your email</h3>
                <p className="text-white/60 text-xs leading-relaxed max-w-[280px] mx-auto">
                  We've sent a verification link to <span className="text-yellow-300 font-semibold">{formData.email}</span>.
                  Please click the link to activate your shop.
                </p>
              </div>
              <div className="pt-3 space-y-2.5">
                <Button
                  onClick={() => navigate('/seller/login')}
                  className="h-12 w-full rounded-2xl bg-yellow-400 font-black text-black transition hover:bg-yellow-300"
                >
                  Go to Login
                </Button>
                <Button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isResending}
                  variant="ghost"
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-2"
                >
                  {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend"}
                </Button>
                <p className="text-[10px] text-white/40">Also check your spam / junk folder.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
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

              <div className="flex gap-2.5 pt-2">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/10 text-xs font-semibold text-white hover:bg-white/20 transition"
                  >
                    Back
                  </Button>
                )}
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={() => {
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
                        if (hasPhysicalShop === null) {
                          toast({ title: "Selection Required", description: "Please select whether you have a physical shop or operate online only.", variant: 'destructive' });
                          return;
                        }
                        if (hasPhysicalShop && !formData.physicalAddress) {
                          toast({ title: "Shop Address Required", description: "Please provide a specific shop address or location on the map.", variant: 'destructive' });
                          return;
                        }
                      }
                      setCurrentStep(currentStep + 1);
                    }}
                    className="h-12 flex-1 rounded-2xl bg-yellow-400 font-black text-black hover:bg-yellow-300 transition"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="h-12 flex-1 rounded-2xl bg-yellow-400 font-black text-black hover:bg-yellow-300 transition"
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

          <div className="pt-2 text-center">
            <p className="text-xs text-white/55">
              Already have an account?{' '}
              <Link
                to="/seller/login"
                className="font-semibold text-yellow-300 hover:underline"
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
    </main>
  );
};

export default SellerRegistration;


