import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BannerUpload } from '../../BannerUpload';
import { BusinessPhotoUpload } from '../../BusinessPhotoUpload';
import { getSellerInitials } from '../dashboardUtils';
import type { SellerSettingsFormData } from '../types';
import { SectionHeader } from './settingsTab.parts';

interface SettingsBusinessProfileSectionProps {
  sellerProfile: import("@/features/auth/types/authTypes").SellerProfile;
  handleBusinessPhotoUploaded: () => void;
  isEditing: boolean;
  formData: SellerSettingsFormData;
  setFormData: React.Dispatch<React.SetStateAction<SellerSettingsFormData>>;
  shopNameAvailable: boolean | null;
  isCheckingShopName: boolean;
  previewShopUsername: string;
  previewShopUrl: string;
}

export function SettingsBusinessProfileSection({ sellerProfile, handleBusinessPhotoUploaded, isEditing, formData, setFormData, shopNameAvailable, isCheckingShopName, previewShopUsername, previewShopUrl }: SettingsBusinessProfileSectionProps) {
  return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <SectionHeader title="Business Profile" description="The core identity buyers see on your shop page." />
        <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
          <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <BusinessPhotoUpload
              currentPhotoUrl={sellerProfile?.avatarUrl}
              fallbackInitials={getSellerInitials(sellerProfile?.shopName, sellerProfile?.fullName)}
              onPhotoUploaded={handleBusinessPhotoUploaded}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <BannerUpload
                currentBannerUrl={sellerProfile?.bannerImage}
                onBannerUploaded={() => undefined}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Shop Name</p>
              {isEditing ? (
                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      name="shopName"
                      value={formData.shopName}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\s/g, '');
                        setFormData(prev => ({ ...prev, shopName: val }));
                      }}
                      placeholder="Shop Name"
                      className={`h-10 text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400 pr-10 ${formData.shopName !== sellerProfile?.shopName && shopNameAvailable === false ? 'border-red-500 focus:border-red-500' :
                        formData.shopName !== sellerProfile?.shopName && shopNameAvailable === true ? 'border-green-500 focus:border-green-500' : ''
                        }`}
                    />
                    {isCheckingShopName && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {!isCheckingShopName && formData.shopName && formData.shopName !== sellerProfile?.shopName && shopNameAvailable !== null && (
                      <div className={`absolute right-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${shopNameAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                    )}
                  </div>
                  {formData.shopName !== sellerProfile?.shopName && shopNameAvailable !== null && !isCheckingShopName && (
                    <p className={`text-[10px] ${shopNameAvailable ? 'text-green-400' : 'text-red-400'}`}>
                      {shopNameAvailable ? 'Name available' : 'Name already taken'}
                    </p>
                  )}
                  {previewShopUsername && (
                    <a
                      href={previewShopUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[10px] font-bold text-slate-600 underline decoration-yellow-400 underline-offset-2"
                      title={previewShopUrl}
                    >
                      {previewShopUsername}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-slate-950 truncate" title={sellerProfile?.shopName || 'Not set'}>
                  {sellerProfile?.shopName || 'Not set'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Full Name</p>
              {isEditing ? (
                <Input
                  name="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Your Full Name"
                  className="h-10 text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400"
                />
              ) : (
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-slate-950 truncate" title={sellerProfile?.fullName || 'Not set'}>
                  {sellerProfile?.fullName || 'Not set'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-xs sm:text-sm font-medium text-slate-600">Shop Bio</p>
                {isEditing && (
                  <span className="text-[10px] text-slate-500">{formData.bio.length}/500</span>
                )}
              </div>
              {isEditing ? (
                <Textarea
                  name="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value.slice(0, 500) }))}
                  placeholder="Tell buyers what your shop offers."
                  className="min-h-[92px] text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400 resize-none"
                />
              ) : (
                <p className="text-sm sm:text-base font-semibold text-slate-950 whitespace-pre-line break-words">
                  {sellerProfile?.bio || 'Not set'}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
  );
}
