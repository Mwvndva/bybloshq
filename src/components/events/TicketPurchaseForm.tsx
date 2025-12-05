import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Minus, Plus, Loader2, CreditCard } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiRequest } from '@/lib/axios';
import { DiscountCodeInput } from '@/components/shared/DiscountCodeInput';
import PaystackPayment from '@/components/shared/PaystackPayment';

type PurchaseFormData = {
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
  ticketTypeId: string;
  quantity: number;
  paymentMethod: 'paystack';
  amount: number;
  eventId: number;
  discountCode?: string;
  discountAmount?: number;
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
  authorization_url?: string;
  access_code?: string;
  reference?: string;
  payment_provider_response?: {
    invoice_id: string;
    reference: string;
    authorization_url: string;
    access_code: string;
    status: string;
  };
  [key: string]: string | boolean | number | undefined | object;
};

interface TicketPurchaseFormProps {
  event: {
    id: number;
    name: string;
    ticketTypes?: EventTicketType[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: any) => void;
}

export function TicketPurchaseForm({ 
  event, 
  open, 
  onOpenChange,
  onSubmit,
}: TicketPurchaseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<{reference?: string; email?: string}>({});
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedDiscountCode, setAppliedDiscountCode] = useState('');
  const [showPaystackModal, setShowPaystackModal] = useState(false);
  const [paymentInitiationData, setPaymentInitiationData] = useState<any>(null);
  const [formData, setFormData] = useState<PurchaseFormData>(() => ({
    customerName: '',
    customerEmail: '',
    phoneNumber: '',
    ticketTypeId: '',
    quantity: 1,
    paymentMethod: 'paystack',
    amount: 0,
    eventId: event.id
  }));
  
  const { toast } = useToast();
  const ticketTypes = event.ticketTypes || [];
  const selectedTicket = ticketTypes.find(t => t.id.toString() === formData.ticketTypeId) || null;
  
