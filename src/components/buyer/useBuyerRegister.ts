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

export function useBuyerRegister() {
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


  return {
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
  };
}
