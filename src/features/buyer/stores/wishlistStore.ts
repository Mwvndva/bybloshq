import { create } from 'zustand';

interface WishlistState {
  wishlistIds: string[];
  optimisticAdditions: string[];
  optimisticRemovals: string[];
  setWishlistIds: (ids: string[]) => void;
  addWishlistId: (id: string) => void;
  removeWishlistId: (id: string) => void;
  addOptimisticAddition: (id: string) => void;
  removeOptimisticAddition: (id: string) => void;
  addOptimisticRemoval: (id: string) => void;
  removeOptimisticRemoval: (id: string) => void;
  clearOptimistic: () => void;
  isInWishlist: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  wishlistIds: [],
  optimisticAdditions: [],
  optimisticRemovals: [],

  setWishlistIds: (ids) => set({ wishlistIds: ids }),
  
  addWishlistId: (id) => set((state) => ({
    wishlistIds: state.wishlistIds.includes(id) ? state.wishlistIds : [...state.wishlistIds, id]
  })),

  removeWishlistId: (id) => set((state) => ({
    wishlistIds: state.wishlistIds.filter((x) => x !== id)
  })),

  addOptimisticAddition: (id) => set((state) => ({
    optimisticAdditions: [...state.optimisticAdditions, id],
    optimisticRemovals: state.optimisticRemovals.filter((x) => x !== id),
  })),

  removeOptimisticAddition: (id) => set((state) => ({
    optimisticAdditions: state.optimisticAdditions.filter((x) => x !== id)
  })),

  addOptimisticRemoval: (id) => set((state) => ({
    optimisticRemovals: [...state.optimisticRemovals, id],
    optimisticAdditions: state.optimisticAdditions.filter((x) => x !== id),
  })),

  removeOptimisticRemoval: (id) => set((state) => ({
    optimisticRemovals: state.optimisticRemovals.filter((x) => x !== id)
  })),

  clearOptimistic: () => set({ optimisticAdditions: [], optimisticRemovals: [] }),

  isInWishlist: (productId: string) => {
    const { wishlistIds, optimisticAdditions, optimisticRemovals } = get();
    if (optimisticRemovals.includes(productId)) return false;
    if (optimisticAdditions.includes(productId)) return true;
    return wishlistIds.includes(productId);
  },
}));


