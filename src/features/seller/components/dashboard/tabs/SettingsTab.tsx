import { useEffect, useState } from 'react';
import { Edit, Loader2, LogOut, Trash2 } from 'lucide-react';
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton';
import { deleteSellerAccount } from '@/features/seller/api/profileApi';
import type { Theme } from '@/features/seller/api';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ThemeSelector } from '../../ThemeSelector';
import { getSellerInitials } from '../dashboardUtils';
import { getShopUrl, getShopUsername } from '@/shared/utils/shopLinks';
import type { SellerSettingsFormData } from '../types';
import { SellerAmbassadorInvites } from './SellerAmbassadorInvites';
import { SectionHeader, SocialInput } from './settingsTab.parts';
import { SettingsLocationSection } from './SettingsLocationSection';
import { ThemeSegmentedPill } from '@/shared/ui/ThemeSegmentedPill';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import type { LocationCoordinates } from '@/infrastructure/location/location';


interface SettingsTabProps {
  cities: Record<string, string[]>;
  formData: SellerSettingsFormData;
  getLocations: () => string[];
  handleBusinessPhotoUploaded: () => void;
  handleCityChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleDeleteLocation: () => Promise<void>;
  handleLocationChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleRemoveSocialLink?: (field: 'instagramLink' | 'tiktokLink') => Promise<void>;
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
  handleRemoveSocialLink,
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
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const previewShopUsername = getShopUsername(formData.shopName);
  const previewShopUrl = getShopUrl(sellerProfile?.slug || formData.shopName);
  const { theme, setTheme } = useThemeScope('seller');

  const contactsHeaderAction = isEditingContacts ? (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setFormData(prev => ({
            ...prev,
            whatsappNumber: sellerProfile?.whatsappNumber || sellerProfile?.phone || '',
            instagramLink: sellerProfile?.instagramLink || '',
            tiktokLink: sellerProfile?.tiktokLink || '',
            facebookLink: sellerProfile?.facebookLink || ''
          }));
          setIsEditingContacts(false);
        }}
        disabled={isSaving}
        className="h-8 rounded-lg border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
      >
        Cancel
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={async () => {
          await handleSaveProfile();
          setIsEditingContacts(false);
        }}
        disabled={isSaving}
        className="h-8 rounded-lg bg-[var(--theme-button-bg,#f5c518)] text-xs font-black text-[var(--theme-button-text,#000000)] hover:opacity-90 shadow-md"
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Changes'
        )}
      </Button>
    </div>
  ) : (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => setIsEditingContacts(true)}
      className="h-8 gap-1.5 rounded-lg border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
    >
      <Edit className="h-3.5 w-3.5 text-yellow-400" />
      Edit Contacts
    </Button>
  );

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      {/* Dashboard theme (light / dark / system) — seller-scoped */}
      <section className="seller-card p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black tracking-tight text-slate-950 dark:text-white sm:text-lg">Theme</h3>
            <p className="mt-0.5 seller-subtext">Choose how your dashboard looks. System follows your device.</p>
          </div>
          <ThemeSegmentedPill value={theme} onChange={setTheme} />
        </div>
      </section>

      {/* Shop accent colour */}
      <section className="seller-card p-4 sm:p-5 lg:p-6">
        <ThemeSelector
          currentTheme={(sellerProfile?.theme as Theme) || 'default'}
          onThemeChange={() => undefined}
        />
      </section>

      {/* Contact & Socials */}
      <section className="seller-card p-4 sm:p-5 lg:p-6">
        <SectionHeader
          title="Contact & Socials"
          description="Where buyers can identify and reach your business."
          action={contactsHeaderAction}
        />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="seller-card-soft p-4">
            <p className="seller-label mb-1">Email</p>
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate" title={sellerProfile?.email || 'Not set'}>
              {sellerProfile?.email || 'Not set'}
            </p>
          </div>

          <div className="seller-card-soft p-4">
            <p className="text-[10px] sm:text-xs font-medium text-white/50 mb-1">WhatsApp Number</p>
            {isEditingContacts ? (
              <Input
                name="whatsappNumber"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                placeholder="e.g. 0712345678"
                className="seller-field text-xs"
              />
            ) : (
              <p className="text-sm sm:text-base lg:text-lg font-semibold text-white">
                {sellerProfile?.whatsappNumber || sellerProfile?.phone || 'Not set'}
              </p>
            )}
          </div>

          <SocialInput
            isEditing={isEditingContacts}
            label="Instagram Link"
            value={formData.instagramLink}
            displayValue={sellerProfile?.instagramLink}
            placeholder="https://instagram.com/yourshop"
            onChange={(value) => setFormData(prev => ({ ...prev, instagramLink: value }))}
            onRemove={() => handleRemoveSocialLink?.('instagramLink')}
            iconPath={<><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></>}
          />
          <SocialInput
            isEditing={isEditingContacts}
            label="TikTok Link"
            value={formData.tiktokLink}
            displayValue={sellerProfile?.tiktokLink}
            placeholder="https://tiktok.com/@yourshop"
            onChange={(value) => setFormData(prev => ({ ...prev, tiktokLink: value }))}
            onRemove={() => handleRemoveSocialLink?.('tiktokLink')}
            iconPath={<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>}
          />
        </div>
      </section>

      {/* Location Settings */}
      <SettingsLocationSection
        isEditing={isEditingLocation}
        toggleEdit={() => setIsEditingLocation(prev => !prev)}
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
        onSave={async () => {
          await handleSaveProfile();
          setIsEditingLocation(false);
        }}
        onCancel={() => {
          setFormData(prev => ({
            ...prev,
            city: sellerProfile?.city || '',
            location: sellerProfile?.location || '',
            physicalAddress: sellerProfile?.physicalAddress || '',
            latitude: sellerProfile?.latitude || null,
            longitude: sellerProfile?.longitude || null
          }));
          setIsEditingLocation(false);
        }}
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
