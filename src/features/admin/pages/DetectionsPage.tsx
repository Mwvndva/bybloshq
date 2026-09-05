import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Textarea } from '@/shared/ui/textarea';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { DetectionCard } from '../components/DetectionCard';
import { useDetections } from '../hooks/useDetections';

export default function DetectionsPage() {
  const {
    earnings,
    isLoading,
    selectedEarning,
    setSelectedEarning,
    isReleaseDialogOpen,
    setIsReleaseDialogOpen,
    isReverseDialogOpen,
    setIsReverseDialogOpen,
    reviewNotes,
    setReviewNotes,
    isProcessing,
    handleRelease,
    handleReverse,
  } = useDetections();

  const formatCurrency = (value: string) => {
    return `KSh ${Number.parseFloat(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic">
            DETECTIONS<span className="text-orange-500">.</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2 ml-1">
            Creator self-dealing review queue — never shown to the creator or buyer
          </p>
        </div>
      </div>

      {earnings.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-7 w-7" />}
          title="No suspected self-dealing"
          description="Creator earnings are only listed here when the system's post-hoc check finds the order's buyer matches the creator's own identity. Nothing needs review right now."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {earnings.map((earning) => (
            <DetectionCard
              key={`${earning.earning_type}-${earning.id}`}
              earning={earning}
              formatCurrency={formatCurrency}
              onRelease={() => { setReviewNotes(''); setSelectedEarning(earning); setIsReleaseDialogOpen(true); }}
              onReverse={() => { setReviewNotes(''); setSelectedEarning(earning); setIsReverseDialogOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* Release Dialog */}
      <Dialog open={isReleaseDialogOpen} onOpenChange={setIsReleaseDialogOpen}>
        <DialogContent
          role="dialog"
          aria-modal="true"
          className="bg-[#0A0A0A] border border-white/10 text-white sm:rounded-[2.5rem] p-10 max-w-md shadow-[0_0_100px_rgba(34,197,94,0.1)]"
        >
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black text-white tracking-tighter italic">RELEASE<span className="text-green-500">.</span></DialogTitle>
          </DialogHeader>

          {selectedEarning && (
            <div className="space-y-8">
              <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-8 text-center shadow-inner">
                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-4 opacity-60">Reviewed as legitimate</p>
                <p className="text-5xl font-black text-green-400 tracking-tighter tabular-nums mb-4">
                  {formatCurrency(selectedEarning.amount)}
                </p>
                <div className="h-px bg-green-500/20 w-12 mx-auto mb-4"></div>
                <p className="text-xs font-bold text-green-300">
                  Creator: {selectedEarning.creator_name || `#${selectedEarning.creator_id}`}
                </p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed px-2">
                This clears the hold. The earning becomes subject to the normal T+2 clearing rule again — immediately withdrawable if that window has already passed.
              </p>
              <div className="space-y-4">
                <Label htmlFor="releaseNotes" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 opacity-60">Review notes (optional)</Label>
                <Textarea
                  id="releaseNotes"
                  placeholder="Why this is a false positive..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="bg-white/[0.03] border-white/10 text-white placeholder:text-gray-700 rounded-[1.5rem] focus:border-green-500/50 p-6 font-medium"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-10 gap-4 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => { setIsReleaseDialogOpen(false); setReviewNotes(''); }}
              disabled={isProcessing}
              className="flex-1 h-12 border-white/10 text-gray-500 hover:bg-white/5 hover:text-white bg-transparent rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRelease}
              disabled={isProcessing}
              className="flex-1 h-12 bg-green-500 hover:bg-green-400 text-black font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-green-500/10"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Release'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse Dialog */}
      <Dialog open={isReverseDialogOpen} onOpenChange={setIsReverseDialogOpen}>
        <DialogContent
          role="dialog"
          aria-modal="true"
          className="bg-[#0A0A0A] border border-white/10 text-white sm:rounded-[2.5rem] p-10 max-w-md shadow-[0_0_100px_rgba(239,68,68,0.1)]"
        >
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black text-white tracking-tighter italic">REVERSE<span className="text-red-500">.</span></DialogTitle>
          </DialogHeader>

          {selectedEarning && (
            <div className="space-y-8">
              <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center shadow-inner">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 opacity-60">Confirmed self-dealing</p>
                <p className="text-5xl font-black text-red-400 tracking-tighter tabular-nums mb-4">
                  {formatCurrency(selectedEarning.amount)}
                </p>
                <div className="h-px bg-red-500/20 w-12 mx-auto mb-4"></div>
                <p className="text-xs font-bold text-red-300">
                  Creator: {selectedEarning.creator_name || `#${selectedEarning.creator_id}`}
                </p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed px-2">
                This claws back only this specific earning. If the creator's balance already covers it, it's deducted immediately; if they already withdrew it, a deficit is recorded for manual follow-up instead of a silent write-off.
              </p>
              <div className="space-y-4">
                <Label htmlFor="reverseNotes" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 opacity-60">Review notes *</Label>
                <Textarea
                  id="reverseNotes"
                  placeholder="Evidence for confirmed self-dealing..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="bg-white/[0.03] border-white/10 text-white placeholder:text-gray-700 rounded-[1.5rem] focus:border-red-500/50 p-6 font-medium"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-10 gap-4 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => { setIsReverseDialogOpen(false); setReviewNotes(''); }}
              disabled={isProcessing}
              className="flex-1 h-12 border-white/10 text-gray-500 hover:bg-white/5 hover:text-white bg-transparent rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReverse}
              disabled={isProcessing || !reviewNotes.trim()}
              className="flex-1 h-12 bg-red-500 hover:bg-red-400 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/10"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Reversal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
