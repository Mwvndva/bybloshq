import type { Product } from '@/types';

export type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow' | 'brown';

export interface ProductCardThemeClasses {
  card: string;
  price: string;
  button: string;
  seller: string;
  description: string;
  icon: string;
}

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

export const getProductFlags = (product: Product) => {
  const productType = String(product.product_type || (product as any).productType || '').toLowerCase();
  const isDigital = productType === 'digital' || product.is_digital || (product as any).isDigital;
  const isService = productType === 'service';
  const isPhysical = productType === 'physical' && !isDigital && !isService;
  const isHybrid = isService && (product.service_options?.location_type === 'hybrid' || (product as any).serviceOptions?.location_type === 'hybrid');
  const isOutOfStock = (product as any).track_inventory === true && ((product as any).quantity === 0 || (product as any).quantity === null);

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
        card: 'bg-white text-slate-950 border-slate-200 hover:border-[var(--theme-accent, #f59e0b)]/40 hover:shadow-xl hover:shadow-slate-950/10',
        price: 'text-[var(--theme-accent, #f59e0b)]',
        button: 'bg-[var(--theme-button-bg, #f5c518)] hover:opacity-90 text-[var(--theme-button-text, black)] font-semibold shadow-sm',
        seller: 'text-slate-600',
        description: 'text-slate-600',
        icon: 'text-[var(--theme-accent, #f59e0b)]',
      };
    case 'pink':
    case 'orange':
    case 'green':
    case 'red':
    case 'yellow':
    case 'brown':
      return {
        card: 'bg-white text-slate-950 border-slate-200 hover:shadow-xl hover:shadow-slate-950/10',
        price: 'text-[var(--theme-accent)]',
        button: 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-sm',
        seller: 'text-slate-600',
        description: 'text-slate-600',
        icon: 'text-[var(--theme-accent)]',
      };
    default:
      return {
        card: 'border border-slate-200 bg-white text-slate-950 shadow-sm hover:shadow-xl hover:shadow-slate-950/10',
        price: 'text-yellow-600',
        button: 'bg-yellow-400 hover:bg-yellow-300 text-black font-semibold shadow-sm',
        seller: 'text-slate-600',
        description: 'text-slate-600',
        icon: 'text-yellow-600',
      };
  }
};
