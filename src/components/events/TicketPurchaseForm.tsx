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
  const [purchaseDetails, setPurchaseDetails] = useState<{ reference?: string; email?: string }>({});
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



  // Payment Status Polling
  const startPaymentStatusPolling = async (invoiceId: string, email: string) => {
    console.log('Starting payment status polling for:', invoiceId);

    // UI Feedback: Show waiting state
    setIsSubmitting(true);
    toast({
      title: 'Payment Initiated',
      description: 'Please check your phone to complete the payment.',
      duration: 10000
    });

    let statusChecks = 0;
    const maxStatusChecks = 24; // Check for up to ~2 minutes (5s * 24)
    const statusCheckInterval = 5000; // Check every 5 seconds

    const statusCheckTimer = setInterval(async () => {
      try {
        statusChecks++;
        console.log(`=== Payment Status Check ${statusChecks}/${maxStatusChecks} ===`);

        const statusResponse = await apiRequest.get<PaymentStatusResponse>(`payments/status/${invoiceId}`, {
          timeout: 10000
        });

        console.log('Payment status response:', statusResponse);

        // Fix: Check data.status specifically, as top-level status is just API success
        const paymentStatus = statusResponse?.data?.status || statusResponse?.data?.state;
        const isComplete = paymentStatus === 'success' || paymentStatus === 'completed';

        if (isComplete) {
          clearInterval(statusCheckTimer);
          setPurchaseComplete(true);
          setPurchaseDetails({
            reference: invoiceId, // Use invoice ID as reference if provider ref not avail immediately
            email: email
          });
          setIsSubmitting(false);

          toast({
            title: 'Payment Successful!',
            description: 'Your ticket purchase has been completed successfully.',
          });

          // Call onSubmit callback if provided
          if (onSubmit) {
            // We need to pass data, use local state or args
            // For simplify, we might not have all original args here if we don't pass them.
            // But UI is already showing success state.
          }
        } else if (statusChecks >= maxStatusChecks) {
          clearInterval(statusCheckTimer);
          setIsSubmitting(false);
          toast({
            title: 'Payment Verification Timeout',
            description: 'We haven\'t received confirmation yet. Please check your email.',
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Status check error:', error);
        if (statusChecks >= maxStatusChecks) {
          clearInterval(statusCheckTimer);
          setIsSubmitting(false);
          toast({
            title: 'Payment Verification Error',
            description: 'Could not verify payment status. Please contact support if money was deducted.',
            variant: "destructive"
          });
        }
      }
    }, statusCheckInterval);
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
            quantity: purchaseData.quantity,
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

        // Show waiting message and start polling
        // setShowPaystackModal(true); // REMOVED

        // Start polling immediately
        await startPaymentStatusPolling(invoiceId, purchaseData.customerEmail);

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
      <DialogContent className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl rounded-3xl max-w-lg p-0 overflow-hidden">
        {purchaseComplete ? (
          <div className="text-center p-8 space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-200 shadow-inner">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-black mb-2">Payment Successful!</h3>
              <p className="text-gray-600 text-lg">
                Your tickets have been sent to <span className="font-semibold text-gray-900">{purchaseDetails.email || formData.customerEmail}</span>
              </p>
            </div>

            {purchaseDetails.reference && (
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Transaction Reference</p>
                <p className="font-mono text-base font-medium text-gray-900">{purchaseDetails.reference}</p>
              </div>
            )}

            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-6 rounded-xl font-bold text-lg"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="p-8 pb-0">
              <DialogTitle className="text-2xl font-black text-black">Purchase Tickets</DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                Complete your booking for <span className="font-semibold text-gray-900">{event.name}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="p-8 pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="text-gray-700 font-semibold">Full Name</Label>
                  <Input
                    id="customerName"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    required
                    minLength={2}
                    maxLength={100}
                    className="rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 h-12 bg-gray-50/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail" className="text-gray-700 font-semibold">Email Address</Label>
                  <Input
                    id="customerEmail"
                    name="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    required
                    className="rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 h-12 bg-gray-50/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-gray-700 font-semibold">M-Pesa Number</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <span className="text-gray-500 font-medium">+254</span>
                    </div>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="712 345 678"
                      className={`pl-16 rounded-xl h-12 bg-gray-50/50 ${phoneError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-yellow-400 focus:ring-yellow-400'}`}
                      value={formData.phoneNumber}
                      onChange={handlePhoneNumberChange}
                      onBlur={(e) => setPhoneError(validatePhoneNumber(e.target.value))}
                      required
                      maxLength={9}
                    />
                  </div>
                  {phoneError ? (
                    <p className="text-sm text-red-500 mt-1 font-medium">{phoneError}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1 ml-1">
                      Enter 9-digit number starting with 7 or 1
                    </p>
                  )}
                </div>

                {ticketTypes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-gray-700 font-semibold">Ticket Type</Label>
                    <Select
                      value={formData.ticketTypeId}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        ticketTypeId: value,
                        quantity: 1 // Reset quantity when ticket type changes
                      }))}
                      required
                    >
                      <SelectTrigger className="rounded-xl border-gray-200 focus:ring-yellow-400 h-12 bg-gray-50/50">
                        <SelectValue placeholder="Select a ticket type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                        {ticketTypes.map((ticket) => (
                          <SelectItem
                            key={ticket.id}
                            value={String(ticket.id)}
                            disabled={ticket.is_sold_out}
                            className="py-3 px-4 focus:bg-yellow-50 focus:text-yellow-900 cursor-pointer"
                          >
                            <div className="flex justify-between items-center w-full min-w-[200px]">
                              <span className="font-medium">{ticket.name}</span>
                              <span className={`text-sm ml-4 ${ticket.is_sold_out ? 'text-red-500 font-bold uppercase text-xs' : 'text-gray-600 font-mono'}`}>
                                {ticket.is_sold_out ? 'SOLD OUT' : formatPrice(ticket.price)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedTicket && (
                  <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-gray-700 font-semibold">Quantity</Label>
                      <div className="flex items-center space-x-3 bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleQuantityChange(formData.quantity - 1)}
                          disabled={formData.quantity <= (selectedTicket.min_per_order || 1)}
                          className="h-8 w-8 rounded-lg hover:bg-gray-100 hover:text-black"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-bold text-lg text-gray-900">
                          {formData.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleQuantityChange(formData.quantity + 1)}
                          disabled={formData.quantity >= maxQuantity}
                          className="h-8 w-8 rounded-lg hover:bg-gray-100 hover:text-black"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-right text-xs text-gray-500 font-medium">
                      {maxQuantity > 0
                        ? `${maxQuantity} available`
                        : 'No tickets available'}
                    </p>

                    <div className="mt-4 pt-4 border-t border-gray-200/60">
                      <DiscountCodeInput
                        eventId={String(event.id)}
                        orderAmount={basePrice}
                        onDiscountApplied={handleDiscountApplied}
                        onDiscountRemoved={handleDiscountRemoved}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-6 bg-gradient-to-r from-gray-50 to-white p-4 rounded-xl border border-gray-100">
                    <div>
                      <span className="font-bold text-gray-700 block">Total Amount</span>
                      {discountAmount > 0 && (
                        <div className="text-xs text-green-600 font-medium mt-1 bg-green-50 px-2 py-0.5 rounded-full inline-block">
                          Saved {formatPrice(discountAmount)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-gray-900">{formatPrice(finalPrice)}</span>
                      {discountAmount > 0 && (
                        <div className="text-sm text-gray-400 line-through decoration-red-400">
                          {formatPrice(basePrice)}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-14 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 rounded-xl text-lg font-bold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-5 w-5" />
                        Pay Now via M-Pesa
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-400 text-center mt-3 font-medium">
                    Secured by Payd • Instant Confirmation
                  </p>
                </div>
              </form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
