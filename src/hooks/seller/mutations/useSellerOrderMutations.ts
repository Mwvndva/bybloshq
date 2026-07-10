import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/api/seller';
import { sellerQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';
import type { OrderStatus } from '@/types/api/order';

export function useQuotePickupMutation() {
  return useMutation({
    mutationFn: (args: { orderId: string; phone: string; address: string; lat: number | null; lng: number | null }) =>
      sellerApi.quotePickup(args.orderId, {
        phone: args.phone,
        pickupLocation: {
          address: args.address,
          lat: args.lat,
          lng: args.lng
        }
      }),
  });
}

export function useRequestPickupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { orderId: string; phone: string; address: string; lat: number | null; lng: number | null; quote: unknown }) =>
      sellerApi.requestPickup(args.orderId, {
        phone: args.phone,
        pickupLocation: {
          address: args.address,
          lat: args.lat,
          lng: args.lng
        },
        quote: args.quote
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Pickup request submitted successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to request pickup');
    }
  });
}

export function useSelectHubDropoffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => sellerApi.selectHubDropoff(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Dropoff method set to Hub Dropoff');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to select hub dropoff');
    }
  });
}

export function useMarkDroppedAtHubMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => sellerApi.markDroppedAtHub(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Order status updated');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to update order status');
    }
  });
}

export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { orderId: string; status: OrderStatus }) =>
      sellerApi.updateOrderStatus(args.orderId, args.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Order status updated');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to update order status');
    }
  });
}

export function useConfirmBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => sellerApi.confirmBooking(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Booking confirmed');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to confirm booking');
    }
  });
}

export function useCancelSellerOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => sellerApi.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Order cancelled successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to cancel order');
    }
  });
}


