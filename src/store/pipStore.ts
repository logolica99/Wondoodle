"use client";

import { create } from "zustand";

export type PipStoreConnection = "idle" | "connecting" | "connected" | "error";
export type PipStoreVoice = "idle" | "listening" | "speaking";

type PipStore = {
  companionOpen: boolean;
  /** When true, PipCompanion should start the realtime session once. */
  autoStartTalk: boolean;
  /**
   * One-shot instructions for Pip's first utterance after connect.
   * Used so TeachBack can replace the generic "what are we working on" greeting.
   */
  openingInstructions: string | null;
  connection: PipStoreConnection;
  voiceState: PipStoreVoice;
  openCompanion: (options?: { autoStartTalk?: boolean }) => void;
  closeCompanion: () => void;
  setCompanionOpen: (open: boolean) => void;
  consumeAutoStartTalk: () => boolean;
  setOpeningInstructions: (instructions: string | null) => void;
  consumeOpeningInstructions: () => string | null;
  setRealtimeStatus: (
    connection: PipStoreConnection,
    voiceState?: PipStoreVoice
  ) => void;
};

export const usePipStore = create<PipStore>((set, get) => ({
  companionOpen: false,
  autoStartTalk: false,
  openingInstructions: null,
  connection: "idle",
  voiceState: "idle",
  openCompanion: (options) =>
    set({
      companionOpen: true,
      autoStartTalk: Boolean(options?.autoStartTalk),
    }),
  closeCompanion: () =>
    set({
      companionOpen: false,
      autoStartTalk: false,
      openingInstructions: null,
    }),
  setCompanionOpen: (companionOpen) =>
    set({
      companionOpen,
      ...(companionOpen
        ? {}
        : { autoStartTalk: false, openingInstructions: null }),
    }),
  consumeAutoStartTalk: () => {
    const should = get().autoStartTalk;
    if (should) set({ autoStartTalk: false });
    return should;
  },
  setOpeningInstructions: (openingInstructions) => set({ openingInstructions }),
  consumeOpeningInstructions: () => {
    const value = get().openingInstructions;
    if (value) set({ openingInstructions: null });
    return value;
  },
  setRealtimeStatus: (connection, voiceState) =>
    set((state) => ({
      connection,
      voiceState: voiceState ?? state.voiceState,
    })),
}));
