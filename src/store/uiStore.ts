"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isPaperStyle, type PaperStyle } from "@/lib/canvas/paper";

export type PipMood = "idle" | "welcome" | "thinking" | "celebrate";

type UiStore = {
  pipHidden: boolean;
  pipMinimized: boolean;
  pipMood: PipMood;
  hasEnteredWorkspace: boolean;
  celebratedFirstStroke: boolean;
  paperStyle: PaperStyle;
  exportPreviewOpen: boolean;
  exportPreviewUrl: string | null;
  setPipHidden: (hidden: boolean) => void;
  setPipMinimized: (minimized: boolean) => void;
  setPipMood: (mood: PipMood) => void;
  setPaperStyle: (style: PaperStyle) => void;
  markWorkspaceEntered: () => void;
  markFirstStrokeCelebrated: () => void;
  openExportPreview: (url: string) => void;
  closeExportPreview: () => void;
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      pipHidden: false,
      pipMinimized: false,
      pipMood: "welcome",
      hasEnteredWorkspace: false,
      celebratedFirstStroke: false,
      paperStyle: "grid",
      exportPreviewOpen: false,
      exportPreviewUrl: null,
      setPipHidden: (pipHidden) => set({ pipHidden }),
      setPipMinimized: (pipMinimized) => set({ pipMinimized }),
      setPipMood: (pipMood) => set({ pipMood }),
      setPaperStyle: (paperStyle) => set({ paperStyle }),
      markWorkspaceEntered: () =>
        set({ hasEnteredWorkspace: true, pipMood: "idle" }),
      markFirstStrokeCelebrated: () =>
        set({ celebratedFirstStroke: true, pipMood: "celebrate" }),
      openExportPreview: (url) =>
        set({ exportPreviewOpen: true, exportPreviewUrl: url }),
      closeExportPreview: () =>
        set({ exportPreviewOpen: false, exportPreviewUrl: null }),
    }),
    {
      name: "wondoodle-ui",
      partialize: (state) => ({
        pipHidden: state.pipHidden,
        pipMinimized: state.pipMinimized,
        hasEnteredWorkspace: state.hasEnteredWorkspace,
        celebratedFirstStroke: state.celebratedFirstStroke,
        paperStyle: state.paperStyle,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UiStore>;
        return {
          ...current,
          ...p,
          paperStyle: isPaperStyle(p.paperStyle) ? p.paperStyle : current.paperStyle,
        };
      },
    }
  )
);
