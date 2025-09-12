import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import adminApi from '@/api/adminApi';

export function AdminLogin() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!pin || pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }

    setIsLoading(true);
    console.log('Attempting login with PIN:', pin);
    
    try {
      // Call the admin login API
      const response = await adminApi.login(pin);
      console.log('Login response:', response);
      
      // Check if login was successful
      if (response?.status === 'success') {
        console.log('Login successful, navigating to dashboard');
        // Force a full page reload to ensure all auth state is properly initialized
        window.location.href = '/admin/dashboard';
      } else {
        const errorMsg = response?.message || 'Login failed. Please try again.';
        console.error('Login failed:', errorMsg);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('Login error:', {
        message: err.message,
        response: err.response?.data,
        stack: err.stack
      });
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
          <CardDescription>Enter your 6-digit PIN to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter 6-digit PIN"
                value={pin}
                onChange={(e) => {
                  // Only allow numbers and limit to 6 digits
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(value);
                  if (error) setError('');
                }}
                className="text-center text-xl tracking-widest h-12"
                autoComplete="off"
                disabled={isLoading}
              />
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            </div>
            <Button 
              type="submit" 
              className="w-full h-11" 
              disabled={isLoading || pin.length !== 6}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
