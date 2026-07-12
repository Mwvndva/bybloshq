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
import { useProductsList } from './useProductsList';

interface ProductsListProps {
  products: Product[];
  onDelete: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  onStatusUpdate?: (productId: string, status: 'available' | 'sold', soldAt: string | null) => void;
  onRefresh?: () => void;
}

export function ProductsList({ products, onDelete, onStatusUpdate, onRefresh }: ProductsListProps) {
  const {
    deletingId,
    updatingId,
    showDeleteDialog,
    setShowDeleteDialog,
    setProductToDelete,
    confirmDelete,
    searchQuery,
    setSearchQuery,
    filteredProducts,
    handleEditClick,
    handleDeleteClick,
    handleStatusUpdate,
    handleInventoryEdit,
    showStockModal,
    selectedProduct,
    stockQuantity,
    lowStockThreshold,
    trackInventory,
    updatingStock,
    setShowStockModal,
    setStockQuantity,
    setLowStockThreshold,
    setTrackInventory,
    handleSaveInventory,
    showEditModal,
    editFormData,
    isLoadingEdit,
    isSavingEdit,
    setShowEditModal,
    setEditFormData,
    handleEditImageChange,
    removeEditImage,
    handleSaveEdit,
  } = useProductsList({ products, onDelete, onStatusUpdate, onRefresh });

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


