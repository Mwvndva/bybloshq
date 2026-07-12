import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSellerAuth } from '@/features/auth/contexts';

export function useSellerLogin() {
  const { toast } = useToast();
  const { login, forgotPassword } = useSellerAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const loginInFlightRef = useRef(false);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInFlightRef.current) return;

    loginInFlightRef.current = true;
    setIsLoading(true);

    try {
      await login({ email: formData.email, password: formData.password });
    } catch (error) {
      // Extract the actual error message and code from the SDK/API response
      const apiError = error?.response?.data;
      const errorMessage = apiError?.message || error?.message || 'Invalid email or password';

      if (apiError?.code === 'PENDING_VERIFICATION' || apiError?.code === 'EMAIL_NOT_VERIFIED' || apiError?.code === 'TERMS_NOT_ACCEPTED') {
        const email = apiError.email || formData.email;
        setUnverifiedEmail(email);
        setIsVerifyModalOpen(true);
        return;
      }

      setError(errorMessage);

      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      loginInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast({
        title: 'Error',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingResetLink(true);
    try {
      // Call the forgot password from context
      const success = await forgotPassword(forgotPasswordEmail);

      if (success) {
        toast({
          title: 'Reset link sent',
          description: 'If an account exists with this email, you will receive a password reset link.',
        });
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to send reset link. Please try again later.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending reset link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reset link. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return {
    formData,
    handleInputChange,
    handleSubmit,
    error,
    isLoading,
    showPassword,
    setShowPassword,
    isVerifyModalOpen,
    setIsVerifyModalOpen,
    unverifiedEmail,
    showForgotPassword,
    setShowForgotPassword,
    forgotPasswordEmail,
    setForgotPasswordEmail,
    handleForgotPassword,
    isSendingResetLink,
  };
}
