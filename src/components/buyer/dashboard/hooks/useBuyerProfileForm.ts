import { useState } from 'react';
import { useBuyerAuth } from '@/features/auth/contexts';
import { useToast } from '@/hooks/use-toast';

/**
 * Buyer self-service profile edits. Buyers may only change the two contact
 * numbers we actually need to reach them (mobile payment + WhatsApp); name,
 * email and location are shown read-only. Saving PATCHes just those fields.
 */
export function useBuyerProfileForm() {
  const { user, updateBuyerProfile } = useBuyerAuth();
  const { toast } = useToast();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [mobilePayment, setMobilePayment] = useState<string>(user?.mobilePayment || '');
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user?.whatsappNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateBuyerProfile({ mobilePayment, whatsappNumber });

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
