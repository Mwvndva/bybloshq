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
            <DialogContent className="w-full max-w-full sm:max-w-[640px] p-0 bg-transparent border-none shadow-none focus-visible:outline-none h-[100dvh] sm:h-auto overflow-hidden">
              <div className="product-modal-light bg-black border-x border-y sm:border border-white/15 rounded-none sm:rounded-[2.5rem] h-full sm:h-auto overflow-hidden shadow-2xl flex flex-col">
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
