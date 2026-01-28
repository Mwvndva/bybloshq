import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, DollarSign, Loader2, User, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface RefundRequest {
  id: number;
  buyer_id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_current_refunds: string;
  amount: string;
  status: string;
  payment_method: string;
  payment_details: any;
  notes: string;
  admin_notes: string;
  requested_at: string;
  processed_at: string;
}

export default function RefundRequestsPage() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    fetchRefundRequests();
  }, [statusFilter]);

  const fetchRefundRequests = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get<{ data: { requests: RefundRequest[] } }>(`${API_URL}/refunds?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data.data.requests);
    } catch (error) {
      console.error('Error fetching refund requests:', error);
      toast.error('Failed to load refund requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRefund = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('admin_token');
      await axios.patch(
        `${API_URL}/refunds/${selectedRequest.id}/confirm`,
        { adminNotes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Refund confirmed and processed successfully!');
      setIsConfirmDialogOpen(false);
      setAdminNotes('');
      setSelectedRequest(null);
      fetchRefundRequests();
    } catch (error: any) {
      console.error('Error confirming refund:', error);
      toast.error(error.response?.data?.message || 'Failed to confirm refund');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('admin_token');
      await axios.patch(
        `${API_URL}/refunds/${selectedRequest.id}/reject`,
        { adminNotes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Refund request rejected');
      setIsRejectDialogOpen(false);
      setAdminNotes('');
      setSelectedRequest(null);
      fetchRefundRequests();
    } catch (error: any) {
      console.error('Error rejecting refund:', error);
      toast.error(error.response?.data?.message || 'Failed to reject refund');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (value: string) => {
    return `KSh ${parseFloat(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Refund Requests</h1>

        <div className="flex gap-2">
          {['pending', 'completed', 'rejected'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-300">No {statusFilter} refund requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">Request #{request.id}</CardTitle>
                    <p className="text-sm text-gray-300">
                      Requested: {format(new Date(request.requested_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <User className="h-4 w-4 mr-2 text-gray-300" />
                      <span className="font-medium">Buyer:</span>
                      <span className="ml-2">{request.buyer_name}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Mail className="h-4 w-4 mr-2 text-gray-300" />
                      <span>{request.buyer_email}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Phone className="h-4 w-4 mr-2 text-gray-300" />
                      <span>{request.buyer_phone}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-gray-700 font-medium">Refund Amount</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(request.amount)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-600">
                      Current Refund Balance: {formatCurrency(request.buyer_current_refunds)}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Payment Method</p>
                      <p className="text-sm text-gray-700">{request.payment_method}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Payment Details</p>
                      <div className="text-sm text-gray-700 space-y-1">
                        {(() => {
                          try {
                            const details = typeof request.payment_details === 'string'
                              ? JSON.parse(request.payment_details)
                              : request.payment_details;
                            return (
                              <>
                                {details.phone && <p>📱 {details.phone}</p>}
                                {details.name && <p>👤 {details.name}</p>}
                                {details.email && <p>✉️ {details.email}</p>}
                              </>
                            );
                          } catch (e) {
                            return <p>N/A</p>;
                          }
                        })()}
                      </div>
                    </div>
                  </div>

                  {request.notes && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-1">Buyer Notes</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{request.notes}</p>
                    </div>
                  )}

                  {request.admin_notes && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-1">Admin Notes</p>
                      <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded">{request.admin_notes}</p>
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => {
                        setSelectedRequest(request);
                        setIsConfirmDialogOpen(true);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm & Process
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request);
                        setIsRejectDialogOpen(true);
                      }}
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Refund Request</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  You are about to process a refund of:
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  To: {selectedRequest.buyer_name}
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  This will deduct the amount from buyer's refund balance
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNotes">Admin Notes (Optional)</Label>
                <Textarea
                  id="confirmNotes"
                  placeholder="Add any notes about this refund..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsConfirmDialogOpen(false);
                setAdminNotes('');
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRefund}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Refund Request</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  You are about to reject a refund request for:
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  From: {selectedRequest.buyer_name}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectNotes">Reason for Rejection *</Label>
                <Textarea
                  id="rejectNotes"
                  placeholder="Please provide a reason for rejecting this request..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setAdminNotes('');
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectRefund}
              disabled={isProcessing || !adminNotes.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

