import { useEffect, useState } from 'react';
import { Copy, Edit, Loader2, MailPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Theme } from '@/api/seller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BannerUpload } from '../../BannerUpload';
import { BusinessPhotoUpload } from '../../BusinessPhotoUpload';
import ShopLocationPicker from '../../ShopLocationPicker';
import { ThemeSelector } from '../../ThemeSelector';
import { getSellerInitials } from '../dashboardUtils';
import { copyLinkedTextToClipboard, getShopUrl, getShopUsername } from '@/lib/shopLinks';
import type { SellerSettingsFormData } from '../types';
import type { LocationCoordinates } from '@/lib/location';

import { useInviteCreatorMutation, useGetCreatorInvitesQuery } from '@/hooks/seller/useSellerProfile';

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
  toggleEdit
}: SettingsTabProps) {
  const [creatorEmail, setCreatorEmail] = useState('');
  const [isInvitingCreator, setIsInvitingCreator] = useState(false);

  const { data: invites = [] } = useGetCreatorInvitesQuery();
  const inviteCreatorMutation = useInviteCreatorMutation();

  const handleInviteCreator = async () => {
    if (!creatorEmail.trim()) {
      toast.error('Enter a creator email.');
      return;
    }

    setIsInvitingCreator(true);
    try {
      await inviteCreatorMutation.mutateAsync(creatorEmail.trim());
      setCreatorEmail('');
      toast.success('Creator invite sent.');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err?.response?.data?.message || err?.message || 'Could not send invite.');
    } finally {
      setIsInvitingCreator(false);
    }
  };

  const copyCreatorLink = async (link?: string, label?: string) => {
    if (!link) return;
    const copyMode = await copyLinkedTextToClipboard(label || link, link);
    toast.success(copyMode === 'rich' ? 'Creator link copied as linked text.' : 'Creator link copied.');
  };

  const creatorCommissionLabel = `${Number(formData.creatorCommissionRate || 1).toFixed(2).replace(/\.?0+$/, '')}%`;
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeader title="Location Settings" description="Set where buyers collect orders from your physical shop." />
              {!isEditing && (
                <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-auto">
                  <button
                    onClick={toggleEdit}
                    className="text-xs sm:text-sm text-yellow-700 hover:text-yellow-800 font-medium flex items-center justify-center gap-1"
                  >
                    <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    Edit Location
                  </button>
                  {(sellerProfile?.physicalAddress || sellerProfile?.latitude || sellerProfile?.longitude) && (
                    <button
                      type="button"
                      onClick={handleDeleteLocation}
                      disabled={isDeletingLocation}
                      className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isDeletingLocation ? (
                        <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      )}
                      Delete Location
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">City</p>
                {isEditing ? (
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleCityChange}
                    className="w-full p-2 sm:p-3 text-xs sm:text-sm lg:text-base border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white text-slate-950"
                  >
                    <option value="">Select a city</option>
                    {Object.keys(cities).map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs sm:text-sm lg:text-base font-semibold text-slate-950">
                    {sellerProfile?.city || 'Not set'}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">Location/Area</p>
                {isEditing ? (
                  <select
                    name="location"
                    value={formData.location}
                    onChange={handleLocationChange}
                    className="w-full p-2 sm:p-3 text-xs sm:text-sm lg:text-base border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white text-slate-950"
                    disabled={!formData.city}
                  >
                    <option value="">Select a location</option>
                    {getLocations().map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs sm:text-sm lg:text-base font-semibold text-slate-950">
                    {sellerProfile?.location || 'Not set'}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">Physical Shop Address</p>
              {isEditing ? (
                <div className="mt-2 space-y-3">
                  <ShopLocationPicker
                    initialAddress={formData.physicalAddress}
                    initialCoordinates={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : null}
                    onLocationChange={handleShopLocationChange}
                  />
                  {(formData.physicalAddress || formData.latitude || formData.longitude || sellerProfile?.physicalAddress) && (
                    <button
                      type="button"
                      onClick={handleDeleteLocation}
                      disabled={isDeletingLocation || isSaving}
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isDeletingLocation ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete Location
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {sellerProfile?.physicalAddress ? (
                    <>
                      <p className="text-xs sm:text-sm lg:text-base font-semibold text-slate-950">
                        {sellerProfile.physicalAddress}
                      </p>
                      <p className="text-xs text-slate-500">
                        {sellerProfile.latitude && sellerProfile.longitude
                          ? `Coordinates: ${Number(sellerProfile.latitude).toFixed(6)}, ${Number(sellerProfile.longitude).toFixed(6)}`
                          : 'No map location pinned'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs sm:text-sm lg:text-base font-semibold text-slate-500 italic">
                      No physical address set
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-2">
              <MailPlus className="h-5 w-5 text-yellow-700" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-950">Invite Creators</h3>
              <p className="text-slate-600 text-xs sm:text-sm">
                Give influencers a creator link for your shop. They earn your chosen commission after completed sales.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-700">Creator commission</p>
              <h4 className="mt-1 text-lg font-black text-slate-950">{creatorCommissionLabel} per completed sale</h4>
              <p className="mt-1 text-xs font-medium text-slate-700 sm:text-sm">
                This is the cut creators earn from sales they bring to your shop. Default is 1%; you can raise it before inviting creators.
              </p>
            </div>
            {isEditing ? (
              <div className="w-full sm:w-44">
                <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="creatorCommissionRate">
                  Commission %
                </label>
                <Input
                  id="creatorCommissionRate"
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  value={formData.creatorCommissionRate}
                  onChange={(event) => setFormData(prev => ({
                    ...prev,
                    creatorCommissionRate: Number(event.target.value)
                  }))}
                  className="h-10 border-slate-200 bg-white text-slate-950 placeholder:text-slate-400"
                />
              </div>
            ) : (
              <Button
                type="button"
                onClick={toggleEdit}
                variant="outline"
                className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                Set Commission
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            type="email"
            value={creatorEmail}
            onChange={(event) => setCreatorEmail(event.target.value)}
            placeholder="creator@example.com"
            className="h-10 border-slate-200 bg-white text-slate-950 placeholder:text-slate-400"
          />
          <Button
            type="button"
            onClick={handleInviteCreator}
            disabled={isInvitingCreator}
            className="h-10 bg-yellow-400 font-black text-black hover:bg-yellow-300"
          >
            {isInvitingCreator ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {invites.length === 0 ? (
            <div className="bg-slate-50 p-4 text-sm font-medium text-slate-500">
              No creator invites yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {(invites as unknown[]).map((inviteItem) => {
                 const invite = inviteItem as { id: string | number; creatorName?: string; email?: string; status?: string; code?: string; commissionRate?: number; shopUrl?: string; shopName?: string };
                 return (
                 <div key={invite.id} className="grid gap-3 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                   <div className="min-w-0">
                     <p className="truncate text-sm font-black text-slate-950">
                       {invite.creatorName || invite.email}
                     </p>
                     <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                       {invite.status}
                       {invite.code ? ` · ${(Number(invite.commissionRate || 0.01) * 100).toFixed(2).replace(/\.?0+$/, '')}% creator cut` : ''}
                     </p>
                     {invite.shopUrl && (
                       <a
                         href={invite.shopUrl}
                         target="_blank"
                         rel="noreferrer"
                         className="mt-1 block truncate text-xs font-bold text-slate-700 underline decoration-yellow-400 underline-offset-2"
                         title={invite.shopUrl}
                       >
                         {getShopUsername(invite.shopName || formData.shopName)}
                       </a>
                     )}
                   </div>
                   {invite.shopUrl && (
                     <Button
                       type="button"
                       variant="outline"
                       onClick={() => copyCreatorLink(invite.shopUrl, getShopUsername(invite.shopName || formData.shopName))}
                       className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                     >
                       <Copy className="mr-2 h-4 w-4" />
                       Copy Link
                     </Button>
                   )}
                 </div>
              );})}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">{title}</h3>
      <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">{description}</p>
    </div>
  );
}

interface SocialInputProps {
  displayValue?: string;
  iconPath: React.ReactNode;
  isEditing: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

function SocialInput({ displayValue, iconPath, isEditing, label, onChange, placeholder, value }: SocialInputProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">{label}</p>
      {isEditing ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400"
        />
      ) : (
        <div className="flex items-center gap-2">
          {displayValue ? (
            <a
              href={displayValue}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-base lg:text-lg font-semibold text-blue-700 hover:underline flex items-center gap-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {iconPath}
              </svg>
              View
            </a>
          ) : (
            <p className="text-sm sm:text-base font-semibold text-slate-500 italic">Not set</p>
          )}
        </div>
      )}
    </div>
  );
}


