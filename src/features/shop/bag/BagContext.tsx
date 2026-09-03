/* eslint-disable react-refresh/only-export-components -- provider + its hooks co-located by convention */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Product } from '@/shared/types';
import { calculateProductServiceCharge, getProductFlags, type ProductWithApiFields } from '@/features/shop/utils/productCardUtils';

const isServiceProduct = (product: Product) => getProductFlags(product as unknown as ProductWithApiFields).isService;

export const MAX_BAG_PRODUCTS = 5;

const sameId = (a: string | number, b: string | number) => String(a) === String(b);

export interface BagLine {
  product: Product;
  quantity: number;
}

interface AddResult {
  ok: boolean;
  reason?: string;
}

interface BagContextValue {
  items: BagLine[];
  count: number;          // distinct products in the bag
  totalQuantity: number;
  subtotal: number;
  serviceCharge: number;  // 2% Byblos charge (delivery is added later at checkout)
  total: number;          // subtotal + serviceCharge
  isFull: boolean;
  isOpen: boolean;
  addProduct: (product: Product) => AddResult;
  removeProduct: (productId: string | number) => void;
  setQuantity: (productId: string | number, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  hasProduct: (productId: string | number) => boolean;
}

const BagContext = createContext<BagContextValue | null>(null);

/**
 * Per-seller shopping bag. Mounted once per seller shop, so its contents are
 * naturally isolated to the current shop — leaving one shop and opening another
 * remounts a fresh, empty bag (spec §29: bags never mix between sellers).
 * Holds up to MAX_BAG_PRODUCTS distinct products (quantities can grow beyond that).
 */
export function BagProvider({ seedProduct, children }: { seedProduct?: Product | null; children: ReactNode }) {
  const [items, setItems] = useState<BagLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const seededRef = useRef(false);

  // Pre-add a product carried over from another surface (e.g. a wishlist tap that
  // opens this shop with the item already in the bag — spec: wishlist → shop + bag).
  useEffect(() => {
    if (!seedProduct || seededRef.current) return;
    seededRef.current = true;
    setItems((prev) => (prev.some((l) => sameId(l.product.id, seedProduct.id)) ? prev : [...prev, { product: seedProduct, quantity: 1 }]));
    setIsOpen(true);
    toast.success(`${seedProduct.name} added to your bag`);
  }, [seedProduct]);

  const hasProduct = useCallback(
    (productId: string | number) => items.some((l) => sameId(l.product.id, productId)),
    [items],
  );

  const addProduct = useCallback((product: Product): AddResult => {
    const already = items.some((l) => sameId(l.product.id, product.id));
    if (already) {
      setItems((prev) => prev.map((l) => (sameId(l.product.id, product.id) ? { ...l, quantity: l.quantity + 1 } : l)));
      return { ok: true };
    }
    // A service is booked with the seller and cannot share an order with other
    // products, so it occupies the bag on its own.
    const addingService = isServiceProduct(product);
    const bagHasService = items.some((l) => isServiceProduct(l.product));
    if (items.length > 0 && (addingService || bagHasService)) {
      return { ok: false, reason: 'A service is booked on its own — check it out separately from products.' };
    }
    if (items.length >= MAX_BAG_PRODUCTS) {
      return { ok: false, reason: `Your bag is full — up to ${MAX_BAG_PRODUCTS} products.` };
    }
    setItems((prev) => [...prev, { product, quantity: 1 }]);
    return { ok: true };
  }, [items]);

  const removeProduct = useCallback((productId: string | number) => {
    setItems((prev) => prev.filter((l) => !sameId(l.product.id, productId)));
  }, []);

  const setQuantity = useCallback((productId: string | number, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((l) => !sameId(l.product.id, productId));
      return prev.map((l) => (sameId(l.product.id, productId) ? { ...l, quantity } : l));
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<BagContextValue>(() => {
    const subtotal = items.reduce((sum, l) => sum + (Number(l.product.price) || 0) * l.quantity, 0);
    const serviceCharge = calculateProductServiceCharge(subtotal);
    const totalQuantity = items.reduce((sum, l) => sum + l.quantity, 0);
    return {
      items,
      count: items.length,
      totalQuantity,
      subtotal,
      serviceCharge,
      total: subtotal + serviceCharge,
      isFull: items.length >= MAX_BAG_PRODUCTS,
      isOpen,
      addProduct,
      removeProduct,
      setQuantity,
      clear,
      open,
      close,
      hasProduct,
    };
  }, [items, isOpen, addProduct, removeProduct, setQuantity, clear, open, close, hasProduct]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

/** Bag access inside a seller shop. Throws if used outside a BagProvider. */
export function useBag(): BagContextValue {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error('useBag must be used within a BagProvider');
  return ctx;
}

/** Bag access that tolerates absence (shared surfaces like the wishlist have no bag). */
export function useBagOptional(): BagContextValue | null {
  return useContext(BagContext);
}
