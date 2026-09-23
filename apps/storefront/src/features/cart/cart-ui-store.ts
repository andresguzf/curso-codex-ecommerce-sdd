"use client";

import { create } from "zustand";

type CartUiState = Readonly<{
  removalItemId: string | null;
  cancelRemoval: () => void;
  requestRemoval: (itemId: string) => void;
}>;

export const useCartUiStore = create<CartUiState>((set) => ({
  removalItemId: null,
  cancelRemoval: () => set({ removalItemId: null }),
  requestRemoval: (removalItemId) => set({ removalItemId }),
}));
