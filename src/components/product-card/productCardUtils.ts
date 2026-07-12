import type { Product, Theme } from '@/types';
import type { ApiSellerProduct, ApiProduct } from '@/types/api/product';
type ProductWithApiFields = Product & Partial<ApiSellerProduct> & Partial<ApiProduct>;


export interface ProductCardThemeClasses {
  card: string;
  price: string;
  button: string;
  seller: string;
  description: string;
  icon: string;
}

export interface ProductCardThemeVars {
  '--product-card-bg': string;
  '--product-card-text': string;
  '--product-card-muted': string;
  '--product-card-border': string;
  '--product-card-accent': string;
  '--product-card-button-bg': string;
  '--product-card-button-text': string;
  '--product-card-soft': string;
}

export const getProductCardThemeVars = (theme: Theme): ProductCardThemeVars => {
  const themes: Record<Theme, ProductCardThemeVars> = {
    black: {
      '--product-card-bg': '#0a0a0a',
      '--product-card-text': '#ffffff',
      '--product-card-muted': 'rgba(255, 255, 255, 0.68)',
      '--product-card-border': 'rgba(255, 255, 255, 0.14)',
      '--product-card-accent': '#f59e0b',
      '--product-card-button-bg': '#f59e0b',
      '--product-card-button-text': '#111111',
      '--product-card-soft': 'rgba(255, 255, 255, 0.08)'
    },
    pink: {
      '--product-card-bg': '#fff7fb',
      '--product-card-text': '#4a102a',
      '--product-card-muted': '#7f5268',
      '--product-card-border': '#f7cfe2',
      '--product-card-accent': '#db2777',
      '--product-card-button-bg': '#db2777',
      '--product-card-button-text': '#ffffff',
      '--product-card-soft': '#fce7f3'
    },
    orange: {
      '--product-card-bg': '#fff7ed',
      '--product-card-text': '#431407',
      '--product-card-muted': '#8a4b2a',
      '--product-card-border': '#fed7aa',
      '--product-card-accent': '#ea580c',
      '--product-card-button-bg': '#ea580c',
      '--product-card-button-text': '#ffffff',
      '--product-card-soft': '#ffedd5'
    },
    green: {
      '--product-card-bg': '#f0fdf4',
      '--product-card-text': '#052e16',
      '--product-card-muted': '#326b45',
      '--product-card-border': '#bbf7d0',
      '--product-card-accent': '#16a34a',
      '--product-card-button-bg': '#16a34a',
      '--product-card-button-text': '#ffffff',
      '--product-card-soft': '#dcfce7'
    },
    red: {
      '--product-card-bg': '#fff5f5',
      '--product-card-text': '#450a0a',
      '--product-card-muted': '#8b4545',
      '--product-card-border': '#fecaca',
      '--product-card-accent': '#dc2626',
      '--product-card-button-bg': '#dc2626',
      '--product-card-button-text': '#ffffff',
      '--product-card-soft': '#fee2e2'
    },
    yellow: {
      '--product-card-bg': '#fefce8',
      '--product-card-text': '#422006',
      '--product-card-muted': '#7a5b16',
      '--product-card-border': '#fde68a',
      '--product-card-accent': '#ca8a04',
      '--product-card-button-bg': '#ca8a04',
      '--product-card-button-text': '#ffffff',
      '--product-card-soft': '#fef3c7'
    },
    brown: {
      '--product-card-bg': '#fff8ee',
      '--product-card-text': '#451a03',
      '--product-card-muted': '#7c4a24',
      '--product-card-border': '#ead7c0',
      '--product-card-accent': '#92400e',
      '--product-card-button-bg': '#92400e',
      '--product-card-button-text': '#ffffff',
      '--product-card-soft': '#f7eadb'
    },
    default: {
      '--product-card-bg': '#ffffff',
      '--product-card-text': '#111827',
      '--product-card-muted': '#64748b',
      '--product-card-border': '#e5e7eb',
      '--product-card-accent': '#f59e0b',
      '--product-card-button-bg': '#f5c518',
      '--product-card-button-text': '#111111',
      '--product-card-soft': '#f8fafc'
    }
  };

  return themes[theme] || themes.default;
};

