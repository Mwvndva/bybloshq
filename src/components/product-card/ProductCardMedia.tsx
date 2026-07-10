import { Badge } from '@/components/ui/badge';
import ProductImage from '@/components/common/ProductImage';
import type { Product } from '@/types';
import { formatFileSize } from '@/lib/utils';
import { FileText, Handshake, Plane } from 'lucide-react';

interface ProductCardMediaProps {
  product: Product;
  isDigital: boolean;
  isService: boolean;
  isHybrid: boolean;
  isImportedProduct?: boolean;
  importDays?: number | null;
  isOutOfStock: boolean;
  canOpenGallery?: boolean;
  imageCount?: number;
  onOpenGallery?: () => void;
}

export function ProductCardMedia({
  product,
  isDigital,
  isService,
  isHybrid,
  isImportedProduct = false,
  importDays = null,
  isOutOfStock,
  canOpenGallery = false,
  imageCount = 0,
  onOpenGallery
}: ProductCardMediaProps) {
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

      {isImportedProduct && !isDigital && !isService && (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          <Badge className="border-yellow-200 bg-yellow-400 text-black font-semibold shadow-sm backdrop-blur-sm">
            <Plane className="h-3 w-3 mr-1" />
            Imported
          </Badge>
          <Badge className="border-[var(--product-card-border)] bg-white/95 text-slate-800 text-[10px] py-0.5 px-2 backdrop-blur-md rounded-full shadow-sm">
            Ready in {importDays || 14} days
          </Badge>
        </div>
      )}

      {isOutOfStock && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="border-red-200 bg-white/95 text-red-700 font-semibold backdrop-blur-sm shadow-sm">
            Sold out
          </Badge>
        </div>
      )}

      <ProductImage
        src={product.image_url}
        alt={product.name}
        className="w-full aspect-[4/3] object-cover"
      />

      {canOpenGallery && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-[2] cursor-zoom-in"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenGallery?.();
            }}
            aria-label={`Open ${product.name} image gallery`}
          />
          {imageCount > 1 && (
            <div className="pointer-events-none absolute bottom-2 right-2 z-[3] rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
              {imageCount} photos
            </div>
          )}
        </>
      )}
    </div>
  );
}


