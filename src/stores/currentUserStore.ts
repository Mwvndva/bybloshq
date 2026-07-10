import { create } from 'zustand';

interface CurrentUserState {
  activeDashboard: 'buyer' | 'seller' | 'creator' | 'admin' | 'logistics' | null;
  selectedWorkspaceId: string | null;
  preferences: Record<string, unknown>;
  setActiveDashboard: (dashboard: 'buyer' | 'seller' | 'creator' | 'admin' | 'logistics' | null) => void;
  setSelectedWorkspaceId: (id: string | null) => void;
  setPreference: (key: string, value: unknown) => void;
}

export const useCurrentUserStore = create<CurrentUserState>((set) => ({
  activeDashboard: null,
  selectedWorkspaceId: null,
  preferences: {},
  setActiveDashboard: (activeDashboard) => set({ activeDashboard }),
  setSelectedWorkspaceId: (selectedWorkspaceId) => set({ selectedWorkspaceId }),
  setPreference: (key, value) =>
    set((state) => ({ preferences: { ...state.preferences, [key]: value } })),
}));


