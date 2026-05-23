import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import apiClient from '@/lib/apiClient';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your payment...');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderReference, setOrderReference] = useState<string>('');

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get('reference');

      // FIX (Task 3): Strict reference validation to prevent probing and injection attacks
      const referenceRegex = /^[A-Za-z0-9_-]{8,64}$/;
      if (!reference || !referenceRegex.test(reference)) {
        setStatus('error');
        setMessage('Invalid payment reference format');
        return;
      }

      try {
        // NOTE: This call may fail with 401 if buyer is not authenticated.
        // That's OK — we handle it below using autoLoginToken.
        const response = await apiClient.get<any>(`/payments/status/${reference}`);
        const paymentData = response.data?.data || response.data;

        if (paymentData.status === 'completed' || paymentData.status === 'success') {
          setStatus('success');
          setMessage('Payment completed successfully!');
          setOrderReference(reference);

          // Handle auto-login if buyer isn't currently authenticated
          if (paymentData.autoLoginToken) {
            try {
              await apiClient.post('/buyers/auto-login', {
                autoLoginToken: paymentData.autoLoginToken
              });
              // Cookie is now set — show success modal then navigate to orders
            } catch (loginErr) {
              console.warn('[PAYMENT-SUCCESS] Auto-login failed:', loginErr);
              // Still show success UI but navigation will require manual login
            }
          }

          setTimeout(() => setShowSuccessModal(true), 800);
        } else if (paymentData.status === 'pending' || paymentData.status === 'processing') {
          // Payment is still being processed — redirect to checkout polling page
          navigate(`/checkout?status=pending&reference=${reference}`, { replace: true });
        } else {
          setStatus('error');
          setMessage('Payment failed or was cancelled');
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          // Buyer not authenticated — the payment may still have succeeded.
          // Redirect to checkout page which handles polling + auto-login properly.
          navigate(`/checkout?status=pending&reference=${reference}`, { replace: true });
          return;
        }
        console.error('[PaymentSuccess] Payment verification failed:', error);
        setStatus('error');
        setMessage(error.response?.data?.message || 'Failed to verify payment. Please contact support.');
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f2] relative px-4">
      <Card className="w-full max-w-md border border-stone-200 bg-white shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
        <CardHeader className="text-center">
          {status === 'loading' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-yellow-500" />}
          {status === 'success' && <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />}
          {status === 'error' && <XCircle className="mx-auto h-12 w-12 text-red-500" />}

          <CardTitle className="mt-4 text-xl font-semibold text-stone-950">
            {status === 'loading' && 'Processing Payment'}
            {status === 'success' && 'Payment Successful'}
            {status === 'error' && 'Payment Failed'}
          </CardTitle>

          <CardDescription className="text-stone-600">
            {message}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          {status === 'error' && (
            <p className="text-sm text-red-400">
              Please contact support if you believe this is an error.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Success Modal */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_24px_80px_rgba(17,17,17,0.18)]">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/buyer/orders', { replace: true });
              }}
              className="absolute top-4 right-4 p-2 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors z-10"
              aria-label="Close and view orders"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative p-8 sm:p-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-100 blur-2xl rounded-full" />
                  <CheckCircle className="relative h-20 w-20 text-emerald-500 animate-pulse" strokeWidth={2} />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-semibold text-stone-950">
                  Payment Successful!
                </h2>
                <p className="text-base sm:text-lg text-stone-600">
                  Your order has been placed.
                </p>
                {orderReference && (
                  <p className="text-sm text-stone-500 font-mono bg-stone-100 rounded-lg px-4 py-2 inline-block">
                    Order: {orderReference}
                  </p>
                )}
              </div>

              <div className="h-px bg-stone-200" />

              <div className="space-y-4">
                <p className="text-base text-stone-600">
                  You can track your order in your dashboard.
                </p>

                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/buyer/orders', { replace: true });
                  }}
                  className="group relative w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-lg rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    View My Orders
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
