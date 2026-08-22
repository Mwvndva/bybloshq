import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Badge } from '@/shared/ui/badge';
import { Textarea } from '@/shared/ui/textarea';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { CheckCircle, XCircle, Clock, DollarSign, Loader2 } from 'lucide-react';
import { RefundRequestCard } from '../components/RefundRequestCard';
import type { RefundRequest } from '../types/refunds';
import { useRefundRequests } from '../hooks/useRefundRequests';


export default function RefundRequestsPage() {
  const {
    requests,
    selectedRequest,
    setSelectedRequest,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    isRejectDialogOpen,
    setIsRejectDialogOpen,
    adminNotes,
    setAdminNotes,
    isProcessing,
    statusFilter,
    setStatusFilter,
    isLoadingRequests,
    fetchRefundRequests,
    handleConfirmRefund,
    handleRejectRefund,
  } = useRefundRequests();

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
    return `KSh ${Number.parseFloat(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (isLoadingRequests) {
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
        <EmptyState
          icon={<DollarSign className="h-7 w-7" />}
          title={`No ${statusFilter} signals detected`}
          description="There are currently no refund requests in this view."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {requests.map((request) => (
          <RefundRequestCard
            key={request.id}
            request={request}
            getStatusBadge={getStatusBadge}
            formatCurrency={formatCurrency}
            onApprove={() => { setAdminNotes(''); setSelectedRequest(request); setIsConfirmDialogOpen(true); }}
            onReject={() => { setAdminNotes(''); setSelectedRequest(request); setIsRejectDialogOpen(true); }}
          />
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



