import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import Link from 'next/link';

type QueryParams = {
  status?: string | string[];
  reference?: string | string[];
  message?: string | string[];
};

export default function CheckoutStatus() {
  const router = useRouter();
  const { status, reference, message } = router.query as unknown as QueryParams;
  const [isLoading, setIsLoading] = useState(true);
  const [statusData, setStatusData] = useState({
    title: 'Processing Payment',
    description: 'Please wait while we process your payment...',
    icon: <Loader2 className="h-12 w-12 animate-spin text-blue-500" />,
    isError: false
  });

  useEffect(() => {
    // Check if we have status in the URL
    const currentStatus = Array.isArray(status) ? status[0] : status || '';
    if (currentStatus) {
      setIsLoading(false);
      switch (currentStatus) {
        case 'success':
          setStatusData({
            title: 'Payment Successful!',
            description: 'Thank you for your purchase. Your order has been received and is being processed.',
            icon: <CheckCircle2 className="h-12 w-12 text-green-500" />,
            isError: false
          });
          break;
        case 'pending':
          setStatusData({
            title: 'Payment Pending',
            description: 'Your payment is being processed. We\'ll notify you once it\'s completed.',
            icon: <Clock className="h-12 w-12 text-yellow-500" />,
            isError: false
          });
          break;
        case 'error':
          const errorMessage = Array.isArray(message) ? message[0] : message;
          setStatusData({
            title: 'Payment Failed',
            description: errorMessage || 'There was an error processing your payment. Please try again.',
            icon: <XCircle className="h-12 w-12 text-red-500" />,
            isError: true
          });
          break;
        default:
          setStatusData({
            title: 'Payment Status',
            description: 'We\'re processing your payment. Please check back later for updates.',
            icon: <Loader2 className="h-12 w-12 animate-spin text-blue-500" />,
            isError: false
          });
      }
    }
  }, [status, message]);

  // Ensure we're working with string values
  const statusValue = Array.isArray(status) ? status[0] : status || '';
  const messageValue = Array.isArray(message) ? message[0] : message || '';
  const referenceValue = Array.isArray(reference) ? reference[0] : reference || '';

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
          <CardTitle className="text-2xl font-bold">
            {statusData.title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {statusValue === 'error' ? (messageValue || statusData.description) : statusData.description}
          </CardDescription>
          {referenceValue && (
            <div className="mt-2 rounded-md bg-muted p-2 text-sm">
              Order Reference: {referenceValue}
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          {statusValue === 'error' && (
            <div className="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {messageValue || 'An unexpected error occurred. Please try again later.'}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button asChild className="w-full">
            <Link href="/">
              Return to Home
            </Link>
          </Button>
          {statusValue === 'error' && (
            <Button variant="outline" className="w-full" onClick={() => router.back()}>
              Try Again
            </Button>
          )}
          {statusValue === 'success' && (
            <Button variant="outline" className="w-full" asChild>
              <Link href="/orders">
                View My Orders
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
