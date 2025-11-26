import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Minus, Plus, Loader2, CreditCard, Tag, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiRequest } from '@/lib/axios';
import { validatePromoCode, calculateDiscount, type PromoCode } from '@/api/promoCodeApi';
import { Badge } from '@/components/ui/badge';

type PurchaseFormData = {
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
  ticketTypeId: string;
  quantity: number;
  paymentMethod: 'mpesa' | 'card' | 'bank';
  amount: number;
  eventId: number;
};

type EventTicketType = {
  id: number;
  name: string;
  price: number;
  max_per_order?: number;
  min_per_order?: number;
  sold?: number;
  available?: number;
  is_sold_out?: boolean;
  quantity_available?: number;
};

type PaymentStatusData = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  timestamp?: string;
  [key: string]: unknown;
};

type FailureDetails = {
  failed_reason?: string;
  failed_code?: string;
  failed_code_link?: string;
};

type PaymentStatusResponse = {
  status?: string;
  data?: PaymentStatusData;
  invoice_id?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
};

type PaymentInitiationResponse = {
  success: boolean;
  message: string;
  invoiceId: string;
  paymentUrl?: string;
  reference?: string;
  [key: string]: string | boolean | undefined;
};

interface TicketPurchaseFormProps {
  event: {
    id: number;
    name: string;
    ticketTypes?: EventTicketType[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: Omit<PurchaseFormData, 'ticketTypeId'> & { ticketTypeId: number | null }) => Promise<void>;
}

// Type definitions moved to the top of the file

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[17]\d{8}$/;
  return phoneRegex.test(phone);
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

export function TicketPurchaseForm({ 
  event, 
  open, 
  onOpenChange,
  onSubmit,
}: TicketPurchaseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<{reference?: string; email?: string}>({});
  const [formData, setFormData] = useState<PurchaseFormData>(() => ({
    customerName: '',
    customerEmail: '',
    phoneNumber: '',
    ticketTypeId: '',
    quantity: 1,
    paymentMethod: 'mpesa',
    amount: 0,
    eventId: event.id
  }));
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [validatedPromoCode, setValidatedPromoCode] = useState<PromoCode | null>(null);
  const [validatingPromoCode, setValidatingPromoCode] = useState(false);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const ticketTypes = event.ticketTypes || [];
  const selectedTicket = ticketTypes.find(t => t.id.toString() === formData.ticketTypeId) || null;
  const baseTotalPrice = selectedTicket ? selectedTicket.price * formData.quantity : 0;
  
  // Calculate discount and final price
  const discountAmount = validatedPromoCode 
    ? calculateDiscount(validatedPromoCode, baseTotalPrice)
    : 0;
  const totalPrice = Math.max(0, baseTotalPrice - discountAmount);
  
  // Update formData with calculated amount when ticket or quantity changes
  useEffect(() => {
    if (selectedTicket) {
      setFormData(prev => ({
        ...prev,
        amount: totalPrice // Use final price after discount
      }));
    }
  }, [selectedTicket, formData.quantity, totalPrice]);
  
  // Re-validate promo code when total price changes
  useEffect(() => {
    if (validatedPromoCode && baseTotalPrice > 0 && promoCode) {
      handlePromoCodeValidation(promoCode, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseTotalPrice]);
  
  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        customerName: '',
        customerEmail: '',
        phoneNumber: '',
        ticketTypeId: ticketTypes.length === 1 ? String(ticketTypes[0].id) : '',
        quantity: 1,
        paymentMethod: 'mpesa',
        amount: 0,
        eventId: event.id
      });
      setPurchaseComplete(false);
      setPurchaseDetails({});
      setPromoCode('');
      setValidatedPromoCode(null);
      setPromoCodeError(null);
    }
  }, [open, ticketTypes, event.id]);

  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    
    // Only update if the value is empty or matches the pattern
    if (rawValue === '' || /^[0-9]*$/.test(rawValue)) {
      setFormData(prev => ({ 
        ...prev, 
        phoneNumber: rawValue
      }));
      
      // Clear error when user starts typing
      if (phoneError) {
        setPhoneError(null);
      }
    }
  };
  
  const validatePhoneNumber = (phone: string): string | null => {
    if (!phone) return 'Phone number is required';
    if (phone.length !== 9) return 'Phone number must be 9 digits';
    if (!phone.startsWith('1') && !phone.startsWith('7')) {
      return 'Phone number must start with 1 or 7';
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number = value;
    
    if (type === 'number') {
      processedValue = Number(value);
    } else if (name === 'customerEmail') {
      processedValue = value.toLowerCase().trim();
    } else if (name === 'customerName') {
      processedValue = value.replace(/[^a-zA-Z\s'-]/g, '');
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const getMaxQuantity = (ticket: EventTicketType | undefined): number => {
    if (!ticket) return 10;
    const available = ticket.available !== undefined 
      ? ticket.available 
      : (ticket.quantity_available || 0);
    const maxPerOrder = ticket.max_per_order || 10;
    return Math.max(0, Math.min(available, maxPerOrder, 10));
  };
  
  const maxQuantity = getMaxQuantity(selectedTicket);

  const handleQuantityChange = (newQuantity: number) => {
    const minQuantity = selectedTicket?.min_per_order || 1;
    const validQuantity = Math.max(minQuantity, Math.min(maxQuantity, newQuantity));
    setFormData(prev => ({ ...prev, quantity: validQuantity }));
  };

  // Handle promo code validation
  const handlePromoCodeValidation = async (code: string, showToast = true) => {
    if (!code.trim()) {
      setValidatedPromoCode(null);
      setPromoCodeError(null);
      return;
    }

    if (baseTotalPrice === 0) {
      setPromoCodeError('Please select tickets first');
      return;
    }

    setValidatingPromoCode(true);
    setPromoCodeError(null);

    try {
      const validation = await validatePromoCode(event.id, code.toUpperCase().trim(), baseTotalPrice);
      
      if (validation.valid && validation.promoCode) {
        setValidatedPromoCode(validation.promoCode as PromoCode);
        setPromoCodeError(null);
        if (showToast) {
          toast({
            title: 'Promo code applied!',
            description: `You'll save ${validation.promoCode.discount_type === 'percentage' 
              ? `${validation.promoCode.discount_value}%` 
              : formatPrice(validation.promoCode.discount_value)}`,
          });
        }
      } else {
        setValidatedPromoCode(null);
        setPromoCodeError(validation.error || 'Invalid promo code');
        if (showToast) {
          toast({
            title: 'Invalid Promo Code',
            description: validation.error || 'This promo code is not valid',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      setValidatedPromoCode(null);
      const errorMessage = error.response?.data?.message || 'Failed to validate promo code';
      setPromoCodeError(errorMessage);
      if (showToast) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setValidatingPromoCode(false);
    }
  };

  const handlePromoCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.toUpperCase().trim();
    setPromoCode(code);
    setPromoCodeError(null);
    
    // Clear validation if code is removed
    if (!code) {
      setValidatedPromoCode(null);
    }
  };

  const handlePromoCodeSubmit = () => {
    if (promoCode.trim()) {
      handlePromoCodeValidation(promoCode);
    }
  };

  const handleRemovePromoCode = () => {
    setPromoCode('');
    setValidatedPromoCode(null);
    setPromoCodeError(null);
  };

  // Form validation function
  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!formData.customerName.trim()) {
      errors.push('Name is required');
    } else if (formData.customerName.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    
    if (!formData.customerEmail.trim()) {
      errors.push('Email is required');
    } else if (!isValidEmail(formData.customerEmail)) {
      errors.push('Please enter a valid email address');
    }
    
    const phoneError = validatePhoneNumber(formData.phoneNumber);
    if (phoneError) {
      errors.push(phoneError);
    }
    
    if (!formData.ticketTypeId) {
      errors.push('Please select a ticket type');
    } else if (maxQuantity <= 0) {
      errors.push('The selected ticket type is sold out');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Listen for payment status updates via Server-Sent Events (SSE)
  const listenForPaymentStatus = (invoiceId: string): Promise<{ success: boolean; status: string; message?: string; data?: PaymentStatusData; failureDetails?: FailureDetails }> => {
    return new Promise((resolve, reject) => {
      console.log(`=== Starting SSE connection for invoice ${invoiceId} ===`);

      // Get the API base URL
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
      const baseUrl = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;
      const sseUrl = `${baseUrl}/payments/status/${invoiceId}/stream`;

      console.log(`Connecting to SSE endpoint: ${sseUrl}`);

      // Create EventSource connection
      const eventSource = new EventSource(sseUrl);

      // Set a timeout fallback (5 minutes max)
      const timeout = setTimeout(() => {
        eventSource.close();
        console.warn('SSE connection timeout, falling back to status check');
        // Fallback to a single status check
        apiRequest.get<{
          success: boolean;
          status: string;
          message?: string;
          data?: PaymentStatusData;
        }>(`payments/status/${invoiceId}`)
          .then((response: any) => {
            const responseData = response?.data || response;
            resolve({
              success: responseData?.status === 'completed',
              status: (responseData?.status as string) || 'timeout',
              message: (responseData?.message as string) || 'Payment status check timed out',
              data: (responseData?.data as PaymentStatusData) || {}
            });
          })
          .catch(() => {
            resolve({
              success: false,
              status: 'timeout',
              message: 'Payment status check timed out. Please check your email for confirmation or contact support.'
            });
          });
      }, 5 * 60 * 1000); // 5 minutes

      eventSource.onopen = () => {
        console.log('SSE connection opened');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE message received:', data);

          if (data.type === 'connected') {
            console.log('SSE connection established');
            return;
          }

          if (data.type === 'payment_status_update') {
            const status = data.status as string;
            const payment = data.payment as PaymentStatusData | undefined;
            const failureDetails = data.failureDetails as { failed_reason?: string; failed_code?: string; failed_code_link?: string } | null;

            console.log(`Payment status update received: ${status}`, failureDetails);

            // Handle terminal states
            if (['completed', 'failed', 'cancelled'].includes(status)) {
              clearTimeout(timeout);
              eventSource.close();

              // Build appropriate message based on status
              let message = '';
              if (status === 'completed') {
                message = 'Payment completed successfully!';
              } else if (status === 'failed' && failureDetails?.failed_reason) {
                message = failureDetails.failed_reason;
              } else if (status === 'cancelled') {
                message = 'Payment was cancelled.';
              } else {
                message = `Payment ${status}`;
              }

              resolve({
                success: status === 'completed',
                status,
                message,
                data: payment,
                failureDetails: failureDetails || undefined
              });
            }
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        
        // If connection is closed, try fallback
        if (eventSource.readyState === EventSource.CLOSED) {
          clearTimeout(timeout);
          eventSource.close();
          
          // Fallback to a single status check
          apiRequest.get<{
            success: boolean;
            status: string;
            message?: string;
            data?: PaymentStatusData;
          }>(`payments/status/${invoiceId}`)
            .then(response => {
              const responseData = response as any;
              resolve({
                success: responseData?.status === 'completed',
                status: (responseData?.status as string) || 'error',
                message: (responseData?.message as string) || 'Error checking payment status',
                data: (responseData?.data as PaymentStatusData) || {}
              });
            })
            .catch(() => {
              reject(new Error('Failed to check payment status'));
            });
        }
      };
    });
  };

  // All state and functions are now properly declared

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== Form Submission Started ===');
    console.log('Form data:', formData);
    
    if (selectedTicket?.is_sold_out) {
      console.error('Ticket is sold out');
      toast({ 
        title: 'Ticket Unavailable', 
        description: 'The selected ticket type is sold out. Please select another ticket type.', 
        variant: 'destructive' 
      });
      return;
    }

    const { isValid, errors } = validateForm();
    console.log('Validation result:', { isValid, errors });
    
    if (!isValid) {
      console.error('Form validation failed:', errors);
      toast({ 
        title: 'Please fix the following issues:', 
        description: errors.join('\n'), 
        variant: 'destructive' 
      });
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    const purchaseData = {
      eventId: event.id,
      ticketTypeId: formData.ticketTypeId ? Number(formData.ticketTypeId) : null,
      quantity: Number(formData.quantity),
      customerName: formData.customerName.trim(),
      customerEmail: formData.customerEmail.trim().toLowerCase(),
      phoneNumber: formData.phoneNumber,
      paymentMethod: formData.paymentMethod,
      amount: totalPrice,
      ticketTypeName: selectedTicket?.name || 'General Admission',
      promoCode: validatedPromoCode ? promoCode.toUpperCase().trim() : undefined
    };
    
    let paymentInitiated = false;
    let invoiceId: string | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    let response;
    
    // Function to attempt payment initiation with retries
    const attemptPaymentInitiation = async () => {
      while (retryCount < maxRetries) {
        try {
          console.log(`=== Payment Initiation (Attempt ${retryCount + 1}/${maxRetries}) ===`);
          console.log('Sending payment request with data:', {
            phone: purchaseData.phoneNumber,
            email: purchaseData.customerEmail,
            amount: purchaseData.amount,
            ticketId: purchaseData.ticketTypeId,
            eventId: purchaseData.eventId,
            customerName: purchaseData.customerName,
            narrative: `Ticket purchase for ${event.name}`,
            paymentMethod: purchaseData.paymentMethod
          });
          
          const result = await apiRequest.post<PaymentInitiationResponse>('payments/initiate', {
            phone: purchaseData.phoneNumber,
            email: purchaseData.customerEmail,
            amount: purchaseData.amount,
            ticketId: purchaseData.ticketTypeId,
            eventId: purchaseData.eventId,
            customerName: purchaseData.customerName,
            narrative: `Ticket purchase for ${event.name}`,
            paymentMethod: purchaseData.paymentMethod,
            promoCode: purchaseData.promoCode, // Include promo code for backend validation
            quantity: purchaseData.quantity // Include quantity for backend price calculation
          }, {
            timeout: 15000 // 15 second timeout for the initial request
          });
          
          console.log('Payment initiation response:', result);
          return result;
          
        } catch (error: any) {
          retryCount++;
          
          if (retryCount >= maxRetries) {
            console.error('Max retries reached for payment initiation');
            throw error; // Re-throw to be caught by the outer catch
          }
          
          // If it's a network error, wait and retry
          if (error.code === 'ECONNABORTED' || error.message?.includes('network')) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
            console.log(`Network error, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // For other errors, rethrow immediately
          throw error;
        }
      }
      
      throw new Error('Failed to initiate payment after multiple attempts');
    };
    
    try {
      // Attempt payment initiation with retries
      response = await attemptPaymentInitiation();
      
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }
      
      // Mark that we've successfully initiated a payment
      paymentInitiated = true;
      
      const { data } = response;
      invoiceId = data.invoiceId || data.data?.invoiceId;
      
      if (!invoiceId) {
        throw new Error('No invoice ID received from server');
      }
      
      console.log('Starting payment status monitoring for invoice:', invoiceId);
      
      // Listen for real-time payment status updates via SSE
      console.log('Connecting to real-time payment status stream...');
      const result = await listenForPaymentStatus(invoiceId);
      
      console.log('Payment status monitoring completed with result:', result);
      
      // Check the actual payment status
      const paymentStatus = result.status?.toLowerCase();
      
      if (paymentStatus === 'completed' && result.success) {
        console.log('Payment completed successfully!');
        setPurchaseDetails({
          reference: invoiceId,
          email: purchaseData.customerEmail
        });
        setPurchaseComplete(true);
        
        // Call the original onSubmit if provided
        if (onSubmit) {
          try {
            await onSubmit(purchaseData);
          } catch (submitError) {
            console.error('Error in onSubmit callback:', submitError);
          }
        }
      } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
        // Payment explicitly failed or was cancelled
        console.error(`Payment ${paymentStatus} with status: ${result.status}`, result.message);
        
        // Use failure details from webhook if available
        const failureMessage = result.failureDetails?.failed_reason || 
                               result.message || 
                               (paymentStatus === 'failed' 
                                 ? 'Payment failed. Please try again.' 
                                 : 'Payment was cancelled.');
        
        // Create error with failure details
        const error = new Error(failureMessage) as any;
        error.failureDetails = result.failureDetails;
        error.paymentStatus = paymentStatus;
        throw error;
      } else {
        // Unknown or pending status - treat as error
        console.error(`Payment ended with unknown status: ${result.status}`, result.message);
        throw new Error(result.message || 'Payment status could not be determined. Please check your email or contact support.');
      }
      
    } catch (error: any) {
      console.error('Error processing payment:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack,
        code: error.code,
        isNetworkError: error.message?.includes('network') || error.code === 'ECONNABORTED'
      });
      
      // Extract failure details if available
      const failureDetails = error.failureDetails as FailureDetails | undefined;
      const paymentStatus = error.paymentStatus as string | undefined;
      
      // Build error message based on failure type
      let errorTitle = 'Payment Failed';
      let errorMessage = '';
      
      // Handle explicit payment failures with webhook details
      if (paymentStatus === 'failed' && failureDetails) {
        errorTitle = 'Payment Failed';
        errorMessage = failureDetails.failed_reason || 'Payment failed. Please try again.';
        
        // Add error code if available
        if (failureDetails.failed_code) {
          errorMessage += ` (Error Code: ${failureDetails.failed_code})`;
        }
      } 
      // Handle cancelled payments
      else if (paymentStatus === 'cancelled') {
        errorTitle = 'Payment Cancelled';
        errorMessage = failureDetails?.failed_reason || error.message || 'Payment was cancelled by user.';
      }
      // Handle network-related errors
      else if (error.message?.includes('network') || error.code === 'ECONNABORTED' || !navigator.onLine) {
        errorTitle = 'Connection Issue';
        errorMessage = 'Network connection issue detected. ';
        
        if (paymentInitiated && invoiceId) {
          errorMessage += 'Your payment was initiated but we could not confirm the status. ';
          errorMessage += 'Please check your email for confirmation or contact support with this reference: ' + invoiceId;
        } else if (paymentInitiated) {
          errorMessage += 'Your payment may have been initiated. Please check your payment method or contact support for assistance.';
        } else {
          errorMessage += 'Please check your internet connection and try again.';
        }
      } 
      // Handle other types of errors
      else if (paymentInitiated) {
        errorTitle = 'Payment Processing Issue';
        if (invoiceId) {
          errorMessage = 'The payment was initiated but we encountered an issue confirming the status. ';
          errorMessage += 'Please check your email for confirmation or contact support with this reference: ' + invoiceId;
        } else {
          errorMessage = 'The payment was initiated but we encountered an issue. Please check your payment method or contact support.';
        }
      } else {
        errorMessage = error.message || 'There was an error processing your payment. Please try again or contact support if the issue persists.';
      }
      
      // Add server error details if available
      if (error.response?.data?.message && !errorMessage.includes(error.response.data.message)) {
        errorMessage += ` (${error.response.data.message})`;
      }
      
      // Show error toast with detailed message
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: 20000, // Show for 20 seconds to allow user to read detailed error
      });
      
      // NEVER show success modal unless payment is confirmed successful
      // Removed the network issue fallback that showed success
    } finally {
      // Always ensure loading state is cleared
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] flex flex-col !grid-cols-1 !translate-y-[-45%] sm:!translate-y-[-50%]">
        {purchaseComplete ? (
          <div className="text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-50 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful</h3>
            <p className="text-gray-600 mb-4">
              Confirmation email will be sent to your email
            </p>
            <Button 
              onClick={() => onOpenChange(false)}
              className="mt-2"
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Purchase Tickets</DialogTitle>
              <DialogDescription>
                Complete your ticket purchase for {event.name}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="space-y-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Full Name</Label>
                <Input
                  id="customerName"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (M-Pesa Registered)</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-gray-500">+254</span>
                  </div>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="712 345 678"
                    className={`pl-14 ${phoneError ? 'border-red-500' : ''}`}
                    value={formData.phoneNumber}
                    onChange={handlePhoneNumberChange}
                    onBlur={(e) => setPhoneError(validatePhoneNumber(e.target.value))}
                    required
                    maxLength={9}
                  />
                </div>
                {phoneError && (
                  <p className="text-sm text-red-500 mt-1">{phoneError}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Enter 9-digit Safaricom number starting with 7 or 1 (e.g., 712345678)
                </p>
              </div>
              
              {ticketTypes.length > 0 && (
                <div className="space-y-2">
                  <Label>Ticket Type</Label>
                  <Select
                    value={formData.ticketTypeId}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      ticketTypeId: value,
                      quantity: 1 // Reset quantity when ticket type changes
                    }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a ticket type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ticketTypes.map((ticket) => (
                        <SelectItem 
                          key={ticket.id} 
                          value={String(ticket.id)}
                          disabled={ticket.is_sold_out}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span>{ticket.name}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              {formatPrice(ticket.price)}
                              {ticket.is_sold_out && ' (Sold Out)'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {selectedTicket && (
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(formData.quantity - 1)}
                      disabled={formData.quantity <= (selectedTicket.min_per_order || 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 text-center">
                      {formData.quantity}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(formData.quantity + 1)}
                      disabled={formData.quantity >= maxQuantity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {maxQuantity > 0 
                      ? `${maxQuantity} ${maxQuantity === 1 ? 'ticket' : 'tickets'} available`
                      : 'No tickets available'}
                  </p>
                </div>
              )}
              
              {/* Promo Code Section */}
              <div className="space-y-2 border-t border-gray-200 pt-4">
                <Label htmlFor="promoCode">Promo Code (Optional)</Label>
                {validatedPromoCode ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">{validatedPromoCode.code}</p>
                        <p className="text-xs text-green-600">
                          {validatedPromoCode.discount_type === 'percentage'
                            ? `${validatedPromoCode.discount_value}% off`
                            : `${formatPrice(validatedPromoCode.discount_value)} off`}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePromoCode}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="promoCode"
                      type="text"
                      value={promoCode}
                      onChange={handlePromoCodeChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handlePromoCodeSubmit();
                        }
                      }}
                      placeholder="Enter promo code"
                      className="flex-1 uppercase"
                      disabled={validatingPromoCode || baseTotalPrice === 0}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePromoCodeSubmit}
                      disabled={validatingPromoCode || !promoCode.trim() || baseTotalPrice === 0}
                    >
                      {validatingPromoCode ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  </div>
                )}
                {promoCodeError && (
                  <p className="text-xs text-red-600">{promoCodeError}</p>
                )}
              </div>
              
              <div className="pt-2">
                <div className="space-y-2 border-t border-gray-200 pt-4 pb-2">
                  {validatedPromoCode && discountAmount > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-600">{formatPrice(baseTotalPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600 font-medium">Discount</span>
                        <span className="text-green-600 font-medium">-{formatPrice(discountAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total</span>
                    <span className="text-lg font-bold">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              </div>
              </div>
              
              <div className="pt-4 flex-shrink-0 border-t mt-4">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pay {formatPrice(totalPrice)} with {formData.paymentMethod === 'mpesa' ? 'M-Pesa' : formData.paymentMethod}
                    </>
                  )}
                </Button>
                
                {formData.paymentMethod === 'mpesa' && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    You'll receive an M-Pesa prompt on your phone to complete the payment
                  </p>
                )}
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
