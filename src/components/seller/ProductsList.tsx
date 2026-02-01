import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Loader2, MoreVertical, EyeOff, Plus, Handshake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  onEdit: (id: string) => void;
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
          className="h-8 w-8 p-0 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteClick(product.id);
          }}
          disabled={!!deletingId}
        >
          {deletingId === product.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
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
              className="bg-transparent border-white/10 text-zinc-200 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!!deletingId}
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
            <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:bg-white/5 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900/90 backdrop-blur-xl border border-white/10">
                  <DropdownMenuItem
                    onClick={() => onEdit(product.id)}
                    className="flex items-center gap-2 cursor-pointer text-white hover:bg-white/5"
                  >
                    <Edit className="h-4 w-4 text-emerald-400" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium truncate text-white">{product.name}</CardTitle>
              <Badge
                variant={product.status === 'sold' ? 'destructive' : 'default'}
                className={`mt-2 w-fit ${
                  product.status === 'sold' 
                    ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {product.status?.toUpperCase() || 'ACTIVE'}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="aspect-square bg-zinc-800/50 border border-white/5 rounded-xl overflow-hidden mb-3">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <EyeOff className="h-8 w-8 text-zinc-400" />
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-white">{formatCurrency(product.price)}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(product.id)}
                    className="border-white/10 text-white hover:bg-white/5 hover:border-white/20"
                  >
                    <Edit className="h-4 w-4 mr-1 text-emerald-400" />
                    Edit
                  </Button>
                  {renderActions(product)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table View - Visible on medium screens and up */}
      <div className="hidden md:block bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="border-b border-white/10">
            <TableRow className="bg-zinc-900/20">
              <TableHead className="w-2/5 text-zinc-400 font-semibold">Product</TableHead>
              <TableHead className="w-1/5 text-zinc-400 font-semibold">Aesthetic</TableHead>
              <TableHead className="w-1/6 text-zinc-400 font-semibold">Price</TableHead>
              <TableHead className="w-1/6 text-zinc-400 font-semibold">Status</TableHead>
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
                  <Badge
                    className={`capitalize font-medium ${
                      product.status === 'sold' 
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
                        className={`${product.status === 'sold' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'}`}
                      >
                        {updatingId === product.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <span>{product.status === 'sold' ? 'Mark Available' : 'Mark Sold'}</span>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(product.id)}
                      className="h-8 w-8 text-zinc-400 hover:bg-white/5 hover:text-emerald-400 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(product.id);
                      }}
                      disabled={!!deletingId}
                    >
                      {deletingId === product.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
