import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGlobalAuth } from '@/contexts/GlobalAuthContext';
import apiClient from '@/lib/apiClient';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken, refreshRole, role } = useGlobalAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your payment...');

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get('reference');
      const urlStatus = searchParams.get('status') || 'success';

      if (!reference) {
        setStatus('error');
        setMessage('Payment reference not found');
        return;
      }

      try {
        // Verify payment with backend
        const response = await apiClient.get(`/payments/status/${reference}`);
        const paymentData = response.data.data;

        if (paymentData.status === 'completed' || paymentData.status === 'success') {
          setStatus('success');
          setMessage('Payment completed successfully!');

          // Auto-login if token is provided
          if (paymentData.autoLoginToken) {
            try {
              await loginWithToken(paymentData.autoLoginToken, 'buyer');
              console.log('[PaymentSuccess] Auto-login successful');
              
              // Set flag for GlobalAuthContext to detect payment success flow
              sessionStorage.setItem('fromPaymentSuccess', 'true');
              
              // CROSS-ROLE FIX: If user is logged in as seller, refresh to buyer role
              if (role && role !== 'buyer') {
                console.log(`[PaymentSuccess] User is ${role}, switching to buyer role`);
                await refreshRole('buyer');
              }
              
              // FORCE NAVIGATION: Use window.location.href to bypass router guards
              // This forces a clean state reload and ensures the buyer dashboard loads properly
              console.log('[PaymentSuccess] Forcing hard navigation to buyer dashboard');
              setTimeout(() => {
                window.location.href = `/buyer/dashboard?tab=orders&ref=${reference}`;
              }, 1500);
            } catch (loginError) {
              console.error('[PaymentSuccess] Auto-login failed:', loginError);
              // Fallback: redirect to login with message
              setTimeout(() => {
                navigate('/buyer/login', {
                  state: { 
                    message: 'Payment successful! Please log in to view your order.',
                    from: '/buyer/dashboard',
                    paymentReference: reference
                  }
                });
              }, 2000);
            }
          } else {
            // No auto-login token, redirect to login
            setTimeout(() => {
              navigate('/buyer/login', {
                state: { 
                  message: 'Payment successful! Please log in to view your order.',
                  from: '/buyer/dashboard',
                  paymentReference: reference
                }
              });
            }, 2000);
          }
        } else {
          setStatus('error');
          setMessage('Payment failed or was cancelled');
        }
      } catch (error: any) {
        console.error('[PaymentSuccess] Payment verification failed:', error);
        setStatus('error');
        setMessage(error.response?.data?.message || 'Failed to verify payment. Please contact support.');
      }
    };

    verifyPayment();
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000000]">
      <Card className="w-full max-w-md bg-[rgba(20,20,20,0.7)] backdrop-blur-[12px] border border-white/10 shadow-xl">
        <CardHeader className="text-center">
          {status === 'loading' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-yellow-400" />}
          {status === 'success' && <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />}
          {status === 'error' && <XCircle className="mx-auto h-12 w-12 text-red-500" />}

          <CardTitle className="mt-4 text-xl font-bold text-white">
            {status === 'loading' && 'Processing Payment'}
            {status === 'success' && 'Payment Successful'}
            {status === 'error' && 'Payment Failed'}
          </CardTitle>

          <CardDescription className="text-zinc-300">
            {message}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          {status === 'success' && (
            <p className="text-sm text-zinc-400">
              Logging you in and redirecting to your orders...
            </p>
          )}

          {status === 'error' && (
            <>
              <Button
                onClick={() => navigate('/buyer/dashboard')}
                className="w-full bg-yellow-500 text-black font-bold hover:bg-yellow-600"
              >
                Go to Dashboard
              </Button>

              <Button
                onClick={() => navigate('/')}
                variant="ghost"
                className="w-full text-zinc-300 hover:bg-white/5"
              >
                Continue Shopping
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
