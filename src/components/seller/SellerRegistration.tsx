
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, Lock, Loader2, Eye, EyeOff, ArrowLeft, Store, MapPin, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { sellerApi, checkShopNameAvailability } from '@/api/sellerApi';

interface SellerRegistrationProps {
  onSuccess?: () => void;
}

// Location data with Kenyan cities and their areas
const locationData: Record<string, string[]> = {
  'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka'],
  'Mombasa': ['Mombasa Island', 'Nyali', 'Bamburi', 'Kisauni', 'Changamwe', 'Likoni', 'Mtongwe', 'Tudor', 'Shanzu', 'Diani'],
  'Kisumu': ['Kisumu Central', 'Milimani', 'Mamboleo', 'Dunga', 'Kogony', 'Kakamega Road', 'Kibuye', 'Kondele', 'Manyatta', 'Nyalenda'],
  'Nakuru': ['Nakuru Town', 'Lanet', 'Kaptembwa', 'Shabab', 'Free Area', 'Section 58', 'Milimani', 'Kiamunyi', 'Kivumbini', 'Ponda Mali'],
  'Eldoret': ['Eldoret Town', 'Kapsoya', 'Langas', 'Huruma', 'Kipkaren', 'Kimumu', 'Chebaiywa', 'Kipkenyo', 'Kapsabet Road', 'Maili Nne'],
  'Thika': ['Thika Town', 'Makongeni', 'Kiganjo', 'Kangemi'],
  'Malindi': ['Malindi Town', 'Casuarina', 'Shella', 'Watamu', 'Kilifi', 'Mtwapa', 'Bamburi', 'Kikambala', 'Vipingo', 'Gede'],
  'Kitale': ['Kitale Town', 'Milimani', 'Kipsongol', 'Matunda', 'Kiminini', 'Sikhendu', 'Kachibora', 'Kapenguria', 'Endebess', 'Saboti'],
  'Garissa': ['Garissa Town', 'Bula Garissa', 'Iftin', 'Bulla Iftin', 'Bulla Punda', 'Bulla Mzuri', 'Bulla Mpya', 'Bulla Kuku', 'Bulla Ngombe', 'Bulla Mbwa'],
  'Kakamega': ['Kakamega Town', 'Shinyalu', 'Ikolomani', 'Lurambi', 'Matungu', 'Mumias', 'Butere', 'Khwisero', 'Malava', 'Navakholo'],
  'Meru': ['Meru Town', 'Makutano', 'Maua', 'Chuka', 'Chogoria', 'Nkubu', 'Kianjai', 'Mitunguu', 'Kithirune', 'Kiguchwa'],
  'Nyeri': ['Nyeri Town', 'Kiganjo', 'Karatina', 'Mathira', 'Othaya', 'Tetu', 'Mukurweini', 'Kieni', 'Mweiga', 'Chaka'],
  'Machakos': ['Machakos Town', 'Athi River', 'Syokimau', 'Tala', 'Kangundo', 'Matuu', 'Kathiani', 'Mavoko', 'Mwala', 'Yatta'],
  'Kericho': ['Kericho Town', 'Londiani', 'Kipkelion', 'Bureti', 'Belgut', 'Sigowet', 'Soin', 'Kipkelion East', 'Kipkelion West', 'Ainamoi'],
  'Kisii': ['Kisii Town', 'Nyamira', 'Bobasi', 'Bomachoge', 'Bomachoge Chache', 'Bonchari', 'Kitutu Chache', 'Kitutu Masaba', 'Nyaribari Chache', 'Nyaribari Masaba'],
  'Embu': ['Embu Town', 'Manyatta', 'Runyenjes', 'Siakago', 'Mbeere North', 'Mbeere South', 'Gachoka', 'Kithyoko', 'Kangaru', 'Mavuria'],
  'Narok': ['Narok Town', 'Kilgoris', 'Suswa', 'Ntulele', 'Mara', 'Loita', 'Oloitokitok', 'Sekenani', 'Ewaso Ngiro', 'Ololulunga'],
  'Kitui': ['Kitui Town', 'Mwingi', 'Mutomo', 'Ikutha', 'Kanyangi', 'Mutha', 'Mumoni', 'Mutonguni', 'Nzambani', 'Kyuso'],
  'Bungoma': ['Bungoma Town', 'Webuye', 'Kimilili', 'Tongaren', 'Kanduyi', 'Bumula', 'Kabuchai', 'Mt. Elgon', 'Sirisia', 'Cheptais'],
  'Busia': ['Busia Town', 'Bunyala', 'Samia', 'Teso North', 'Teso South', 'Nambale', 'Matayos']
};

