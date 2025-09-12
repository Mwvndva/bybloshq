import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Mail, User, Phone, Lock, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';

export function BuyerRegister() {
  const { toast } = useToast();
  const { register, isLoading } = useBuyerAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: 'destructive',
      });
      return;
    }

    if (!validatePasswords(formData.password, formData.confirmPassword)) {
      return;
    }

    try {
      await register({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      });
      
      // Registration success and navigation is handled by the auth context
    } catch (error) {
      // Error is already handled by the auth context
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
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-black text-black">Buyer Portal</span>
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
                <ShoppingBag className="h-8 w-8 text-yellow-600" />
              </div>
              <h1 className="text-3xl font-black text-black mb-2">Create Account</h1>
              <p className="text-gray-600 font-medium">Join our buyer community</p>
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
              to="/buyer/login" 
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
}
