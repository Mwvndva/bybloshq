import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Loader2, MoreVertical, EyeOff, Plus, Handshake, Package, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sellerApi } from '@/api/sellerApi';
import { aestheticCategories } from '../AestheticCategories';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductsListProps {
  products: Product[];
  onDelete: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  onStatusUpdate?: (productId: string, status: 'available' | 'sold', soldAt: string | null) => void;
  onRefresh?: () => void;
}

export function ProductsList({ products, onDelete, onEdit, onStatusUpdate, onRefresh }: ProductsListProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
  const [trackInventory, setTrackInventory] = useState<boolean>(false);
  const [updatingStock, setUpdatingStock] = useState(false);

  // Edit product modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    price: '',
    description: '',
    aesthetic: 'afro-futuristic',
    image: null as File | null,
    imagePreview: ''
  });
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleEditClick = async (id: string) => {
    setIsLoadingEdit(true);

    try {
      // Fetch product data from database
      const product = await sellerApi.getProduct(id);

      // Set the data first
      setEditingProduct(product as any);
      setEditFormData({
        name: product.name || '',
        price: (product.price ?? 0).toString(),
        description: product.description || '',
        aesthetic: product.aesthetic || 'clothes-style',
        image: null,
        imagePreview: product.image_url || ''
      });

      // Then open the modal
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

    // Validation
    if (!editFormData.name || !editFormData.price || !editFormData.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const priceValue = parseFloat(editFormData.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid price',
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
        aesthetic: editFormData.aesthetic
      };

      // Process image if changed
      if (editFormData.image) {
        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(editFormData.image!);
        });
        updateData.image_url = imageData;
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
      // Success toast is handled by the parent component
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

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
          <Plus className="h-8 w-8 text-emerald-400" />
        </div>
        <h3 className="text-lg font-medium text-white mb-1">No products yet</h3>
        <p className="text-zinc-400">Get started by adding your first product from the button above</p>
      </div>
    );
  }

  const renderActions = (product: Product) => {
    return (
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 p-0 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteClick(product.id);
          }}
          disabled={!!deletingId}
        >
          {deletingId === product.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px] bg-[rgba(17,17,17,0.75)] backdrop-blur-[12px] border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Product</DialogTitle>
            <DialogDescription className="text-zinc-300">
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setProductToDelete(null);
              }}
              disabled={!!deletingId}
              className="bg-transparent border-white/10 text-zinc-200 hover:bg-white/5 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
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
      {/* Grid View - Hidden on larger screens */}
      <div className="md:hidden grid gap-6 grid-cols-1 sm:grid-cols-2">
        {products.map((product) => (
          <Card key={product.id} className="relative group bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl hover:border-emerald-500/50 transition-all shadow-2xl">
            <div className="absolute right-2 top-2 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:bg-white/5 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900/90 backdrop-blur-xl border border-white/10">
                  <DropdownMenuItem
                    onClick={() => handleEditClick(product.id)}
                    className="flex items-center gap-2 cursor-pointer text-white hover:bg-white/5"
                  >
                    <Edit className="h-4 w-4 text-emerald-400" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteClick(product.id)}
                    className="flex items-center gap-2 cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-2">
              <div className="flex items-start justify-between pr-8">
                <div className="flex-1">
                  <CardTitle className="text-xs sm:text-sm font-medium text-white mb-1">{product.name}</CardTitle>
                  <p className="text-[10px] text-zinc-400 capitalize">{product.aesthetic}</p>
                </div>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                <Badge
                  variant={product.status === 'sold' ? 'destructive' : 'default'}
                  className={`w-fit text-[10px] px-1.5 py-0 ${product.status === 'sold'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}
                >
                  {product.status?.toUpperCase() || 'ACTIVE'}
                </Badge>
                {(product.product_type === 'digital' || product.productType === 'digital' || product.is_digital) && (
                  <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10">
                    Digital
                  </Badge>
                )}
                {(product.product_type === 'service' || product.productType === 'service') && (
                  <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 border-purple-500/30 text-purple-400 bg-purple-500/10">
                    Service
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-2">
              <div className="h-16 bg-zinc-800/50 border border-white/5 rounded-xl overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <EyeOff className="h-4 w-4 text-zinc-400" />
                  </div>
                )}
              </div>

              {/* Stock Info */}
              <div className="flex items-center justify-between py-1">
                <span className="text-[10px] text-zinc-400">Stock:</span>
                <div className="flex items-center gap-2">
                  {(product as any).track_inventory ? (
                    <Badge
                      className={cn(
                        'font-mono font-semibold text-[10px] px-1.5 py-0',
                        (product as any).quantity === 0
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : (product as any).quantity <= ((product as any).low_stock_threshold || 5)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      )}
                    >
                      <Package className="h-2.5 w-2.5 mr-0.5" />
                      {(product as any).quantity ?? 0}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-zinc-500 italic">Not tracked</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProduct(product);
                      setStockQuantity((product as any).quantity ?? 0);
                      setLowStockThreshold((product as any).low_stock_threshold ?? 5);
                      setTrackInventory((product as any).track_inventory ?? false);
                      setShowStockModal(true);
                    }}
                    className="h-5 px-1.5 text-[10px] text-zinc-400 hover:text-emerald-400 hover:bg-white/5"
                  >
                    Edit
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="font-medium text-white text-sm sm:text-base">{formatCurrency(product.price)}</span>
              </div>

              {/* Action Button - Only Status Toggle */}
              {onStatusUpdate && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusUpdate(product.id, product.status === 'sold' ? 'available' : 'sold')}
                    disabled={updatingId === product.id}
                    className={`w-full ${product.status === 'sold' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'} h-6 px-2 text-[10px]`}
                  >
                    {updatingId === product.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span>{product.status === 'sold' ? 'Mark Available' : 'Sold Out'}</span>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table View - Visible on medium screens and up */}
      <div className="hidden md:block bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="border-b border-white/10">
            <TableRow className="bg-zinc-900/20">
              <TableHead className="w-1/4 text-zinc-400 font-semibold">Product</TableHead>
              <TableHead className="w-1/6 text-zinc-400 font-semibold">Aesthetic</TableHead>
              <TableHead className="w-1/8 text-zinc-400 font-semibold">Price</TableHead>
              <TableHead className="w-1/8 text-zinc-400 font-semibold">Stock</TableHead>
              <TableHead className="w-1/8 text-zinc-400 font-semibold">Status</TableHead>
              <TableHead className="w-1/6 text-right text-zinc-400 font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-10 w-10 rounded-lg object-cover border border-white/10"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center">
                        <EyeOff className="h-5 w-5 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="line-clamp-2 text-white font-medium">{product.name}</span>
                      <div className="flex gap-1 mt-1">
                        {(product.product_type === 'digital' || product.productType === 'digital' || product.is_digital) && (
                          <Badge variant="outline" className="w-fit text-[10px] h-5 px-1.5 border-blue-500/30 text-blue-400 bg-blue-500/10">
                            Digital
                          </Badge>
                        )}
                        {(product.product_type === 'service' || product.productType === 'service') && (
                          <Badge variant="outline" className="w-fit text-[10px] h-5 px-1.5 border-purple-500/30 text-purple-400 bg-purple-500/10">
                            <Handshake className="h-3 w-3 mr-1 text-purple-400" />
                            Service
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize text-zinc-300">{product.aesthetic}</TableCell>
                <TableCell className="text-white font-semibold">{formatCurrency(product.price)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {(product as any).track_inventory ? (
                      <Badge
                        className={cn(
                          'font-mono font-semibold',
                          (product as any).quantity === 0
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : (product as any).quantity <= ((product as any).low_stock_threshold || 5)
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        )}
                      >
                        <Package className="h-3 w-3 mr-1" />
                        {(product as any).quantity ?? 0}
                      </Badge>
                    ) : (
                      <span className="text-xs text-zinc-500 italic">Not tracked</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(product);
                        setStockQuantity((product as any).quantity ?? 0);
                        setLowStockThreshold((product as any).low_stock_threshold ?? 5);
                        setTrackInventory((product as any).track_inventory ?? false);
                        setShowStockModal(true);
                      }}
                      className="h-7 px-2 text-xs text-zinc-400 hover:text-emerald-400 hover:bg-white/5"
                    >
                      Edit
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    className={`capitalize font-medium ${product.status === 'sold'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                  >
                    {product.status || 'available'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {onStatusUpdate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusUpdate(product.id, product.status === 'sold' ? 'available' : 'sold')}
                        disabled={updatingId === product.id}
                        className={`${product.status === 'sold' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'} h-7 px-2 text-xs`}
                      >
                        {updatingId === product.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <span>{product.status === 'sold' ? 'Mark Available' : 'Mark Sold'}</span>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(product.id);
                      }}
                      title="Edit product"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(product.id);
                      }}
                      disabled={!!deletingId}
                    >
                      {deletingId === product.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* OLED Edit Stock Modal */}
      <Dialog open={showStockModal} onOpenChange={setShowStockModal}>
        <DialogContent className="bg-[#000000] border border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-400" />
              Manage Inventory
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update stock levels for {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Track Inventory Toggle */}
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div>
                <label className="text-sm font-medium text-white">Track Inventory</label>
                <p className="text-xs text-zinc-400 mt-1">Enable stock tracking for this product</p>
              </div>
              <button
                onClick={() => setTrackInventory(!trackInventory)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  trackInventory ? 'bg-emerald-500' : 'bg-zinc-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    trackInventory ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {trackInventory && (
              <>
                {/* Current Stock */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Current Stock</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                      placeholder="0"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Badge
                        className={cn(
                          'font-semibold',
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

                {/* Low Stock Threshold */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Low Stock Alert Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value) || 5))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                    placeholder="5"
                  />
                  <p className="text-xs text-zinc-400">
                    You'll receive a WhatsApp alert when stock falls to or below this level
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowStockModal(false)}
              className="border border-white/10 text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedProduct) return;

                try {
                  setUpdatingStock(true);

                  // Import sellerApi dynamically to avoid circular dependencies
                  const { sellerApi } = await import('@/api/sellerApi');

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
              }}
              disabled={updatingStock}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700"
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

      {/* Edit Product Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#000000] border border-white/10 text-white w-[95vw] max-w-md max-h-[85vh] overflow-y-auto p-3 sm:p-4 rounded-xl">
          <DialogHeader className="flex flex-row items-center gap-2 space-y-0 text-left mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEditModal(false)}
              className="h-7 w-7 -ml-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-white">Edit Product</DialogTitle>
              <DialogDescription className="text-zinc-400 text-[10px] sm:text-xs">
                Update product information
              </DialogDescription>
            </div>
          </DialogHeader>

          {isLoadingEdit ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-name" className="text-white text-xs">Product Name</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="bg-zinc-900 border-white/10 text-white h-9 text-sm"
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-price" className="text-white text-xs">Price (KES)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                    className="bg-zinc-900 border-white/10 text-white h-9 text-sm"
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description" className="text-white text-xs">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="bg-zinc-900 border-white/10 text-white min-h-[60px] text-sm"
                    placeholder="Enter product description"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-aesthetic" className="text-white text-xs">Category</Label>
                  <Select
                    value={editFormData.aesthetic}
                    onValueChange={(value) => setEditFormData({ ...editFormData, aesthetic: value })}
                  >
                    <SelectTrigger className="bg-zinc-900 border-white/10 text-white h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      {aestheticCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id} className="text-white hover:bg-white/5">
                          {category.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-image" className="text-white text-xs">Product Image</Label>
                  <div className="mt-2">
                    {editFormData.imagePreview && (
                      <div className="mb-2">
                        <img
                          src={editFormData.imagePreview}
                          alt="Preview"
                          className="w-full h-32 object-cover rounded-lg border border-white/10"
                        />
                      </div>
                    )}
                    <Input
                      id="edit-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditFormData({
                            ...editFormData,
                            image: file,
                            imagePreview: URL.createObjectURL(file)
                          });
                        }
                      }}
                      className="bg-zinc-900 border-white/10 text-white text-xs file:bg-emerald-500/20 file:text-emerald-400 file:border-0 file:mr-2 file:py-1.5 file:px-3 file:text-xs"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">PNG, JPG, GIF up to 2MB</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowEditModal(false)}
              className="border border-white/10 text-zinc-300 hover:bg-white/5"
              disabled={isSavingEdit}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSavingEdit || isLoadingEdit}
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 font-semibold"
            >
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
