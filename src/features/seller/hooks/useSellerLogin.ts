/**
 * useSellerLogin – thin hook that delegates to the unified useGlobalAuth
 * auth system. Kept as a convenience wrapper so the forgot-password dialog
 * and verification modal state stay co-located with the form.
 *
 * NOTE: The old useSellerAuth dependency has been removed.
 * Authentication is now fully handled by useGlobalAuth().
 */
import { useState, useEffect, useRef } from 'react';
import { useGlobalAuth } from '@/features/auth/contexts';
import { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { toast } from 'sonner';

export function useSellerLogin() {
  const { login, forgotPassword } = useGlobalAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const loginInFlightRef = useRef(false);

  useEffect(() => {
    void getFreshCsrfToken();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInFlightRef.current) return;

    let email = formData.email?.trim().toLowerCase();
    let password = formData.password?.trim();

    if (!email) {
      const emailEl = document.querySelector<HTMLInputElement>('input[name="email"], input[type="email"]');
      if (emailEl?.value) email = emailEl.value.trim().toLowerCase();
    }
    if (!password) {
      const passEl = document.querySelector<HTMLInputElement>('input[name="password"], input[type="password"]');
      if (passEl?.value) password = passEl.value;
    }

    if (!email || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    loginInFlightRef.current = true;
    setIsLoading(true);
    try {
      await login(email, password, 'seller');
      // Navigation handled by useGlobalAuth().login()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; code?: string; email?: string } }; message?: string };
      const apiError = err?.response?.data;
      const errorMessage = apiError?.message || err?.message || 'Invalid email or password';

      if (apiError?.code === 'PENDING_VERIFICATION' || apiError?.code === 'EMAIL_NOT_VERIFIED' || apiError?.code === 'TERMS_NOT_ACCEPTED') {
        setUnverifiedEmail(apiError.email || email);
        setIsVerifyModalOpen(true);
        return;
      }

      setError(errorMessage);
    } finally {
      loginInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast.error('Please enter your email address');
      return;
    }
    setIsSendingResetLink(true);
    try {
      const success = await forgotPassword(forgotPasswordEmail, 'seller');
      if (success) {
        toast.success('Reset link sent', { description: 'If an account exists with this email, you will receive a password reset link.' });
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      } else {
        toast.error('Failed to send reset link. Please try again later.');
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to send reset link. Please try again later.');
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
