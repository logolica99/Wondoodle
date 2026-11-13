"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { HelpCircle, Minimize2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CanvasTopBar } from "./CanvasTopBar";
import { CanvasToolbar } from "./CanvasToolbar";
import { ToolSettings } from "./ToolSettings";
import { ExportPreview } from "./ExportPreview";
import { VoicePanel } from "@/components/voice/VoicePanel";
import { PipCompanion } from "@/components/voice/PipCompanion";
import { PipMascot } from "@/components/mascot/PipMascot";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";
import { useCanvasStore } from "@/store/canvasStore";
import { usePipStore } from "@/store/pipStore";
import { copy } from "@/lib/design-tokens";
import { exportDocument } from "@/lib/canvas/export";

const SmartCanvas = dynamic(
  () => import("./SmartCanvas").then((m) => m.SmartCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full items-center justify-center bg-mc-white text-sm text-mc-ink/60"
        data-testid="canvas-ssr-loading"
      >
        Preparing your creative space…
      </div>
    ),
  }
);

export function LearnWorkspace() {
  const reduceMotion = useReducedMotion();
  const pipHidden = useUiStore((s) => s.pipHidden);
  const pipMinimized = useUiStore((s) => s.pipMinimized);
  const pipMood = useUiStore((s) => s.pipMood);
  const paperStyle = useUiStore((s) => s.paperStyle);
  const setPipHidden = useUiStore((s) => s.setPipHidden);
  const setPipMinimized = useUiStore((s) => s.setPipMinimized);
  const setPipMood = useUiStore((s) => s.setPipMood);
  const openCompanion = usePipStore((s) => s.openCompanion);
  const companionOpen = usePipStore((s) => s.companionOpen);
  const markWorkspaceEntered = useUiStore((s) => s.markWorkspaceEntered);
  const celebratedFirstStroke = useUiStore((s) => s.celebratedFirstStroke);
  const markFirstStrokeCelebrated = useUiStore((s) => s.markFirstStrokeCelebrated);
  const isHydrated = useCanvasStore((s) => s.isHydrated);
  const objectCount = useCanvasStore((s) => s.document.objects.length);
  const getExportableDocument = useCanvasStore((s) => s.getExportableDocument);
  const baselineCount = useRef<number | null>(null);
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    markWorkspaceEntered();
  }, [markWorkspaceEntered]);

  useEffect(() => {
    if (!isHydrated) return;
    if (baselineCount.current === null) {
      baselineCount.current = objectCount;
      return;
    }
    if (objectCount > baselineCount.current && !celebratedFirstStroke) {
      markFirstStrokeCelebrated();
      setShowCelebrate(true);
      const t = window.setTimeout(() => {
        setShowCelebrate(false);
        setPipMood("idle");
      }, 1600);
      return () => window.clearTimeout(t);
    }
  }, [
    isHydrated,
    objectCount,
    celebratedFirstStroke,
    markFirstStrokeCelebrated,
    setPipMood,
  ]);

  return (
    <motion.div
      className="relative h-[100dvh] w-full overflow-hidden bg-mc-white"
      data-testid="learn-workspace"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.42 }}
    >
      <div className="absolute inset-0 z-0">
        <SmartCanvas />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="pointer-events-auto">
          <CanvasTopBar />
        </div>
      </div>

      <CanvasToolbar />
      <VoicePanel />
      <PipCompanion />

      <div className="pointer-events-none absolute inset-x-0 bottom-[5.75rem] z-30 px-3 sm:bottom-5 sm:left-[5.75rem] sm:right-[12.5rem] sm:px-0">
        <div className="pointer-events-auto mx-auto max-w-3xl sm:mx-0 sm:max-w-[min(100%,36rem)]">
          <ToolSettings />
        </div>
      </div>

      {!pipHidden && !companionOpen && (
        <div
          className="absolute right-3 top-[5.25rem] z-30 flex flex-col items-end gap-2 sm:right-5"
          data-testid="pip-dock"
        >
          {helpOpen && !pipMinimized && (
            <motion.div
              className="max-w-[240px] rounded-2xl border border-white bg-white/95 p-3 text-sm text-mc-ink shadow-float"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="pip-help-bubble"
            >
              <p>
                Try Draw to sketch, Write for words, and Photo for homework
                pictures. Hold Space to pan — or tap Pip to talk!
              </p>
              <Button
                size="sm"
                className="mt-2 w-full rounded-xl"
                data-testid="pip-dock-talk"
                onClick={() => {
                  setHelpOpen(false);
                  openCompanion();
                }}
              >
                Talk to Pip
              </Button>
            </motion.div>
          )}

          {pipMinimized ? (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-white/90 bg-white/95 py-1 pl-1 pr-3 shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30"
              data-testid="pip-expand-button"
              onClick={() => {
                setPipMinimized(false);
                setPipMood("welcome");
              }}
            >
              <PipMascot mood={pipMood} size="sm" />
              <span className="text-sm font-bold text-mc-ink">Pip</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-full border border-white/90 bg-white/90 p-1.5 shadow-toolbar backdrop-blur-md">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={helpOpen ? "Hide Pip tip" : "Ask Pip for a tip"}
                data-testid="pip-help-button"
                onClick={() => {
                  setHelpOpen((v) => !v);
                  setPipMood(helpOpen ? "idle" : "thinking");
                }}
              >
                <HelpCircle className="h-4 w-4 text-mc-purple" />
              </Button>
              <button
                type="button"
                className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30"
                aria-label="Talk to Pip"
                data-testid="pip-toggle-area"
                onClick={() => {
                  setHelpOpen(false);
                  openCompanion();
                  setPipMood("welcome");
                }}
              >
                <PipMascot
                  mood={showCelebrate ? "celebrate" : pipMood}
                  size="sm"
                />
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Minimize Pip"
                data-testid="pip-minimize-button"
                onClick={() => {
                  setPipMinimized(true);
                  setHelpOpen(false);
                  setPipMood("idle");
                }}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Hide Pip"
                data-testid="pip-hide-button"
                onClick={() => setPipHidden(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {pipHidden && !companionOpen && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-3 top-[5.25rem] z-30 rounded-full bg-white shadow-soft sm:right-5"
          data-testid="pip-show-button"
          onClick={() => {
            setPipHidden(false);
            setPipMinimized(false);
            setPipMood("welcome");
          }}
        >
          Show Pip
        </Button>
      )}

      {showCelebrate && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-full bg-mc-mint px-4 py-2 text-sm font-bold text-mc-ink shadow-float"
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          data-testid="first-stroke-celebration"
        >
          {copy.firstDrawing}
        </motion.div>
      )}

      <ExportPreview
        onConfirmDownload={async () => {
          const result = await exportDocument(getExportableDocument(), {
            paperStyle,
          });
          return result.imageBlob;
        }}
      />
    </motion.div>
  );
}
