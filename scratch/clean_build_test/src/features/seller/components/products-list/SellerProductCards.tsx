import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Edit, EyeOff, Handshake, Loader2, MoreVertical, Package, Trash2 } from 'lucide-react';
import type { Product } from '@/shared/types';
import type { ApiSellerProduct } from '@/shared/types/api/product';
type ProductWithApiFields = Product & Partial<ApiSellerProduct>;
import { cn, formatCurrency } from '@/shared/utils/formatting';

interface SellerProductCardsProps {
  products: ProductWithApiFields[];
  deletingId: string | null;
  updatingId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusUpdate?: (productId: string, status: 'available' | 'sold') => void;
  onInventoryEdit: (product: ProductWithApiFields) => void;
}

export function SellerProductCards({
  products,
  deletingId,
  updatingId,
  onEdit,
  onDelete,
  onStatusUpdate,
  onInventoryEdit
}: SellerProductCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
      {products.map((product) => (
        <Card key={product.id} className="relative group bg-[#0a0a0a] border border-white/10 text-white rounded-2xl hover:border-emerald-500/50 transition-all shadow-sm">
          <div className="absolute right-2 top-2 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton variant="ghost" aria-label="Product options" className="h-11 w-11 text-white/60 hover:bg-white/10 hover:text-white">
                  <MoreVertical className="h-4 w-4" />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#0a0a0a] border border-white/10 text-white">
                <DropdownMenuItem
                  onClick={() => onEdit(product.id)}
                  className="flex items-center gap-2 cursor-pointer text-white hover:bg-white/10"
                >
                  <Edit className="h-4 w-4 text-emerald-400" />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(product.id)}
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
                <CardTitle className="text-xs sm:text-sm font-medium text-white mb-0.5 line-clamp-1 h-4">{product.name}</CardTitle>
                <p className="text-[9px] text-white/60 capitalize mb-1">{product.aesthetic}</p>
                {product.description && (
                  <p className="text-[10px] text-white/60 line-clamp-2 h-6 leading-tight mb-2">
                    {product.description}
                  </p>
                )}
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
            <div className="h-24 w-full rounded-xl seller-card-soft overflow-hidden mb-3">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <EyeOff className="h-6 w-6 text-zinc-400" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-[10px] text-white/60">Stock:</span>
              <div className="flex items-center gap-2">
                {product.track_inventory ? (
                  <Badge
                    className={cn(
                      'font-mono font-semibold text-[10px] px-1.5 py-0',
                      product.quantity === 0
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : (product.quantity <= (product.low_stock_threshold || 5)
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30')
                    )}
                  >
                    <Package className="h-2.5 w-2.5 mr-0.5" />
                    {product.quantity ?? 0}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-white/60 italic">Not tracked</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onInventoryEdit(product)}
                  className="h-5 px-1.5 text-[10px] text-white/60 hover:text-emerald-300 hover:bg-emerald-500/10"
                >
                  Edit
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="font-medium text-white text-sm sm:text-base">{formatCurrency(product.price)}</span>
            </div>

            {onStatusUpdate && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusUpdate(product.id, product.status === 'sold' ? 'available' : 'sold')}
                  disabled={updatingId === product.id}
                  className={`w-full ${product.status === 'sold' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'} h-11 px-3 text-xs font-semibold rounded-xl`}
                >
                  {updatingId === product.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span>{product.status === 'sold' ? 'Mark Available' : 'Mark as Sold Out'}</span>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


