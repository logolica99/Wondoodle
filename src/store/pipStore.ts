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
  /**
   * When true, the next look_at_canvas reply must guess the adventure
   * (“Is this your adventure: …?”) instead of tutoring.
   */
  adventureInvitePending: boolean;
  connection: PipStoreConnection;
  voiceState: PipStoreVoice;
  openCompanion: (options?: { autoStartTalk?: boolean }) => void;
  closeCompanion: () => void;
  setCompanionOpen: (open: boolean) => void;
  consumeAutoStartTalk: () => boolean;
  setOpeningInstructions: (instructions: string | null) => void;
  consumeOpeningInstructions: () => string | null;
  setAdventureInvitePending: (pending: boolean) => void;
  consumeAdventureInvitePending: () => boolean;
  setRealtimeStatus: (
    connection: PipStoreConnection,
    voiceState?: PipStoreVoice
  ) => void;
  /** Clear pending auto-start / opening prompts (e.g. after End conversation). */
  clearPendingVoiceStart: () => void;
};

export const usePipStore = create<PipStore>((set, get) => ({
  companionOpen: false,
  autoStartTalk: false,
  openingInstructions: null,
  adventureInvitePending: false,
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
      adventureInvitePending: false,
    }),
  setCompanionOpen: (companionOpen) =>
    set({
      companionOpen,
      ...(companionOpen
        ? {}
        : {
            autoStartTalk: false,
            openingInstructions: null,
            adventureInvitePending: false,
          }),
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
  setAdventureInvitePending: (adventureInvitePending) =>
    set({ adventureInvitePending }),
  consumeAdventureInvitePending: () => {
    const pending = get().adventureInvitePending;
    if (pending) set({ adventureInvitePending: false });
    return pending;
  },
  setRealtimeStatus: (connection, voiceState) =>
    set((state) => ({
      connection,
      voiceState: voiceState ?? state.voiceState,
    })),
  clearPendingVoiceStart: () =>
    set({
      autoStartTalk: false,
      openingInstructions: null,
      adventureInvitePending: false,
    }),
}));
