import { Product } from '@/types';

/**
 * Type guard to check if a product is a service
 */
export const isServiceProduct = (product: Product): boolean => {
    return (
        product.product_type === 'service' ||
        product.productType === 'service' ||
        !!product.service_options
    );
};

/**
 * Type guard to check if a product is a digital product
 */
export const isDigitalProduct = (product: Product): boolean => {
    return (
        product.product_type === 'digital' ||
        product.productType === 'digital' ||
        !!product.is_digital
    );
};

/**
 * Type guard to check if a product is a physical product
 */
export const isPhysicalProduct = (product: Product): boolean => {
    return !isServiceProduct(product) && !isDigitalProduct(product);
};

/**
 * Helper to get all images for a product with fallback
 */
export const getProductImages = (product: Product): string[] => {
    const images = product.images || [];
    const mainImage = product.imageUrl || product.image_url;

    if (images.length === 0 && mainImage) {
        return [mainImage];
    }

    return images.length > 0 ? images : [mainImage || ''];
};
