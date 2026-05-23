import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useGlobalAuth } from '@/contexts/GlobalAuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from '@/components/ui/card';
import { Loader2, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';
import axios from 'axios';
import { toast } from '@/components/ui/use-toast';

type OrderStatus = 'success' | 'completed' | 'pending' | 'processing' | 'error' | 'failed' | 'declined' | 'delivery_pending' | 'collection_pending' | 'service_pending';

interface PaymentStatusResponse {
  success: boolean;
  status: OrderStatus;
  message: string;
  updatedAt?: string;
  autoLoginToken?: string;   // ← returned when payment completes
}

interface StatusData {
  title: string;
  description: string;
  icon: React.ReactNode;
  isError: boolean;
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useGlobalAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalStatus, setIsFinalStatus] = useState(false);
  const [statusData, setStatusData] = useState<StatusData>({
    title: 'Processing Payment',
    description: 'Please wait while we process your payment...',
    icon: <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />,
    isError: false,
  });

  // Use a ref for the interval so cleanup always has the current value
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // FIX (Task 1 & 10): Using refs for guards and counts to avoid stale closures in React state
  const isCheckingRef = useRef(false);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 36; // 3 minutes at 5s intervals (or 6 mins at 10s)

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const updateStatusUI = useCallback((status: string, message?: string | null) => {
    const normalized = status.toLowerCase();
    const isSuccess = normalized === 'success' || normalized === 'completed' ||
      normalized === 'delivery_pending' || normalized === 'collection_pending' ||
      normalized === 'service_pending';

    if (isSuccess) {
      setIsFinalStatus(true);
      stopPolling();
      setStatusData({
        title: 'Payment Successful!',
        description: message || 'Your order has been received and is being processed.',
        icon: <CheckCircle2 className="h-12 w-12 text-green-500" />,
        isError: false,
      });
    } else if (normalized === 'pending' || normalized === 'processing') {
      setStatusData({
        title: 'Payment Pending',
        description: message || "Your payment is being processed. We'll notify you once complete.",
        icon: <Clock className="h-12 w-12 text-yellow-500" />,
        isError: false,
      });
    } else if (normalized === 'error' || normalized === 'failed' || normalized === 'declined') {
      setIsFinalStatus(true);
      stopPolling();
      setStatusData({
        title: 'Payment Failed',
        description: message || 'There was an error processing your payment. Please try again.',
        icon: <XCircle className="h-12 w-12 text-red-500" />,
        isError: true,
      });
    } else if (normalized === 'timeout') {
      setIsFinalStatus(true);
      stopPolling();
      setStatusData({
        title: 'Payment Verification Timeout',
        description: 'We haven\'t received confirmation yet. Please check your orders page in a few minutes.',
        icon: <Clock className="h-12 w-12 text-yellow-500" />,
        isError: true,
      });
    }
  }, [stopPolling]);

  // Handle auto-login when payment completes — calls the backend auto-login endpoint
  // which sets the HttpOnly jwt cookie and returns buyer profile
  const handleAutoLogin = useCallback(async (autoLoginToken: string) => {
    try {
      await axios.post(
        '/api/buyers/auto-login',
        { autoLoginToken },
        { withCredentials: true }
      );

      // FIX (Task 2): Never trust cookie set — must rehydrate auth context
      // This ensures the application state is consistent before navigation
      await loginWithToken(autoLoginToken, 'buyer');

      // Only navigate AFTER auth context confirms login
      navigate('/buyer/orders', { replace: true });
    } catch (err) {
      // Auto-login failed — navigate to buyer dashboard login instead
      console.warn('[CHECKOUT] Auto-login failed, redirecting to login:', err);
      navigate('/buyer/login', { replace: true });
    }
  }, [navigate, loginWithToken]);

  const checkPaymentStatus = useCallback(async (reference: string) => {
    // FIX (Task 1): Guard using isCheckingRef.current to prevent overlapping polling requests
    // caused by stale React state in intervals
    if (isCheckingRef.current) return;

    // Stop if we reached max polls
    if (pollCountRef.current >= MAX_POLLS) {
      updateStatusUI('timeout');
      return;
    }

    isCheckingRef.current = true;
    pollCountRef.current += 1;

    try {
      const response = await axios.get<{ data: PaymentStatusResponse }>(
        `/api/orders/reference/${reference}`,
        { withCredentials: true }
      );

      // Handle the nested data structure from the response
      const responseData = response.data.data || (response.data as any);
      const { status, message, autoLoginToken } = responseData as PaymentStatusResponse;

      const isFinal = ['success', 'completed', 'error', 'failed', 'declined', 'delivery_pending', 'collection_pending', 'service_pending'].includes(status);

      if (isFinal) {
        stopPolling();
        updateStatusUI(status, message);

        // If payment succeeded and we have an auto-login token, log the buyer in
        if ((status === 'success' || status === 'completed') && autoLoginToken) {
          await handleAutoLogin(autoLoginToken);
        }
      }
    } catch (error) {
      console.error('[CHECKOUT] Error checking payment status:', error);
      // We don't stop polling on single network error, unless it's a structural failure
    } finally {
      isCheckingRef.current = false;
    }
  }, [stopPolling, updateStatusUI, handleAutoLogin]);

  useEffect(() => {
    const status = searchParams.get('status');
    const reference = searchParams.get('reference');
    const message = searchParams.get('message');

    if (!status) {
      navigate('/', { replace: true });
      return;
    }

    setIsLoading(false);
    updateStatusUI(status, message);

    // Start polling for pending payments
    if ((status === 'pending' || status === 'processing') && reference) {
      // Initial check immediately
      checkPaymentStatus(reference);

      // Then poll every 10 seconds
      pollingIntervalRef.current = setInterval(() => {
        checkPaymentStatus(reference);
      }, 10_000);
    }

    // CRITICAL: Always clean up the interval on unmount
    return () => {
      stopPolling();
    };
  }, [searchParams, navigate, updateStatusUI, checkPaymentStatus, stopPolling]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7f2] px-4">
        <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white px-5 py-3 shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
          <span className="text-sm font-semibold text-stone-700">Checking payment...</span>
        </div>
      </div>
    );
  }

  const reference = searchParams.get('reference');

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center bg-[#f8f7f2] px-4 py-12">
      <Card className="w-full max-w-md border border-stone-200 bg-white shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">{statusData.icon}</div>
          <CardTitle className="text-xl font-bold">{statusData.title}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {statusData.description}
          </CardDescription>
          {reference && (
            <div className="mt-2 rounded-md bg-muted p-2 text-sm">
              Order Reference: {reference}
            </div>
          )}
        </CardHeader>

        <CardContent className="grid gap-4">
          {statusData.isError && (
            <div className="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {searchParams.get('message') || 'An unexpected error occurred. Please try again.'}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          {isFinalStatus && !statusData.isError && (
            <Button
              onClick={() => navigate('/buyer/orders', { replace: true })}
              className="w-full"
            >
              <FileText className="mr-2 h-4 w-4" />
              View My Orders
            </Button>
          )}
          {statusData.isError && (
            <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
              Try Again
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
