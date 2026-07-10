import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  coupon: string | null;
  discount: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (coupon: string, discountAmount: number) => void;
  removeCoupon: () => void;
  getTotals: () => {
    subtotal: number;
    discount: number;
    total: number;
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      discount: 0,

      addItem: (item) => set((state) => {
        const existing = state.items.find((x) => x.productId === item.productId);
        if (existing) {
          return {
            items: state.items.map((x) =>
              x.productId === item.productId ? { ...x, quantity: x.quantity + item.quantity } : x
            ),
          };
        }
        return { items: [...state.items, item] };
      }),

      removeItem: (productId) => set((state) => ({
        items: state.items.filter((x) => x.productId !== productId),
      })),

      updateQuantity: (productId, quantity) => set((state) => ({
        items: state.items.map((x) =>
          x.productId === productId ? { ...x, quantity: Math.max(1, quantity) } : x
        ),
      })),

      clearCart: () => set({ items: [], coupon: null, discount: 0 }),

      applyCoupon: (coupon, discountAmount) => set({ coupon, discount: discountAmount }),

      removeCoupon: () => set({ coupon: null, discount: 0 }),

      getTotals: () => {
        const { items, discount } = get();
        const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
        const total = Math.max(0, subtotal - discount);
        return {
          subtotal,
          discount,
          total,
        };
      },
    }),
    {
      name: 'byblos-cart-storage',
    }
  )
);


