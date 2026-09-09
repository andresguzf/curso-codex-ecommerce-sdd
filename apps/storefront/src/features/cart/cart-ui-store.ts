"use client";

import { create } from "zustand";

type CartUiState = Readonly<{
  notice: string | null;
  removalItemId: string | null;
  cancelRemoval: () => void;
  clearNotice: () => void;
  requestRemoval: (itemId: string) => void;
  setNotice: (notice: string) => void;
}>;

export const useCartUiStore = create<CartUiState>((set) => ({
  notice: null,
  removalItemId: null,
  cancelRemoval: () => set({ removalItemId: null }),
  clearNotice: () => set({ notice: null }),
  requestRemoval: (removalItemId) => set({ removalItemId }),
  setNotice: (notice) => set({ notice }),
}));
