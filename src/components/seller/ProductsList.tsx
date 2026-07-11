import { useMemo, useState, type ChangeEvent } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateProductMutation, useUpdateInventoryMutation, sellerProductQuery } from '@/hooks/seller/useSellerProducts';
import type { ApiSellerProduct, Product } from '@/types';
import { ProductDeleteDialog } from './products-list/ProductDeleteDialog';
import { ProductEditDialog, type ProductEditFormData } from './products-list/ProductEditDialog';
import { ProductInventoryDialog } from './products-list/ProductInventoryDialog';
import { SellerProductCards } from './products-list/SellerProductCards';
import { SellerProductsTable } from './products-list/SellerProductsTable';
import { createInitialEditFormData, processImage } from './products-list/productsListUtils';

interface ProductsListProps {
  products: Product[];
  onDelete: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  onStatusUpdate?: (productId: string, status: 'available' | 'sold', soldAt: string | null) => void;
  onRefresh?: () => void;
}

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
    setStockQuantity((product as ApiSellerProduct).quantity ?? 0);
    setLowStockThreshold((product as ApiSellerProduct).low_stock_threshold ?? 5);
    setTrackInventory((product as ApiSellerProduct).track_inventory ?? false);
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

  const queryClient = useQueryClient();
  const updateProductMutation = useUpdateProductMutation();
  const updateInventoryMutation = useUpdateInventoryMutation();

  const handleEditClick = async (id: string) => {
    setIsLoadingEdit(true);

    try {
      const product = await queryClient.fetchQuery(sellerProductQuery(id));
      setEditingProduct(product as unknown as Product);
      setEditFormData({
        name: product.name || '',
        price: (product.price ?? 0).toString(),
        description: product.description || '',
        aesthetic: product.aesthetic || 'clothes-style',
        image: null,
        imagePreview: product.image_url || '',
        extraFiles: [],
        extraPreviews: product.images || [],
        product_type: (product.product_type || product.productType || 'physical') as 'physical' | 'digital' | 'service',
        is_custom_product: Boolean(product.is_custom_product || product.isCustomProduct),
        production_days: String(product.production_days || product.productionDays || 1),
        customization_prompt: product.customization_prompt || product.customizationPrompt || 'Tell the seller exactly what you want customized.',
        is_imported_product: Boolean(product.is_imported_product || product.isImportedProduct),
        import_days: String(product.import_days || product.importDays || 14),
        import_note: product.import_note || product.importNote || 'Imported item. Delivery starts after seller handoff.'
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

    if (editFormData.product_type === 'physical' && editFormData.is_custom_product) {
      const productionDays = Number.parseInt(editFormData.production_days, 10);
      if (!Number.isInteger(productionDays) || productionDays < 1 || productionDays > 5) {
        toast({
          title: 'Error',
          description: 'Select custom production time from 1 to 5 days.',
          variant: 'destructive',
        });
        return;
      }
      if (!editFormData.customization_prompt.trim()) {
        toast({
          title: 'Error',
          description: 'Add the buyer instruction prompt for this custom product.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (editFormData.product_type === 'physical' && editFormData.is_imported_product) {
      const importDays = Number.parseInt(editFormData.import_days, 10);
      if (![7, 14, 21, 30].includes(importDays)) {
        toast({
          title: 'Error',
          description: 'Select imported item ready time of 7, 14, 21, or 30 days.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSavingEdit(true);

    try {
      const updateData: Record<string, unknown> = {
        name: editFormData.name.trim(),
        price: priceValue,
        description: editFormData.description.trim(),
        aesthetic: editFormData.aesthetic,
        images: editFormData.extraPreviews.length > 0 ? editFormData.extraPreviews : [],
        product_type: editFormData.product_type || 'physical',
        is_custom_product: editFormData.product_type === 'physical' ? editFormData.is_custom_product : false,
        production_days: editFormData.product_type === 'physical' && editFormData.is_custom_product ? Number.parseInt(editFormData.production_days, 10) : null,
        customization_prompt: editFormData.product_type === 'physical' && editFormData.is_custom_product ? editFormData.customization_prompt.trim() : null,
        is_imported_product: editFormData.product_type === 'physical' ? editFormData.is_imported_product : false,
        import_days: editFormData.product_type === 'physical' && editFormData.is_imported_product ? Number.parseInt(editFormData.import_days, 10) : null,
        import_note: editFormData.product_type === 'physical' && editFormData.is_imported_product ? editFormData.import_note.trim() : null
      };

      if (editFormData.image) {
        updateData.image_url = editFormData.imagePreview;
      } else if (!editFormData.imagePreview) {
        updateData.image_url = '';
      }

      await updateProductMutation.mutateAsync({
        id: editingProduct.id,
        updates: updateData
      });

      toast({
        title: 'Success',
        description: 'Product updated successfully!',
      });

      setShowEditModal(false);
      onRefresh?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      console.error('Error updating product:', error);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update product',
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
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      console.error('Failed to delete product:', error);
      toast({
        title: 'Error',
        description: err?.response?.data?.message ||
          err?.message ||
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
      await updateInventoryMutation.mutateAsync({
        id: selectedProduct.id,
        stockCount: trackInventory ? stockQuantity : 0
      });

      toast({
        title: 'Inventory Updated',
        description: `Stock levels updated for ${selectedProduct.name}`,
      });

      setShowStockModal(false);
      onRefresh?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast({
        title: 'Error',
        description: err.response?.data?.message || err.message || 'Failed to update inventory',
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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-700">No products match "{searchQuery}".</p>
          <Button variant="link" className="mt-2 text-yellow-700" onClick={() => setSearchQuery('')}>
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


