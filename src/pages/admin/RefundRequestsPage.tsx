import { useState, useEffect, useCallback } from 'react';
import { adminApiInstance as axios } from '@/api/adminApi';
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
  }, [fetchRefundRequests]);

  const fetchRefundRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/refunds?status=${statusFilter}`);
      setRequests(response.data.data.requests);
    } catch (error) {
      console.error('Error fetching refund requests:', error);
      toast.error('Failed to load refund requests');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const handleConfirmRefund = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      await axios.patch(
        `${API_URL}/refunds/${selectedRequest.id}/confirm`,
        { adminNotes }
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
      await axios.patch(
        `${API_URL}/refunds/${selectedRequest.id}/reject`,
        { adminNotes }
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic">REFUND<span className="text-red-500">.</span>PROTOCOL</h1>
          <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2 ml-1">Capital Reclamation Management</p>
        </div>

        <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
          {['pending', 'completed', 'rejected'].map((status) => (
            <Button
              key={status}
              variant="ghost"
              onClick={() => setStatusFilter(status)}
              className={`capitalize px-6 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statusFilter === status
                ? 'bg-white/10 text-white shadow-inner'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center py-24 opacity-40">
            <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 border border-white/5">
              <DollarSign className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">No {statusFilter} signals detected</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {requests.map((request) => (
            <Card key={request.id} className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group hover:border-white/20 transition-all duration-500">
              <CardHeader className="p-8 border-b border-white/5 bg-white/[0.01]">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-60">Sequence</p>
                      <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[10px] font-black text-white">#{request.id}</div>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Captured: {format(new Date(request.requested_at), 'MMM d, yyyy • h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40">Subject Identification</p>
                    <div className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-base font-black text-white tracking-tight">{request.buyer_name}</p>
                        <p className="text-[10px] font-bold text-gray-500 lowercase opacity-60">{request.buyer_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                      <Phone className="h-3 w-3" />
                      {request.buyer_phone}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40">Capital Breakdown</p>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] text-green-400/60 font-black uppercase tracking-widest mb-1">Requested Reclamation</p>
                      <p className="text-3xl font-black text-green-400 tracking-tighter tabular-nums">
                        {formatCurrency(request.amount)}
                      </p>
                    </div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 opacity-60">
                      Total Allocation: <span className="text-white ml-2 tabular-nums">{formatCurrency(request.buyer_current_refunds)}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40 mb-3">Protocol</p>
                      <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 text-xs font-bold text-white tracking-tight">
                        {request.payment_method}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40 mb-3">Endpoint Meta</p>
                      <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 space-y-2">
                        {(() => {
                          try {
                            const details = typeof request.payment_details === 'string'
                              ? JSON.parse(request.payment_details)
                              : request.payment_details;
                            return (
                              <>
                                {details.phone && <p className="text-xs font-bold text-gray-300">📱 {details.phone}</p>}
                                {details.name && <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{details.name}</p>}
                              </>
                            );
                          } catch (e) {
                            return <p className="text-xs font-bold text-gray-600">NULL</p>;
                          }
                        })()}
                      </div>
                    </div>
                  </div>

                  {request.notes && (
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40 mb-3">Subject Manifest</p>
                      <p className="text-xs font-medium text-gray-400 bg-white/[0.02] p-5 rounded-2xl border border-white/5 leading-relaxed">{request.notes}</p>
                    </div>
                  )}

                  {request.admin_notes && (
                    <div>
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">Operator Annotation</p>
                      <p className="text-xs font-bold text-blue-400 bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20">{request.admin_notes}</p>
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div className="flex gap-4 pt-6">
                    <Button
                      onClick={() => {
                        setAdminNotes('');
                        setSelectedRequest(request);
                        setIsConfirmDialogOpen(true);
                      }}
                      className="flex-1 h-14 bg-green-500 hover:bg-green-400 text-black font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all duration-300 shadow-lg shadow-green-500/10"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Authorize Payout
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAdminNotes('');
                        setSelectedRequest(request);
                        setIsRejectDialogOpen(true);
                      }}
                      className="flex-1 h-14 border-white/10 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl bg-transparent font-black text-[10px] uppercase tracking-widest transition-all duration-300"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Veto Request
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
        <DialogContent
          role="dialog"
          aria-modal="true"
          className="bg-[#0A0A0A] border border-white/10 text-white sm:rounded-[2.5rem] p-10 max-w-md shadow-[0_0_100px_rgba(34,197,94,0.1)]"
        >
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black text-white tracking-tighter italic">AUTHORIZE<span className="text-green-500">.</span></DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-8">
              <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-8 text-center shadow-inner">
                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-4 opacity-60">Pending Settlement</p>
                <p className="text-5xl font-black text-green-400 tracking-tighter tabular-nums mb-4">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                <div className="h-px bg-green-500/20 w-12 mx-auto mb-4"></div>
                <p className="text-xs font-bold text-green-300">
                  Beneficiary: {selectedRequest.buyer_name}
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="confirmNotes" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 opacity-60">Operator Log (Optional)</Label>
                <Textarea
                  id="confirmNotes"
                  placeholder="Record transmission details..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  className="bg-white/[0.03] border-white/10 text-white placeholder:text-gray-700 rounded-[1.5rem] focus:border-green-500/50 p-6 font-medium"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-10 gap-4 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setIsConfirmDialogOpen(false);
                setAdminNotes('');
              }}
              disabled={isProcessing}
              className="flex-1 h-12 border-white/10 text-gray-500 hover:bg-white/5 hover:text-white bg-transparent rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Abort
            </Button>
            <Button
              onClick={handleConfirmRefund}
              disabled={isProcessing}
              className="flex-1 h-12 bg-green-500 hover:bg-green-400 text-black font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-green-500/10"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Release'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent
          role="dialog"
          aria-modal="true"
          className="bg-[#0A0A0A] border border-white/10 text-white sm:rounded-[2.5rem] p-10 max-w-md shadow-[0_0_100px_rgba(239,68,68,0.1)]"
        >
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black text-white tracking-tighter italic">VETO<span className="text-red-500">.</span></DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-8">
              <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center shadow-inner">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 opacity-60">Reclamation Void</p>
                <p className="text-5xl font-black text-red-400 tracking-tighter tabular-nums mb-4">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                <div className="h-px bg-red-500/20 w-12 mx-auto mb-4"></div>
                <p className="text-xs font-bold text-red-300">
                  Subject: {selectedRequest.buyer_name}
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="rejectNotes" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 opacity-60">Veto Rationale *</Label>
                <Textarea
                  id="rejectNotes"
                  placeholder="Record rejection cause..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  className="bg-white/[0.03] border-white/10 text-white placeholder:text-gray-700 rounded-[1.5rem] focus:border-red-500/50 p-6 font-medium"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-10 gap-4 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setAdminNotes('');
              }}
              disabled={isProcessing}
              className="flex-1 h-12 border-white/10 text-gray-500 hover:bg-white/5 hover:text-white bg-transparent rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Abort
            </Button>
            <Button
              onClick={handleRejectRefund}
              disabled={isProcessing || !adminNotes.trim()}
              className="flex-1 h-12 bg-red-500 hover:bg-red-400 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/10"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Execute Veto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

