import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getImageUrl } from '@/lib/utils';

interface ProductImageViewerProps {
  images: string[];
  productName: string;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
}

export function ProductImageViewer({
  images,
  productName,
  activeIndex,
  onActiveIndexChange,
  onClose
}: ProductImageViewerProps) {
  const hasMultipleImages = images.length > 1;
  const activeImage = images[activeIndex] || images[0];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasMultipleImages) {
        onActiveIndexChange((activeIndex - 1 + images.length) % images.length);
      }
      if (event.key === 'ArrowRight' && hasMultipleImages) {
        onActiveIndexChange((activeIndex + 1) % images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, hasMultipleImages, images.length, onActiveIndexChange, onClose]);

  if (!activeImage) return null;

  const goToPrevious = () => {
    onActiveIndexChange((activeIndex - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    onActiveIndexChange((activeIndex + 1) % images.length);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-slate-950/95 text-white backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} images`}
      onClick={onClose}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold sm:text-base">{productName}</p>
          <p className="text-xs text-white/55">
            {activeIndex + 1} of {images.length}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Close image viewer"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-4 sm:px-12"
        onClick={(event) => event.stopPropagation()}
      >
        {hasMultipleImages && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:left-5 sm:h-12 sm:w-12"
            onClick={goToPrevious}
            aria-label="Previous product image"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        )}

        <img
          src={getImageUrl(activeImage)}
          alt={`${productName} image ${activeIndex + 1}`}
          className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
        />

        {hasMultipleImages && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:right-5 sm:h-12 sm:w-12"
            onClick={goToNext}
            aria-label="Next product image"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        )}
      </div>

      {hasMultipleImages && (
        <div
          className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 px-4 py-3 sm:justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => onActiveIndexChange(index)}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white/5 transition-all sm:h-20 sm:w-20',
                index === activeIndex ? 'border-yellow-400 ring-2 ring-yellow-400/30' : 'border-white/15 opacity-70 hover:opacity-100'
              )}
              aria-label={`View product image ${index + 1}`}
            >
              <img
                src={getImageUrl(image)}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
