import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import ProductImage from '@/components/common/ProductImage';
import type { Product } from '@/types';
import { formatFileSize } from '@/lib/utils';
import { FileText, Handshake, Plane, ChevronLeft, ChevronRight } from 'lucide-react';

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
  images?: string[];
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
  images = [],
  onOpenGallery
}: ProductCardMediaProps) {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const activeImages = images.length > 0 ? images : product.image_url ? [product.image_url] : [];
  const currentImageSrc = activeImages[currentImgIndex] || product.image_url;
  const hasMultipleImages = activeImages.length > 1;

  const handlePrevImage = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentImgIndex(prev => (prev - 1 + activeImages.length) % activeImages.length);
  };

  const handleNextImage = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentImgIndex(prev => (prev + 1) % activeImages.length);
  };

  return (
    <div className="relative shrink-0 overflow-hidden rounded-t-2xl bg-[var(--product-card-soft)] group/media">
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
        src={currentImageSrc}
        alt={product.name}
        className="w-full aspect-[4/3] object-cover transition-all duration-200"
      />

      {canOpenGallery && (
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
      )}

      {hasMultipleImages && (
        <>
          {/* Previous image arrow */}
          <button
            type="button"
            onClick={handlePrevImage}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-[5] flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/85 shadow-md backdrop-blur-sm transition-all active:scale-95"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Next image arrow */}
          <button
            type="button"
            onClick={handleNextImage}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-[5] flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/85 shadow-md backdrop-blur-sm transition-all active:scale-95"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[5] flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 backdrop-blur-sm">
            {activeImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentImgIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all ${idx === currentImgIndex ? 'w-3.5 bg-yellow-400' : 'w-1.5 bg-white/60'}`}
                aria-label={`View image ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}


