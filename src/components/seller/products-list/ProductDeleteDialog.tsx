import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      <DialogContent className="sm:max-w-[425px] bg-white border border-slate-200 text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-slate-950">Delete Product</DialogTitle>
          <DialogDescription className="text-slate-700">
            Are you sure you want to delete this product? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={!!deletingId}
            className="bg-transparent border-slate-200 text-slate-700 hover:bg-slate-50 h-8 text-xs"
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


