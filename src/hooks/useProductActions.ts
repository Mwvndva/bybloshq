import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, Seller } from '@/types';
import { useWishlist } from '@/contexts/WishlistContext';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import { useToast } from '@/components/ui/use-toast';
import apiClient from '@/lib/apiClient';
import { publicApiService } from '@/api/publicApi';
import buyerApi from '@/api/buyerApi';
import { isServiceProduct } from '@/utils/productUtils';

export interface UseProductActionsProps {
    product: Product;
    seller?: Seller;
    hideWishlist?: boolean;
}

export const useProductActions = ({ product, seller }: UseProductActionsProps) => {
    const navigate = useNavigate();
    const { user: userData, isAuthenticated } = useBuyerAuth();
    const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
    const { toast } = useToast();

    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPhoneCheck, setShowPhoneCheck] = useState(false);
    const [showBuyerInfo, setShowBuyerInfo] = useState(false);
    const [showServiceBooking, setShowServiceBooking] = useState(false);
    const [existingBuyer, setExistingBuyer] = useState<any>(null);

    // Toggle Wishlist
    const toggleWishlist = useCallback(async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!isAuthenticated) {
            toast({
                title: "Authentication Required",
                description: "Please login to add items to your wishlist.",
                variant: "destructive"
            });
            return;
        }

        try {
            if (isInWishlist(product.id)) {
                await removeFromWishlist(product.id);
                toast({ title: "Removed from Wishlist", description: `${product.name} has been removed.` });
            } else {
                await addToWishlist(product);
                toast({ title: "Added to Wishlist", description: `${product.name} has been added.` });
            }
        } catch (error) {
            console.error('Wishlist error:', error);
            toast({ title: "Error", description: "Failed to update wishlist.", variant: "destructive" });
        }
    }, [product, isAuthenticated, isInWishlist, addToWishlist, removeFromWishlist, toast]);

    // Handle Card Click
    const handleCardClick = useCallback(() => {
        if (seller?.shopName) {
            navigate(`/buyer/shop/${encodeURIComponent(seller.shopName)}`);
        }
    }, [seller?.shopName, navigate]);

    // Image Navigation
    const scrollToImage = useCallback((index: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentImageIndex(index);
    }, []);

    // Execution of Payment (Internal)
    const executePayment = useCallback(async (buyerData: { email: string; phone: string; fullName: string }) => {
        setIsProcessing(true);
        try {
            const payload = {
                phone: buyerData.phone,
                mobilePayment: buyerData.phone,
                whatsappNumber: buyerData.phone,
                email: buyerData.email,
                amount: product.price,
                productId: product.id,
                sellerId: product.sellerId || (product as any).seller_id,
                productName: product.name,
                customerName: buyerData.fullName,
                paymentMethod: 'payd',
            };

            const response = await apiClient.post('/payments/initiate-product', payload);
            const data = response.data as any;

            if (data.status === 'success') {
                toast({
                    title: "Payment Initiated",
                    description: "Please check your phone for the M-Pesa prompt.",
                });

                // Start Polling
                const reference = data.data?.reference || data.data?.invoice_id;
                if (reference) {
                    const pollResult = await publicApiService.pollPaymentStatus(reference) as any;
                    if (pollResult.status === 'success' || pollResult.status === 'completed') {
                        toast({ title: "Payment Successful", description: "Your purchase has been confirmed!" });
                        setTimeout(() => {
                            navigate(`/payment/success?reference=${reference}&status=success`, { replace: true });
                        }, 1500);
                    } else {
                        toast({ title: "Payment Failed", description: "Transaction was not completed.", variant: "destructive" });
                    }
                }
            } else {
                throw new Error(data.message || 'Failed to initiate payment');
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            toast({
                title: "Payment Failed",
                description: error.response?.data?.error || error.message || "Failed to process payment.",
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    }, [product, toast, navigate]);

    // Handle Buy Now / Book Service
    const handleAction = useCallback(async (e?: React.MouseEvent) => {
        e?.stopPropagation();

        if (isServiceProduct(product)) {
            setShowServiceBooking(true);
            return;
        }

        if (product.isSold) {
            toast({ title: "Sold Out", description: "This product is no longer available.", variant: "destructive" });
            return;
        }

        // Step 1: Check if we have user data from context
        if (userData && userData.email && userData.phone) {
            await executePayment({
                email: userData.email,
                phone: userData.phone,
                fullName: userData.fullName || '',
            });
            return;
        }

        // Step 2: Show Phone Check for guest users
        setShowPhoneCheck(true);
    }, [product, userData, executePayment, toast]);

    // Handle Phone Check Result
    const handlePhoneSubmit = useCallback(async (phone: string) => {
        setIsProcessing(true);
        try {
            const result = await buyerApi.checkBuyerByPhone(phone);
            setShowPhoneCheck(false);

            if (result.exists && result.buyer) {
                if ((result.buyer as any).hasEmail || (result.buyer.email && result.buyer.email.trim() !== '')) {
                    await executePayment({
                        email: result.buyer.email || '',
                        phone: phone,
                        fullName: result.buyer.fullName || '',
                    });
                } else {
                    setExistingBuyer(result.buyer);
                    setShowBuyerInfo(true);
                }
            } else {
                setExistingBuyer({ phone });
                setShowBuyerInfo(true);
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to check phone.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    }, [executePayment, toast]);

    // Handle Buyer Info Complete
    const handleBuyerInfoSubmit = useCallback(async (buyerData: any) => {
        // Note: BuyerInfoModal passes a complex object, we adapt it here
        const adaptedData = {
            email: buyerData.email,
            phone: buyerData.mobilePayment || buyerData.phone,
            fullName: buyerData.fullName
        };
        await executePayment(adaptedData);
        setShowBuyerInfo(false);
    }, [executePayment]);

    // Handle Service Booking
    const handleBookingConfirm = useCallback(async (bookingData: any) => {
        setShowServiceBooking(false);
        // For now we just trigger the payment flow or whatever is next
        // The previous implementation had a complex sequence, let's keep it simple for now
        await handleAction();
    }, [handleAction]);

    return {
        currentImageIndex,
        isProcessing,
        showPhoneCheck,
        showBuyerInfo,
        showServiceBooking,
        existingBuyer,
        setShowPhoneCheck,
        setShowBuyerInfo,
        setShowServiceBooking,
        toggleWishlist,
        handleCardClick,
        scrollToImage,
        handleAction,
        handlePhoneSubmit,
        handleBuyerInfoSubmit,
        handleBookingConfirm,
        isInWishlist: isInWishlist(product.id)
    };
};
