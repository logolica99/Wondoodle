"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { CanvasTopBar } from "./CanvasTopBar";
import { CanvasToolbar } from "./CanvasToolbar";
import { ToolSettings } from "./ToolSettings";
import { ExportPreview } from "./ExportPreview";
import { VoicePanel } from "@/components/voice/VoicePanel";
import { PipCompanion } from "@/components/voice/PipCompanion";
import { DiscoveryCard } from "@/components/learning/DiscoveryCard";
import { FractionPlayground } from "@/components/learning/FractionPlayground";
import { TeachBackPanel } from "@/components/learning/TeachBackPanel";
import { MasteryChallengePanel } from "@/components/learning/MasteryChallengePanel";
import { BaselineInvite } from "@/components/learning/BaselineInvite";
import { CelebrationBurst } from "@/components/learning/CelebrationBurst";
import { AppNav } from "@/components/nav/AppNav";
import { useUiStore } from "@/store/uiStore";
import { useCanvasStore } from "@/store/canvasStore";
import { usePipStore } from "@/store/pipStore";
import { useActivityStore } from "@/store/activityStore";
import { useTeachBackStore } from "@/store/teachbackStore";
import { useMasteryStore } from "@/store/masteryStore";
import { buildActivityRoute } from "@/lib/learning/misconceptions";
import { getAllLearningEvents } from "@/lib/learning/events";
import { baselineQuestionIdsFromEvents } from "@/lib/learning/masteryProof";
import { copy } from "@/lib/design-tokens";
import { exportDocument } from "@/lib/canvas/export";
import {
  clearPendingDocumentTitle,
  isDefaultUntitledTitle,
  peekPendingDocumentTitle,
} from "@/lib/canvas/pendingTitle";

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
  const searchParams = useSearchParams();
  const paperStyle = useUiStore((s) => s.paperStyle);
  const setPipMood = useUiStore((s) => s.setPipMood);
  const openCompanion = usePipStore((s) => s.openCompanion);
  const openFractionPlayground = useActivityStore(
    (s) => s.openFractionPlayground
  );
  const openTeachBack = useTeachBackStore((s) => s.openTeachBack);
  const openMasteryCheck = useMasteryStore((s) => s.openMasteryCheck);
  const rememberBaselineQuestions = useMasteryStore(
    (s) => s.rememberBaselineQuestions
  );
  const markWorkspaceEntered = useUiStore((s) => s.markWorkspaceEntered);
  const celebratedFirstStroke = useUiStore((s) => s.celebratedFirstStroke);
  const markFirstStrokeCelebrated = useUiStore(
    (s) => s.markFirstStrokeCelebrated
  );
  const isHydrated = useCanvasStore((s) => s.isHydrated);
  const objectCount = useCanvasStore((s) => s.document.objects.length);
  const documentTitle = useCanvasStore((s) => s.document.title);
  const setTitle = useCanvasStore((s) => s.setTitle);
  const getExportableDocument = useCanvasStore((s) => s.getExportableDocument);
  const strokeBaselineCount = useRef<number | null>(null);
  const masteryLaunchRef = useRef<string | null>(null);
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [baselineInviteOpen, setBaselineInviteOpen] = useState(false);

  useEffect(() => {
    markWorkspaceEntered();
  }, [markWorkspaceEntered]);

  // Welcome naming card → ensure title sticks even if hydrate already ran.
  useEffect(() => {
    if (!isHydrated) return;
    const pending = peekPendingDocumentTitle();
    if (!pending) return;
    if (documentTitle === pending) {
      clearPendingDocumentTitle();
      return;
    }
    if (objectCount === 0 && isDefaultUntitledTitle(documentTitle)) {
      setTitle(pending);
      clearPendingDocumentTitle();
    }
  }, [isHydrated, documentTitle, objectCount, setTitle]);

  // Journey "Talk with Pip" opens the companion panel only — user taps Talk to start.
  useEffect(() => {
    if (searchParams.get("talk") === "1") {
      openCompanion({ autoStartTalk: false });
    }
  }, [searchParams, openCompanion]);

  // Manual / Journey launch path for Fraction Playground.
  useEffect(() => {
    if (searchParams.get("activity") === "fraction_comparison") {
      openFractionPlayground(buildActivityRoute("denominator_size"));
      openCompanion({ autoStartTalk: false });
    }
  }, [searchParams, openFractionPlayground, openCompanion]);

  // Journey "Be the Teacher" — open TeachBack; "Let's teach Pip" starts voice.
  useEffect(() => {
    if (searchParams.get("teachback") === "1") {
      openTeachBack({
        conceptId: "unit_fraction_comparison",
        source: "journey",
      });
    }
  }, [searchParams, openTeachBack]);

  // Baseline invite — explicit start only (welcome / ?baseline=1).
  useEffect(() => {
    if (searchParams.get("baseline") !== "1") return;
    if (masteryLaunchRef.current === "baseline-invite") return;
    masteryLaunchRef.current = "baseline-invite";
    setBaselineInviteOpen(true);
  }, [searchParams]);

  // Journey "Show your superpower" — post_learning, exclude baseline questions.
  useEffect(() => {
    if (searchParams.get("mastery") !== "1") return;
    if (masteryLaunchRef.current === "mastery") return;
    masteryLaunchRef.current = "mastery";
    let cancelled = false;
    void (async () => {
      const events = await getAllLearningEvents();
      if (cancelled) return;
      const exclude = baselineQuestionIdsFromEvents(events);
      rememberBaselineQuestions(exclude);
      openMasteryCheck({
        source: "journey",
        assessmentType: "post_learning",
        excludeIds: exclude,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, openMasteryCheck, rememberBaselineQuestions]);

  useEffect(() => {
    if (!isHydrated) return;
    if (strokeBaselineCount.current === null) {
      strokeBaselineCount.current = objectCount;
      return;
    }
    if (objectCount > strokeBaselineCount.current && !celebratedFirstStroke) {
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

  const startBaseline = () => {
    setBaselineInviteOpen(false);
    openMasteryCheck({
      source: searchParams.get("baseline") === "1" ? "welcome" : "manual",
      assessmentType: "baseline",
    });
  };

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

      <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 md:hidden">
        <div className="pointer-events-auto">
          <AppNav />
        </div>
      </div>

      <CanvasToolbar />
      <VoicePanel />
      <PipCompanion />
      <DiscoveryCard />
      <FractionPlayground />
      <TeachBackPanel />
      <BaselineInvite
        open={baselineInviteOpen}
        onStart={startBaseline}
        onSkip={() => setBaselineInviteOpen(false)}
      />
      <MasteryChallengePanel />
      <CelebrationBurst />

      <div className="pointer-events-none absolute inset-x-0 bottom-[5.75rem] z-30 px-3 sm:bottom-5 sm:left-[5.75rem] sm:right-[12.5rem] sm:px-0">
        <div className="pointer-events-auto mx-auto max-w-3xl sm:mx-0 sm:max-w-[min(100%,36rem)]">
          <ToolSettings />
        </div>
      </div>

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
