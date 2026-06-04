import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { AddProductForm } from '../../AddProductForm';
import { ProductsList } from '../../ProductsList';
import type { Product } from '../types';

interface ProductsTabProps {
  fetchProducts: () => Promise<void>;
  isAddProductModalOpen: boolean;
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct: (id: string) => void;
  onStatusUpdate: (productId: string, newStatus: 'available' | 'sold') => Promise<void>;
  products: Product[];
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
  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="text-center px-2 sm:px-0">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950 mb-1.5">Product Management</h2>
        <p className="text-slate-700 text-xs sm:text-sm lg:text-base font-medium">Manage all your products in one place</p>
      </div>

      <div className="space-y-4">
        <div className="seller-service-charge-notice rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-xs sm:text-sm font-semibold leading-relaxed">
          Byblos adds a 2% service charge to each product price to keep products safe in transit, secure the transaction, and support our operations and maintenance.
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-950">All Products</h3>
            <p className="text-slate-700 text-xs sm:text-sm font-medium mt-1">Manage inventory and track stock levels</p>
          </div>

          <Dialog open={isAddProductModalOpen} onOpenChange={setIsAddProductModalOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-3 py-1.5 rounded-lg font-semibold text-xs w-full sm:w-auto h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="inset-0 max-h-none max-w-none translate-x-0 translate-y-0 rounded-none border-none bg-transparent p-0 shadow-none focus-visible:outline-none sm:left-1/2 sm:top-1/2 sm:h-[min(92dvh,760px)] sm:w-[min(94vw,640px)] sm:translate-x-[-50%] sm:translate-y-[-50%]">
              <div className="product-modal-light flex h-full min-h-0 flex-col overflow-hidden rounded-none border-x border-y border-white/15 bg-black shadow-2xl sm:rounded-[2rem] sm:border">
                <AddProductForm
                  onSuccess={() => {
                    fetchProducts();
                    setIsAddProductModalOpen(false);
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ProductsList
          products={products as any}
          onDelete={onDeleteProduct}
          onEdit={onEditProduct}
          onStatusUpdate={onStatusUpdate}
          onRefresh={fetchProducts}
        />
      </div>
    </div>
  );
}
