import { Edit, Loader2, Trash2 } from 'lucide-react';
import ShopLocationPicker from '@/shared/components/ShopLocationPicker';
import { Button } from '@/shared/ui/button';
import type { SellerSettingsFormData } from '../types';
import type { LocationCoordinates } from '@/infrastructure/location/location';
import { SectionHeader } from './settingsTab.parts';

interface SettingsLocationSectionProps {
  isEditing: boolean;
  toggleEdit: () => void;
  sellerProfile: import("@/features/auth/types/authTypes").SellerProfile;
  handleDeleteLocation: () => Promise<void>;
  isDeletingLocation: boolean;
  formData: SellerSettingsFormData;
  handleCityChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  cities: Record<string, string[]>;
  handleLocationChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  getLocations: () => string[];
  handleShopLocationChange: (address: string, coordinates: LocationCoordinates | null) => void;
  isSaving: boolean;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
}

export function SettingsLocationSection({
  isEditing,
  toggleEdit,
  sellerProfile,
  handleDeleteLocation,
  isDeletingLocation,
  formData,
  handleCityChange,
  cities,
  handleLocationChange,
  getLocations,
  handleShopLocationChange,
  isSaving,
  onSave,
  onCancel
}: SettingsLocationSectionProps) {
  const headerAction = isEditing ? (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onCancel || toggleEdit}
        disabled={isSaving}
        className="h-8 rounded-lg border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
      >
        Cancel
      </Button>
      {onSave && (
        <Button
          type="button"
          size="sm"
          onClick={onSave}
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
      )}
    </div>
  ) : (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={toggleEdit}
      className="h-8 gap-1.5 rounded-lg border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
    >
      <Edit className="h-3.5 w-3.5 text-yellow-400" />
      Edit Location
    </Button>
  );

  return (
    <section className="seller-card p-4 sm:p-5 lg:p-6">
      <div className="space-y-3 sm:space-y-4">
        <SectionHeader
          title="Location Settings"
          description="Set where buyers collect orders from your physical shop."
          action={headerAction}
        />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="seller-card-soft p-4">
                <p className="seller-label mb-2">City</p>
                {isEditing ? (
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleCityChange}
                    className="seller-field w-full p-2 sm:p-3 text-xs sm:text-sm lg:text-base rounded-lg sm:rounded-xl focus:ring-2"
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

              <div className="seller-card-soft p-4">
                <p className="seller-label mb-2">Location/Area</p>
                {isEditing ? (
                  <select
                    name="location"
                    value={formData.location}
                    onChange={handleLocationChange}
                    className="seller-field w-full p-2 sm:p-3 text-xs sm:text-sm lg:text-base rounded-lg sm:rounded-xl focus:ring-2"
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

            <div className="seller-card-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="seller-label">Physical Shop Address</p>
                {isEditing && (formData.physicalAddress || formData.latitude || formData.longitude) ? (
                  <button
                    type="button"
                    onClick={() => handleShopLocationChange('', null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                    title="Clear physical shop address"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear Address
                  </button>
                ) : null}
              </div>
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
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/15 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-xs sm:text-sm lg:text-base font-semibold text-white">
                          {sellerProfile.physicalAddress}
                        </p>
                        <p className="text-xs text-white/40">
                          {sellerProfile.latitude && sellerProfile.longitude
                            ? `Coordinates: ${Number(sellerProfile.latitude).toFixed(6)}, ${Number(sellerProfile.longitude).toFixed(6)}`
                            : 'No map location pinned'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteLocation}
                        disabled={isDeletingLocation || isSaving}
                        className="self-start sm:self-auto h-8 px-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-semibold gap-1.5 shrink-0"
                        title="Remove physical shop address"
                      >
                        {isDeletingLocation ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Remove Address
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm lg:text-base font-semibold text-white/40 italic">
                      No physical address set
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
      </section>
  );
}
