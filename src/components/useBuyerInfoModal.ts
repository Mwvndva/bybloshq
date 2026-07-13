import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { BuyerInfo, BuyerInfoModalProps } from './BuyerInfoModal';

export function useBuyerInfoModal({ isOpen, onClose, onSubmit, isLoading = false, theme = 'default', phoneNumber, initialData }: BuyerInfoModalProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    firstName: initialData?.fullName?.split(' ')[0] || '',
    lastName: initialData?.fullName?.split(' ').slice(1).join(' ') || '',
    email: initialData?.email || '',
    mobilePayment: initialData?.mobilePayment || phoneNumber || '',
    whatsappNumber: initialData?.whatsappNumber || phoneNumber || '',
    city: initialData?.city || '',
    location: initialData?.location || '',
    password: '',
    confirmPassword: ''
  });

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<BuyerInfo & { termsAccepted?: string }>>({});

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setBuyerInfo(prev => ({
        ...prev,
        ...initialData,
        firstName: initialData.fullName?.split(' ')[0] || prev.firstName,
        lastName: initialData.fullName?.split(' ').slice(1).join(' ') || prev.lastName,
        city: initialData.city || prev.city
      }) as BuyerInfo);
    }
  }, [initialData]);

  // FIX (Task 1): Reset ALL state when modal opens to prevent auto-save or carry-over errors
  useEffect(() => {
    if (isOpen) {
      setTermsAccepted(false);
      setErrors({});
      // Note: we don't reset buyerInfo here to allow pre-filling from initialData
    }
  }, [isOpen]);

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

  const validateForm = (): boolean => {
    const newErrors: Partial<BuyerInfo & { termsAccepted?: string }> = {};

    if (!buyerInfo.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!buyerInfo.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!buyerInfo.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(buyerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Strict Password validation matching BuyerRegister
    const strength = checkPasswordStrength(buyerInfo.password || '');
    const unmetRequirements: string[] = [];

    if (!strength.minLength) unmetRequirements.push("at least 8 characters");
    if (!strength.hasNumber) unmetRequirements.push("a number");
    if (!strength.hasSpecial) unmetRequirements.push("a special character");
    if (!strength.hasUpper) unmetRequirements.push("an uppercase letter");
    if (!strength.hasLower) unmetRequirements.push("a lowercase letter");

    if (unmetRequirements.length > 0) {
      newErrors.password = `Password needs ${unmetRequirements.join(', ')}`;
    }

    if (buyerInfo.password !== buyerInfo.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!buyerInfo.whatsappNumber?.trim()) {
      newErrors.whatsappNumber = 'WhatsApp number is required';
    }

    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the Terms and Conditions to continue.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        ...buyerInfo,
        fullName: `${buyerInfo.firstName} ${buyerInfo.lastName}`.trim(),
        termsAccepted: true // Passed as true because validation passed
      } as unknown as Parameters<typeof onSubmit>[0]);
      // Reset form on successful submission
      setBuyerInfo({
        firstName: '',
        lastName: '',
        email: '',
        mobilePayment: '',
        whatsappNumber: '',
        city: '',
        location: '',
        password: '',
        confirmPassword: ''
      });
      setErrors({});
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to save buyer information',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setTermsAccepted(false); // Reset terms on close
      setErrors({});
      onClose();
    }
  };

  const themeClasses = {
    bg: 'bg-black border border-white/15',
    text: 'text-white',
    input: 'bg-white/5 border-white/15 text-white placeholder:text-white/60 focus-visible:ring-yellow-400',
    label: 'text-white',
    button: 'bg-yellow-400 hover:bg-yellow-500 text-white',
    error: 'text-red-500'
  };


  return {
    buyerInfo,
    setBuyerInfo,
    errors,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    termsAccepted,
    setTermsAccepted,
    isTermsModalOpen,
    setIsTermsModalOpen,
    handleSubmit,
    handleClose,
    checkPasswordStrength,
    themeClasses,
  };
}
