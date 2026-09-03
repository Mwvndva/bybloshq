import { create } from 'zustand';

interface WishlistState {
  wishlistIds: string[];
  optimisticAdditions: string[];
  optimisticRemovals: string[];
  setWishlistIds: (ids: Array<string | number>) => void;
  addWishlistId: (id: string | number) => void;
  removeWishlistId: (id: string | number) => void;
  addOptimisticAddition: (id: string | number) => void;
  removeOptimisticAddition: (id: string | number) => void;
  addOptimisticRemoval: (id: string | number) => void;
  removeOptimisticRemoval: (id: string | number) => void;
  clearOptimistic: () => void;
  isInWishlist: (productId: string | number) => boolean;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  wishlistIds: [],
  optimisticAdditions: [],
  optimisticRemovals: [],

  setWishlistIds: (ids) => set({ wishlistIds: ids.map(String) }),
  
  addWishlistId: (id) => {
    const pid = String(id);
    set((state) => ({
      wishlistIds: state.wishlistIds.some((x) => String(x) === pid) ? state.wishlistIds : [...state.wishlistIds, pid]
    }));
  },

  removeWishlistId: (id) => {
    const pid = String(id);
    set((state) => ({
      wishlistIds: state.wishlistIds.filter((x) => String(x) !== pid)
    }));
  },

  addOptimisticAddition: (id) => {
    const pid = String(id);
    set((state) => ({
      optimisticAdditions: state.optimisticAdditions.some((x) => String(x) === pid) ? state.optimisticAdditions : [...state.optimisticAdditions, pid],
      optimisticRemovals: state.optimisticRemovals.filter((x) => String(x) !== pid),
      wishlistIds: state.wishlistIds.some((x) => String(x) === pid) ? state.wishlistIds : [...state.wishlistIds, pid],
    }));
  },

  removeOptimisticAddition: (id) => {
    const pid = String(id);
    set((state) => ({
      optimisticAdditions: state.optimisticAdditions.filter((x) => String(x) !== pid)
    }));
  },

  addOptimisticRemoval: (id) => {
    const pid = String(id);
    set((state) => ({
      optimisticRemovals: state.optimisticRemovals.some((x) => String(x) === pid) ? state.optimisticRemovals : [...state.optimisticRemovals, pid],
      optimisticAdditions: state.optimisticAdditions.filter((x) => String(x) !== pid),
      wishlistIds: state.wishlistIds.filter((x) => String(x) !== pid),
    }));
  },

  removeOptimisticRemoval: (id) => {
    const pid = String(id);
    set((state) => ({
      optimisticRemovals: state.optimisticRemovals.filter((x) => String(x) !== pid)
    }));
  },

  clearOptimistic: () => set({ optimisticAdditions: [], optimisticRemovals: [] }),

  isInWishlist: (productId: string | number) => {
    const pid = String(productId);
    const { wishlistIds, optimisticAdditions, optimisticRemovals } = get();
    if (optimisticRemovals.some((x) => String(x) === pid)) return false;
    if (optimisticAdditions.some((x) => String(x) === pid)) return true;
    return wishlistIds.some((x) => String(x) === pid);
  },
}));

/**
 * Reactive selector hook: triggers an immediate component re-render when the
 * wishlist status of the specific product changes (optimistic or server).
 */
export function useIsProductWishlisted(productId: string | number | undefined | null): boolean {
  const pid = productId !== undefined && productId !== null ? String(productId) : '';
  return useWishlistStore((state) => {
    if (!pid) return false;
    if (state.optimisticRemovals.some((id) => String(id) === pid)) return false;
    if (state.optimisticAdditions.some((id) => String(id) === pid)) return true;
    return state.wishlistIds.some((id) => String(id) === pid);
  });
}


