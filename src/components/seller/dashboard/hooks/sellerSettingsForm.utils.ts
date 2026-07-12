import type { SellerSettingsFormData } from '../types';
import type { ApiSeller } from '@/types';

export const cities = {
  'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka'],
  'Mombasa': ['Mombasa Island', 'Nyali', 'Bamburi', 'Kisauni', 'Changamwe', 'Likoni', 'Mtongwe', 'Tudor', 'Shanzu', 'Diani'],
  'Kisumu': ['Kisumu Central', 'Milimani', 'Mamboleo', 'Dunga', 'Kondele', 'Manyatta', 'Nyalenda'],
  'Nakuru': ['Nakuru Town', 'Lanet', 'Kaptembwa', 'Shabab', 'Free Area', 'Section 58', 'Milimani', 'Kiamunyi'],
  'Eldoret': ['Eldoret Town', 'Kapsoya', 'Langas', 'Huruma', 'Kipkaren', 'Kimumu', 'Maili Nne']
};

export const isDefaultCoordinate = (lat?: number | null, lng?: number | null) => {
  return Boolean(lat && lng &&
    Math.abs(Number(lat) - (-1.2921)) < 0.0001 &&
    Math.abs(Number(lng) - (36.8219)) < 0.0001);
};

export const buildInitialFormData = (sellerProfile: ApiSeller | Record<string, unknown>): SellerSettingsFormData => {
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
