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
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge className="bg-gray-500/10 text-gray-400 border-white/10">{status}</Badge>;
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
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Refund Requests</h1>

        <div className="flex gap-2">
          {['pending', 'completed', 'rejected'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              onClick={() => setStatusFilter(status)}
              className={`capitalize ${statusFilter === status
                ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                : 'bg-transparent text-gray-400 border-white/10 hover:bg-white/5 hover:text-white'
                }`}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-12 w-12 text-gray-500 mb-4" />
            <p className="text-gray-400">No {statusFilter} refund requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-xl">
              <CardHeader className="bg-white/5 border-b border-white/10">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl text-white">Request #{request.id}</CardTitle>
                    <p className="text-sm text-gray-400 mt-1">
                      Requested: {format(new Date(request.requested_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <User className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="font-medium text-gray-300">Buyer:</span>
                      <span className="ml-2 text-white">{request.buyer_name}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="text-gray-300">{request.buyer_email}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="text-gray-300">{request.buyer_phone}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                      <p className="text-sm text-green-400 font-medium">Refund Amount</p>
                      <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(request.amount)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-400">
                      Current Refund Balance: <span className="text-white">{formatCurrency(request.buyer_current_refunds)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-1 text-gray-300">Payment Method</p>
                      <p className="text-sm text-gray-400">{request.payment_method}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1 text-gray-300">Payment Details</p>
                      <div className="text-sm text-gray-400 space-y-1">
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
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-1 text-gray-300">Buyer Notes</p>
                      <p className="text-sm text-gray-400 bg-black/20 p-3 rounded-xl border border-white/5">{request.notes}</p>
                    </div>
                  )}

                  {request.admin_notes && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-1 text-gray-300">Admin Notes</p>
                      <p className="text-sm text-blue-400 bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">{request.admin_notes}</p>
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => {
                        setSelectedRequest(request);
                        setIsConfirmDialogOpen(true);
                      }}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-xl"
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
                      className="flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-xl bg-transparent"
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
        <DialogContent className="bg-gray-900 border border-white/10 text-white sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Refund Request</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-sm text-green-400">
                  You are about to process a refund of:
                </p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                <p className="text-sm text-green-300 mt-2">
                  To: {selectedRequest.buyer_name}
                </p>
                <p className="text-xs text-green-500/70 mt-1">
                  This will deduct the amount from buyer's refund balance
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNotes" className="text-gray-300">Admin Notes (Optional)</Label>
                <Textarea
                  id="confirmNotes"
                  placeholder="Add any notes about this refund..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-green-500/50"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsConfirmDialogOpen(false);
                setAdminNotes('');
              }}
              disabled={isProcessing}
              className="border-white/10 text-gray-300 hover:bg-white/5 hover:text-white bg-transparent rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRefund}
              disabled={isProcessing}
              className="bg-green-500 hover:bg-green-600 text-black font-semibold rounded-xl"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="bg-gray-900 border border-white/10 text-white sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Refund Request</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-400">
                  You are about to reject a refund request for:
                </p>
                <p className="text-2xl font-bold text-red-400">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                <p className="text-sm text-red-300 mt-2">
                  From: {selectedRequest.buyer_name}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectNotes" className="text-gray-300">Reason for Rejection *</Label>
                <Textarea
                  id="rejectNotes"
                  placeholder="Please provide a reason for rejecting this request..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-red-500/50"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setAdminNotes('');
              }}
              disabled={isProcessing}
              className="border-white/10 text-gray-300 hover:bg-white/5 hover:text-white bg-transparent rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectRefund}
              disabled={isProcessing || !adminNotes.trim()}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl"
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

