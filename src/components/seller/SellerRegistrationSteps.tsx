import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Globe, Check, X, Eye, EyeOff } from 'lucide-react';
import ShopLocationPicker from './ShopLocationPicker';
import { checkPasswordStrength, locationData, type SellerRegistrationFormData } from './sellerRegistrationUtils';

interface SellerRegistrationStepsProps {
  currentStep: number;
  formData: SellerRegistrationFormData;
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setFormData: Dispatch<SetStateAction<SellerRegistrationFormData>>;
  shopNameAvailable: boolean | null;
  isCheckingShopName: boolean;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
  showConfirmPassword: boolean;
  setShowConfirmPassword: Dispatch<SetStateAction<boolean>>;
  passwordError: string;
  hasPhysicalShop: boolean | null;
  setHasPhysicalShop: Dispatch<SetStateAction<boolean | null>>;
  setCurrentStep: Dispatch<SetStateAction<number>>;
  termsAccepted: boolean;
  setTermsAccepted: Dispatch<SetStateAction<boolean>>;
  setIsTermsModalOpen: Dispatch<SetStateAction<boolean>>;
}

export const SellerRegistrationSteps = ({
  currentStep,
  formData,
  handleInputChange,
  setFormData,
  shopNameAvailable,
  isCheckingShopName,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  passwordError,
  hasPhysicalShop,
  setHasPhysicalShop,
  setCurrentStep,
  termsAccepted,
  setTermsAccepted,
  setIsTermsModalOpen,
}: SellerRegistrationStepsProps) => {
  return (
    <>
                {/* Step 1: Shop & Contact */}
                {currentStep === 1 && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <div className="space-y-0.5 sm:space-y-2">
                        <Label htmlFor="firstName" className="text-[10px] sm:text-sm font-medium text-gray-200">
                          First Name
                        </Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          type="text"
                          placeholder="First Name"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                          className="input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                        />
                      </div>

                      <div className="space-y-0.5 sm:space-y-2">
                        <Label htmlFor="lastName" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Last Name
                        </Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          type="text"
                          placeholder="Last Name"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className="input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                        />
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="shopName" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        Shop Name
                        {formData.shopName.length >= 3 && (
                          <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${shopNameAvailable ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {isCheckingShopName ? 'Checking...' : shopNameAvailable ? 'Available' : 'Taken'}
                          </span>
                        )}
                      </Label>
                      <Input
                        id="shopName"
                        name="shopName"
                        type="text"
                        placeholder="Unique shop name"
                        value={formData.shopName}
                        onChange={handleInputChange}
                        required
                        className={`input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base ${shopNameAvailable === false ? 'border-red-500' : ''}`}
                      />
                      <p className="text-[8px] sm:text-[10px] text-slate-500 dark:text-slate-400">Byblos.space/{formData.shopName.toLowerCase() || 'yourshop'}</p>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="email" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Your email address"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                      />
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="whatsappNumber" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        WhatsApp Number
                      </Label>
                      <Input
                        id="whatsappNumber"
                        name="whatsappNumber"
                        type="tel"
                        placeholder="07... or 01..."
                        value={formData.whatsappNumber}
                        onChange={handleInputChange}
                        required
                        className="input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                      />
                    </div>
                  </>
                )}

                {/* Step 2: Location */}
                {currentStep === 2 && (
                  <>
                    <div className="space-y-0.5 sm:space-y-2">
                      <Label className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">City</Label>
                      <Select
                        value={formData.city}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, city: value, location: '' }))}
                      >
                        <SelectTrigger className="!pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base">
                          <SelectValue placeholder="Nairobi" className="text-slate-400 dark:text-slate-400" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/20 text-slate-950 dark:text-white z-[110]">
                          <SelectItem value="Nairobi" className="text-slate-900 dark:text-white focus:bg-yellow-400 focus:text-black text-xs">
                            Nairobi
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">Area/Location</Label>
                      <Select
                        value={formData.location}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                        disabled={!formData.city}
                      >
                        <SelectTrigger className="!pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white focus:border-yellow-400 focus:ring-yellow-400 disabled:opacity-50 text-[10px] sm:text-base">
                          <SelectValue placeholder={formData.city ? 'Select your area' : 'Select city first'} className="text-slate-400 dark:text-slate-400" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/20 text-slate-950 dark:text-white z-[110]">
                          {formData.city && locationData[formData.city]?.sort((a, b) => a.localeCompare(b)).map((area) => (
                            <SelectItem key={area} value={area} className="text-slate-900 dark:text-white focus:bg-yellow-400 focus:text-black text-xs">{area}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Step 3: Shop Details */}
                {currentStep === 3 && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    {hasPhysicalShop === null ? (
                      <div className="space-y-6 py-4">
                        <div className="text-center space-y-2">
                          <h3 className="text-lg font-bold text-slate-950 dark:text-white">Do you have a physical shop?</h3>
                          <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                            Adding your shop location helps local customers find you easily.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Button
                            type="button"
                            onClick={() => {
                              setHasPhysicalShop(false);
                              setFormData(prev => ({ ...prev, physicalAddress: '', latitude: undefined, longitude: undefined }));
                              setCurrentStep(4); // Move directly to verification
                            }}
                            variant="ghost"
                            className="h-24 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all group active:scale-95 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 uppercase tracking-wider bg-slate-50 dark:bg-white/5"
                          >
                            <div className="flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Globe className="h-12 w-12 text-slate-500 dark:text-zinc-400 group-hover:text-slate-950 dark:group-hover:text-white" />
                            </div>
                            <span className="font-bold text-[10px] text-slate-600 dark:text-gray-400 group-hover:text-slate-950 dark:group-hover:text-white transition-colors">No, online only</span>
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setHasPhysicalShop(true)}
                            variant="ghost"
                            className="h-24 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all group active:scale-95 border border-slate-200 dark:border-white/10 hover:bg-yellow-400/10 hover:text-yellow-600 dark:hover:text-yellow-400 uppercase tracking-wider bg-slate-50 dark:bg-white/5"
                          >
                            <div className="flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Store className="h-12 w-12 text-yellow-500" />
                            </div>
                            <span className="font-bold text-[10px] text-slate-600 dark:text-gray-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">Yes, I have a physical shop</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in zoom-in-95 duration-300">
                        {hasPhysicalShop ? (
                          <>
                            <div className="flex items-center justify-between mb-2 p-2 bg-yellow-400/10 rounded-lg border border-yellow-500/20">
                              <div className="flex items-center gap-2">
                                <Store className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                <p className="text-[10px] sm:text-xs text-slate-800 dark:text-gray-300 font-medium">Pin your shop's specific location.</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setHasPhysicalShop(null)}
                                className="h-6 px-2 text-[10px] text-slate-500 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white"
                              >
                                Change
                              </Button>
                            </div>
                            <ShopLocationPicker
                              initialAddress={formData.physicalAddress}
                              initialCoordinates={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : null}
                              onLocationChange={(address, coords) => {
                                setFormData(prev => ({
                                  ...prev,
                                  physicalAddress: address,
                                  latitude: coords?.lat,
                                  longitude: coords?.lng
                                }));
                              }}
                            />
                          </>
                        ) : (
                          <div className="py-8 text-center space-y-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 animate-in slide-in-from-top-4 duration-500">
                            <div className="w-12 h-12 mx-auto bg-yellow-400/10 rounded-full flex items-center justify-center">
                              <Check className="h-6 w-6 text-yellow-500" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-slate-950 dark:text-white font-bold">Online-only Shop</p>
                              <p className="text-slate-600 dark:text-zinc-400 text-xs px-8 font-medium">You've selected that your shop only operates online. You can add a physical address later from your settings.</p>
                            </div>
                            <Button
                              type="button"
                              variant="link"
                              onClick={() => setHasPhysicalShop(null)}
                              className="text-yellow-600 dark:text-yellow-400 text-xs font-semibold"
                            >
                              Wait, I actually have a physical shop
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Security */}
                {currentStep === 4 && (
                  <>
                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="password" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          className="input-mobile !pl-4 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-2 sm:pr-4 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Password Strength Checklist */}
                    {formData.password && (
                      <div className="mt-2 p-3 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Password Requirements:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { label: "8+ chars", met: checkPasswordStrength(formData.password).minLength },
                            { label: "1 Number", met: checkPasswordStrength(formData.password).hasNumber },
                            { label: "1 Special", met: checkPasswordStrength(formData.password).hasSpecial },
                            { label: "Upper/Lower", met: checkPasswordStrength(formData.password).hasUpper && checkPasswordStrength(formData.password).hasLower },
                          ].map((req, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              {req.met ? (
                                <div className="bg-green-500/20 p-0.5 rounded-full">
                                  <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600 dark:text-green-400" />
                                </div>
                              ) : (
                                <div className="bg-slate-300 dark:bg-gray-700 p-0.5 rounded-full">
                                  <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-600 dark:text-gray-300" />
                                </div>
                              )}
                              <span className={`text-[10px] sm:text-xs ${req.met ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-slate-600 dark:text-gray-300'}`}>
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="confirmPassword" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          required
                          className="input-mobile !pl-4 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-2 sm:pr-4 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                          )}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-[10px] sm:text-sm text-red-500 dark:text-red-400 font-semibold">{passwordError}</p>
                      )}
                    </div>

                    <div className="pt-2">
                      <div className="flex items-start space-x-2 bg-gray-900/40 p-3 rounded-xl border border-gray-800">
                        <input
                          type="checkbox"
                          id="termsAccepted"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-800 text-yellow-500 focus:ring-yellow-500"
                        />
                        <Label htmlFor="termsAccepted" className="text-xs text-gray-400 leading-tight">
                          I agree to the{' '}
                          <button
                            type="button"
                            onClick={() => setIsTermsModalOpen(true)}
                            className="text-yellow-400 hover:text-yellow-300 font-medium underline underline-offset-2"
                          >
                            Terms & Conditions
                          </button>
                          {' '}and have read the Privacy Policy.
                        </Label>
                      </div>
                    </div>
                  </>
                )}
    </>
  );
};