import { useSellerAuth } from '@/contexts/GlobalAuthContext';

const SellerRegistration = ({ onSuccess }: SellerRegistrationProps) => {
  const navigate = useNavigate();
  const { register } = useSellerAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    shopName: '',
    email: '',
    whatsappNumber: '',
    password: '',
    confirmPassword: '',
    city: '',
    location: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingShopName, setIsCheckingShopName] = useState(false);
  const [shopNameAvailable, setShopNameAvailable] = useState<boolean | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();

  // Ensure body and html have black background and no margins/padding
  useEffect(() => {
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    document.body.style.cssText = 'margin: 0; padding: 0; background-color: #000000; overflow-x: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; background-color: #000000; overflow-x: hidden;';

    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
    };
  }, []);

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

  const validatePasswords = (password: string, confirmPassword: string, showToast = true): boolean => {
    if (password !== confirmPassword) {
      if (showToast) {
        setPasswordError('Passwords do not match');
        toast({
          title: "Validation Error",
          description: "Passwords do not match",
          variant: 'destructive',
        });
      }
      return false;
    }

    const strength = checkPasswordStrength(password);
    const unmetRequirements: string[] = [];

    if (!strength.minLength) unmetRequirements.push("at least 8 characters");
    if (!strength.hasNumber) unmetRequirements.push("a number");
    if (!strength.hasSpecial) unmetRequirements.push("a special character");
    if (!strength.hasUpper) unmetRequirements.push("an uppercase letter");
    if (!strength.hasLower) unmetRequirements.push("a lowercase letter");

    if (unmetRequirements.length > 0) {
      const errorMsg = `Password needs ${unmetRequirements.join(', ')}`;
      setPasswordError(errorMsg);
      if (showToast) {
        toast({
          title: "Weak Password",
          description: errorMsg,
          variant: 'destructive',
        });
      }
      return false;
    }

    setPasswordError('');
    return true;
  };

  // Check shop name availability when shopName changes
  useEffect(() => {
    const checkShopName = async () => {
      const trimmedShopName = formData.shopName.trim();

      if (!trimmedShopName) {
        setShopNameAvailable(null);
        return;
      }

      // Don't check if the shop name is too short
      if (trimmedShopName.length < 3) {
        setShopNameAvailable(null);
        return;
      }

      try {
        setIsCheckingShopName(true);
        const result = await checkShopNameAvailability(trimmedShopName);

        // Make sure we have a valid result before updating state
        if (result && typeof result.available === 'boolean') {
          setShopNameAvailable(result.available);
        } else {
          console.warn('Unexpected response format from server:', result);
          setShopNameAvailable(null);
        }
      } catch (error) {
        console.error('Error checking shop name:', error);
        setShopNameAvailable(false); // Default to not available on error
      } finally {
        setIsCheckingShopName(false);
      }
    };

    const timer = setTimeout(() => {
      checkShopName();
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.shopName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;

    // Disallow spaces in shop name
    if (name === 'shopName') {
      value = value.replace(/\s/g, '');
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear shop name availability when editing the field
    if (name === 'shopName') {
      setShopNameAvailable(null);
    }

    // Validate passwords when either field changes
    if (name === 'password' || name === 'confirmPassword') {
      if (formData.password && formData.confirmPassword) {
        validatePasswords(
          name === 'password' ? value : formData.password,
          name === 'confirmPassword' ? value : formData.confirmPassword,
          false // Don't show toast on every keystroke
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.fullName || !formData.shopName || !formData.email || !formData.whatsappNumber || !formData.password || !formData.confirmPassword || !formData.city || !formData.location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including location",
        variant: 'destructive',
      });
      return;
    }

    // Validate shop name is available
    if (shopNameAvailable === false) {
      toast({
        title: "Shop Name Unavailable",
        description: "The shop name you've chosen is already taken. Please choose another one.",
        variant: 'destructive',
      });
      return;
    }

    // Validate shop name is checked
    if (formData.shopName && shopNameAvailable === null) {
      toast({
        title: "Checking Shop Name",
        description: "Please wait while we check the availability of your shop name.",
        variant: 'default',
      });
      return;
    }

    // Validate passwords match
    if (!validatePasswords(formData.password, formData.confirmPassword)) {
      return;
    }

    setIsLoading(true);

    try {
      await register({
        fullName: formData.fullName,
        shopName: formData.shopName.trim(),
        email: formData.email,
        whatsappNumber: formData.whatsappNumber,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        city: formData.city,
        location: formData.location
      });

      // Token is handled via HttpOnly cookie, no need to store it manually

      toast({
        title: "Registration Successful!",
        description: "Welcome to your seller dashboard!",
      });

      // Redirect to shop setup
      navigate('/seller/shop-setup');

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Registration failed:', error);

      let errorMessage = 'An error occurred during registration';
      let errorTitle = 'Registration Failed';

      // Handle structured validation errors
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors) && error.response.data.errors.length > 0) {
        const firstError = error.response.data.errors[0];
        errorTitle = 'Validation Error';
        errorMessage = firstError.message;
      } else {
        errorMessage = error.response?.data?.message ||
          (error instanceof Error ? error.message : errorMessage);
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 w-full h-full bg-black overflow-y-auto"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        margin: 0,
        padding: 0,
        backgroundColor: '#000000',
        width: '100vw',
        minHeight: '100vh'
      }}
    >
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-3">
          <div className="flex justify-between items-center h-14">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl px-2 h-9 font-normal"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span className="text-xs sm:text-sm">Back</span>
            </Button>
            <div className="flex items-center space-x-1.5">
              <div className="w-7 h-7 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                <Store className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold text-white tracking-tight">Seller Portal</span>
            </div>
          </div>
        </div>
      </div>



      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] py-6 px-3">
        <div className="w-full max-w-[420px]">
          {/* Register Card */}
          <div
            className="rounded-2xl border border-white/10 shadow-2xl p-5 sm:p-6 bg-[rgba(17,17,17,0.7)] backdrop-blur-md"
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <Store className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-white mb-1">Create Account</h1>
              <p className="text-sm text-gray-400">Join our seller community</p>

              {/* Progress Indicator */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 1 ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-400'}`}>
                    1
                  </div>
                </div>
                <div className={`w-6 h-0.5 ${currentStep >= 2 ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 2 ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-400'}`}>
                    2
                  </div>
                </div>
                <div className={`w-6 h-0.5 ${currentStep >= 3 ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 3 ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-400'}`}>
                    3
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Personal Details */}
              {currentStep === 1 && (
                <>
                  <div className="space-y-0.5 sm:space-y-2">
                    <Label htmlFor="fullName" className="text-[10px] sm:text-sm font-medium text-gray-200">
                      Full Name
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                        <User className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                      </div>
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                        className="input-mobile !pl-8 sm:!pl-14 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5 sm:space-y-2">
                    <Label htmlFor="shopName" className="text-[10px] sm:text-sm font-medium text-gray-200">
                      Shop Name
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                        <Store className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                      </div>
                      <Input
                        id="shopName"
                        name="shopName"
                        type="text"
                        placeholder="your-shop-name"
                        value={formData.shopName}
                        onChange={handleInputChange}
                        required
                        className="input-mobile !pl-8 sm:!pl-14 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                      />
                      {isCheckingShopName && (
                        <Loader2 className="absolute right-2 sm:right-4 top-1/2 h-3.5 w-3.5 sm:h-5 sm:w-5 -translate-y-1/2 animate-spin text-gray-300" />
                      )}
                      {!isCheckingShopName && formData.shopName && shopNameAvailable !== null && (
                        <span className={`absolute right-2 sm:right-4 top-1/2 h-2.5 w-2.5 sm:h-3 sm:w-3 -translate-y-1/2 rounded-full ${shopNameAvailable ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                      )}
                    </div>
                    {formData.shopName && !isCheckingShopName && shopNameAvailable !== null && (
                      <p className={`text-[10px] sm:text-sm font-medium ${shopNameAvailable ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {shopNameAvailable ? 'Available!' : 'Taken'}
                      </p>
                    )}
                    <p className="text-[9px] sm:text-xs text-gray-300 hidden sm:block">This will be your shop's unique URL: byblos.com/shop/{formData.shopName || 'your-shop-name'}</p>
                  </div>

                  <div className="space-y-0.5 sm:space-y-2">
                    <Label htmlFor="email" className="text-[10px] sm:text-sm font-medium text-gray-200">
                      Email Address
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                        <Mail className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                      </div>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="input-mobile !pl-8 sm:!pl-14 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 h-8 sm:h-12 text-[10px] sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5 sm:space-y-2">
                    <Label htmlFor="whatsappNumber" className="text-[10px] sm:text-sm font-medium text-gray-200 flex items-center justify-between flex-wrap gap-2">
                      <span>WhatsApp Number</span>
                      <span className="text-[8px] sm:text-[10px] text-yellow-400 font-normal">For Order Notifications</span>
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                        <Phone className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                      </div>
                      <Input
                        id="whatsappNumber"
                        name="whatsappNumber"
                        type="tel"
                        placeholder="e.g. 0712345678"
                        value={formData.whatsappNumber}
                        onChange={handleInputChange}
                        required
                        className="input-mobile !pl-8 sm:!pl-14 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 h-8 sm:h-12 text-[10px] sm:text-base"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Location */}
              {currentStep === 2 && (
                <>
                  <div className="space-y-0.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-sm font-medium text-gray-200">City</Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none z-10">
                        <MapPin className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                      </div>
                      <Select
                        value={formData.city}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, city: value, location: '' }))}
                      >
                        <SelectTrigger className="pl-8 sm:pl-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base">
                          <SelectValue placeholder="Select your city" className="text-gray-300" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          {Object.keys(locationData).sort((a, b) => a.localeCompare(b)).map((city) => (
                            <SelectItem key={city} value={city} className="text-white hover:bg-gray-700 focus:bg-gray-700 text-xs">
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-0.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-sm font-medium text-gray-200">Area/Location</Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none z-10">
                        <MapPin className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                      </div>
                      <Select
                        value={formData.location}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                        disabled={!formData.city}
                      >
                        <SelectTrigger className="pl-8 sm:pl-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400 disabled:opacity-50 text-[10px] sm:text-base">
                          <SelectValue placeholder={formData.city ? 'Select your area' : 'Select city first'} className="text-gray-300" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          {formData.city && locationData[formData.city]?.sort((a, b) => a.localeCompare(b)).map((area) => (
                            <SelectItem key={area} value={area} className="text-white hover:bg-gray-700 focus:bg-gray-700 text-xs">{area}</SelectItem>
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
                    <Label htmlFor="password" className="text-[10px] sm:text-sm font-medium text-gray-200">
                      Password
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                        <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                      </div>
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className="input-mobile !pl-8 sm:!pl-14 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-2 sm:pr-4 flex items-center text-gray-300 hover:text-gray-300"
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
                    <div className="mt-2 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                      <p className="text-xs font-semibold text-gray-300 mb-2">Password Requirements:</p>
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
                                <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-400" />
                              </div>
                            ) : (
                              <div className="bg-gray-700 p-0.5 rounded-full">
                                <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-300" />
                              </div>
                            )}
                            <span className={`text-[10px] sm:text-xs ${req.met ? 'text-green-400 font-medium' : 'text-gray-300'}`}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-0.5 sm:space-y-2">
                    <Label htmlFor="confirmPassword" className="text-[10px] sm:text-sm font-medium text-gray-200">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 sm:pl-4 flex items-center pointer-events-none">
                        <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-300" />
                      </div>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        className="input-mobile !pl-8 sm:!pl-14 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-2 sm:pr-4 flex items-center text-gray-300 hover:text-gray-300"
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
                      <p className="text-[10px] sm:text-sm text-red-400 font-medium">{passwordError}</p>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-4">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1 bg-gray-700 text-white hover:bg-gray-600 rounded-xl h-11 font-medium tracking-tight transition-all duration-200 text-sm"
                  >
                    Back
                  </Button>
                )}
                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      // ... validation logic ...
                      if (currentStep === 1) {
                        if (!formData.fullName || !formData.shopName || !formData.email || !formData.whatsappNumber) {
                          toast({ title: "Missing Information", description: "Please fill in all details", variant: 'destructive' });
                          return;
                        }
                        if (shopNameAvailable === false) {
                          toast({ title: "Shop Name Unavailable", description: "Please choose another name", variant: 'destructive' });
                          return;
                        }
                      } else if (currentStep === 2) {
                        if (!formData.city || !formData.location) {
                          toast({ title: "Missing Information", description: "Please select your location", variant: 'destructive' });
                          return;
                        }
                      }
                      setCurrentStep(currentStep + 1);
                    }}
                    className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl h-11 font-semibold tracking-tight transition-all duration-200 text-sm"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl h-11 font-semibold tracking-tight transition-all duration-200 text-sm"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : 'Register'}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-3 sm:mt-5 text-center">
              <p className="text-gray-300 font-normal text-[10px] sm:text-base">
                Already have an account?{' '}
                <Link
                  to="/seller/login"
                  className="font-medium text-yellow-400 hover:text-yellow-300 hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerRegistration;
