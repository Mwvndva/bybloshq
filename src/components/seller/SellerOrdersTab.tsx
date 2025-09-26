import React, { useState, useEffect } from 'react';
import { sellerApi, SellerOrder } from '@/api/sellerApi';
import { OrderStatus } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Truck, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const statusVariantMap: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  confirmed: 'bg-blue-100 text-blue-800',
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SellerOrdersTab = () => {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await sellerApi.getSellerOrders();
        
        // Log the complete order data structure
        console.log('Orders data received:', {
          count: data.length,
          sampleOrder: data[0] ? {
            id: data[0].id,
            order_number: data[0].order_number,
            total_amount: data[0].total_amount,
            total_amount_type: typeof data[0].total_amount,
            items: data[0].items?.map(item => ({
              id: item.id,
              product_name: item.product_name,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.subtotal
            }))
          } : 'No orders'
        });
        
        setOrders(data);
      } catch (err: any) {
        console.error('Error fetching orders:', err);
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handleMarkAsDeliveredClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setConfirmDialogOpen(true);
  };

  const confirmMarkAsDelivered = async () => {
    if (!selectedOrderId) return;
    
    try {
      setUpdatingOrderId(selectedOrderId);
      setConfirmDialogOpen(false);
      
      const result = await sellerApi.markOrderAsDelivered(selectedOrderId);
      
      if (result.success) {
        // Update the order status in the local state
        setOrders(orders.map(order => {
          // Convert both IDs to strings for comparison to avoid type issues
          const currentOrderId = typeof order.id === 'number' ? order.id.toString() : order.id;
          return currentOrderId === selectedOrderId ? { ...order, status: 'delivered' } : order;
        }));
        
        toast({
          title: 'Success',
          description: 'Order marked as delivered successfully',
          variant: 'default',
        });
      }
    } catch (error: any) {
      console.error('Error marking order as delivered:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark order as delivered',
        variant: 'destructive',
      });
    } finally {
      setUpdatingOrderId(null);
      setSelectedOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading orders...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No orders found</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.order_number}</TableCell>
                  <TableCell>{formatDate(order.created_at)}</TableCell>
                  <TableCell>
                    {order.shipping_address?.first_name} {order.shipping_address?.last_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                          {item.product_image && (
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              className="h-10 w-10 rounded-md object-cover"
                            />
                          )}
                          <span>
                            {item.quantity} × {item.product_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <div>{formatCurrency(Number(order.total_amount))}</div>
                      <div className="text-xs text-gray-500">
                        Raw: {order.total_amount} ({typeof order.total_amount})
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusVariantMap[order.status] || 'bg-gray-100 text-gray-800'} text-xs`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!['delivered', 'cancelled', 'confirmed', 'completed'].includes(order.status) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleMarkAsDeliveredClick(order.id.toString())}
                        disabled={updatingOrderId === order.id.toString() || order.status === 'delivered' as OrderStatus}
                        className="gap-1 text-xs"
                      >
                        {updatingOrderId === order.id.toString() ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Mark as Delivered
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

      {/* Delivery Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <DialogTitle>Confirm Delivery</DialogTitle>
            </div>
            <DialogDescription className="pt-4">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Before marking this order as delivered, please ensure you have completed the following:
                </p>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <p className="text-sm text-yellow-700">
                    Ensure you have dropped the package at Mzigofgo drop off station in Dynamic Mall, 
                    along Tomboya Street - shop number SL 32 before marking the order as delivered.
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  Have you completed this step?
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialogOpen(false)}
              disabled={updatingOrderId !== null}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmMarkAsDelivered}
              disabled={updatingOrderId !== null}
              className="bg-green-600 hover:bg-green-700"
            >
              {updatingOrderId === selectedOrderId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marking as Delivered...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Yes, Mark as Delivered
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SellerOrdersTab;
