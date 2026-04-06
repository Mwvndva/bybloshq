import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sellerApi } from '@/api/sellerApi';
import { Loader2, ArrowLeft, Eye, EyeOff, Lock, Check, X, ShieldCheck } from 'lucide-react';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email') || '';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [passwordError, setPasswordError] = useState('');

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

  // Verify token on component mount
  useEffect(() => {
    if (!token) {
      setIsValidToken(false);
      toast({
        title: 'Invalid Token',
        description: 'No reset token provided. Please use the link from your email.',
        variant: 'destructive',
      });
      return;
    }

    // Basic format check for SHA-256 hex token
    const isValidHexToken = /^[a-f0-9]{64}$/.test(token);
    setIsValidToken(isValidHexToken);

    if (!isValidHexToken) {
      toast({
        title: 'Invalid Token',
        description: 'The reset link is malformed or invalid.',
        variant: 'destructive',
      });
    }
  }, [token, toast]);

  // Handle body background
  useEffect(() => {
    const originalBodyStyle = document.body.style.cssText;
    document.body.style.cssText = 'margin: 0; padding: 0; background-color: #000000; overflow-x: hidden;';
    return () => {
      document.body.style.cssText = originalBodyStyle;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswords(password, confirmPassword)) {
      return;
    }

    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Reset link is missing your email address. Please request a new reset link.',
      });
      return;
    }

    try {
      setIsLoading(true);
      await sellerApi.resetPassword(token!, password, email);

      toast({
        title: 'Success',
        description: 'Your password has been reset successfully.',
      });

      navigate('/seller/login');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to reset password.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <p className="text-gray-400">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-black">
        <div className="w-full max-w-md rounded-2xl border border-white/10 p-6 bg-[rgba(17,17,17,0.7)] backdrop-blur-md shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-3 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
              <Lock className="h-6 w-6 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-1">Invalid or Expired Link</h1>
            <p className="text-sm text-gray-400">The password reset link is invalid or has expired.</p>
          </div>
          <div className="space-y-3">
            <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-600 rounded-xl" onClick={() => navigate('/seller/forgot-password')}>
              Request New Reset Link
            </Button>
            <Button variant="ghost" className="w-full text-gray-400 hover:text-white" onClick={() => navigate('/seller/login')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const strength = checkPasswordStrength(password);

  return (
    <div className="min-h-screen w-full bg-black flex flex-col relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 h-20 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/seller/login')} className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">Security Center</h1>
          </div>
          <div className="w-20" /> {/* Spacer */}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl border border-white/10 shadow-2xl p-6 bg-[rgba(17,17,17,0.7)] backdrop-blur-md">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-white mb-1">Reset Password</h1>
              <p className="text-sm text-gray-400">Set a strong new password for your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New Password"
                    required
                    className="pl-11 pr-11 h-11 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                  />
                  <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              {password && (
                <div className="mt-2 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                  <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Security Requirements:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "8+ chars", met: strength.minLength },
                      { label: "1 Number", met: strength.hasNumber },
                      { label: "1 Special", met: strength.hasSpecial },
                      { label: "Upper/Lower", met: strength.hasUpper && strength.hasLower },
                    ].map((req, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        {req.met ? (
                          <div className="bg-green-500/20 p-0.5 rounded-full">
                            <Check className="h-2.5 w-2.5 text-green-400" />
                          </div>
                        ) : (
                          <div className="bg-gray-700 p-0.5 rounded-full">
                            <X className="h-2.5 w-2.5 text-gray-400" />
                          </div>
                        )}
                        <span className={`text-[10px] ${req.met ? 'text-green-400 font-medium' : 'text-gray-400'}`}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    required
                    className="pl-11 pr-11 h-11 rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                  />
                  <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {passwordError && <p className="text-[11px] text-red-500 font-medium px-1 leading-tight">{passwordError}</p>}

              <Button type="submit" disabled={isLoading} className="w-full h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 rounded-xl font-bold mt-4 shadow-lg transition-all duration-200">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : 'Update Password'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
