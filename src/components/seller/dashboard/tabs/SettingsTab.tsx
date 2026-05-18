import { Edit, Gift, Loader2, Trash2 } from 'lucide-react';
import type { Theme } from '@/api/sellerApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BusinessPhotoUpload } from '../../BusinessPhotoUpload';
import ReferralPanel from '../../ReferralPanel';
import ShopLocationPicker from '../../ShopLocationPicker';
import { ThemeSelector } from '../../ThemeSelector';
import { getSellerInitials } from '../dashboardUtils';
import type { SellerSettingsFormData } from '../types';

interface SettingsTabProps {
  cities: Record<string, string[]>;
  formData: SellerSettingsFormData;
  getLocations: () => string[];
  handleBusinessPhotoUploaded: () => void;
  handleCityChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleDeleteLocation: () => Promise<void>;
  handleLocationChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleSaveProfile: () => Promise<void>;
  handleShopLocationChange: (address: string, coordinates: { lat: number; lng: number } | null) => void;
  isCheckingShopName: boolean;
  isDeletingLocation: boolean;
  isEditing: boolean;
  isSaving: boolean;
  sellerProfile: any;
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
  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-yellow-300/80">Settings</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Shop controls</h2>
          <p className="mt-1 max-w-2xl text-xs font-medium text-white/50 sm:text-sm">
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
                className="h-10 w-full border-white/10 bg-transparent text-white hover:bg-white/5 sm:w-auto"
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

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
        <SectionHeader title="Business Profile" description="The core identity buyers see on your shop page." />
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <BusinessPhotoUpload
              currentPhotoUrl={sellerProfile?.avatarUrl}
              fallbackInitials={getSellerInitials(sellerProfile?.shopName, sellerProfile?.fullName)}
              onPhotoUploaded={handleBusinessPhotoUploaded}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">Shop Name</p>
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
                      className={`h-8 sm:h-9 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400 pr-10 ${formData.shopName !== sellerProfile?.shopName && shopNameAvailable === false ? 'border-red-500 focus:border-red-500' :
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
                  <p className="text-[10px] text-gray-400 truncate">byblos.com/shop/{formData.shopName}</p>
                </div>
              ) : (
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate" title={sellerProfile?.shopName || 'Not set'}>
                  {sellerProfile?.shopName || 'Not set'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">Full Name</p>
              {isEditing ? (
                <Input
                  name="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Your Full Name"
                  className="h-8 sm:h-9 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                />
              ) : (
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate" title={sellerProfile?.fullName || 'Not set'}>
                  {sellerProfile?.fullName || 'Not set'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-xs sm:text-sm font-medium text-gray-300">Shop Bio</p>
                {isEditing && (
                  <span className="text-[10px] text-gray-400">{formData.bio.length}/500</span>
                )}
              </div>
              {isEditing ? (
                <Textarea
                  name="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value.slice(0, 500) }))}
                  placeholder="Tell buyers what your shop offers."
                  className="min-h-[92px] text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400 resize-none"
                />
              ) : (
                <p className="text-sm sm:text-base font-semibold text-white whitespace-pre-line break-words">
                  {sellerProfile?.bio || 'Not set'}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
        <ThemeSelector
          currentTheme={(sellerProfile?.theme as Theme) || 'default'}
          onThemeChange={() => undefined}
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
        <SectionHeader title="Contact & Socials" description="Where buyers can identify and reach your business." />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">Email</p>
              <p className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate" title={sellerProfile?.email || 'Not set'}>
                {sellerProfile?.email || 'Not set'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] sm:text-xs font-medium text-gray-300 mb-1">WhatsApp Number</p>
              {isEditing ? (
                <Input
                  name="whatsappNumber"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  placeholder="e.g. 0712345678"
                  className="h-8 text-xs bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                />
              ) : (
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-white">
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

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeader title="Location Settings" description="Set where buyers collect orders from your physical shop." />
              {!isEditing && (
                <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-auto">
                  <button
                    onClick={toggleEdit}
                    className="text-xs sm:text-sm text-yellow-300 hover:text-yellow-200 font-medium flex items-center justify-center gap-1"
                  >
                    <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    Edit Location
                  </button>
                  {(sellerProfile?.physicalAddress || sellerProfile?.latitude || sellerProfile?.longitude) && (
                    <button
                      type="button"
                      onClick={handleDeleteLocation}
                      disabled={isDeletingLocation}
                      className="text-xs sm:text-sm text-red-200 hover:text-red-100 font-medium flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2">City</p>
                {isEditing ? (
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleCityChange}
                    className="w-full p-2 sm:p-3 text-xs sm:text-sm lg:text-base border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-gray-800 text-white"
                  >
                    <option value="">Select a city</option>
                    {Object.keys(cities).map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs sm:text-sm lg:text-base font-semibold text-white">
                    {sellerProfile?.city || 'Not set'}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2">Location/Area</p>
                {isEditing ? (
                  <select
                    name="location"
                    value={formData.location}
                    onChange={handleLocationChange}
                    className="w-full p-2 sm:p-3 text-xs sm:text-sm lg:text-base border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-gray-800 text-white"
                    disabled={!formData.city}
                  >
                    <option value="">Select a location</option>
                    {getLocations().map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs sm:text-sm lg:text-base font-semibold text-white">
                    {sellerProfile?.location || 'Not set'}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2">Physical Shop Address</p>
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
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 text-xs font-semibold hover:bg-red-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
                      <p className="text-xs sm:text-sm lg:text-base font-semibold text-white">
                        {sellerProfile.physicalAddress}
                      </p>
                      <p className="text-xs text-gray-300">
                        {sellerProfile.latitude && sellerProfile.longitude
                          ? `Coordinates: ${Number(sellerProfile.latitude).toFixed(6)}, ${Number(sellerProfile.longitude).toFixed(6)}`
                          : 'No map location pinned'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs sm:text-sm lg:text-base font-semibold text-gray-300 italic">
                      No physical address set
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-2">
              <Gift className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Refer & Earn</h3>
              <p className="text-gray-400 text-xs sm:text-sm">Build your squad and earn rewards from their sales</p>
            </div>
          </div>

          <ReferralPanel totalSales={sellerProfile?.totalSales || 0} />
      </section>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-black tracking-tight text-white sm:text-lg">{title}</h3>
      <p className="mt-1 text-xs font-medium text-white/45 sm:text-sm">{description}</p>
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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">{label}</p>
      {isEditing ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 sm:h-9 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
        />
      ) : (
        <div className="flex items-center gap-2">
          {displayValue ? (
            <a
              href={displayValue}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-base lg:text-lg font-semibold text-blue-300 hover:underline flex items-center gap-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {iconPath}
              </svg>
              View
            </a>
          ) : (
            <p className="text-sm sm:text-base font-semibold text-gray-300 italic">Not set</p>
          )}
        </div>
      )}
    </div>
  );
}
