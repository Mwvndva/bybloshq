
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, Lock, Loader2, Eye, EyeOff, ArrowLeft, Store, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { sellerApi, checkShopNameAvailability } from '@/api/sellerApi';

interface SellerRegistrationProps {
  onSuccess?: () => void;
}

const SellerRegistration = ({ onSuccess }: SellerRegistrationProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    shopName: '',
    email: '',
    phone: '',
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

  const validatePasswords = (password: string, confirmPassword: string): boolean => {
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
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
    const { name, value } = e.target;
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
          name === 'confirmPassword' ? value : formData.confirmPassword
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.fullName || !formData.shopName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword || !formData.city || !formData.location) {
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
      const { token } = await sellerApi.register({
        fullName: formData.fullName,
        shopName: formData.shopName.trim(),
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        city: formData.city,
        location: formData.location
      });
      
      // Store the token in localStorage
      localStorage.setItem('sellerToken', token);
      
      toast({
        title: "Registration Successful!",
        description: "Welcome to your seller dashboard!",
      });
      
      // Redirect to seller dashboard
      navigate('/seller/dashboard');
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Registration failed:', error);
      const errorMessage = error.response?.data?.message || 
                         (error instanceof Error ? error.message : 'An error occurred during registration');
      
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl px-3 py-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-black text-black">Seller Portal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Register Card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl flex items-center justify-center shadow-lg">
                <Store className="h-8 w-8 text-yellow-600" />
              </div>
              <h1 className="text-3xl font-black text-black mb-2">Create Account</h1>
              <p className="text-gray-600 font-medium">Join our seller community</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-bold text-black">
                  Full Name
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                    placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                    className="pl-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopName" className="text-sm font-bold text-black">
                  Shop Name
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Store className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="shopName"
                    name="shopName"
                    type="text"
                    placeholder="your-shop-name"
                    value={formData.shopName}
                    onChange={handleInputChange}
                    required
                    className="pl-12 pr-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  {isCheckingShopName && (
                    <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                  {!isCheckingShopName && formData.shopName && shopNameAvailable !== null && (
                    <span className={`absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${
                      shopNameAvailable ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                  )}
                </div>
                {formData.shopName && !isCheckingShopName && shopNameAvailable !== null && (
                  <p className={`text-sm font-medium ${
                    shopNameAvailable ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {shopNameAvailable ? 'Shop name is available!' : 'Shop name is already taken'}
                  </p>
                )}
                <p className="text-xs text-gray-500">This will be your shop's unique URL: byblos.com/shop/{formData.shopName || 'your-shop-name'}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold text-black">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                    placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                    className="pl-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-bold text-black">
                  Phone Number
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                    placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                    className="pl-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold text-black">City</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <Select
                    value={formData.city}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, city: value, location: '' }))}
                  >
                    <SelectTrigger className="pl-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400">
                      <SelectValue placeholder="Select your city" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nairobi">Nairobi</SelectItem>
                      <SelectItem value="Mombasa">Mombasa</SelectItem>
                      <SelectItem value="Kisumu">Kisumu</SelectItem>
                      <SelectItem value="Nakuru">Nakuru</SelectItem>
                      <SelectItem value="Eldoret">Eldoret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold text-black">Area/Location</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <Select
                    value={formData.location}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                    disabled={!formData.city}
                  >
                    <SelectTrigger className="pl-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400">
                      <SelectValue placeholder={formData.city ? 'Select your area' : 'Select city first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.city === 'Nairobi' ? ['CBD','Westlands','Kilimani','Karen','Runda'] :
                        formData.city === 'Mombasa' ? ['Nyali','Bamburi','Kisauni','Likoni'] :
                        formData.city === 'Kisumu' ? ['Milimani','Kondele','Nyalenda','Manyatta'] :
                        formData.city === 'Nakuru' ? ['Milimani','Kiamunyi','Lanet','Section 58'] :
                        formData.city === 'Eldoret' ? ['Kapsoya','Langas','Kimumu','Huruma'] :
                        []).map((area) => (
                          <SelectItem key={area} value={area}>{area}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-bold text-black">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password (min 8 characters)"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="pl-12 pr-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-bold text-black">
                  Confirm Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="pl-12 pr-12 h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700"
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
                  <p className="text-sm text-red-500 font-medium">{passwordError}</p>
                )}
            </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-bold text-lg transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : 'Create Account'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-600 font-medium">
                Already have an account?{' '}
                <Link 
                  to="/seller/login" 
                  className="font-bold text-yellow-600 hover:text-yellow-500 hover:underline"
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
