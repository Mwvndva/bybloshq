import { Edit, Loader2, Trash2 } from 'lucide-react';
import ShopLocationPicker from '../../ShopLocationPicker';
import type { SellerSettingsFormData } from '../types';
import type { LocationCoordinates } from '@/lib/location';
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
}

export function SettingsLocationSection({ isEditing, toggleEdit, sellerProfile, handleDeleteLocation, isDeletingLocation, formData, handleCityChange, cities, handleLocationChange, getLocations, handleShopLocationChange, isSaving }: SettingsLocationSectionProps) {
  return (
      <section className="seller-card p-4 sm:p-5 lg:p-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeader title="Location Settings" description="Set where buyers collect orders from your physical shop." />
              {!isEditing && (
                <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-auto">
                  <button
                    onClick={toggleEdit}
                    className="text-xs sm:text-sm text-[var(--theme-accent,#f5c518)] hover:opacity-80 font-medium flex items-center justify-center gap-1"
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
              <p className="seller-label mb-2">Physical Shop Address</p>
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
                    <>
                      <p className="text-xs sm:text-sm lg:text-base font-semibold text-white">
                        {sellerProfile.physicalAddress}
                      </p>
                      <p className="text-xs text-white/40">
                        {sellerProfile.latitude && sellerProfile.longitude
                          ? `Coordinates: ${Number(sellerProfile.latitude).toFixed(6)}, ${Number(sellerProfile.longitude).toFixed(6)}`
                          : 'No map location pinned'}
                      </p>
                    </>
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
