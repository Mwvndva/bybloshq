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
    <div className="relative overflow-hidden rounded-t-lg sm:rounded-t-xl">
      {isDigital && (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          <Badge className="bg-red-600 hover:bg-red-700 text-white border-0 backdrop-blur-sm shadow-md">
            <FileText className="h-3 w-3 mr-1" />
            Digital
          </Badge>
          {product.digital_file_size && (
            <Badge className="bg-black/60 text-white border-0 text-[10px] py-0.5 px-2 backdrop-blur-md rounded-full">
              {formatFileSize(product.digital_file_size)}
            </Badge>
          )}
        </div>
      )}

      {isService && (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          <Badge className="bg-purple-500/90 hover:bg-purple-600/90 text-white border-0 backdrop-blur-sm shadow-md">
            <Handshake className="h-3 w-3 mr-1" />
            Service
          </Badge>
          {isHybrid && (
            <Badge className="bg-blue-500/90 hover:bg-blue-600/90 text-white border-0 backdrop-blur-sm shadow-md">
              Hybrid
            </Badge>
          )}
        </div>
      )}

      {isOutOfStock && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-[#000000] text-red-500 border-2 border-red-500 font-bold backdrop-blur-sm shadow-lg animate-pulse">
            SOLD OUT
          </Badge>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[1]" />

      <ProductImage
        src={product.image_url}
        alt={product.name}
        className="w-full aspect-[3/4] transition-transform duration-700 sm:group-hover:scale-105"
      />
    </div>
  );
}
