import { useState } from 'react';
import apiClient from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

export interface PaymentDetails {
    fullName: string;
    email: string;
    mobilePayment: string;
    city?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
}

export const usePaymentFlow = () => {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const initiatePayment = async (
        product: any,
        buyerDetails: PaymentDetails,
        bookingDetails: any = null
    ) => {
        if (product.price < 10) {
            toast({
                title: "Minimum Amount Not Met",
                description: `Payments must be at least 10 KES.`,
                variant: "destructive"
            });
            return null;
        }

        setIsProcessing(true);
        try {
            const isService = product.product_type === 'service' || product.productType === 'service';
            const isDigital = product.product_type === 'digital' || product.productType === 'digital' || product.is_digital || product.isDigital;

            const payload = {
                phone: buyerDetails.mobilePayment,
                mobilePayment: buyerDetails.mobilePayment,
                email: buyerDetails.email,
                amount: product.price,
                productId: product.id,
                sellerId: product.sellerId || product.seller?.id,
                productName: product.name,
                customerName: buyerDetails.fullName,
                narrative: `Purchase of ${product.name}`,
                paymentMethod: 'payd',
                buyerLocation: bookingDetails?.buyerLocation || (buyerDetails.city && buyerDetails.location ? {
                    address: `${buyerDetails.city}, ${buyerDetails.location}`,
                    lat: buyerDetails.latitude || 0,
                    lng: buyerDetails.longitude || 0
                } : undefined),
                metadata: bookingDetails ? {
                    booking_date: format(bookingDetails.date, 'yyyy-MM-dd'),
                    booking_time: bookingDetails.time,
                    service_location: bookingDetails.location,
                    service_requirements: bookingDetails.serviceRequirements,
                    buyer_location: bookingDetails.buyerLocation,
                    product_type: isService ? 'service' : (isDigital ? 'digital' : 'physical')
                } : {
                    product_type: isService ? 'service' : (isDigital ? 'digital' : 'physical')
                }
            };

            const response = await apiClient.post('/payments/initiate-product', payload) as any;
            const data = response.data;

            if (data.status === 'success' || data.success === true) {
                toast({
                    title: 'STK Push Sent',
                    description: 'Please check your phone to complete the payment.',
                    duration: 10000
                });
                return data.data;
            } else {
                throw new Error(data.message || 'Payment initiation failed');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Could not initiate payment';
            toast({
                title: 'Payment Failed',
                description: errorMessage,
                variant: 'destructive',
                duration: 8000
            });
            return null;
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        initiatePayment,
        isProcessing
    };
};
