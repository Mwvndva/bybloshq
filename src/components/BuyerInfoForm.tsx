import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Mail, MapPin, Phone, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { locationData } from '@/lib/constants';
import type { BuyerInfo } from './BuyerInfoModal';

interface BuyerInfoFormProps {
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleClose: () => void;
  buyerInfo: BuyerInfo;
  setBuyerInfo: React.Dispatch<React.SetStateAction<BuyerInfo>>;
  errors: Partial<BuyerInfo & { termsAccepted?: string }>;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  showConfirmPassword: boolean;
  setShowConfirmPassword: React.Dispatch<React.SetStateAction<boolean>>;
  termsAccepted: boolean;
  setTermsAccepted: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTermsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  checkPasswordStrength: (password: string) => { minLength: boolean; hasNumber: boolean; hasSpecial: boolean; hasUpper: boolean; hasLower: boolean };
  themeClasses: Record<string, string>;
  isLoading: boolean;
}

export function BuyerInfoForm({
  handleSubmit,
  handleClose,
  buyerInfo,
  setBuyerInfo,
  errors,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  termsAccepted,
  setTermsAccepted,
  setIsTermsModalOpen,
  checkPasswordStrength,
  themeClasses,
  isLoading,
}: BuyerInfoFormProps) {
  return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85dvh] sm:max-h-[90dvh] w-full">
          <DialogHeader className="p-4 sm:p-6 lg:p-8 pb-3 shrink-0 space-y-4">
            <div className="mx-auto w-14 h-14 bg-yellow-50 border border-yellow-100 rounded-2xl flex items-center justify-center shadow-inner">
              <User className="h-7 w-7 text-yellow-400" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-black text-center text-white">PAYMENT DETAILS</DialogTitle>
              <p className="text-[11px] text-center font-bold text-white uppercase tracking-wider opacity-80 leading-relaxed px-4">
                Your payment details are safe and are only collected once
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-2 space-y-4 overscroll-contain"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent'
            }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  First Name *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="First Name"
                    value={buyerInfo.firstName}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, firstName: e.target.value }))}
                    className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.firstName ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.firstName && (
                  <p className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  Last Name *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Last Name"
                    value={buyerInfo.lastName}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, lastName: e.target.value }))}
                    className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.lastName ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.lastName && (
                  <p className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                Email Address *
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={buyerInfo.email}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, email: e.target.value }))}
                  className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.email ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.email}</p>
              )}
            </div>

            {/* Phone numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mobilePayment" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  M-Pesa *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="mobilePayment"
                    type="tel"
                    placeholder="07..."
                    value={buyerInfo.mobilePayment}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, mobilePayment: e.target.value }))}
                    className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input}`}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsappNumber" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  WhatsApp *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="whatsappNumber"
                    type="tel"
                    placeholder="07..."
                    value={buyerInfo.whatsappNumber}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                    className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.whatsappNumber ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
            </div>

            {/* City & Area in a grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  City *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <MapPin className="h-4 w-4 text-slate-400" />
                  </div>
                  <Select
                    value={buyerInfo.city}
                    onValueChange={(value) => {
                      setBuyerInfo(prev => ({
                        ...prev,
                        city: value,
                        location: '' // Reset location when city changes
                      }));
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input}`}>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/15 text-white">
                      <SelectItem value="Nairobi" className="text-white hover:bg-white/10 focus:bg-white/10">
                        Nairobi
                      </SelectItem>
                      <SelectItem value="Mombasa" className="text-white hover:bg-white/10 focus:bg-white/10">
                        Mombasa
                      </SelectItem>
                      <SelectItem value="Kisumu" className="text-white hover:bg-white/10 focus:bg-white/10">
                        Kisumu
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  Area *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <MapPin className="h-4 w-4 text-slate-400" />
                  </div>
                  <Select
                    value={buyerInfo.location}
                    onValueChange={(value) => {
                      setBuyerInfo(prev => ({
                        ...prev,
                        location: value
                      }));
                    }}
                    disabled={isLoading || !buyerInfo.city}
                  >
                    <SelectTrigger className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input}`}>
                      <SelectValue placeholder={buyerInfo.city ? "Select area" : "City first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/15 text-white">
                      {buyerInfo.city && [...(locationData[buyerInfo.city] || [])]
                        .sort((a, b) => a.localeCompare(b))
                        .map((area) => (
                          <SelectItem key={area} value={area} className="text-white hover:bg-white/10 focus:bg-white/10">
                            {area}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2 pt-2">
              <Label htmlFor="password" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                Set Password *
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={buyerInfo.password}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, password: e.target.value }))}
                  className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.password ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Password Strength Checklist */}
              {buyerInfo.password && (
                <div className="p-3 bg-white/5 rounded-xl border border-white/15">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "8+ chars", met: checkPasswordStrength(buyerInfo.password).minLength },
                      { label: "Number", met: checkPasswordStrength(buyerInfo.password).hasNumber },
                      { label: "Special", met: checkPasswordStrength(buyerInfo.password).hasSpecial },
                      { label: "Case Mix", met: checkPasswordStrength(buyerInfo.password).hasUpper && checkPasswordStrength(buyerInfo.password).hasLower },
                    ].map((req, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className={`p-0.5 rounded-full ${req.met ? 'bg-green-500/20 text-green-400' : 'bg-slate-50 text-slate-400'}`}>
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                        <span className={`text-[10px] uppercase font-black ${req.met ? 'text-green-400' : 'text-slate-400'}`}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errors.password && (
                <p className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5 pb-2">
              <Label htmlFor="confirmPassword" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                Verify Password *
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  value={buyerInfo.confirmPassword}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms and Conditions Checkout */}
            <div className="flex items-start gap-3 mt-4 px-1">
              <input
                type="checkbox"
                id="termsAccepted"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-200 bg-slate-50 text-yellow-400 focus:ring-yellow-400 accent-yellow-400"
              />
              <label htmlFor="termsAccepted" className="text-sm text-white cursor-pointer leading-relaxed">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="text-white underline font-medium hover:text-yellow-400 transition-colors"
                >
                  Terms and Conditions
                </button>
                {' '}and have read the Privacy Policy.
              </label>
            </div>
            {errors.termsAccepted && (
              <p className={`text-[10px] font-bold px-1 ${themeClasses.error}`}>{errors.termsAccepted}</p>
            )}
          </div>

          <div className="p-4 sm:p-6 lg:p-8 pt-4 space-y-3 mt-auto border-t border-white/15 shrink-0 bg-white/5 backdrop-blur-sm">
            <Button
              type="submit"
              disabled={isLoading || !termsAccepted}
              variant="secondary-byblos"
              className={`w-full h-12 rounded-xl font-black text-base shadow-lg transition-all active:scale-[0.98] ${!termsAccepted ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Saving Profile...
                </>
              ) : (
                'Save & Continue to Payment'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full h-10 text-sm font-bold text-white hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        </form>
  );
}
