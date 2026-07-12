
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

export function useSellerRegistration(onSuccess?: () => void) {
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



  const handleResend = async () => {
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
  };


  return {
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
  };
}
