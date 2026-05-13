import { useMemo, useState, type ChangeEvent } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { sellerApi } from '@/api/sellerApi';
import { ProductDeleteDialog } from './products-list/ProductDeleteDialog';
import { ProductEditDialog, type ProductEditFormData } from './products-list/ProductEditDialog';
import { ProductInventoryDialog } from './products-list/ProductInventoryDialog';
import { SellerProductCards } from './products-list/SellerProductCards';
import { SellerProductsTable } from './products-list/SellerProductsTable';

interface ProductsListProps {
  products: Product[];
  onDelete: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  onStatusUpdate?: (productId: string, status: 'available' | 'sold', soldAt: string | null) => void;
  onRefresh?: () => void;
}

const createInitialEditFormData = (): ProductEditFormData => ({
  name: '',
  price: '',
  description: '',
  aesthetic: 'afro-futuristic',
  image: null,
  imagePreview: '',
  extraFiles: [],
  extraPreviews: []
});

const processImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const img = new Image();

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            const MAX_SIZE_KB = 500;

            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
            } else if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.9;
            let imageDataUrl: string;

            do {
              imageDataUrl = canvas.toDataURL('image/jpeg', quality);
              const sizeKB = (imageDataUrl.length * 0.75) / 1024;
              if (sizeKB <= MAX_SIZE_KB || quality <= 0.5) break;
              quality -= 0.1;
            } while (quality >= 0.5);

            resolve(imageDataUrl);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        if (event.target?.result) {
          img.src = event.target.result as string;
        } else {
          reject(new Error('Failed to read file'));
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export function ProductsList({ products, onDelete, onStatusUpdate, onRefresh }: ProductsListProps) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [trackInventory, setTrackInventory] = useState(false);
  const [updatingStock, setUpdatingStock] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormData, setEditFormData] = useState<ProductEditFormData>(createInitialEditFormData);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.aesthetic?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const handleInventoryEdit = (product: Product) => {
    setSelectedProduct(product);
    setStockQuantity((product as any).quantity ?? 0);
    setLowStockThreshold((product as any).low_stock_threshold ?? 5);
    setTrackInventory((product as any).track_inventory ?? false);
    setShowStockModal(true);
  };

  const handleEditImageChange = async (event: ChangeEvent<HTMLInputElement>, slot: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (JPEG, PNG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      const processedImage = await processImage(file);

      if (slot === 0) {
        setEditFormData(prev => ({ ...prev, image: file, imagePreview: processedImage }));
      } else {
        const idx = slot - 1;
        setEditFormData(prev => {
          const updatedFiles = [...prev.extraFiles];
          const updatedPreviews = [...prev.extraPreviews];
          updatedFiles[idx] = file;
          updatedPreviews[idx] = processedImage;
          return { ...prev, extraFiles: updatedFiles, extraPreviews: updatedPreviews };
        });
      }
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process image',
        variant: 'destructive',
      });
    }
  };

  const removeEditImage = (slot: number) => {
    if (slot === 0) {
      setEditFormData(prev => ({ ...prev, image: null, imagePreview: '' }));
      return;
    }

    const idx = slot - 1;
    setEditFormData(prev => ({
      ...prev,
      extraFiles: prev.extraFiles.filter((_, index) => index !== idx),
      extraPreviews: prev.extraPreviews.filter((_, index) => index !== idx)
    }));
  };

  const handleEditClick = async (id: string) => {
    setIsLoadingEdit(true);

    try {
      const product = await sellerApi.getProduct(id);
      setEditingProduct(product as any);
      setEditFormData({
        name: product.name || '',
        price: (product.price ?? 0).toString(),
        description: product.description || '',
        aesthetic: product.aesthetic || 'clothes-style',
        image: null,
        imagePreview: product.image_url || '',
        extraFiles: [],
        extraPreviews: product.images || []
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast({
        title: 'Error',
        description: 'Failed to load product data',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    if (!editFormData.name || !editFormData.price || !editFormData.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const priceValue = Number.parseFloat(editFormData.price);
    if (Number.isNaN(priceValue) || priceValue < 50) {
      toast({
        title: 'Error',
        description: 'Minimum price must be KES 50',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingEdit(true);

    try {
      const updateData: any = {
        name: editFormData.name.trim(),
        price: priceValue,
        description: editFormData.description.trim(),
        aesthetic: editFormData.aesthetic,
        images: editFormData.extraPreviews.length > 0 ? editFormData.extraPreviews : []
      };

      if (editFormData.image) {
        updateData.image_url = editFormData.imagePreview;
      } else if (!editFormData.imagePreview) {
        updateData.image_url = '';
      }

      await sellerApi.updateProduct(editingProduct.id, updateData);

      toast({
        title: 'Success',
        description: 'Product updated successfully!',
      });

      setShowEditModal(false);
      onRefresh?.();
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update product',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      setDeletingId(productToDelete);
      await onDelete(productToDelete);
      setShowDeleteDialog(false);
      setProductToDelete(null);
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message ||
          error?.message ||
          'Failed to delete product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusUpdate = async (productId: string, newStatus: 'available' | 'sold') => {
    if (!onStatusUpdate) return;

    try {
      setUpdatingId(productId);
      const soldAt = newStatus === 'sold' ? new Date().toISOString() : null;
      await onStatusUpdate(productId, newStatus, soldAt);
      onRefresh?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update product status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveInventory = async () => {
    if (!selectedProduct) return;

    try {
      setUpdatingStock(true);
      await sellerApi.updateInventory(selectedProduct.id, {
        track_inventory: trackInventory,
        quantity: trackInventory ? stockQuantity : null,
        low_stock_threshold: trackInventory ? lowStockThreshold : null
      });

      toast({
        title: 'Inventory Updated',
        description: `Stock levels updated for ${selectedProduct.name}`,
      });

      setShowStockModal(false);
      onRefresh?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to update inventory',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStock(false);
    }
  };

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
          <Plus className="h-8 w-8 text-emerald-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-950 mb-1">No products yet</h3>
        <p className="text-slate-700">Get started by adding your first product from the button above</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProductDeleteDialog
        open={showDeleteDialog}
        deletingId={deletingId}
        onOpenChange={setShowDeleteDialog}
        onCancel={() => {
          setShowDeleteDialog(false);
          setProductToDelete(null);
        }}
        onConfirm={confirmDelete}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search products..."
          className="bg-white border-slate-200 text-slate-950 placeholder:text-slate-500 rounded-xl pl-10 h-10"
        />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
          <p className="text-white">No products match "{searchQuery}".</p>
          <Button variant="link" className="mt-2 text-yellow-400" onClick={() => setSearchQuery('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <>
          <SellerProductCards
            products={filteredProducts}
            deletingId={deletingId}
            updatingId={updatingId}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onStatusUpdate={onStatusUpdate ? handleStatusUpdate : undefined}
            onInventoryEdit={handleInventoryEdit}
          />

          <SellerProductsTable
            products={filteredProducts}
            deletingId={deletingId}
            updatingId={updatingId}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onStatusUpdate={onStatusUpdate ? handleStatusUpdate : undefined}
            onInventoryEdit={handleInventoryEdit}
          />
        </>
      )}

      <ProductInventoryDialog
        open={showStockModal}
        selectedProduct={selectedProduct}
        stockQuantity={stockQuantity}
        lowStockThreshold={lowStockThreshold}
        trackInventory={trackInventory}
        updatingStock={updatingStock}
        onOpenChange={setShowStockModal}
        onStockQuantityChange={setStockQuantity}
        onLowStockThresholdChange={setLowStockThreshold}
        onTrackInventoryChange={setTrackInventory}
        onSave={handleSaveInventory}
      />

      <ProductEditDialog
        open={showEditModal}
        formData={editFormData}
        isLoading={isLoadingEdit}
        isSaving={isSavingEdit}
        onOpenChange={setShowEditModal}
        onFormDataChange={setEditFormData}
        onImageChange={handleEditImageChange}
        onRemoveImage={removeEditImage}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
