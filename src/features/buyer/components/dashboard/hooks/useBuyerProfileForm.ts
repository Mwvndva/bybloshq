import { useState } from 'react';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { BuyerProfile } from '@/features/auth/types/authTypes';
import { useToast } from '@/shared/hooks/use-toast';

/**
 * Buyer self-service profile edits. Buyers may only change the two contact
 * numbers we actually need to reach them (mobile payment + WhatsApp); name,
 * email and location are shown read-only. Saving PATCHes just those fields.
 *
 * NOTE: Migrated from useBuyerAuth → useGlobalAuth (unified auth system).
 */
export function useBuyerProfileForm() {
  const { user: globalUser, updateProfile } = useGlobalAuth();
  const user = globalUser?.role === 'buyer' ? globalUser.profile as BuyerProfile : null;
  const { toast } = useToast();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [mobilePayment, setMobilePayment] = useState<string>(user?.mobilePayment || '');
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user?.whatsappNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateProfile({ mobilePayment, whatsappNumber }, 'buyer');

      toast({
        title: 'Profile Updated',
        description: 'Your payment and WhatsApp numbers have been saved.',
      });

      setIsEditingProfile(false);
    } catch (error) {
      console.error('Failed to update profile', error);
      toast({
        title: 'Update Failed',
        description: 'There was a problem saving your details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return {
    isEditingProfile, setIsEditingProfile,
    mobilePayment, setMobilePayment,
    whatsappNumber, setWhatsappNumber,
    isSavingProfile, handleSaveProfile,
  };
}
