import { create } from 'zustand';

interface FilterState {
  searchQuery: string;
  sortBy: string;
  page: number;
  limit: number;
  categories: string[];
  priceRange: { min: number; max: number };
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  toggleCategory: (category: string) => void;
  setPriceRange: (min: number, max: number) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  searchQuery: '',
  sortBy: 'newest',
  page: 1,
  limit: 24,
  categories: [],
  priceRange: { min: 0, max: 1000000 },

  setSearchQuery: (searchQuery) => set({ searchQuery, page: 1 }),
  setSortBy: (sortBy) => set({ sortBy }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit }),
  toggleCategory: (category) =>
    set((state) => ({
      categories: state.categories.includes(category)
        ? state.categories.filter((c) => c !== category)
        : [...state.categories, category],
      page: 1,
    })),
  setPriceRange: (min, max) => set({ priceRange: { min, max }, page: 1 }),
  resetFilters: () =>
    set({
      searchQuery: '',
      sortBy: 'newest',
      page: 1,
      limit: 24,
      categories: [],
      priceRange: { min: 0, max: 1000000 },
    }),
}));


