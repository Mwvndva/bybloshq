import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Mail, MapPin, Phone, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { locationData } from '@/lib/constants';
import TermsModal from '@/components/TermsModal';
import { useBuyerInfoModal } from './useBuyerInfoModal';
import { BuyerInfoForm } from './BuyerInfoForm';

export interface BuyerInfo {
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  city: string;
  location: string;
  password?: string;
  confirmPassword?: string;
}

export interface BuyerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (buyerInfo: BuyerInfo) => Promise<void>;
  isLoading?: boolean;
  theme?: string;
  phoneNumber: string; // Pre-filled from first step
  initialData?: Partial<BuyerInfo>;
}

export function BuyerInfoModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  theme = 'default',
  phoneNumber,
  initialData
}: BuyerInfoModalProps) {
  const {
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
  } = useBuyerInfoModal({ isOpen, onClose, onSubmit, isLoading, theme, phoneNumber, initialData });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`w-[92vw] max-w-[400px] sm:max-w-[420px] max-h-[85dvh] sm:max-h-[90dvh] p-0 overflow-hidden ${themeClasses.bg} ${themeClasses.text} shadow-2xl rounded-3xl border border-slate-200 dark:border-white/10`}>
        <BuyerInfoForm
          handleSubmit={handleSubmit}
          buyerInfo={buyerInfo}
          setBuyerInfo={setBuyerInfo}
          errors={errors}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
          termsAccepted={termsAccepted}
          setTermsAccepted={setTermsAccepted}
          setIsTermsModalOpen={setIsTermsModalOpen}
          checkPasswordStrength={checkPasswordStrength}
          themeClasses={themeClasses}
          isLoading={isLoading}
          handleClose={handleClose}
        />
        <TermsModal
          isOpen={isTermsModalOpen}
          onClose={() => setIsTermsModalOpen(false)}
          onAccept={() => {
            setTermsAccepted(true);
            setIsTermsModalOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}


