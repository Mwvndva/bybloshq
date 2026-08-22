import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Loader2, Package } from 'lucide-react';
import type { Product } from '@/shared/types';
import { cn } from '@/shared/utils/formatting';

interface ProductInventoryDialogProps {
  open: boolean;
  selectedProduct: Product | null;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  updatingStock: boolean;
  onOpenChange: (open: boolean) => void;
  onStockQuantityChange: (value: number) => void;
  onLowStockThresholdChange: (value: number) => void;
  onTrackInventoryChange: (value: boolean) => void;
  onSave: () => void;
}

export function ProductInventoryDialog({
  open,
  selectedProduct,
  stockQuantity,
  lowStockThreshold,
  trackInventory,
  updatingStock,
  onOpenChange,
  onStockQuantityChange,
  onLowStockThresholdChange,
  onTrackInventoryChange,
  onSave
}: ProductInventoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border border-white/10 text-white w-[90vw] max-w-sm sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            Manage Inventory
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Update stock levels for {selectedProduct?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between p-4 seller-card-soft rounded-xl">
            <div>
              <label className="text-sm font-semibold text-white">Track Inventory</label>
              <p className="text-xs text-white/60 mt-1 font-medium">Enable stock tracking for this product</p>
            </div>
            <button
              type="button"
              onClick={() => onTrackInventoryChange(!trackInventory)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                trackInventory ? 'bg-emerald-500' : 'bg-zinc-700'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white/95 transition-transform shadow-md',
                  trackInventory ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {trackInventory && (
            <>
              <div className="space-y-2">
                <label className="seller-label text-sm font-semibold">Current Stock</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={stockQuantity}
                    onChange={(event) => onStockQuantityChange(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                    placeholder="0"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Badge
                      className={cn(
                        'font-bold',
                        stockQuantity === 0
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : stockQuantity <= lowStockThreshold
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      )}
                    >
                      {stockQuantity === 0 ? 'OUT' : stockQuantity <= lowStockThreshold ? 'LOW' : 'OK'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="seller-label text-sm font-semibold">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  min="1"
                  value={lowStockThreshold}
                  onChange={(event) => onLowStockThresholdChange(Math.max(1, Number.parseInt(event.target.value, 10) || 5))}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                  placeholder="5"
                />
                <p className="text-xs text-white/60 font-medium">
                  You'll receive an email alert when stock falls to or below this level
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={updatingStock}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 font-bold shadow-md"
          >
            {updatingStock ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


