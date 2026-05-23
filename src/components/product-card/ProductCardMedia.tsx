import { Badge } from '@/components/ui/badge';
import ProductImage from '@/components/common/ProductImage';
import type { Product } from '@/types';
import { formatFileSize } from '@/lib/utils';
import { FileText, Handshake } from 'lucide-react';

interface ProductCardMediaProps {
  product: Product;
  isDigital: boolean;
  isService: boolean;
  isHybrid: boolean;
  isOutOfStock: boolean;
}

export function ProductCardMedia({ product, isDigital, isService, isHybrid, isOutOfStock }: ProductCardMediaProps) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-t-2xl bg-[var(--product-card-soft)]">
      {isDigital && (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          <Badge className="border-[var(--product-card-border)] bg-white/95 text-slate-900 shadow-sm backdrop-blur-sm">
            <FileText className="h-3 w-3 mr-1" />
            Digital
          </Badge>
          {product.digital_file_size && (
            <Badge className="border-[var(--product-card-border)] bg-white/90 text-slate-600 text-[10px] py-0.5 px-2 backdrop-blur-md rounded-full">
              {formatFileSize(product.digital_file_size)}
            </Badge>
          )}
        </div>
      )}

      {isService && (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          <Badge className="border-[var(--product-card-border)] bg-white/95 text-slate-900 shadow-sm backdrop-blur-sm">
            <Handshake className="h-3 w-3 mr-1" />
            Service
          </Badge>
          {isHybrid && (
            <Badge className="border-[var(--product-card-border)] bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm">
              Hybrid
            </Badge>
          )}
        </div>
      )}

      {isOutOfStock && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="border-red-200 bg-white/95 text-red-700 font-semibold backdrop-blur-sm shadow-sm">
            Sold out
          </Badge>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[1]" />

      <ProductImage
        src={product.image_url}
        alt={product.name}
        className="w-full aspect-[4/3] object-cover transition-transform duration-500 sm:group-hover:scale-[1.02]"
      />
    </div>
  );
}
