import { useEffect, useState } from 'react';
import { Edit, Loader2, LogOut, Trash2 } from 'lucide-react';
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton';
import { deleteSellerAccount } from '@/api/seller/profileApi';
import type { Theme } from '@/api/seller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BannerUpload } from '../../BannerUpload';
import { BusinessPhotoUpload } from '../../BusinessPhotoUpload';
import ShopLocationPicker from '../../ShopLocationPicker';
import { ThemeSelector } from '../../ThemeSelector';
import { getSellerInitials } from '../dashboardUtils';
import { getShopUrl, getShopUsername } from '@/lib/shopLinks';
import type { SellerSettingsFormData } from '../types';
import { SellerAmbassadorInvites } from './SellerAmbassadorInvites';
import { SectionHeader, SocialInput } from './settingsTab.parts';
import { SettingsBusinessProfileSection } from './SettingsBusinessProfileSection';
import { SettingsLocationSection } from './SettingsLocationSection';
import type { LocationCoordinates } from '@/lib/location';


interface SettingsTabProps {
  cities: Record<string, string[]>;
  formData: SellerSettingsFormData;
  getLocations: () => string[];
  handleBusinessPhotoUploaded: () => void;
  handleCityChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleDeleteLocation: () => Promise<void>;
  handleLocationChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleSaveProfile: () => Promise<void>;
  handleShopLocationChange: (address: string, coordinates: LocationCoordinates | null) => void;
  isCheckingShopName: boolean;
  isDeletingLocation: boolean;
  isEditing: boolean;
  isSaving: boolean;
  sellerProfile: import("@/features/auth/types/authTypes").SellerProfile;
  setFormData: React.Dispatch<React.SetStateAction<SellerSettingsFormData>>;
  shopNameAvailable: boolean | null;
  onLogout: () => void;
  toggleEdit: () => void;
}

export function SettingsTab({
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
  sellerProfile,
  setFormData,
  shopNameAvailable,
  onLogout,
  toggleEdit
}: SettingsTabProps) {
  const previewShopUsername = getShopUsername(formData.shopName);
  const previewShopUrl = getShopUrl(formData.shopName);

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-yellow-600">Settings</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Shop controls</h2>
          <p className="mt-1 max-w-2xl text-xs font-medium text-slate-700 sm:text-sm">
            Keep your public shop details, appearance, contacts, and pickup location current.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={toggleEdit}
                disabled={isSaving}
                className="h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="h-10 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300 sm:w-auto"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button
              onClick={toggleEdit}
              className="h-10 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300 sm:w-auto"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <SettingsBusinessProfileSection
        sellerProfile={sellerProfile}
        isEditing={isEditing}
        formData={formData}
        setFormData={setFormData}
        shopNameAvailable={shopNameAvailable}
        isCheckingShopName={isCheckingShopName}
        previewShopUsername={previewShopUsername}
        previewShopUrl={previewShopUrl}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <ThemeSelector
          currentTheme={(sellerProfile?.theme as Theme) || 'default'}
          onThemeChange={() => undefined}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <SectionHeader title="Contact & Socials" description="Where buyers can identify and reach your business." />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Email</p>
              <p className="text-sm sm:text-base lg:text-lg font-semibold text-slate-950 truncate" title={sellerProfile?.email || 'Not set'}>
                {sellerProfile?.email || 'Not set'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] sm:text-xs font-medium text-slate-600 mb-1">WhatsApp Number</p>
              {isEditing ? (
                <Input
                  name="whatsappNumber"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  placeholder="e.g. 0712345678"
                  className="h-10 text-xs bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400"
                />
              ) : (
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-slate-950">
                  {sellerProfile?.whatsappNumber || sellerProfile?.phone || 'Not set'}
                </p>
              )}
            </div>

            <SocialInput
              isEditing={isEditing}
              label="Instagram Link"
              value={formData.instagramLink}
              displayValue={sellerProfile?.instagramLink}
              placeholder="https://instagram.com/yourshop"
              onChange={(value) => setFormData(prev => ({ ...prev, instagramLink: value }))}
              iconPath={<><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></>}
            />
            <SocialInput
              isEditing={isEditing}
              label="TikTok Link"
              value={formData.tiktokLink}
              displayValue={sellerProfile?.tiktokLink}
              placeholder="https://tiktok.com/@yourshop"
              onChange={(value) => setFormData(prev => ({ ...prev, tiktokLink: value }))}
              iconPath={<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>}
            />
            <SocialInput
              isEditing={isEditing}
              label="Facebook Link"
              value={formData.facebookLink}
              displayValue={sellerProfile?.facebookLink}
              placeholder="https://facebook.com/yourshop"
              onChange={(value) => setFormData(prev => ({ ...prev, facebookLink: value }))}
              iconPath={<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>}
            />
        </div>
      </section>

      <SettingsLocationSection
        isEditing={isEditing}
        toggleEdit={toggleEdit}
        sellerProfile={sellerProfile}
        handleDeleteLocation={handleDeleteLocation}
        isDeletingLocation={isDeletingLocation}
        formData={formData}
        handleCityChange={handleCityChange}
        cities={cities}
        handleLocationChange={handleLocationChange}
        getLocations={getLocations}
        handleShopLocationChange={handleShopLocationChange}
        isSaving={isSaving}
      />

      <SellerAmbassadorInvites formData={formData} setFormData={setFormData} isEditing={isEditing} toggleEdit={toggleEdit} />

      <section className="rounded-2xl border border-white/10 bg-[#000000] p-4 shadow-sm sm:p-5 lg:p-6">
        <SectionHeader title="Account" description="Sign out of your seller account on this device." />
        <div className="mt-4">
          <Button
            onClick={onLogout}
            className="h-10 w-full bg-red-600 font-black text-white hover:bg-red-500 sm:w-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
        <div className="mt-3">
          <DeleteAccountButton deleteAccount={deleteSellerAccount} onDeleted={onLogout} />
        </div>
      </section>
    </div>
  );
}
