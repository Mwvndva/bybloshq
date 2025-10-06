import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Phone, Mail, MapPin } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface BuyerInfo {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  location: string;
}

interface BuyerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (buyerInfo: BuyerInfo) => Promise<void>;
  isLoading?: boolean;
  theme?: string;
}

export function BuyerInfoModal({ isOpen, onClose, onSubmit, isLoading = false, theme = 'default' }: BuyerInfoModalProps) {
  const { toast } = useToast();
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    fullName: '',
    email: '',
    phone: '',
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

    if (!buyerInfo.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^(\+254|254|0)[17]\d{8}$/.test(buyerInfo.phone.replace(/[\s-]/g, ''))) {
      newErrors.phone = 'Please enter a valid Kenyan phone number';
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
        phone: '',
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
        phone: '',
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
          bg: 'bg-white/95',
          text: 'text-gray-900',
          input: 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400',
          label: 'text-gray-700',
          button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
          error: 'text-red-600'
        };
    }
  };

  const themeClasses = getThemeClasses();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`sm:max-w-md ${themeClasses.bg} ${themeClasses.text} border-0 shadow-2xl`}>
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${themeClasses.text} flex items-center gap-2`}>
            <User className={`h-5 w-5 ${themeClasses.text}`} />
            Buyer Information
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className={`text-sm font-medium ${themeClasses.label}`}>
              Full Name *
            </Label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-60`} />
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={buyerInfo.fullName}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, fullName: e.target.value }))}
                className={`pl-10 ${themeClasses.input} ${errors.fullName ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
            </div>
            {errors.fullName && (
              <p className={`text-xs ${themeClasses.error}`}>{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className={`text-sm font-medium ${themeClasses.label}`}>
              Email Address *
            </Label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-60`} />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={buyerInfo.email}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, email: e.target.value }))}
                className={`pl-10 ${themeClasses.input} ${errors.email ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <p className={`text-xs ${themeClasses.error}`}>{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className={`text-sm font-medium ${themeClasses.label}`}>
              Phone Number *
            </Label>
            <div className="relative">
              <Phone className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-60`} />
              <Input
                id="phone"
                type="tel"
                placeholder="0712345678 or +254712345678"
                value={buyerInfo.phone}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, phone: e.target.value }))}
                className={`pl-10 ${themeClasses.input} ${errors.phone ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
            </div>
            {errors.phone && (
              <p className={`text-xs ${themeClasses.error}`}>{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city" className={`text-sm font-medium ${themeClasses.label}`}>
              City
            </Label>
            <div className="relative">
              <MapPin className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-60`} />
              <Input
                id="city"
                type="text"
                placeholder="Enter your city (optional)"
                value={buyerInfo.city}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, city: e.target.value }))}
                className={`pl-10 ${themeClasses.input}`}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className={`text-sm font-medium ${themeClasses.label}`}>
              Location/Address
            </Label>
            <div className="relative">
              <MapPin className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${themeClasses.text} opacity-60`} />
              <Input
                id="location"
                type="text"
                placeholder="Enter your location/address (optional)"
                value={buyerInfo.location}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, location: e.target.value }))}
                className={`pl-10 ${themeClasses.input}`}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className={`flex-1 ${themeClasses.text} border-gray-300 hover:bg-gray-50`}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className={`flex-1 ${themeClasses.button} ${isLoading ? 'opacity-70' : ''}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Continue to Payment'
              )}
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
