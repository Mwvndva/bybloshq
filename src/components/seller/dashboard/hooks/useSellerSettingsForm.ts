import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { checkShopNameAvailability } from '@/api/seller';
import { useUpdateProfileMutation } from '@/hooks/seller/useSellerProfile';
import { sellerQueryKeys } from '@/api/queryKeys';
import type { SellerSettingsFormData } from '../types';
import type { ApiSeller } from '@/types';
import type { LocationCoordinates } from '@/lib/location';

const cities = {
  'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka'],
  'Mombasa': ['Mombasa Island', 'Nyali', 'Bamburi', 'Kisauni', 'Changamwe', 'Likoni', 'Mtongwe', 'Tudor', 'Shanzu', 'Diani'],
  'Kisumu': ['Kisumu Central', 'Milimani', 'Mamboleo', 'Dunga', 'Kondele', 'Manyatta', 'Nyalenda'],
  'Nakuru': ['Nakuru Town', 'Lanet', 'Kaptembwa', 'Shabab', 'Free Area', 'Section 58', 'Milimani', 'Kiamunyi'],
  'Eldoret': ['Eldoret Town', 'Kapsoya', 'Langas', 'Huruma', 'Kipkaren', 'Kimumu', 'Maili Nne']
};

const isDefaultCoordinate = (lat?: number | null, lng?: number | null) => {
  return Boolean(lat && lng &&
    Math.abs(Number(lat) - (-1.2921)) < 0.0001 &&
    Math.abs(Number(lng) - (36.8219)) < 0.0001);
};

const buildInitialFormData = (sellerProfile: ApiSeller | Record<string, unknown>): SellerSettingsFormData => {
  const s = sellerProfile as Record<string, unknown>;
  const str = (v: unknown, fallback = ''): string => (v === null || v === undefined || v === '') ? fallback : String(v);
  const optNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const initialPhysicalAddress = s?.physicalAddress === 'Nairobi, Kenya'
    ? ''
    : str(s?.physicalAddress);
  const initialLat = optNum(s?.latitude);
  const initialLng = optNum(s?.longitude);
  const isDefaultCoord = isDefaultCoordinate(initialLat, initialLng);

  return {
    fullName: str(s?.fullName),
    shopName: str(s?.shopName),
    city: str(s?.city),
    location: str(s?.location),
    physicalAddress: initialPhysicalAddress,
    latitude: isDefaultCoord ? null : (initialLat || null),
    longitude: isDefaultCoord ? null : (initialLng || null),
    instagramLink: str(s?.instagramLink),
    tiktokLink: str(s?.tiktokLink),
    facebookLink: str(s?.facebookLink),
    whatsappNumber: str(s?.whatsappNumber || s?.phone),
    bio: str(s?.bio),
    creatorCommissionRate: Number(s?.creatorCommissionRate || 0.01) * 100
  };
};

interface UseSellerSettingsFormArgs {
  sellerProfile: ApiSeller | Record<string, unknown>;
  toast: (options: Record<string, unknown>) => void;
  updateSellerProfile?: (payload: Record<string, unknown>) => Promise<void>;
}

