import { useState, useEffect } from 'react';
import { useToast } from '@/shared/hooks/use-toast';
import { useBuyerResendVerificationMutation } from '@/features/buyer/hooks/mutations/useBuyerAuthMutations';
import { useSellerResendVerificationMutation } from '@/features/seller/hooks/mutations/useSellerAuthMutations';
import { VerifyEmailModalView } from '@/components/auth/VerifyEmailModalView';

export interface VerifyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  role: 'buyer' | 'seller';
}

export function VerifyEmailModal({ isOpen, onClose, email, role }: VerifyEmailModalProps) {
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  const buyerResend = useBuyerResendVerificationMutation();
  const sellerResend = useSellerResendVerificationMutation();

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setIsSuccess(false);
    try {
      if (role === 'seller') {
        await sellerResend.mutateAsync(email);
      } else {
        await buyerResend.mutateAsync(email);
      }

      setIsSuccess(true);
      toast({
        title: 'Verification Link Sent',
        description: `A new link has been sent to ${email}. Please check your inbox.`,
      });
      setResendCooldown(60);
    } catch (error) {
      const errObj = error as { message?: string };
      toast({
        title: 'Error',
        description: errObj.message || 'Failed to resend verification email.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <VerifyEmailModalView
      isOpen={isOpen}
      onClose={onClose}
      email={email}
      role={role}
      isResending={isResending}
      resendCooldown={resendCooldown}
      isSuccess={isSuccess}
      onResend={handleResend}
    />
  );
}

export default VerifyEmailModal;