export const createCheckoutAttemptToken = (productId: string | number): string => {
  const fallbackBytes = new Uint32Array(4);
  globalThis.crypto?.getRandomValues?.(fallbackBytes);
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Array.from(fallbackBytes).map(value => value.toString(36)).join('')}`;
  return `checkout:${productId}:${randomPart}`;
};

export const normalizePhone = (phone: string): string => {
  let normalized = phone.replace(/\s+/g, '');
  if (normalized.startsWith('+254')) {
    normalized = `0${normalized.slice(4)}`;
  } else if (normalized.startsWith('254')) {
    normalized = `0${normalized.slice(3)}`;
  }
  return normalized;
};

export const getProductFlags = (product: ProductWithApiFields) => {
  const productType = String(product.product_type || product.productType || '').toLowerCase();
  const isDigital = productType === 'digital' || product.is_digital || product.isDigital;
  const isService = productType === 'service';
  const isPhysical = productType === 'physical' && !isDigital && !isService;
  const isHybrid = isService && (product.service_options?.location_type === 'hybrid' || product.serviceOptions?.location_type === 'hybrid');
  const isOutOfStock = product.track_inventory === true && (product.quantity === 0 || product.quantity === null);

  return {
    isDigital,
    isService,
    isPhysical,
    isHybrid,
    isOutOfStock,
    isSold: product.status === 'sold' || product.isSold || isOutOfStock
  };
};

export const getThemeClasses = (theme: Theme): ProductCardThemeClasses => {
  switch (theme) {
    case 'black':
      return {
        card: 'border hover:shadow-xl hover:shadow-slate-950/10',
        price: 'text-[var(--product-card-accent)]',
        button: 'bg-[var(--product-card-button-bg)] hover:opacity-90 text-[var(--product-card-button-text)] font-semibold shadow-sm',
        seller: 'text-[var(--product-card-muted)]',
        description: 'text-[var(--product-card-muted)]',
        icon: 'text-[var(--product-card-accent)]',
      };
    case 'pink':
    case 'orange':
    case 'green':
    case 'red':
    case 'yellow':
    case 'brown':
      return {
        card: 'border hover:shadow-xl hover:shadow-slate-950/10',
        price: 'text-[var(--product-card-accent)]',
        button: 'bg-[var(--product-card-button-bg)] hover:opacity-90 text-[var(--product-card-button-text)] font-semibold shadow-sm',
        seller: 'text-[var(--product-card-muted)]',
        description: 'text-[var(--product-card-muted)]',
        icon: 'text-[var(--product-card-accent)]',
      };
    default:
      return {
        card: 'border shadow-sm hover:shadow-xl hover:shadow-slate-950/10',
        price: 'text-[var(--product-card-accent)]',
        button: 'bg-[var(--product-card-button-bg)] hover:opacity-90 text-[var(--product-card-button-text)] font-semibold shadow-sm',
        seller: 'text-[var(--product-card-muted)]',
        description: 'text-[var(--product-card-muted)]',
        icon: 'text-[var(--product-card-accent)]',
      };
  }
};

const PRODUCT_SERVICE_CHARGE_RATE = 0.02;

export const calculateProductServiceCharge = (amount: number) =>
  Math.ceil(amount * PRODUCT_SERVICE_CHARGE_RATE * 100) / 100;

export const calculateBuyerPayableTotal = (productAmount: number, deliveryFee = 0) =>
  Math.ceil(Math.round((productAmount + deliveryFee + calculateProductServiceCharge(productAmount)) * 100) / 100);

export const normalizeProductImages = (product: Product): string[] => {
  const rawImages = product.images;
  const extraImages = Array.isArray(rawImages)
    ? rawImages
    : typeof rawImages === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(rawImages);
          return Array.isArray(parsed) ? parsed : [rawImages];
        } catch {
          return [rawImages];
        }
      })()
      : [];

  return [
    product.image_url,
    (product as { imageUrl?: string }).imageUrl,
    ...extraImages
  ]
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
    .map(image => image.trim())
    .filter((image, index, allImages) => allImages.indexOf(image) === index);
};