export function useSellerSettingsForm({ sellerProfile, toast, updateSellerProfile }: UseSellerSettingsFormArgs) {
  const queryClient = useQueryClient();
  const updateProfileMutation = useUpdateProfileMutation();
  const [formData, setFormData] = useState<SellerSettingsFormData>(() => buildInitialFormData(sellerProfile));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);
  const [shopNameAvailable, setShopNameAvailable] = useState<boolean | null>(null);
  const [isCheckingShopName, setIsCheckingShopName] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setFormData(buildInitialFormData(sellerProfile));
    }
  }, [isEditing, sellerProfile]);

  useEffect(() => {
    const checkShopName = async () => {
      const trimmedShopName = formData.shopName.trim();

      if (!trimmedShopName || trimmedShopName === sellerProfile?.shopName) {
        setShopNameAvailable(null);
        return;
      }

      if (trimmedShopName.length < 3) {
        setShopNameAvailable(null);
        return;
      }

      setIsCheckingShopName(true);
      try {
        const result = await checkShopNameAvailability(trimmedShopName);
        setShopNameAvailable(result.available);
      } catch (error) {
        console.error('Error checking shop name:', error);
        setShopNameAvailable(false);
      } finally {
        setIsCheckingShopName(false);
      }
    };

    const timer = setTimeout(checkShopName, 500);
    return () => clearTimeout(timer);
  }, [formData.shopName, sellerProfile?.shopName]);

  const getLocations = useCallback(() => {
    return formData.city && cities[formData.city as keyof typeof cities]
      ? cities[formData.city as keyof typeof cities]
      : [];
  }, [formData.city]);

  const handleCityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const city = e.target.value;
    setFormData(prev => ({
      ...prev,
      city,
      location: ''
    }));
  }, []);

  const handleLocationChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      location: e.target.value
    }));
  }, []);

  const handleShopLocationChange = useCallback((address: string, coordinates: LocationCoordinates | null) => {
    setFormData(prev => ({
      ...prev,
      physicalAddress: address,
      latitude: coordinates?.lat || null,
      longitude: coordinates?.lng || null
    }));
  }, []);

  const handleDeleteLocation = useCallback(async () => {
    const hasLocation = Boolean(
      formData.physicalAddress ||
      sellerProfile?.physicalAddress ||
      formData.latitude ||
      formData.longitude ||
      sellerProfile?.latitude ||
      sellerProfile?.longitude
    );

    if (!hasLocation) {
      toast({
        title: 'No location saved',
        description: 'There is no shop location to delete.',
      });
      return;
    }

    const confirmed = window.confirm('Delete your saved shop location? Buyers will no longer see a physical pickup address until you add one again.');
    if (!confirmed) return;

    setIsDeletingLocation(true);

    try {
      const payload = {
        physicalAddress: null,
        latitude: null,
        longitude: null
      };

      if (updateSellerProfile) {
        await updateSellerProfile(payload);
      } else {
        await updateProfileMutation.mutateAsync(payload);
      }

      setFormData(prev => ({
        ...prev,
        physicalAddress: '',
        latitude: null,
        longitude: null
      }));

      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.summary() });

      toast({
        title: 'Location deleted',
        description: 'Your shop pickup location has been removed.',
      });
    } catch (error) {
      console.error('Error deleting shop location:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete shop location. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingLocation(false);
    }
  }, [
    formData.physicalAddress,
    formData.latitude,
    formData.longitude,
    queryClient,
    sellerProfile?.physicalAddress,
    sellerProfile?.latitude,
    sellerProfile?.longitude,
    toast,
    updateSellerProfile,
    updateProfileMutation
  ]);

  const toggleEdit = useCallback(() => {
    setIsEditing(prev => {
      if (!prev) {
        setFormData(buildInitialFormData(sellerProfile));
        setShopNameAvailable(null);
      }
      return !prev;
    });
  }, [sellerProfile]);

  const handleSaveProfile = useCallback(async () => {
    if (!formData.city || !formData.location || !formData.shopName) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (formData.shopName !== sellerProfile?.shopName && shopNameAvailable === false) {
      toast({
        title: 'Error',
        description: 'Shop name is not available. Please choose another.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.bio.trim().length > 500) {
      toast({
        title: 'Error',
        description: 'Bio must be at most 500 characters',
        variant: 'destructive',
      });
      return;
    }

    const creatorCommissionRate = Number(formData.creatorCommissionRate);
    if (!Number.isFinite(creatorCommissionRate) || creatorCommissionRate < 1 || creatorCommissionRate > 100) {
      toast({
        title: 'Error',
        description: 'Creator commission must be between 1% and 100%',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {
        fullName: formData.fullName,
        shopName: formData.shopName,
        city: formData.city,
        location: formData.location,
        physicalAddress: formData.physicalAddress,
        instagramLink: formData.instagramLink,
        tiktokLink: formData.tiktokLink,
        facebookLink: formData.facebookLink,
        whatsappNumber: formData.whatsappNumber,
        bio: formData.bio.trim(),
        creatorCommissionRate: creatorCommissionRate / 100,
        latitude: formData.latitude,
        longitude: formData.longitude
      };

      if (updateSellerProfile) {
        await updateSellerProfile(payload);
      } else {
        await updateProfileMutation.mutateAsync(payload);
      }

      setIsEditing(false);

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [formData, sellerProfile?.shopName, shopNameAvailable, toast, updateSellerProfile, updateProfileMutation]);

  const handleBusinessPhotoUploaded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: sellerQueryKeys.dashboard() });
    queryClient.invalidateQueries({ queryKey: sellerQueryKeys.summary() });
  }, [queryClient]);

  return {
    cities,
    formData,
    getLocations,
    handleBusinessPhotoUploaded,
    handleCityChange,
    handleDeleteLocation,
    handleLocationChange,
    handleSaveProfile,
    handleShopLocationChange,
    isCheckingShopName,
    isDeletingLocation,
    isEditing,
    isSaving,
    setFormData,
    shopNameAvailable,
    toggleEdit
  };
}


