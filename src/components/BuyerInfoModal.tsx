import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Mail, MapPin, Phone, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { locationData } from '@/lib/constants';

interface BuyerInfo {
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  city: string;
  location: string;
  password?: string;
  confirmPassword?: string;
}

interface BuyerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (buyerInfo: BuyerInfo) => Promise<void>;
  isLoading?: boolean;
  theme?: string;
  phoneNumber: string; // Pre-filled from first step
  initialData?: Partial<BuyerInfo>;
}

export function BuyerInfoModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  theme = 'default',
  phoneNumber,
  initialData
}: BuyerInfoModalProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    firstName: initialData?.fullName?.split(' ')[0] || '',
    lastName: initialData?.fullName?.split(' ').slice(1).join(' ') || '',
    email: initialData?.email || '',
    mobilePayment: initialData?.mobilePayment || phoneNumber || '',
    whatsappNumber: (initialData as any)?.whatsappNumber || phoneNumber || '',
    city: initialData?.city || 'Nairobi',
    location: initialData?.location || '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<Partial<BuyerInfo>>({});

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setBuyerInfo(prev => ({
        ...prev,
        ...initialData,
        firstName: initialData.fullName?.split(' ')[0] || prev.firstName,
        lastName: initialData.fullName?.split(' ').slice(1).join(' ') || prev.lastName,
        city: initialData.city || 'Nairobi'
      }) as BuyerInfo);
    }
  }, [initialData]);

  // Password strength checker function
  const checkPasswordStrength = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
    };
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<BuyerInfo> = {};

    if (!buyerInfo.firstName.trim()) {
      newErrors.firstName = 'First name is required' as any;
    }

    if (!buyerInfo.lastName.trim()) {
      newErrors.lastName = 'Last name is required' as any;
    }

    if (!buyerInfo.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Strict Password validation matching BuyerRegister
    const strength = checkPasswordStrength(buyerInfo.password || '');
    const unmetRequirements: string[] = [];

    if (!strength.minLength) unmetRequirements.push("at least 8 characters");
    if (!strength.hasNumber) unmetRequirements.push("a number");
    if (!strength.hasSpecial) unmetRequirements.push("a special character");
    if (!strength.hasUpper) unmetRequirements.push("an uppercase letter");
    if (!strength.hasLower) unmetRequirements.push("a lowercase letter");

    if (unmetRequirements.length > 0) {
      newErrors.password = `Password needs ${unmetRequirements.join(', ')}`;
    }

    if (buyerInfo.password !== buyerInfo.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!buyerInfo.whatsappNumber?.trim()) {
      newErrors.whatsappNumber = 'WhatsApp number is required' as any;
    }

    if (!buyerInfo.whatsappNumber?.trim()) {
      newErrors.whatsappNumber = 'WhatsApp number is required' as any;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        ...buyerInfo,
        fullName: `${buyerInfo.firstName} ${buyerInfo.lastName}`.trim()
      } as any);
      // Reset form on successful submission
      setBuyerInfo({
        firstName: '',
        lastName: '',
        email: '',
        mobilePayment: '',
        whatsappNumber: '',
        city: 'Nairobi',
        location: '',
        password: '',
        confirmPassword: ''
      });
      setErrors({});
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save buyer information',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setBuyerInfo({
        firstName: '',
        lastName: '',
        email: '',
        mobilePayment: '',
        whatsappNumber: '',
        city: 'Nairobi',
        location: '',
        password: '',
        confirmPassword: ''
      });
      setErrors({});
      onClose();
    }
  };

  const themeClasses = {
    bg: 'bg-[#0a0a0a] border border-white/10',
    text: 'text-white',
    input: 'bg-white/5 border-white/10 text-white placeholder:text-[#555555] focus-visible:ring-yellow-400',
    label: 'text-[#a1a1a1]',
    button: 'bg-yellow-400 hover:bg-yellow-500 text-black',
    error: 'text-red-500'
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`w-[95vw] max-w-[480px] max-h-[85vh] sm:max-h-[90vh] p-0 overflow-hidden ${themeClasses.bg} ${themeClasses.text} border-white/10 shadow-2xl rounded-3xl`}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh] sm:max-h-[90vh] w-full">
          <DialogHeader className="p-4 sm:p-6 lg:p-8 pb-3 shrink-0 space-y-4">
            <div className="mx-auto w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
              <User className="h-7 w-7 text-yellow-400" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-black text-center text-white">PAYMENT DETAILS</DialogTitle>
              <p className="text-[11px] text-center font-bold text-[#a1a1a1] uppercase tracking-wider opacity-80 leading-relaxed px-4">
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
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-[#555555]" />
                  </div>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="First Name"
                    value={buyerInfo.firstName}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, firstName: e.target.value }))}
                    className={`pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.firstName ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.firstName && (
                  <p className={`text-[10px] font-bold ${themeClasses.error}`}>{(errors as any).firstName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  Last Name *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-[#555555]" />
                  </div>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Last Name"
                    value={buyerInfo.lastName}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, lastName: e.target.value }))}
                    className={`pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.lastName ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.lastName && (
                  <p className={`text-[10px] font-bold ${themeClasses.error}`}>{(errors as any).lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                Email Address *
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[#555555]" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={buyerInfo.email}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, email: e.target.value }))}
                  className={`pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.email ? 'border-red-500' : ''}`}
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
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-[#555555]" />
                  </div>
                  <Input
                    id="mobilePayment"
                    type="tel"
                    placeholder="07..."
                    value={buyerInfo.mobilePayment}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, mobilePayment: e.target.value }))}
                    className={`pl-10 h-11 text-sm rounded-xl ${themeClasses.input}`}
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
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-[#555555]" />
                  </div>
                  <Input
                    id="whatsappNumber"
                    type="tel"
                    placeholder="07..."
                    value={buyerInfo.whatsappNumber}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                    className={`pl-10 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.whatsappNumber ? 'border-red-500' : ''}`}
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
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <MapPin className="h-4 w-4 text-[#555555]" />
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
                    <SelectTrigger className={`pl-10 h-11 text-sm rounded-xl ${themeClasses.input}`}>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                      <SelectItem value="Nairobi" className="text-white hover:bg-white/5 focus:bg-white/10">
                        Nairobi
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
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <MapPin className="h-4 w-4 text-[#555555]" />
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
                    <SelectTrigger className={`pl-10 h-11 text-sm rounded-xl ${themeClasses.input}`}>
                      <SelectValue placeholder={buyerInfo.city ? "Select area" : "City first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                      {buyerInfo.city && locationData[buyerInfo.city]?.map((area) => (
                        <SelectItem key={area} value={area} className="text-white hover:bg-white/5 focus:bg-white/10">
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
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#555555]" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={buyerInfo.password}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, password: e.target.value }))}
                  className={`pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.password ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white transition-colors"
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
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "8+ chars", met: checkPasswordStrength(buyerInfo.password).minLength },
                      { label: "Number", met: checkPasswordStrength(buyerInfo.password).hasNumber },
                      { label: "Special", met: checkPasswordStrength(buyerInfo.password).hasSpecial },
                      { label: "Case Mix", met: checkPasswordStrength(buyerInfo.password).hasUpper && checkPasswordStrength(buyerInfo.password).hasLower },
                    ].map((req, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className={`p-0.5 rounded-full ${req.met ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-[#555555]'}`}>
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                        <span className={`text-[10px] uppercase font-black ${req.met ? 'text-green-400' : 'text-[#555555]'}`}>
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
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#555555]" />
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  value={buyerInfo.confirmPassword}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={`pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white transition-colors"
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
          </div>

          <div className="p-4 sm:p-6 lg:p-8 pt-4 space-y-3 mt-auto border-t border-white/5 shrink-0 bg-white/2 backdrop-blur-sm">
            <Button
              type="submit"
              disabled={isLoading}
              variant="secondary-byblos"
              className="w-full h-12 rounded-xl font-black text-base shadow-lg transition-all active:scale-[0.98]"
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
              className="w-full h-10 text-sm font-bold text-[#a1a1a1] hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

