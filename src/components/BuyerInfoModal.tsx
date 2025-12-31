import { useState } from 'react';
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
}

interface BuyerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (buyerInfo: BuyerInfo) => Promise<void>;
  isLoading?: boolean;
  theme?: string;
  phoneNumber: string; // Pre-filled from first step
}

export function BuyerInfoModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  theme = 'default',
  phoneNumber
}: BuyerInfoModalProps) {
  const { toast } = useToast();
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    fullName: '',
    email: '',
    city: '',
    location: ''
  });

  const [errors, setErrors] = useState<Partial<BuyerInfo>>({});

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
        location: ''
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
        location: ''
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
      <DialogContent className={`sm:max-w-md ${themeClasses.bg} ${themeClasses.text} border-0 shadow-2xl rounded-3xl`}>
        <DialogHeader>
          <DialogTitle className={`text-xl font-black text-center ${themeClasses.text} flex items-center justify-center gap-2 mb-1`}>
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <User className="h-4 w-4 text-yellow-600" />
            </div>
            Complete Your Info
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone Number - Read Only */}
          <div className="space-y-2">
            <Label htmlFor="phone" className={`text-sm font-medium ${themeClasses.label}`}>
              Phone Number
            </Label>
            <div className="relative">
              <Phone className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-60`} />
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                disabled
                className={`pl-10 bg-gray-100 ${theme === 'black' ? 'bg-gray-800' : ''} cursor-not-allowed opacity-75`}
              />
            </div>
            <p className={`text-xs ${themeClasses.text} opacity-60`}>Your registered phone number</p>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className={`text-xs font-semibold ${themeClasses.label}`}>
              Full Name *
            </Label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-40`} />
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={buyerInfo.fullName}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, fullName: e.target.value }))}
                className={`pl-10 h-10 rounded-xl text-base ${themeClasses.input} ${errors.fullName ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
            </div>
            {errors.fullName && (
              <p className={`text-xs ${themeClasses.error}`}>{errors.fullName}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className={`text-xs font-semibold ${themeClasses.label}`}>
              Email Address *
            </Label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-40`} />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={buyerInfo.email}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, email: e.target.value }))}
                className={`pl-10 h-10 rounded-xl text-base ${themeClasses.input} ${errors.email ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <p className={`text-xs ${themeClasses.error}`}>{errors.email}</p>
            )}
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city" className={`text-xs font-semibold ${themeClasses.label}`}>
              City
            </Label>
            <div className="relative">
              <MapPin className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-40`} />
              <Input
                id="city"
                type="text"
                placeholder="Enter your city (optional)"
                value={buyerInfo.city}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, city: e.target.value }))}
                className={`pl-10 h-10 rounded-xl text-base ${themeClasses.input}`}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className={`text-xs font-semibold ${themeClasses.label}`}>
              Location/Address
            </Label>
            <div className="relative">
              <MapPin className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-40`} />
              <Input
                id="location"
                type="text"
                placeholder="Enter your location (optional)"
                value={buyerInfo.location}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, location: e.target.value }))}
                className={`pl-10 h-10 rounded-xl text-base ${themeClasses.input}`}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-6">
            <Button
              type="submit"
              disabled={isLoading}
              className={`w-full h-10 rounded-xl font-bold text-sm transition-all ${themeClasses.button} ${isLoading ? 'opacity-70' : ''}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
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
              className="w-full rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
            >
              Cancel
            </Button>
          </div>
        </form>

        <p className={`text-xs ${themeClasses.text} opacity-70 text-center mt-4`}>
          Your information will be saved securely and used only for this purchase.
        </p>
      </DialogContent>
    </Dialog>
  );
}
