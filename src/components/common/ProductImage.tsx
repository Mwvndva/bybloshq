import { useState } from 'react';
import { cn, getImageUrl } from '@/lib/utils';

interface ProductImageProps {
    src?: string | null;
    alt: string;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * ProductImage – renders a product image with a styled placeholder fallback.
 * Always renders something (no broken icons or blank spaces).
 */
const ProductImage = ({ src, alt, className, style }: ProductImageProps) => {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const showPlaceholder = !src || hasError;

    if (showPlaceholder) {
        return (
            <div
                className={cn(
                    'flex flex-col items-center justify-center bg-[var(--product-card-soft,#f8fafc)] text-[var(--product-card-muted,#64748b)]',
                    className
                )}
                style={style}
                aria-label={alt}
            >
                {/* Stylish store/image placeholder */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-10 h-10 opacity-40"
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-xs mt-2 opacity-60 font-medium tracking-wide uppercase">No Image</span>
            </div>
        );
    }

    return (
        <div className={cn('relative overflow-hidden', className)} style={style}>
            {isLoading && (
                <div className="absolute inset-0 bg-[var(--product-card-soft,#f8fafc)] animate-pulse" />
            )}
            <img
                src={getImageUrl(src)}
                alt={alt}
                className={cn(
                    'w-full h-full object-cover transition-opacity duration-300',
                    isLoading ? 'opacity-0' : 'opacity-100'
                )}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                }}
            />
        </div>
    );
};

export default ProductImage;
