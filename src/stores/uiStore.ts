import { create } from 'zustand';

interface UIState {
  modals: Record<string, boolean>;
  drawers: Record<string, boolean>;
  selections: Record<string, unknown>;
  setModalOpen: (key: string, isOpen: boolean) => void;
  setDrawerOpen: (key: string, isOpen: boolean) => void;
  setSelection: (key: string, value: unknown) => void;
  clearSelection: (key: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  modals: {},
  drawers: {},
  selections: {},
  setModalOpen: (key, isOpen) =>
    set((state) => ({ modals: { ...state.modals, [key]: isOpen } })),
  setDrawerOpen: (key, isOpen) =>
    set((state) => ({ drawers: { ...state.drawers, [key]: isOpen } })),
  setSelection: (key, value) =>
    set((state) => ({ selections: { ...state.selections, [key]: value } })),
  clearSelection: (key) =>
    set((state) => ({ selections: { ...state.selections, [key]: null } })),
}));


