import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGlobalAuth } from '@/contexts/GlobalAuthContext';
import apiClient from '@/lib/apiClient';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useGlobalAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your payment...');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderReference, setOrderReference] = useState<string>('');

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
          setOrderReference(reference);
          
          // Show success modal instead of auto-redirecting
          setTimeout(() => {
            setShowSuccessModal(true);
          }, 1000);
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
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000000] relative">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/95 backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-full max-w-lg mx-4 bg-[#000000] backdrop-blur-[20px] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            {/* Emerald Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
            
            {/* Close Button */}
            <button
              onClick={async () => {
                setShowSuccessModal(false);
                // Clear any existing session to ensure fresh login
                await logout();
                navigate('/buyer/login', {
                  state: { 
                    message: 'Payment successful! Please log in to view your order.',
                    paymentReference: orderReference
                  }
                });
              }}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
            >
              <X className="h-5 w-5 text-gray-300" />
            </button>

            <div className="relative p-8 sm:p-12 text-center space-y-6">
              {/* Emerald Checkmark */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
                  <CheckCircle className="relative h-20 w-20 text-emerald-500 animate-pulse" strokeWidth={2} />
                </div>
              </div>

              {/* Success Message */}
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  Payment Successful!
                </h2>
                <p className="text-base sm:text-lg text-gray-300">
                  Your order has been placed.
                </p>
                {orderReference && (
                  <p className="text-sm text-gray-400 font-mono bg-white/5 rounded-lg px-4 py-2 inline-block">
                    Order: {orderReference}
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

              {/* Login Instruction */}
              <div className="space-y-4">
                <p className="text-base text-gray-300">
                  Please log in to your buyer account to track this order.
                </p>

                {/* Go to Login Button */}
                <button
                  onClick={async () => {
                    // Clear any existing session to ensure fresh login
                    await logout();
                    navigate('/buyer/login', {
                      state: { 
                        message: 'Payment successful! Please log in to view your order.',
                        paymentReference: orderReference
                      }
                    });
                  }}
                  className="group relative w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-lg rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    Go to Login
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
