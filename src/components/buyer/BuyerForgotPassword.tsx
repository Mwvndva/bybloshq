import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';

export function BuyerForgotPassword() {
    const { toast } = useToast();
    const { forgotPassword, isLoading } = useBuyerAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast({
                title: 'Error',
                description: 'Please enter your email address',
                variant: 'destructive',
            });
            return;
        }

        try {
            await forgotPassword(email);
            navigate('/buyer/login', {
                state: {
                    message: 'If an account exists with this email, you will receive a password reset link.'
                }
            });
        } catch (error) {
            // Error is already handled by the auth context
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <Button
                        variant="ghost"
                        className="w-fit p-0 mb-4"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <CardTitle>Forgot Password</CardTitle>
                    <CardDescription>
                        Enter your email address and we'll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="your@email.com"
                                    className="pl-10"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                'Send Reset Link'
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
