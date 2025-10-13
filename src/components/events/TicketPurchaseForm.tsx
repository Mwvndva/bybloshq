import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Minus, Plus, Loader2, CreditCard } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiRequest } from '@/lib/axios';

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
  
  const { toast } = useToast();
  const ticketTypes = event.ticketTypes || [];
  const selectedTicket = ticketTypes.find(t => t.id.toString() === formData.ticketTypeId) || null;
  const totalPrice = selectedTicket ? selectedTicket.price * formData.quantity : 0;
  
  // Update formData with calculated amount when ticket or quantity changes
  useEffect(() => {
    if (selectedTicket) {
      setFormData(prev => ({
        ...prev,
        amount: selectedTicket.price * prev.quantity
      }));
    }
  }, [selectedTicket, formData.quantity]);
  
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

  // Poll payment status
  const pollPaymentStatus = async (invoiceId: string): Promise<{ success: boolean; status: string; message?: string; data?: PaymentStatusData; error?: Error }> => {
    const maxAttempts = 30;
    const baseDelayMs = 2000; // Start with 2 seconds
    let attempts = 0;
    let lastStatus = '';

    console.log(`=== Starting payment status polling for invoice ${invoiceId} ===`);

    const checkStatus = async () => {
      try {
        console.log(`[Attempt ${attempts + 1}/${maxAttempts}] Checking payment status...`);
        
        const response = await apiRequest.get<{
          success: boolean;
          status: string;
          message?: string;
          data?: PaymentStatusData;
        }>(`payments/status/${invoiceId}`, {
          params: { _t: Date.now() },
          timeout: 10000 // 10 second timeout
        });
        
        console.log('Payment status response:', response.data);
        
        if (!response?.data) {
          throw new Error('No response data received from server');
        }
        
        // Handle the standardized response format
        if (response.data.success === false) {
          const errorMessage = typeof response.data.message === 'string' 
            ? response.data.message 
            : 'Payment check failed';
          throw new Error(errorMessage);
        }
        
        // Handle not_found status
        if (response.data.status === 'not_found') {
          return {
            status: 'not_found',
            message: response.data.message || 'Payment not found',
            data: response.data.data
          };
        }
        
        return {
          status: response.data.status || 'pending',
          message: response.data.message,
          data: response.data.data
        };
        
      } catch (error: any) {
        console.error('Error checking payment status:', error);
        
        // Handle network-related errors
        const isNetworkError = error.code === 'ECONNABORTED' || 
                             error.message?.includes('timeout') || 
                             error.message?.includes('network') ||
                             !navigator.onLine;
        
        if (isNetworkError) {
          return { 
            status: 'pending',
            message: 'Network issue, checking again...',
            error: new Error('Network error - please check your connection')
          };
        }
        
        // For other errors, return error status
        return {
          status: 'error',
          message: error.message || 'Error checking payment status',
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    };

    // Main polling loop
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const { status, message, data, error } = await checkStatus();
        
        // Update last status
        if (status !== lastStatus) {
          console.log(`Payment status changed: ${lastStatus} -> ${status}`);
          lastStatus = status;
        }
        
        // Handle terminal states
        if (['completed', 'failed', 'cancelled', 'error', 'not_found'].includes(status)) {
          // Ensure data matches PaymentStatusData type
          const responseData: PaymentStatusData = data && typeof data === 'object' 
            ? { ...data } 
            : {};
            
          return {
            success: status === 'completed',
            status,
            message: message || `Payment ${status}`,
            data: responseData
          };
        }
        
        // If we got an error but it's not terminal, log it and continue
        if (error) {
          console.error('Non-terminal error:', error);
        }
        
        // Calculate delay with exponential backoff and jitter
        const delayMs = Math.min(
          baseDelayMs * Math.pow(1.5, attempts - 1) + Math.random() * 1000,
          10000 // Max 10 seconds
        );
        
        console.log(`Waiting ${Math.round(delayMs)}ms before next check...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
      } catch (error) {
        console.error('Unexpected error in polling loop:', error);
        // Continue to next attempt after a delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // If we get here, we've exhausted all attempts
    return {
      success: false,
      status: 'timeout',
      message: 'Payment status check timed out. Please check your email for confirmation or contact support.',
      data: null
    };
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
      ticketTypeName: selectedTicket?.name || 'General Admission'
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
            paymentMethod: purchaseData.paymentMethod
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
      
      console.log('Starting payment status polling for invoice:', invoiceId);
      
      // Start polling for payment status
      console.log('Starting payment status polling...');
      const result = await pollPaymentStatus(invoiceId);
      
      console.log('Payment polling completed with result:', result);
      
      if (result.success) {
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
      } else {
        console.error(`Payment failed with status: ${result.status}`, result.message);
        throw new Error(result.message || 'Payment failed. Please try again.');
      }
      
    } catch (error: any) {
      console.error('Error processing payment:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack,
        code: error.code,
        isNetworkError: error.message?.includes('network') || error.code === 'ECONNABORTED'
      });
      
      let errorMessage = 'There was an error processing your payment. ';
      
      // Check for network-related errors first
      if (error.message?.includes('network') || error.code === 'ECONNABORTED' || !navigator.onLine) {
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
        if (invoiceId) {
          errorMessage = 'The payment was initiated but we encountered an issue confirming the status. ';
          errorMessage += 'Please check your email for confirmation or contact support with this reference: ' + invoiceId;
        } else {
          errorMessage = 'The payment was initiated but we encountered an issue. Please check your payment method or contact support.';
        }
      } else {
        errorMessage = 'There was an error processing your payment. Please try again or contact support if the issue persists.';
      }
      
      // Add server error details if available
      if (error.response?.data?.message) {
        errorMessage += ` (${error.response.data.message})`;
      } else if (error.message && !error.message.includes('network')) {
        errorMessage += ` (${error.message})`;
      }
      
      toast({
        title: paymentInitiated ? 'Payment Processing Issue' : 'Payment Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 15000, // Show for 15 seconds to allow user to read
      });
      
      // If we have an invoice ID but had an error, we should still show the success state
      // as the payment might have gone through but we couldn't confirm
      if (invoiceId && paymentInitiated) {
        setPurchaseDetails({
          reference: invoiceId,
          email: purchaseData.customerEmail
        });
        setPurchaseComplete(true);
      }
    } finally {
      // Always ensure loading state is cleared
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
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
          <>
            <DialogHeader>
              <DialogTitle>Purchase Tickets</DialogTitle>
              <DialogDescription>
                Complete your ticket purchase for {event.name}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
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
              
              <div className="pt-2">
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <span className="font-medium">Total</span>
                  <span className="text-lg font-bold">{formatPrice(totalPrice)}</span>
                </div>
              </div>
              
              <div className="pt-2">
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
