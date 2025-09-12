import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { sellerApi } from '@/api/sellerApi';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  // Verify token on component mount
  useEffect(() => {
    console.log('Token from URL:', token);
    
    if (!token) {
      console.error('No token found in URL');
      setIsValidToken(false);
      toast({
        title: 'Invalid Token',
        description: 'No reset token provided. Please use the link from your email.',
        variant: 'destructive',
      });
      return;
    }
    
    const verifyToken = async () => {
      try {
        // In a real app, you might want to verify the token with the server
        // For now, we'll just check if it exists and looks like a JWT
        const isJWT = token.split('.').length === 3;
        console.log('Token is JWT format:', isJWT);
        
        setIsValidToken(isJWT);
        
        if (!isJWT) {
          console.error('Invalid token format');
          toast({
            title: 'Invalid Token',
            description: 'The reset link is invalid. Please request a new one.',
            variant: 'destructive',
          });
        } else {
          console.log('Token is valid');
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        setIsValidToken(false);
        toast({
          title: 'Error',
          description: 'An error occurred while verifying your reset link.',
          variant: 'destructive',
        });
      }
    };
    
    verifyToken();
  }, [token, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Passwords do not match',
      });
      return;
    }
    
    if (password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 8 characters long',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      await sellerApi.resetPassword(token!, password);
      
      toast({
        title: 'Success',
        description: 'Your password has been reset successfully. You can now log in with your new password.',
      });
      
      // Redirect to login page after successful password reset
      navigate('/seller/login');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to reset password. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying your reset link...</p>
        </div>
      </div>
    );
  }
  
  if (!isValidToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Invalid or Expired Link</CardTitle>
            <CardDescription className="text-center">
              The password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please request a new password reset link below.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button 
              className="w-full" 
              onClick={() => navigate('/seller/forgot-password')}
            >
              Request New Reset Link
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/seller/login')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Reset Your Password</CardTitle>
          <CardDescription className="text-center">
            Please enter your new password below.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1} // Prevent focusing the button when toggling
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {showPassword ? 'Hide password' : 'Show password'}
                  </span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1} // Prevent focusing the button when toggling
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {showConfirmPassword ? 'Hide password' : 'Show password'}
                  </span>
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex justify-center">
          <Button 
            variant="ghost" 
            className="text-muted-foreground"
            onClick={() => navigate('/seller/login')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ResetPasswordPage;
