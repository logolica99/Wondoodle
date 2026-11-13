"use client";

import { create } from "zustand";
import type { DiscoveryCardModel } from "@/lib/learning/observationSchema";

type DiscoveryStore = {
  card: DiscoveryCardModel | null;
  minimized: boolean;
  showCard: (card: DiscoveryCardModel) => void;
  dismiss: () => void;
  minimize: () => void;
  expand: () => void;
  clear: () => void;
};

export const useDiscoveryStore = create<DiscoveryStore>((set) => ({
  card: null,
  minimized: false,
  showCard: (card) => set({ card, minimized: false }),
  dismiss: () => set({ card: null, minimized: false }),
  minimize: () => set({ minimized: true }),
  expand: () => set({ minimized: false }),
  clear: () => set({ card: null, minimized: false }),
}));
