"use client";

import { create } from "zustand";

type PipStore = {
  companionOpen: boolean;
  openCompanion: () => void;
  closeCompanion: () => void;
  setCompanionOpen: (open: boolean) => void;
};

export const usePipStore = create<PipStore>((set) => ({
  companionOpen: false,
  openCompanion: () => set({ companionOpen: true }),
  closeCompanion: () => set({ companionOpen: false }),
  setCompanionOpen: (companionOpen) => set({ companionOpen }),
}));
