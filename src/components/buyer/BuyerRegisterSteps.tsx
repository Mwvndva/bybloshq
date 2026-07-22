import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Phone, MapPin, Lock, Eye, EyeOff, Check, X } from 'lucide-react';
import { locationData } from '@/lib/constants';
import { checkPasswordStrength, type BuyerRegisterFormData } from './buyerRegisterUtils';

interface BuyerRegisterStepsProps {
  currentStep: number;
  formData: BuyerRegisterFormData;
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setFormData: Dispatch<SetStateAction<BuyerRegisterFormData>>;
  errors: { [key: string]: string };
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
  showConfirmPassword: boolean;
  setShowConfirmPassword: Dispatch<SetStateAction<boolean>>;
  termsAccepted: boolean;
  setTermsAccepted: Dispatch<SetStateAction<boolean>>;
  setIsTermsModalOpen: Dispatch<SetStateAction<boolean>>;
}

export const BuyerRegisterSteps = ({
  currentStep,
  formData,
  handleInputChange,
  setFormData,
  errors,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  termsAccepted,
  setTermsAccepted,
  setIsTermsModalOpen,
}: BuyerRegisterStepsProps) => {
  return (
    <>
                {/* Step 1: Personal Details */}
                {currentStep === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5 sm:space-y-2">
                        <Label htmlFor="firstName" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                          First Name
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                            <User className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                          </div>
                          <Input
                            id="firstName"
                            name="firstName"
                            type="text"
                            placeholder="First Name"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            required
                            className={`input-mobile !pl-8 sm:!pl-14 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-sm ${errors.firstName ? 'border-red-500' : ''}`}
                          />
                        </div>
                        {errors.firstName && <p className="text-[10px] sm:text-sm text-red-500 mt-0.5 sm:mt-1 ml-1 font-medium">{errors.firstName}</p>}
                      </div>

                      <div className="space-y-0.5 sm:space-y-2">
                        <Label htmlFor="lastName" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Last Name
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                            <User className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                          </div>
                          <Input
                            id="lastName"
                            name="lastName"
                            type="text"
                            placeholder="Last Name"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            required
                            className={`input-mobile !pl-8 sm:!pl-14 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-sm ${errors.lastName ? 'border-red-500' : ''}`}
                          />
                        </div>
                        {errors.lastName && <p className="text-[10px] sm:text-sm text-red-500 mt-0.5 sm:mt-1 ml-1 font-medium">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="email" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Email Address
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Mail className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="Enter your email"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          className={`input-mobile !pl-8 sm:!pl-14 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-sm ${errors.email ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.email && <p className="text-[10px] sm:text-sm text-red-500 mt-0.5 sm:mt-1 ml-1 font-medium">{errors.email}</p>}
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="mobilePayment" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        Mobile Payment (M-Pesa)
                        <span className="text-[8px] sm:text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold">For STK Push & Refunds</span>
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Phone className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <Input
                          id="mobilePayment"
                          name="mobilePayment"
                          type="tel"
                          placeholder="e.g. 0712345678"
                          value={formData.mobilePayment}
                          onChange={handleInputChange}
                          required
                          className={`input-mobile !pl-8 sm:!pl-14 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-sm ${errors.mobilePayment ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.mobilePayment && <p className="text-[10px] sm:text-sm text-red-500 mt-0.5 sm:mt-1 ml-1 font-medium">{errors.mobilePayment}</p>}
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="whatsappNumber" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        WhatsApp Number
                        <span className="text-[8px] sm:text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold">For Order Updates</span>
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Phone className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <Input
                          id="whatsappNumber"
                          name="whatsappNumber"
                          type="tel"
                          placeholder="e.g. 0712345678"
                          value={formData.whatsappNumber}
                          onChange={handleInputChange}
                          required
                          className={`input-mobile !pl-8 sm:!pl-14 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-sm ${errors.whatsappNumber ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.whatsappNumber && <p className="text-[10px] sm:text-sm text-red-500 mt-0.5 sm:mt-1 ml-1 font-medium">{errors.whatsappNumber}</p>}
                    </div>
                  </>
                )}

                {/* Step 2: Location */}
                {currentStep === 2 && (
                  <>
                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="city" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        City
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none z-10">
                          <MapPin className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <Select
                          value={formData.city}
                          onValueChange={(value) => {
                            setFormData(prev => ({
                              ...prev,
                              city: value,
                              location: '' // Reset location when city changes
                            }));
                          }}
                        >
                          <SelectTrigger className="!pl-8 sm:!pl-14 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-sm">
                            <SelectValue placeholder="Nairobi" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/20 text-slate-950 dark:text-white z-[110]">
                            <SelectItem value="Nairobi" className="text-slate-900 dark:text-white focus:bg-yellow-400 focus:text-black text-xs">
                              Nairobi
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="location" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Area/Location
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none z-10">
                          <MapPin className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <Select
                          value={formData.location}
                          onValueChange={(value) => {
                            setFormData(prev => ({
                              ...prev,
                              location: value
                            }));
                          }}
                          disabled={!formData.city}
                        >
                          <SelectTrigger className="!pl-8 sm:!pl-14 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white focus:border-yellow-400 focus:ring-yellow-400 disabled:opacity-50 text-[10px] sm:text-sm">
                            <SelectValue placeholder={formData.city ? "Select your area" : "Select city first"} />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/20 text-slate-950 dark:text-white z-[110]">
                            {formData.city && locationData[formData.city]?.map((area) => (
                              <SelectItem key={area} value={area} className="text-slate-900 dark:text-white focus:bg-yellow-400 focus:text-black text-xs">
                                {area}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 3: Security */}
                {currentStep === 3 && (
                  <>
                    <div className="space-y-0.5 sm:space-y-2">
                      <Label htmlFor="password" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Password
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password (min 8 characters)"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          className={`input-mobile !pl-8 sm:!pl-14 !pr-8 sm:!pr-12 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-sm ${errors.password ? 'border-red-500' : ''}`}
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
                      <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Password Requirements:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { label: "At least 8 characters", met: checkPasswordStrength(formData.password).minLength },
                            { label: "At least one number", met: checkPasswordStrength(formData.password).hasNumber },
                            { label: "At least one special char", met: checkPasswordStrength(formData.password).hasSpecial },
                            { label: "Upper & lowercase letters", met: checkPasswordStrength(formData.password).hasUpper && checkPasswordStrength(formData.password).hasLower },
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
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                          <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          required
                          className={`input-mobile !pl-8 sm:!pl-14 !pr-8 sm:!pr-12 h-8 sm:h-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-sm ${errors.confirmPassword ? 'border-red-500' : ''}`}
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
                      {errors.confirmPassword && <p className="text-[10px] sm:text-sm text-red-500 mt-0.5 sm:mt-1 ml-1 font-medium">{errors.confirmPassword}</p>}
                    </div>

                    <div className="pt-2">
                      <div className="flex items-start space-x-2 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                        <input
                          type="checkbox"
                          id="termsAccepted"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-0.5 rounded accent-yellow-400 cursor-pointer"
                        />
                        <Label htmlFor="termsAccepted" className="text-[10px] sm:text-xs text-slate-600 dark:text-gray-300 font-medium cursor-pointer">
                          I agree to the{' '}
                          <button
                            type="button"
                            onClick={() => setIsTermsModalOpen(true)}
                            className="text-yellow-600 dark:text-yellow-400 hover:underline font-semibold"
                          >
                            Terms & Conditions
                          </button>
                        </Label>
                      </div>
                    </div>
                  </>
                )}
              </>
  );
};
