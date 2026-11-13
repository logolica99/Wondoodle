"use client";

import { create } from "zustand";

type CelebrationStore = {
  token: number;
  label: string | null;
  celebrate: (label?: string) => void;
  clear: () => void;
};

export const useCelebrationStore = create<CelebrationStore>((set) => ({
  token: 0,
  label: null,
  celebrate: (label) =>
    set((state) => ({
      token: state.token + 1,
      label: label ?? "Nice work!",
    })),
  clear: () => set({ label: null }),
}));
