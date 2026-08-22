import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Loader2 } from 'lucide-react';

interface ProductDeleteDialogProps {
  open: boolean;
  deletingId: string | null;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ProductDeleteDialog({ open, deletingId, onOpenChange, onCancel, onConfirm }: ProductDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-[340px] bg-[#0a0a0a] border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Delete Product</DialogTitle>
          <DialogDescription className="text-white/60">
            Are you sure you want to delete this product? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={!!deletingId}
            className="bg-transparent border-white/10 text-white hover:bg-white/5 h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!!deletingId}
            className="h-8 text-xs"
          >
            {deletingId ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Product'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


