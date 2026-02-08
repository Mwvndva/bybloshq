import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PaymentProvider } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Minus, Plus, Loader2, CreditCard, Smartphone, Ticket, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiRequest } from '@/lib/axios';
import { DiscountCodeInput } from '@/components/shared/DiscountCodeInput';

type PurchaseFormData = {
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
  ticketTypeId: string;
  quantity: number;
  paymentMethod: PaymentProvider;
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
  description?: string;
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
  theme?: 'yellow' | 'default';
}

export function TicketPurchaseForm({
  event,
  open,
  onOpenChange,
  onSubmit,
  theme = 'yellow',
}: TicketPurchaseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [waitingForStk, setWaitingForStk] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<{ reference?: string; email?: string }>({});
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedDiscountCode, setAppliedDiscountCode] = useState('');
  const [paymentInitiationData, setPaymentInitiationData] = useState<any>(null);
  const [formData, setFormData] = useState<PurchaseFormData>(() => ({
    customerName: '',
    customerEmail: '',
    phoneNumber: '',
    ticketTypeId: '',
    quantity: 1,
    paymentMethod: 'payd',
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

  // Format Price Helper
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: price % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    }).format(price);
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
        paymentMethod: 'payd',
        amount: 0,
        eventId: event.id
      });
      setDiscountAmount(0);
      setAppliedDiscountCode('');
      setPurchaseComplete(false);
      setWaitingForStk(false);
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

        // Show STK Push confirmation
        toast({
          title: 'STK Push Sent',
          description: 'Please check your phone to complete the payment.',
          duration: 5000,
        });

        setWaitingForStk(true);

        // Start polling
        const checkPaymentStatus = async () => {
          let statusChecks = 0;
          const maxStatusChecks = 60; // 5 minutes
          const statusCheckInterval = 5000;

          const timer = setInterval(async () => {
            statusChecks++;
            try {
              const statusRes = await apiRequest.get<PaymentStatusResponse>(`payments/status/${invoiceId}`);

              // Map DB status to success
              const status = statusRes.data?.status || statusRes.status;
              if (status === 'success' || status === 'completed') {
                clearInterval(timer);
                setWaitingForStk(false);
                setPurchaseComplete(true);
                setPurchaseDetails({
                  reference: response.data?.reference,
                  email: purchaseData.customerEmail
                });
                toast({ title: 'Payment Successful', description: 'Your ticket has been booked.' });

                if (onSubmit) {
                  onSubmit({
                    ...purchaseData,
                    paymentMethod: 'payd'
                  });
                }
              } else if (status === 'failed') {
                clearInterval(timer);
                setWaitingForStk(false);
                setIsSubmitting(false);
                toast({
                  title: 'Payment Failed',
                  description: 'The transaction was declined or failed. Please try again.',
                  variant: 'destructive'
                });
              }
            } catch (e) {
              // ignore errors during polling
            }
            if (statusChecks > maxStatusChecks) {
              clearInterval(timer);
              setWaitingForStk(false);
              setIsSubmitting(false);
              toast({
                title: 'Payment Timeout',
                description: 'We did not receive confirmation in time. Please check your email.',
                variant: 'destructive'
              });
            }
          }, statusCheckInterval);
        };

        checkPaymentStatus();

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
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[500px] max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-3xl border border-white/10 shadow-2xl bg-[#0a0a0a] p-0 gap-0 text-white">
        <div className="p-4 sm:p-8">
          {purchaseComplete ? (
            <div className="text-center py-6">
              <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300 border border-green-500/20">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Success!</h3>
              <p className="text-[#a1a1a1] mb-6 font-medium">
                Your ticket has been booked successfully.
                <br />A confirmation email has been sent.
              </p>
              {purchaseDetails.reference && (
                <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/5">
                  <p className="text-[10px] text-[#a1a1a1] mb-1 uppercase tracking-widest font-black">Reference</p>
                  <p className="font-mono text-white font-bold">{purchaseDetails.reference}</p>
                </div>
              )}
              <Button
                variant="secondary-byblos"
                onClick={() => onOpenChange(false)}
                className="w-full rounded-xl h-11 font-black text-base"
              >
                Close
              </Button>
            </div>
          ) : waitingForStk ? (
            <div className="text-center py-10 px-4 sm:py-16">
              <div className="relative mx-auto w-24 h-24 mb-10 flex items-center justify-center">
                <div className="absolute inset-0 bg-yellow-400/10 rounded-full blur-3xl animate-pulse"></div>
                <Loader2 className="h-16 w-16 text-yellow-400 animate-spin relative z-10" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Waiting for Payment</h3>
              <p className="text-[#a1a1a1] mb-10 max-w-[280px] mx-auto text-lg leading-snug font-medium">
                We've sent an M-PESA prompt to <span className="text-yellow-400 font-bold">{formData.phoneNumber}</span>
              </p>
              <div className="bg-yellow-400/5 border border-yellow-400/10 px-8 py-3 rounded-2xl inline-block">
                <p className="text-sm font-black text-yellow-400 uppercase tracking-widest">Check your phone</p>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader className="mb-8 space-y-4">
                <div className="mx-auto w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                  <Ticket className="h-7 w-7 text-yellow-400" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-black text-center text-white">Purchase Tickets</DialogTitle>
                  <DialogDescription className="text-center text-base font-medium text-[#a1a1a1]">
                    {event.name}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="text-xs font-black uppercase tracking-wider text-[#a1a1a1]">Full Name</Label>
                  <Input
                    id="customerName"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                    required
                    minLength={2}
                    maxLength={100}
                    className="text-base rounded-xl border-white/10 focus-visible:ring-yellow-400 h-12 bg-white/5 text-white placeholder:text-[#555555]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail" className="text-xs font-black uppercase tracking-wider text-[#a1a1a1]">Email Address</Label>
                  <Input
                    id="customerEmail"
                    name="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    required
                    className="text-base rounded-xl border-white/10 focus-visible:ring-yellow-400 h-12 bg-white/5 text-white placeholder:text-[#555555]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-xs font-black uppercase tracking-wider text-[#a1a1a1]">Phone Number</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <span className="text-[#a1a1a1] text-sm font-bold">+254</span>
                    </div>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="712 345 678"
                      className={`text-base pl-14 rounded-xl border-white/10 focus-visible:ring-yellow-400 h-12 bg-white/5 text-white placeholder:text-[#555555] ${phoneError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
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
                  <p className="text-[10px] text-[#555555] mt-1 font-medium">
                    Please use your M-PESA registered number
                  </p>
                </div>

                {ticketTypes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-wider text-[#a1a1a1]">Ticket Type</Label>
                    <Select
                      value={formData.ticketTypeId}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        ticketTypeId: value,
                        quantity: 1 // Reset quantity when ticket type changes
                      }))}
                      required
                    >
                      <SelectTrigger className="text-base rounded-xl border-white/10 focus:ring-yellow-400 h-12 bg-white/5 text-white">
                        <SelectValue placeholder="Select a ticket type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111111] border-white/10 text-white">
                        {ticketTypes.map((ticket) => (
                          <SelectItem
                            key={ticket.id}
                            value={String(ticket.id)}
                            disabled={ticket.is_sold_out}
                            className="hover:bg-white/5 focus:bg-white/5"
                          >
                            <div className="flex flex-col w-full text-left gap-1">
                              <div className="flex justify-between items-center w-full">
                                <span className="font-bold">{ticket.name}</span>
                                <span className="text-sm font-black text-yellow-400 ml-2">
                                  {formatPrice(ticket.price)}
                                  {ticket.is_sold_out && ' (Sold Out)'}
                                </span>
                              </div>
                              {ticket.description && (
                                <span className="text-xs text-[#a1a1a1] line-clamp-2 leading-tight pr-4">
                                  {ticket.description}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTicket?.description && (
                      <p className="text-xs text-[#a1a1a1] mt-1 bg-white/5 p-3 rounded-xl border border-white/5 italic">
                        {selectedTicket.description}
                      </p>
                    )}
                  </div>
                )}

                {selectedTicket && (
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-wider text-[#a1a1a1]">Quantity</Label>
                    <div className="flex items-center space-x-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleQuantityChange(formData.quantity - 1)}
                        disabled={formData.quantity <= (selectedTicket.min_per_order || 1)}
                        className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="flex-1 text-center font-black text-2xl text-white">
                        {formData.quantity}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleQuantityChange(formData.quantity + 1)}
                        disabled={formData.quantity >= maxQuantity}
                        className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-[#555555] text-center font-bold">
                      {maxQuantity > 0
                        ? `${maxQuantity} ${maxQuantity === 1 ? 'TICKET' : 'TICKETS'} REMAINING`
                        : 'NO TICKETS REMAINING'}
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

                <div className="pt-4">
                  <div className="flex items-center justify-between border-t border-white/10 pt-6">
                    <div>
                      <span className="font-bold text-white text-lg">Subtotal</span>
                      {discountAmount > 0 && (
                        <div className="text-sm text-green-400 font-bold">
                          Saved: {formatPrice(discountAmount)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-yellow-400">{formatPrice(finalPrice)}</span>
                      {discountAmount > 0 && (
                        <div className="text-xs text-[#a1a1a1] line-through">
                          {formatPrice(basePrice)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <Button
                    type="submit"
                    variant="secondary-byblos"
                    className="w-full h-14 rounded-2xl font-black text-base transition-all duration-300 transform active:scale-95 shadow-2xl hover:shadow-yellow-400/20"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-3 h-5 w-5" />
                        Complete Booking • {formatPrice(finalPrice)}
                      </>
                    )}
                  </Button>

                  <p className="text-[10px] text-[#555555] text-center mt-4 font-bold uppercase tracking-widest">
                    Secured by PayD Payments
                  </p>
                </div>
              </form>
            </>
          )
          }
        </div >
      </DialogContent >
    </Dialog >
  );
}
