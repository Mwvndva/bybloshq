import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Mail, MapPin, Phone } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface BuyerInfo {
  fullName: string;
  email: string;
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
        city: '',
        location: '',
        password: '',
        confirmPassword: ''
      });
      setErrors({});
      onClose();
    }
  };

  const getThemeClasses = () => {
    switch (theme) {
      case 'black':
        return {
          bg: 'bg-gray-900/95',
          text: 'text-white',
          input: 'bg-gray-800 border-gray-700 text-white placeholder-gray-400',
          label: 'text-gray-200',
          button: 'bg-yellow-500 hover:bg-yellow-600 text-black',
          error: 'text-red-400'
        };
      case 'pink':
        return {
          bg: 'bg-pink-50/95',
          text: 'text-pink-900',
          input: 'bg-white border-pink-200 text-pink-900 placeholder-pink-400',
          label: 'text-pink-800',
          button: 'bg-pink-600 hover:bg-pink-700 text-white',
          error: 'text-pink-600'
        };
      case 'orange':
        return {
          bg: 'bg-orange-50/95',
          text: 'text-orange-900',
          input: 'bg-white border-orange-200 text-orange-900 placeholder-orange-400',
          label: 'text-orange-800',
          button: 'bg-orange-600 hover:bg-orange-700 text-white',
          error: 'text-orange-600'
        };
      case 'green':
        return {
          bg: 'bg-green-50/95',
          text: 'text-green-900',
          input: 'bg-white border-green-200 text-green-900 placeholder-green-400',
          label: 'text-green-800',
          button: 'bg-green-600 hover:bg-green-700 text-white',
          error: 'text-green-600'
        };
      case 'red':
        return {
          bg: 'bg-red-50/95',
          text: 'text-red-900',
          input: 'bg-white border-red-200 text-red-900 placeholder-red-400',
          label: 'text-red-800',
          button: 'bg-red-600 hover:bg-red-700 text-white',
          error: 'text-red-600'
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-50/95',
          text: 'text-yellow-900',
          input: 'bg-white border-yellow-200 text-yellow-900 placeholder-yellow-400',
          label: 'text-yellow-800',
          button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
          error: 'text-yellow-600'
        };
      default:
        return {
          bg: 'bg-white/95 backdrop-blur-md',
          text: 'text-gray-900',
          input: 'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400 focus-visible:ring-yellow-400',
          label: 'text-gray-700',
          button: 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg shadow-yellow-200',
          error: 'text-red-500'
        };
    }
  };

  const themeClasses = getThemeClasses();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`w-[95vw] max-w-[425px] max-h-[75dvh] p-0 overflow-hidden ${themeClasses.bg} ${themeClasses.text} border-0 shadow-xl rounded-2xl`}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full w-full">
          <DialogHeader className="p-3 pb-1 shrink-0">
            <DialogTitle className={`text-base font-black text-center ${themeClasses.text} flex items-center justify-center gap-1.5`}>
              <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
                <User className="h-3 w-3 text-yellow-600" />
              </div>
              Buyer Details
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5">
            {/* Phone Number - Read Only */}
            <div className="space-y-1">
              <Label htmlFor="phone" className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.label}`}>
                Phone Number
              </Label>
              <div className="relative">
                <Phone className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 ${themeClasses.text} opacity-60`} />
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  disabled
                  className={`pl-9 h-9 text-sm bg-gray-100 ${theme === 'black' ? 'bg-gray-800' : ''} cursor-not-allowed opacity-75 rounded-xl`}
                />
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <Label htmlFor="fullName" className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.label}`}>
                Full Name *
              </Label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 ${themeClasses.text} opacity-40`} />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={buyerInfo.fullName}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, fullName: e.target.value }))}
                  className={`pl-9 h-9 text-sm rounded-xl ${themeClasses.input} ${errors.fullName ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
              </div>
              {errors.fullName && (
                <p className={`text-[10px] ${themeClasses.error}`}>{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email" className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.label}`}>
                Email Address *
              </Label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 ${themeClasses.text} opacity-40`} />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={buyerInfo.email}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, email: e.target.value }))}
                  className={`pl-9 h-9 text-sm rounded-xl ${themeClasses.input} ${errors.email ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className={`text-[10px] ${themeClasses.error}`}>{errors.email}</p>
              )}
            </div>

            {/* City & Location in a row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="city" className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.label}`}>
                  City
                </Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="City"
                  value={buyerInfo.city}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, city: e.target.value }))}
                  className={`h-9 text-sm rounded-xl ${themeClasses.input}`}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="location" className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.label}`}>
                  Location
                </Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="Area"
                  value={buyerInfo.location}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, location: e.target.value }))}
                  className={`h-9 text-sm rounded-xl ${themeClasses.input}`}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Setup Notice */}
            <div className="rounded-xl bg-blue-50/50 p-2 border border-blue-100/50">
              <p className="text-[10px] leading-tight text-blue-700 font-medium">
                <span className="font-black">Security:</span> Setup your password once to secure your account for future logins.
              </p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className={`text-xs font-semibold ${themeClasses.label}`}>
                Setup Password *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={buyerInfo.password}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, password: e.target.value }))}
                  className={`h-9 text-sm rounded-xl ${themeClasses.input} ${errors.password ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.882 9.882L5.146 5.147m13.71 13.71L14.12 14.121M21 12c-1.274 4.057-5.064 7-9.542 7-1.274 0-2.434-.216-3.492-.597m11.104-13.483c1.259 1.287 2.181 3.033 2.766 5.08" /></svg>
                  )}
                </button>
              </div>

              {/* Password Strength Checklist */}
              {buyerInfo.password && (
                <div className="mt-1 p-1.5 bg-gray-50/50 rounded-lg border border-gray-100">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {[
                      { label: "8+ chars", met: checkPasswordStrength(buyerInfo.password).minLength },
                      { label: "Number", met: checkPasswordStrength(buyerInfo.password).hasNumber },
                      { label: "Special", met: checkPasswordStrength(buyerInfo.password).hasSpecial },
                      { label: "Case Mix", met: checkPasswordStrength(buyerInfo.password).hasUpper && checkPasswordStrength(buyerInfo.password).hasLower },
                    ].map((req, index) => (
                      <div key={index} className="flex items-center space-x-1">
                        <div className={`p-0.5 rounded-full ${req.met ? 'bg-green-100' : 'bg-gray-200'}`}>
                          {req.met ? (
                            <svg className="h-2 w-2 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          ) : (
                            <svg className="h-2 w-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          )}
                        </div>
                        <span className={`text-[9px] ${req.met ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errors.password && (
                <p className={`text-[10px] ${themeClasses.error}`}>{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.label}`}>
                Verify Password *
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  value={buyerInfo.confirmPassword}
                  onChange={(e) => setBuyerInfo(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={`h-9 text-sm rounded-xl ${themeClasses.input} ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && (
                <p className={`text-[10px] ${themeClasses.error}`}>{errors.confirmPassword}</p>
              )}
            </div>

            <p className={`text-[10px] ${themeClasses.text} opacity-70 text-center mt-1`}>
              Your information will be saved securely and used only for this purchase.
            </p>
          </div>

          <div className="p-3 space-y-2 mt-auto border-t shrink-0">
            <Button
              type="submit"
              disabled={isLoading}
              className={`w-full h-10 rounded-xl font-bold text-sm transition-all ${themeClasses.button} ${isLoading ? 'opacity-70' : ''}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Continue to Payment'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full h-8 text-xs font-semibold text-gray-500 hover:text-gray-900"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