  // Calculate prices - this will recalculate on every render
  const basePrice = selectedTicket ? selectedTicket.price * formData.quantity : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  // Debug logging for price changes
  useEffect(() => {
    console.log('=== PRICE CALCULATION DEBUG ===');
    console.log('Selected ticket:', selectedTicket);
    console.log('Quantity:', formData.quantity);
    console.log('Base price:', basePrice);
    console.log('Discount amount:', discountAmount);
    console.log('Applied code:', appliedDiscountCode);
    console.log('Final price:', finalPrice);
  }, [basePrice, discountAmount, finalPrice, selectedTicket, formData.quantity, appliedDiscountCode]);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: price % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    }).format(price);
  };

  // Handler for when Paystack modal opens - close the ticket purchase dialog
  const handlePaystackModalOpen = () => {
    console.log('Paystack modal opening, closing ticket purchase dialog');
    // Close the ticket purchase dialog when Paystack modal opens
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  // Paystack success handler
  const handlePaystackSuccess = async (response: any) => {
    console.log('Paystack payment successful:', response);
    setShowPaystackModal(false);
    
    // Start checking payment status
    if (paymentInitiationData?.invoiceId) {
      const checkPaymentStatus = async () => {
        let statusChecks = 0;
        const maxStatusChecks = 20; // Check for up to ~2 minutes
        const statusCheckInterval = 5000; // Check every 5 seconds
        
        const statusCheckTimer = setInterval(async () => {
          try {
            statusChecks++;
            console.log(`=== Payment Status Check ${statusChecks}/${maxStatusChecks} ===`);
            
            const statusResponse = await apiRequest.get<PaymentStatusResponse>(`payments/status/${paymentInitiationData.invoiceId}`, {
              timeout: 10000
            });
            
            console.log('Payment status response:', statusResponse);
            
            if (statusResponse?.status === 'success' || statusResponse?.data?.status === 'success' || 
                statusResponse?.status === 'completed' || statusResponse?.data?.status === 'completed') {
              clearInterval(statusCheckTimer);
              setPurchaseComplete(true);
              setPurchaseDetails({
                reference: response.reference || paymentInitiationData.reference,
                email: paymentInitiationData.email
              });
              setIsSubmitting(false);
              
              toast({
                title: 'Payment Successful!',
                description: 'Your ticket purchase has been completed successfully.',
              });
              
              // Call onSubmit callback if provided
              if (onSubmit) {
                await onSubmit({
                  eventId: event.id,
                  ticketTypeId: paymentInitiationData.ticketTypeId,
                  quantity: paymentInitiationData.quantity,
                  customerName: paymentInitiationData.customerName,
                  customerEmail: paymentInitiationData.email,
                  phoneNumber: paymentInitiationData.phone,
                  paymentMethod: 'paystack',
                  amount: paymentInitiationData.amount
                });
              }
            } else if (statusChecks >= maxStatusChecks) {
              clearInterval(statusCheckTimer);
              setIsSubmitting(false);
              toast({
                title: 'Payment Verification',
                description: 'Payment was completed but verification is taking longer. You will receive a confirmation email.',
              });
            }
          } catch (error) {
            console.error('Status check error:', error);
            if (statusChecks >= maxStatusChecks) {
              clearInterval(statusCheckTimer);
              setIsSubmitting(false);
              toast({
                title: 'Payment Verification',
                description: 'Payment was completed but we could not verify it immediately. Please check your email for confirmation.',
              });
            }
          }
        }, statusCheckInterval);
      };
      
      checkPaymentStatus();
    }
  };
  
  // Paystack close handler
  const handlePaystackClose = () => {
    console.log('Paystack modal closed');
    setShowPaystackModal(false);
    setIsSubmitting(false);
    
    toast({
      title: 'Payment Cancelled',
      description: 'You can try again when ready.',
      variant: 'destructive'
    });
  };

  const handleDiscountApplied = (discount: number, finalAmount: number, code: string) => {
    console.log('=== DISCOUNT APPLIED ===');
    console.log('Discount details:', { discount, finalAmount, code });
    console.log('Current state before update:', {
      currentDiscountAmount: discountAmount,
      currentAppliedCode: appliedDiscountCode,
      basePrice,
      finalPrice
    });
    
    // Update all discount-related state in a single update
    setDiscountAmount(discount);
    setAppliedDiscountCode(code);
    
    // Force a re-render by updating formData amount
    setFormData(prev => ({ 
      ...prev, 
      amount: finalAmount 
    }));
    
    console.log('State after discount update:', {
      newDiscountAmount: discount,
      newAppliedCode: code,
      newFormAmount: finalAmount,
      expectedFinalPrice: Math.max(0, basePrice - discount)
    });
    
    // Verify the calculation is correct
    if (Math.max(0, basePrice - discount) !== finalAmount) {
      console.error('Discount calculation mismatch!', {
        basePrice,
        discount,
        expectedFinalPrice: Math.max(0, basePrice - discount),
        receivedFinalAmount: finalAmount
      });
    }
  };

  const handleDiscountRemoved = () => {
    console.log('=== DISCOUNT REMOVED ===');
    console.log('Resetting to base price:', basePrice);
    console.log('Current discount state:', { discountAmount, appliedDiscountCode });
    
    // Reset all discount-related state
    setDiscountAmount(0);
    setAppliedDiscountCode('');
    setFormData(prev => ({ ...prev, amount: basePrice }));
    setPurchaseComplete(false);
    setPurchaseDetails({});
    
    console.log('State after discount removal:', {
      newDiscountAmount: 0,
      newAppliedCode: '',
      newFormAmount: basePrice,
      finalPrice: basePrice
    });
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setFormData({
        customerName: '',
        customerEmail: '',
        phoneNumber: '',
        ticketTypeId: '',
        quantity: 1,
        paymentMethod: 'paystack',
        amount: 0,
        eventId: event.id
      });
      setDiscountAmount(0);
      setAppliedDiscountCode('');
      setPurchaseComplete(false);
      setPurchaseDetails({});
    }
  }, [open, ticketTypes, event.id]);

  const [phoneError, setPhoneError] = useState<string | null>(null);

  const validatePhoneNumber = (phone: string): string | null => {
    const digits = phone.replace(/\D/g, '');
    
    if (!digits) return 'Phone number is required';
    if (digits.length !== 9) return 'Phone number must be 9 digits';
    if (!/^[17]/.test(digits)) return 'Phone number must start with 7 or 1';
    
    return null;
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
    setFormData(prev => ({ ...prev, phoneNumber: value }));
    if (phoneError) setPhoneError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.customerName.trim()) {
      errors.push('Full name is required');
    }
    
    if (!formData.customerEmail.trim()) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      errors.push('Valid email is required');
    }
    
    const phoneValidationError = validatePhoneNumber(formData.phoneNumber);
    if (phoneValidationError) {
      errors.push(phoneValidationError);
    }

    if (!formData.ticketTypeId) {
      errors.push('Please select a ticket type');
    }

    if (selectedTicket?.is_sold_out) {
      errors.push('The selected ticket type is sold out');
    }

    if (formData.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }

    if (selectedTicket) {
      const minQuantity = selectedTicket.min_per_order || 1;
      const maxQuantity = selectedTicket.max_per_order || 10;
      const available = selectedTicket.available !== undefined 
        ? selectedTicket.available 
        : (selectedTicket.quantity_available || 0);

      if (formData.quantity < minQuantity) {
        errors.push(`Minimum order quantity is ${minQuantity}`);
      }

      if (formData.quantity > Math.min(available, maxQuantity)) {
        errors.push(`Maximum order quantity is ${Math.min(available, maxQuantity)}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  };

  const getMaxQuantity = (ticket: EventTicketType | null): number => {
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
      amount: finalPrice,
      ticketTypeName: selectedTicket?.name || 'General Admission',
      discountCode: appliedDiscountCode || undefined,
      discountAmount: discountAmount || undefined
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
            paymentMethod: purchaseData.paymentMethod,
            discountCode: purchaseData.discountCode,
            discountAmount: purchaseData.discountAmount
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
            discountCode: purchaseData.discountCode,
            discountAmount: purchaseData.discountAmount
          }, {
            timeout: 15000 // 15 second timeout for the initial request
          });
          
          console.log('Payment initiation response:', result);
          return result;
          
        } catch (error: any) {
          retryCount++;
          
          console.error(`Payment initiation attempt ${retryCount} failed:`, {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          });
          
          // Don't retry on client errors (4xx)
          if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
            throw error;
          }
          
          // If we've reached max retries, throw the error
          if (retryCount >= maxRetries) {
            throw new Error(`Payment initiation failed after ${maxRetries} attempts. Last error: ${error.message}`);
          }
          
          // Wait before retrying with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };
    
    try {
      response = await attemptPaymentInitiation();
      
      if (response?.status === 'success' || response?.success) {
        paymentInitiated = true;
        invoiceId = response.data?.invoiceId || response.data?.reference || response.invoiceId || response.reference;
        
        console.log('Payment initiated successfully:', {
          invoiceId,
          authorization_url: response.data?.authorization_url || response.authorization_url,
          access_code: response.data?.access_code || response.access_code,
          reference: response.data?.reference || response.reference,
          payment_provider_response: response.payment_provider_response
        });
        
        // Store payment initiation data for Paystack modal
        setPaymentInitiationData({
          email: purchaseData.customerEmail,
          amount: purchaseData.amount,
          reference: response.data?.reference || response.reference || invoiceId,
          invoiceId: invoiceId,
          ticketTypeId: purchaseData.ticketTypeId?.toString() || '',
          quantity: purchaseData.quantity.toString(),
          customerName: purchaseData.customerName,
          phone: purchaseData.phoneNumber
        });
        
        // Show Paystack modal
        setShowPaystackModal(true);
        
        toast({
          title: 'Payment Ready',
          description: 'Please complete the payment in the Paystack modal.',
        });
      } else {
        throw new Error(response.data?.message || response.message || 'Payment initiation failed');
      }
      
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      setIsSubmitting(false);
      
      toast({
        title: 'Payment Error',
        description: error.message || 'Failed to initiate payment. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {purchaseComplete ? (
          <div className="text-center py-6">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful</h3>
            <p className="text-gray-600 mb-4">
              Confirmation email will be sent to your email
            </p>
            {purchaseDetails.reference && (
              <p className="text-sm text-gray-500 mb-4">
                Reference: {purchaseDetails.reference}
              </p>
            )}
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
                <Label htmlFor="phoneNumber">Phone Number</Label>
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
                  Enter 9-digit number starting with 7 or 1 (e.g., 712345678)
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
              
              {selectedTicket && (
                <div className="pt-2">
                  <DiscountCodeInput
                    eventId={String(event.id)}
                    orderAmount={basePrice}
                    onDiscountApplied={handleDiscountApplied}
                    onDiscountRemoved={handleDiscountRemoved}
                  />
                </div>
              )}
              
              <div className="pt-2">
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <div>
                    <span className="font-medium">Subtotal</span>
                    {discountAmount > 0 && (
                      <div className="text-sm text-green-600">
                        Discount: -{formatPrice(discountAmount)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {/* Debug log for subtotal display */}
                    {(() => {
                      console.log('=== SUBTOTAL RENDER DEBUG ===');
                      console.log('Rendering subtotal with:', {
                        finalPrice,
                        basePrice,
                        discountAmount,
                        formattedFinalPrice: formatPrice(finalPrice),
                        formattedBasePrice: formatPrice(basePrice)
                      });
                      return null;
                    })()}
                    <span className="text-lg font-bold">{formatPrice(finalPrice)}</span>
                    {discountAmount > 0 && (
                      <div className="text-sm text-gray-500 line-through">
                        {formatPrice(basePrice)}
                      </div>
                    )}
                  </div>
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
                      Pay {formatPrice(finalPrice)} with Paystack
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-gray-500 text-center mt-2">
                  You'll be redirected to Paystack's secure payment modal
                </p>
              </div>
            </form>
          </>
        )}
      </DialogContent>
      
      {/* Paystack Modal */}
      {showPaystackModal && paymentInitiationData && (
        <PaystackPayment
          email={paymentInitiationData.email}
          amount={paymentInitiationData.amount}
          reference={paymentInitiationData.reference}
          onSuccess={handlePaystackSuccess}
          onClose={handlePaystackClose}
          onOpen={handlePaystackModalOpen}
          metadata={{
            event_id: event.id.toString(),
            ticket_type_id: formData.ticketTypeId,
            quantity: formData.quantity.toString(),
            customer_name: formData.customerName,
            phone: formData.phoneNumber
          }}
        />
      )}
    </Dialog>
  );
}
