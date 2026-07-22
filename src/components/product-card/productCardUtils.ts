import type { Product, Theme } from '@/types';
export type { Theme };
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
  const accentVars: Record<string, { accent: string; buttonBg: string; buttonText: string; soft: string }> = {
    pink: {
      accent: '#db2777',
      buttonBg: '#db2777',
      buttonText: '#ffffff',
      soft: 'rgba(219, 39, 119, 0.12)'
    },
    purple: {
      accent: '#a855f7',
      buttonBg: '#a855f7',
      buttonText: '#ffffff',
      soft: 'rgba(168, 85, 247, 0.12)'
    },
    orange: {
      accent: '#ea580c',
      buttonBg: '#ea580c',
      buttonText: '#ffffff',
      soft: 'rgba(234, 88, 12, 0.12)'
    },
    green: {
      accent: '#16a34a',
      buttonBg: '#16a34a',
      buttonText: '#ffffff',
      soft: 'rgba(22, 163, 74, 0.12)'
    },
    red: {
      accent: '#dc2626',
      buttonBg: '#dc2626',
      buttonText: '#ffffff',
      soft: 'rgba(220, 38, 38, 0.12)'
    },
    yellow: {
      accent: '#ca8a04',
      buttonBg: '#ca8a04',
      buttonText: '#ffffff',
      soft: 'rgba(202, 138, 4, 0.12)'
    },
    brown: {
      accent: '#92400e',
      buttonBg: '#92400e',
      buttonText: '#ffffff',
      soft: 'rgba(146, 64, 14, 0.12)'
    },
    default: {
      accent: '#f59e0b',
      buttonBg: '#f5c518',
      buttonText: '#111111',
      soft: 'rgba(245, 158, 11, 0.12)'
    },
    black: {
      accent: '#f59e0b',
      buttonBg: '#f5c518',
      buttonText: '#111111',
      soft: 'rgba(245, 158, 11, 0.12)'
    }
  };

  const selected = accentVars[theme] || accentVars.default;

  return {
    '--product-card-bg': 'var(--byblos-surface, #ffffff)',
    '--product-card-text': 'var(--byblos-text, #0f0f0e)',
    '--product-card-muted': 'var(--byblos-muted, #64748b)',
    '--product-card-border': 'var(--byblos-border, rgba(0, 0, 0, 0.1))',
    '--product-card-accent': selected.accent,
    '--product-card-button-bg': selected.buttonBg,
    '--product-card-button-text': selected.buttonText,
    '--product-card-soft': selected.soft,
  };
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
