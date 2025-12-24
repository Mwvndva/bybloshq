import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your payment...');

  useEffect(() => {
    const reference = searchParams.get('reference');
    const status = searchParams.get('status') || 'success'; // Paystack uses 'success' for successful payments

    if (!reference) {
      setStatus('error');
      setMessage('Payment reference not found');
      return;
    }

    // Simulate payment verification (in real app, you'd verify with backend)
    setTimeout(() => {
      if (status === 'success') {
        setStatus('success');
        setMessage('Payment completed successfully!');

        // Redirect to buyer dashboard after 3 seconds
        setTimeout(() => {
          navigate('/buyer/dashboard', { replace: true });
        }, 3000);
      } else {
        setStatus('error');
        setMessage('Payment failed or was cancelled');
      }
    }, 2000);
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />}
          {status === 'success' && <CheckCircle className="mx-auto h-12 w-12 text-green-600" />}
          {status === 'error' && <XCircle className="mx-auto h-12 w-12 text-red-600" />}

          <CardTitle className="mt-4">
            {status === 'loading' && 'Processing Payment'}
            {status === 'success' && 'Payment Successful'}
            {status === 'error' && 'Payment Failed'}
          </CardTitle>

          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          {status === 'success' && (
            <p className="text-sm text-gray-600">
              You will be redirected to your orders page in a few seconds...
            </p>
          )}

          <Button
            onClick={() => navigate('/buyer/dashboard')}
            className="w-full"
            variant={status === 'success' ? 'outline' : 'default'}
          >
            {status === 'success' ? 'View My Orders' : 'Go to Dashboard'}
          </Button>

          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="w-full"
          >
            Continue Shopping
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
