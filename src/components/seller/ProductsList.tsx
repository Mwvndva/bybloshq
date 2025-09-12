import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Loader2, MoreVertical, EyeOff, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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

  const handleDeleteClick = async (id: string) => {
    try {
      setDeletingId(id);
      await onDelete(id);
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
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
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Plus className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No products yet</h3>
        <p className="text-gray-500">Get started by adding your first product from the button above</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid View - Hidden on larger screens */}
      <div className="md:hidden grid gap-6 grid-cols-1 sm:grid-cols-2">
        {products.map((product) => (
          <Card key={product.id} className="relative group">
            <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => onEdit(product.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{product.name}" and cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeleteClick(product.id)}
                          disabled={deletingId === product.id}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          {deletingId === product.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium truncate">{product.name}</CardTitle>
              <Badge 
                variant={product.status === 'sold' ? 'destructive' : 'default'}
                className="mt-2 w-fit"
              >
                {product.status?.toUpperCase() || 'ACTIVE'}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="aspect-square bg-gray-100 rounded-md overflow-hidden mb-3">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <EyeOff className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">{formatCurrency(product.price)}</span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onEdit(product.id)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table View - Visible on medium screens and up */}
      <div className="hidden md:block rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/5">Product</TableHead>
              <TableHead className="w-1/5">Aesthetic</TableHead>
              <TableHead className="w-1/6">Price</TableHead>
              <TableHead className="w-1/6">Status</TableHead>
              <TableHead className="w-1/6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center">
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <span className="line-clamp-2">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{product.aesthetic}</TableCell>
                <TableCell>{formatCurrency(product.price)}</TableCell>
                <TableCell>
                  <Badge
                    variant={product.status === 'sold' ? 'destructive' : 'outline'}
                    className={cn(
                      'capitalize',
                      product.status === 'sold' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    )}
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
                        className={`${product.status === 'sold' ? 'bg-yellow-300 text-black' : 'bg-black text-yellow-300'} border-yellow-300`}
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
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {deletingId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Product</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{product.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteClick(product.id)}
                            disabled={deletingId === product.id}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {deletingId === product.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
