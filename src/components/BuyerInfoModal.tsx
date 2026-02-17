import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Mail, MapPin, Phone, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface BuyerInfo {
  fullName: string;
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
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    fullName: initialData?.fullName || '',
    email: initialData?.email || '',
    mobilePayment: initialData?.mobilePayment || phoneNumber || '',
    whatsappNumber: initialData?.whatsappNumber || phoneNumber || '',
    city: initialData?.city || '',
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
        ...initialData
      }));
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

    if (!buyerInfo.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(buyerInfo);
      // Reset form on successful submission
      setBuyerInfo({
        fullName: '',
        email: '',
        mobilePayment: '',
        whatsappNumber: '',
        city: '',
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
        fullName: '',
        email: '',
        mobilePayment: '',
        whatsappNumber: '',
        city: '',
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
            <DialogTitle className="text-2xl font-black text-center text-white">Create Account</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-2 space-y-4 overscroll-contain"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent'
            }}>
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                Full Name *
              </Label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#555555]`} />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={buyerInfo.fullName}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, fullName: e.target.value }))}
                  className={`pl-14 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.fullName ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
              </div>
              {errors.fullName && (
                <p className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                Email Address *
              </Label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#555555]`} />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={buyerInfo.email}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, email: e.target.value }))}
                  className={`pl-14 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.email ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.email}</p>
              )}
            </div>

            {/* Phone numbers row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mobilePayment" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  M-Pesa
                </Label>
                <Input
                  id="mobilePayment"
                  type="tel"
                  placeholder="07..."
                  value={buyerInfo.mobilePayment}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, mobilePayment: e.target.value }))}
                  className={`h-11 text-sm rounded-xl ${themeClasses.input}`}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsappNumber" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  WhatsApp
                </Label>
                <Input
                  id="whatsappNumber"
                  type="tel"
                  placeholder="07..."
                  value={buyerInfo.whatsappNumber}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  className={`h-11 text-sm rounded-xl ${themeClasses.input}`}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* City & Location in a row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  City
                </Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="e.g. Nairobi"
                  value={buyerInfo.city}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, city: e.target.value }))}
                  className={`h-11 text-sm rounded-xl ${themeClasses.input}`}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                  Area
                </Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="e.g. Kilimani"
                  value={buyerInfo.location}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, location: e.target.value }))}
                  className={`h-11 text-sm rounded-xl ${themeClasses.input}`}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2 pt-2">
              <Label htmlFor="password" className={`text-xs font-black uppercase tracking-wider ${themeClasses.label}`}>
                Set Password *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={buyerInfo.password}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, password: e.target.value }))}
                  className={`h-11 text-sm rounded-xl ${themeClasses.input} ${errors.password ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.882 9.882L5.146 5.147m13.71 13.71L14.12 14.121M21 12c-1.274 4.057-5.064 7-9.542 7-1.274 0-2.434-.216-3.492-.597m11.104-13.483c1.259 1.287 2.181 3.033 2.766 5.08" /></svg>
                  )}
                </button>
              </div>

              {/* Password Strength Checklist */}
              {buyerInfo.password && (
                <div className="mt-2 p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
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
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  value={buyerInfo.confirmPassword}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={`h-11 text-sm rounded-xl ${themeClasses.input} ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
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
