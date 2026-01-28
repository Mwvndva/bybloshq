import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';

export function BuyerResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const { toast } = useToast();
    const { resetPassword, isLoading } = useBuyerAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
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

        // For buyer tokens, we'll check if it looks like a valid hex token (not JWT)
        const isValidHexToken = /^[a-f0-9]{64}$/.test(token);
        console.log('Token is valid hex format:', isValidHexToken);

        setIsValidToken(isValidHexToken);

        if (!isValidHexToken) {
            console.error('Invalid token format');
            toast({
                title: 'Invalid Token',
                description: 'Invalid reset token format. Please use the link from your email.',
                variant: 'destructive',
            });
        }
    }, [token, toast]);

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

        if (!token || !isValidToken) {
            toast({
                title: 'Invalid Token',
                description: 'Please use the reset link from your email.',
                variant: 'destructive',
            });
            return;
        }

        if (!formData.password || !formData.confirmPassword) {
            toast({
                title: 'Error',
                description: 'Please fill in all fields',
                variant: 'destructive',
            });
            return;
        }

        if (!validatePasswords(formData.password, formData.confirmPassword)) {
            return;
        }

        if (!token) {
            toast({
                title: 'Error',
                description: 'Invalid reset token',
                variant: 'destructive',
            });
            return;
        }

        try {
            await resetPassword(token, formData.password);
        } catch (error) {
            // Error is already handled by the auth context
        }
    };

    // Show loading state while validating token
    if (isValidToken === null) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardContent className="flex items-center justify-center py-8">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Validating reset token...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Show error state if token is invalid
    if (isValidToken === false) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-red-600">Invalid Reset Link</CardTitle>
                        <CardDescription>
                            This password reset link is invalid or has expired.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => navigate('/buyer/login')}
                            className="w-full"
                        >
                            Back to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Reset Password</CardTitle>
                    <CardDescription>
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className="pl-10 pr-10"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className="pl-10 pr-10"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                            {passwordError && (
                                <p className="text-sm text-red-500">{passwordError}</p>
                            )}
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Resetting...
                                </>
                            ) : (
                                'Reset Password'
                            )}
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm">
                        Remember your password?{' '}
                        <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => navigate('/buyer/login')}
                        >
                            Sign in
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
