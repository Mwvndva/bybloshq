import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

type OrderStatus = 'success' | 'completed' | 'pending' | 'processing' | 'error' | 'failed' | 'declined';

interface PaymentStatusResponse {
  success: boolean;
  status: OrderStatus;
  message: string;
  updatedAt?: string;
}
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Clock, XCircle, ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from '@/components/ui/use-toast';

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [statusData, setStatusData] = useState({
    title: 'Processing Payment',
    description: 'Please wait while we process your payment...',
    icon: <Loader2 className="h-12 w-12 animate-spin text-blue-500" />,
    isError: false
  });

  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout>();

  const updateStatusUI = (status: string, message?: string | null) => {
    const normalizedStatus = status.toLowerCase();

    switch (normalizedStatus) {
      case 'success':
      case 'completed':
        setStatusData({
          title: 'Payment Successful!',
          description: message || 'Thank you for your purchase. Your order has been received and is being processed.',
          icon: <CheckCircle2 className="h-12 w-12 text-green-500" />,
          isError: false
        });
        // Update URL to reflect success status without page reload
        const newSearchParams = new URLSearchParams(window.location.search);
        newSearchParams.set('status', 'success');
        if (message) newSearchParams.set('message', message);
        window.history.replaceState({}, '', `${window.location.pathname}?${newSearchParams.toString()}`);


        // Automatically redirect to buyer dashboard after 3 seconds with countdown
        setRedirectCountdown(3);
        const countdownInterval = setInterval(() => {
          setRedirectCountdown(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownInterval);
              navigate('/buyer/dashboard', {
                state: { activeSection: 'orders' }
              });
              return null;
            }
            return prev - 1;
          });
        }, 1000);
        break;

      case 'pending':
      case 'processing':
        setStatusData({
          title: 'Payment Pending',
          description: message || 'Your payment is being processed. We\'ll notify you once it\'s completed.',
          icon: <Clock className="h-12 w-12 text-yellow-500" />,
          isError: false
        });
        break;

      case 'error':
      case 'failed':
      case 'declined':
        setStatusData({
          title: 'Payment Failed',
          description: message || 'There was an error processing your payment. Please try again.',
          icon: <XCircle className="h-12 w-12 text-red-500" />,
          isError: true
        });
        break;

      default:
        setStatusData({
          title: 'Payment Status',
          description: message || 'We\'re processing your payment. Please check back later for updates.',
          icon: <Loader2 className="h-12 w-12 animate-spin text-blue-500" />,
          isError: false
        });
    }
  };

  const checkPaymentStatus = async (reference: string) => {
    if (isCheckingStatus) return;

    try {
      setIsCheckingStatus(true);
      const response = await axios.get<PaymentStatusResponse>(`/api/orders/reference/${reference}`);
      const { status, message } = response.data;

      // Consider 'completed' as a success status
      if (status === 'success' || status === 'completed' || status === 'error') {
        // Stop polling when we get a final status
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = undefined;
        }
        updateStatusUI(status, message);
      }
      // If still pending, the UI will continue showing the pending state

      return response.data;
    } catch (error) {
      console.error('Error checking payment status:', error);
      toast({
        title: 'Error',
        description: 'Failed to check payment status. Please refresh the page to try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const startStatusPolling = (reference: string) => {
    // Clear any existing interval
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    // Initial check
    checkPaymentStatus(reference);

    // Set up polling every 10 seconds
    pollingInterval.current = setInterval(() => {
      checkPaymentStatus(reference);
    }, 10000);

    // Clean up interval on component unmount
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  };

  useEffect(() => {
    const status = searchParams.get('status');
    const reference = searchParams.get('reference');
    const message = searchParams.get('message');

    if (status) {
      setIsLoading(false);
      updateStatusUI(status, message);

      // If status is pending, start polling for updates
      if (status === 'pending' && reference) {
        startStatusPolling(reference);
      }
    } else {
      // No status in URL, redirect to home
      navigate('/');
    }
  }, [searchParams, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            {statusData.icon}
          </div>
          <CardTitle className="text-xl font-bold">
            {statusData.title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {statusData.description}
          </CardDescription>
          {searchParams.get('reference') && (
            <div className="mt-2 rounded-md bg-muted p-2 text-sm">
              Order Reference: {searchParams.get('reference')}
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          {searchParams.get('status') === 'error' && (
            <div className="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {searchParams.get('message') || 'An unexpected error occurred. Please try again later.'}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {(searchParams.get('status') === 'success' || searchParams.get('status') === 'completed') && redirectCountdown !== null && (
            <div className="w-full rounded-md bg-green-50 p-3 text-center text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Redirecting to your dashboard in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
            </div>
          )}
          <Button
            onClick={() => {
              // Navigate to buyer dashboard with orders tab active
              navigate('/buyer/dashboard', {
                state: { activeSection: 'orders' }
              });
            }}
            className="w-full"
            variant="outline"
          >
            <FileText className="mr-2 h-4 w-4" />
            View My Orders
          </Button>
          {searchParams.get('status') === 'error' && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(-1)}
            >
              Try Again
            </Button>
          )}

        </CardFooter>
      </Card>
    </div>
  );
}
