import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent } from '@/shared/ui/dialog';
import { AddProductForm } from '../../AddProductForm';
import { ProductsList } from '../../ProductsList';
import type { ProductSummary } from '@/shared/types/view/productSummary';

interface ProductsTabProps {
  fetchProducts: () => Promise<void>;
  isAddProductModalOpen: boolean;
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct: (id: string) => void;
  onStatusUpdate: (productId: string, newStatus: 'available' | 'sold') => Promise<void>;
  products: ProductSummary[];
  setIsAddProductModalOpen: (open: boolean) => void;
}

export function ProductsTab({
  fetchProducts,
  isAddProductModalOpen,
  onDeleteProduct,
  onEditProduct,
  onStatusUpdate,
  products,
  setIsAddProductModalOpen
}: ProductsTabProps) {
  const hasProducts = products.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="text-center px-2 sm:px-0">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-1.5">Product Management</h2>
        <p className="text-white/60 text-xs sm:text-sm lg:text-base font-medium">Manage all your products in one place</p>
      </div>

      <div className="space-y-4">
        {/* Service-charge notice — explicitly readable in both light and dark themes. */}
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-100 px-4 py-3 text-xs sm:text-sm font-semibold leading-relaxed">
          Byblos adds a 2% service charge to each product price to keep products safe in transit, secure the transaction, and support our operations and maintenance.
        </div>

        {/* Single controlled add-product dialog, opened from the header button or the empty-state plus. */}
        <Dialog open={isAddProductModalOpen} onOpenChange={setIsAddProductModalOpen}>
          <DialogContent className="w-[92vw] max-w-lg sm:max-w-[540px] max-h-[85dvh] sm:h-[min(84dvh,640px)] p-0 overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] rounded-3xl sm:rounded-[2rem] shadow-2xl [&>button]:z-30">
            <div className="product-modal-light flex h-full min-h-0 flex-col overflow-hidden">
              <AddProductForm
                onSuccess={() => {
                  fetchProducts();
                  setIsAddProductModalOpen(false);
                }}
                onClose={() => setIsAddProductModalOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>

        {hasProducts ? (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">All Products</h3>
                <p className="text-white/60 text-xs sm:text-sm font-medium mt-1">Manage inventory and track stock levels</p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddProductModalOpen(true)}
                className="gap-1.5 bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)] hover:opacity-90 shadow-lg px-3 py-1.5 rounded-lg font-semibold text-xs w-full sm:w-auto h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                Add products
              </Button>
            </div>

            <ProductsList
              products={products as import('@/shared/types').Product[]}
              onDelete={onDeleteProduct}
              onEdit={onEditProduct}
              onStatusUpdate={onStatusUpdate}
              onRefresh={fetchProducts}
            />
          </>
        ) : (
          /* Empty state: a single prominent plus that opens the existing creation flow. */
          <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
            <button
              type="button"
              onClick={() => setIsAddProductModalOpen(true)}
              aria-label="Add your first product"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)] shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-button-bg,#f5c518)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <Plus className="h-10 w-10" strokeWidth={2.5} />
            </button>
            <p className="text-sm font-semibold text-white/80">Tap the plus to add your first product</p>
          </div>
        )}
      </div>
    </div>
  );
}
