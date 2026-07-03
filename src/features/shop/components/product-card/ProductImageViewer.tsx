import { useEffect, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getImageUrl } from '@/lib/utils';

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

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!activeImage) return null;

  const goToPrevious = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onActiveIndexChange((activeIndex - 1 + images.length) % images.length);
  };

  const goToNext = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onActiveIndexChange((activeIndex + 1) % images.length);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 text-white backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} images`}
      onClick={onClose}
    >
      <div className="relative flex h-full w-full max-w-6xl items-center justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-20 h-10 w-10 rounded-full bg-black/55 text-white shadow-lg hover:bg-black/75 hover:text-white sm:right-4 sm:top-4 sm:h-11 sm:w-11"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Close image viewer"
        >
          <X className="h-5 w-5" />
        </Button>

        {hasMultipleImages && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full bg-black/55 text-white shadow-lg hover:bg-black/75 hover:text-white sm:left-4 sm:h-12 sm:w-12"
            onClick={goToPrevious}
            aria-label="Previous product image"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        )}

        <img
          src={getImageUrl(activeImage)}
          alt={`${productName} image ${activeIndex + 1}`}
          className="max-h-[92dvh] max-w-full select-none rounded-xl object-contain shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
          onClick={(event) => event.stopPropagation()}
        />

        {hasMultipleImages && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full bg-black/55 text-white shadow-lg hover:bg-black/75 hover:text-white sm:right-4 sm:h-12 sm:w-12"
            onClick={goToNext}
            aria-label="Next product image"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        )}
        {hasMultipleImages && (
          <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white shadow-lg sm:bottom-4">
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
