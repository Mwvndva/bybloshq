import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, EyeOff, Handshake, Loader2, Package, Trash2 } from 'lucide-react';
import type { Product } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';

interface SellerProductsTableProps {
  products: Product[];
  deletingId: string | null;
  updatingId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusUpdate?: (productId: string, status: 'available' | 'sold') => void;
  onInventoryEdit: (product: Product) => void;
}

export function SellerProductsTable({
  products,
  deletingId,
  updatingId,
  onEdit,
  onDelete,
  onStatusUpdate,
  onInventoryEdit
}: SellerProductsTableProps) {
  return (
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
                    onClick={() => onInventoryEdit(product)}
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
                      onClick={() => onStatusUpdate(product.id, product.status === 'sold' ? 'available' : 'sold')}
                      disabled={updatingId === product.id}
                      className={`${product.status === 'sold' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'} h-6 px-2 text-[10px]`}
                    >
                      {updatingId === product.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <span>{product.status === 'sold' ? 'Mark Available' : 'Mark as Sold Out'}</span>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(product.id);
                    }}
                    title="Edit product"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(product.id);
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
  );
}
