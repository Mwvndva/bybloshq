import { useState } from 'react';
import { useBuyerAuth } from '@/features/auth/contexts';
import { useToast } from '@/hooks/use-toast';

export function useBuyerProfileForm(onProfileSaved?: (city: string) => void) {
  const { user, updateBuyerProfile } = useBuyerAuth();
  const { toast } = useToast();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState<string>(user?.fullName || '');
  const [city, setCity] = useState<string>(user?.city || '');
  const [locationArea, setLocationArea] = useState<string>(user?.location || '');
  const [mobilePayment, setMobilePayment] = useState<string>(user?.mobilePayment || '');
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user?.whatsappNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
    if (!fullName || !city || !locationArea) {
      toast({
        title: "Missing Information",
        description: "Full name, city, and location are required.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateBuyerProfile({
        fullName,
        city,
        location: locationArea,
        mobilePayment,
        whatsappNumber
      });

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });

      // Update the filter city when profile is updated
      onProfileSaved?.(city);
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Failed to update profile', error);
      toast({
        title: "Update Failed",
        description: "There was a problem saving your profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return {
    isEditingProfile, setIsEditingProfile,
    fullName, setFullName,
    city, setCity,
    locationArea, setLocationArea,
    mobilePayment, setMobilePayment,
    whatsappNumber, setWhatsappNumber,
    isSavingProfile, handleSaveProfile,
  };
}
