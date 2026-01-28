
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

import { useSellerAuth } from '@/contexts/SellerAuthContext';

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
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 h-auto sm:h-16 py-3 sm:py-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl px-3 py-2 font-normal w-fit self-start sm:self-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                <Store className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-semibold text-white tracking-tight">Seller Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-6 sm:py-8 md:py-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="w-[90%] sm:w-[95%] md:w-full md:max-w-md">
          {/* Register Card */}
          <div 
            className="rounded-2xl sm:rounded-3xl border shadow-2xl p-4 sm:p-5 md:p-6"
            style={{
              background: 'rgba(17, 17, 17, 0.7)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)'
            }}
          >
            <div className="text-center mb-5 sm:mb-6 md:mb-8">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                <Store className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
              </div>
              <h1 className="mobile-heading mb-1.5 sm:mb-2 font-semibold tracking-tight text-white">Create Account</h1>
              <p className="mobile-text text-gray-300 font-normal">Join our seller community</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium text-gray-200">
                  Full Name
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="input-mobile !pl-14 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopName" className="text-sm font-medium text-gray-200">
                  Shop Name
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Store className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="shopName"
                    name="shopName"
                    type="text"
                    placeholder="your-shop-name"
                    value={formData.shopName}
                    onChange={handleInputChange}
                    required
                    className="input-mobile !pl-14 !pr-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  {isCheckingShopName && (
                    <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-gray-300" />
                  )}
                  {!isCheckingShopName && formData.shopName && shopNameAvailable !== null && (
                    <span className={`absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${shopNameAvailable ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                  )}
                </div>
                {formData.shopName && !isCheckingShopName && shopNameAvailable !== null && (
                  <p className={`text-sm font-medium ${shopNameAvailable ? 'text-green-400' : 'text-red-400'
                    }`}>
                    {shopNameAvailable ? 'Shop name is available!' : 'Shop name is already taken'}
                  </p>
                )}
                <p className="text-xs text-gray-300">This will be your shop's unique URL: byblos.com/shop/{formData.shopName || 'your-shop-name'}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-200">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="input-mobile !pl-14 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappNumber" className="text-sm font-medium text-gray-200 flex items-center justify-between flex-wrap gap-2">
                  <span>WhatsApp Number</span>
                  <span className="text-[10px] text-yellow-400 font-normal">For Order Notifications</span>
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="whatsappNumber"
                    name="whatsappNumber"
                    type="tel"
                    placeholder="e.g. 0712345678"
                    value={formData.whatsappNumber}
                    onChange={handleInputChange}
                    required
                    className="input-mobile !pl-14 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-200">City</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <MapPin className="h-5 w-5 text-gray-300" />
                  </div>
                  <Select
                    value={formData.city}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, city: value, location: '' }))}
                  >
                    <SelectTrigger className="pl-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400">
                      <SelectValue placeholder="Select your city" className="text-gray-300" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      {Object.keys(locationData).sort((a, b) => a.localeCompare(b)).map((city) => (
                        <SelectItem key={city} value={city} className="text-white hover:bg-gray-700 focus:bg-gray-700">
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-200">Area/Location</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <MapPin className="h-5 w-5 text-gray-300" />
                  </div>
                  <Select
                    value={formData.location}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                    disabled={!formData.city}
                  >
                    <SelectTrigger className="pl-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400 disabled:opacity-50">
                      <SelectValue placeholder={formData.city ? 'Select your area' : 'Select city first'} className="text-gray-300" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      {formData.city && locationData[formData.city]?.sort((a, b) => a.localeCompare(b)).map((area) => (
                        <SelectItem key={area} value={area} className="text-white hover:bg-gray-700 focus:bg-gray-700">{area}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-200">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password (min 8 characters)"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="input-mobile !pl-14 !pr-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-300 hover:text-gray-300"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
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
                      { label: "At least 8 characters", met: checkPasswordStrength(formData.password).minLength },
                      { label: "At least one number", met: checkPasswordStrength(formData.password).hasNumber },
                      { label: "At least one special char", met: checkPasswordStrength(formData.password).hasSpecial },
                      { label: "Upper & lowercase letters", met: checkPasswordStrength(formData.password).hasUpper && checkPasswordStrength(formData.password).hasLower },
                    ].map((req, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        {req.met ? (
                          <div className="bg-green-500/20 p-0.5 rounded-full">
                            <Check className="h-3 w-3 text-green-400" />
                          </div>
                        ) : (
                          <div className="bg-gray-700 p-0.5 rounded-full">
                            <X className="h-3 w-3 text-gray-300" />
                          </div>
                        )}
                        <span className={`text-xs ${req.met ? 'text-green-400 font-medium' : 'text-gray-300'}`}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-200">
                  Confirm Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-300" />
                  </div>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="input-mobile !pl-14 !pr-12 h-12 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-300 hover:text-gray-300"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-sm text-red-400 font-medium">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="button-mobile w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-medium tracking-tight transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : 'Sign Up'}
              </Button>
            </form>

            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-gray-300 font-normal text-sm sm:text-base">
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
