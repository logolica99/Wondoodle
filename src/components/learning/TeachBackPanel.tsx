"use client";

import { useCallback, useEffect, useRef } from "react";
import { Mic, RefreshCw, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { FractionBar } from "./FractionBar";
import { useTeachBackStore } from "@/store/teachbackStore";
import { usePipStore } from "@/store/pipStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useActivityStore } from "@/store/activityStore";
import {
  TEACHBACK_CONCEPT_LABEL,
  teachBackOpeningInstructions,
} from "@/lib/learning/teachback";
import { recordTeachBackStarted } from "@/lib/learning/recordHelpers";
import { useCelebrationStore } from "@/store/celebrationStore";
import { useUiStore } from "@/store/uiStore";
import { useMasteryStore } from "@/store/masteryStore";
import { cn } from "@/lib/utils";

function pushTeachBackContext(input: {
  emitPipEvent: ReturnType<typeof useActivityStore.getState>["emitPipEvent"];
  conceptId: string;
  question: string;
  runId: string;
  /** When true, Pip should speak (already-connected / retry). */
  speak: boolean;
  retry?: boolean;
}) {
  input.emitPipEvent({
    kind: "activity_opened",
    summary: input.retry
      ? `[TeachBack retry] conceptId=${input.conceptId}. Ask the TeachBack question again, listen to their explanation, then call report_teachback_assessment. Question: "${input.question}"`
      : `[TeachBack started] You are in TeachBack mode (Be the Teacher). conceptId=${input.conceptId}. After each explanation, call report_teachback_assessment. Do not leave TeachBack mode. Question: "${input.question}"`,
    payload: {
      mode: "teachback",
      conceptId: input.conceptId,
      question: input.question,
      runId: input.runId,
      retry: Boolean(input.retry),
      speak: input.speak,
    },
  });
}

/**
 * TeachBack ("Be the Teacher") panel — explanation practice with Pip.
 * "Let's teach Pip" starts the live voice session and injects TeachBack context.
 */
export function TeachBackPanel() {
  const reduceMotion = useReducedMotion();
  const open = useTeachBackStore((s) => s.open);
  const conceptId = useTeachBackStore((s) => s.conceptId);
  const runId = useTeachBackStore((s) => s.runId);
  const source = useTeachBackStore((s) => s.source);
  const question = useTeachBackStore((s) => s.question);
  const status = useTeachBackStore((s) => s.status);
  const feedback = useTeachBackStore((s) => s.feedback);
  const completed = useTeachBackStore((s) => s.completed);
  const attempts = useTeachBackStore((s) => s.attempts);
  const voiceArmed = useTeachBackStore((s) => s.voiceArmed);
  const closeTeachBack = useTeachBackStore((s) => s.closeTeachBack);
  const resetForRetry = useTeachBackStore((s) => s.resetForRetry);
  const armVoice = useTeachBackStore((s) => s.armVoice);
  const openCompanion = usePipStore((s) => s.openCompanion);
  const pipConnection = usePipStore((s) => s.connection);
  const pipVoice = usePipStore((s) => s.voiceState);
  const documentId = useCanvasStore((s) => s.document.id);
  const emitPipEvent = useActivityStore((s) => s.emitPipEvent);
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const setPipMood = useUiStore((s) => s.setPipMood);
  const openMasteryCheck = useMasteryStore((s) => s.openMasteryCheck);
  const startedRef = useRef<string | null>(null);
  const contextSentForConnectionRef = useRef<string | null>(null);
  const celebratedRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (!completed || !runId) return;
    if (celebratedRunRef.current === runId) return;
    celebratedRunRef.current = runId;
    celebrate("You taught Pip!");
    setPipMood("celebrate");
    const t = window.setTimeout(() => setPipMood("idle"), 1600);
    return () => window.clearTimeout(t);
  }, [completed, runId, celebrate, setPipMood]);

  useEffect(() => {
    if (!open || !runId) return;
    if (startedRef.current === runId) return;
    startedRef.current = runId;
    contextSentForConnectionRef.current = null;

    void recordTeachBackStarted({
      documentId,
      runId,
      conceptId,
      source: source ?? "manual",
    });
  }, [open, runId, documentId, conceptId, source]);

  // After a fresh connect, attach TeachBack facts silently (opening utterance already asked the question).
  useEffect(() => {
    if (!open || !runId || !voiceArmed) return;
    if (pipConnection !== "connected") return;
    const key = `${runId}:context`;
    if (contextSentForConnectionRef.current === key) return;
    contextSentForConnectionRef.current = key;
    pushTeachBackContext({
      emitPipEvent,
      conceptId,
      question,
      runId,
      speak: false,
    });
  }, [
    open,
    runId,
    voiceArmed,
    pipConnection,
    question,
    conceptId,
    emitPipEvent,
  ]);

  const startTeaching = useCallback(() => {
    if (!runId) return;
    const opening = teachBackOpeningInstructions(question);
    armVoice();

    const alreadyConnected =
      usePipStore.getState().connection === "connected";

    if (alreadyConnected) {
      const key = `${runId}:context`;
      contextSentForConnectionRef.current = key;
      usePipStore.getState().setOpeningInstructions(null);
      openCompanion({ autoStartTalk: false });
      pushTeachBackContext({
        emitPipEvent,
        conceptId,
        question,
        runId,
        speak: true,
      });
      return;
    }

    // Replace the default "what are we working on" greeting.
    usePipStore.getState().setOpeningInstructions(opening);
    openCompanion({ autoStartTalk: true });
  }, [runId, armVoice, openCompanion, emitPipEvent, conceptId, question]);

  const onRetry = useCallback(() => {
    if (!runId) return;
    resetForRetry();
    const q = useTeachBackStore.getState().question;
    const opening = teachBackOpeningInstructions(q);
    const alreadyConnected =
      usePipStore.getState().connection === "connected";

    if (alreadyConnected) {
      openCompanion({ autoStartTalk: false });
      pushTeachBackContext({
        emitPipEvent,
        conceptId,
        question: q,
        runId,
        speak: true,
        retry: true,
      });
      return;
    }

    usePipStore.getState().setOpeningInstructions(opening);
    openCompanion({ autoStartTalk: true });
  }, [runId, resetForRetry, openCompanion, emitPipEvent, conceptId]);

  const voiceStatusLabel = (() => {
    if (completed) return "TeachBack complete";
    if (!voiceArmed) return "Tap Let’s teach Pip to start the voice lesson";
    if (pipConnection === "connecting") return "Connecting to Pip…";
    if (pipConnection === "error") return "Connection trouble — try again";
    if (pipConnection === "connected") {
      if (pipVoice === "listening") return "Pip is listening — explain your idea";
      if (pipVoice === "speaking") return "Pip is talking";
      if (status === "developing" || status === "unclear") {
        return "Keep talking with Pip — one idea at a time";
      }
      return "Voice is on — teach Pip using the question above";
    }
    return "Starting Pip…";
  })();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            "pointer-events-none absolute z-[36]",
            "left-3 right-3 top-[4.35rem]",
            "sm:left-[5.25rem] sm:right-[min(42vw,17rem)] sm:max-w-[26rem]",
            "md:right-auto md:w-[min(42vw,26rem)]"
          )}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          data-testid="teachback-panel-anchor"
        >
          <aside
            className={cn(
              "pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-3xl border border-mc-ink/10 bg-mc-white/95 shadow-float backdrop-blur-sm",
              // Extra bottom clearance so the pinned footer clears tool settings / zoom.
              "max-h-[calc(100dvh-4.35rem-6.5rem)]",
              "sm:max-h-[calc(100dvh-4.35rem-5.25rem)]"
            )}
            role="dialog"
            aria-label="TeachBack"
            data-testid="teachback-panel"
          >
            <header className="flex shrink-0 items-start justify-between gap-2 border-b border-mc-ink/8 bg-gradient-to-br from-mc-yellow-soft via-mc-white to-mc-purple-soft px-3 py-2.5 sm:px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mc-ink/50 sm:text-xs">
                  Be the teacher
                </p>
                <h2 className="font-display text-base font-bold leading-tight text-mc-ink sm:text-lg">
                  {completed ? "You did it, Teacher!" : "Your turn, Teacher!"}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-mc-ink/45 hover:bg-mc-ink/5 hover:text-mc-ink"
                onClick={closeTeachBack}
                aria-label="Close TeachBack"
                data-testid="teachback-close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3 sm:space-y-3 sm:p-4">
              <p className="text-xs font-medium text-mc-ink/55">
                {TEACHBACK_CONCEPT_LABEL[conceptId]}
              </p>

              {!completed ? (
                <>
                  <div className="rounded-2xl bg-[#FAF9F6] px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-mc-ink/45">
                      Pip asks
                    </p>
                    <p
                      className="mt-1 text-sm font-semibold leading-snug text-mc-ink"
                      data-testid="teachback-question"
                    >
                      {question}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-mc-ink/8 bg-white p-2.5">
                    <p className="text-[11px] font-medium text-mc-ink/50">
                      Idea to teach
                    </p>
                    <FractionBar
                      denominator={3}
                      fillClass="bg-mc-purple/35"
                      highlightClass="bg-mc-purple"
                      label="One-third"
                      compact
                      data-testid="teachback-bar-third"
                    />
                    <FractionBar
                      denominator={4}
                      fillClass="bg-mc-pink/40"
                      highlightClass="bg-mc-pink"
                      label="One-fourth"
                      compact
                      data-testid="teachback-bar-fourth"
                    />
                    <p className="text-[11px] leading-snug text-mc-ink/55">
                      You can draw on the canvas while you explain. Ask Pip to
                      look if you want them to see it.
                    </p>
                  </div>
                </>
              ) : (
                <motion.div
                  className="rounded-2xl bg-mc-mint-soft px-3 py-3 text-center"
                  initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  data-testid="teachback-complete-banner"
                >
                  <p className="text-sm font-semibold text-mc-ink">
                    You taught Pip — nice work!
                  </p>
                  {feedback ? (
                    <p className="mt-1 text-xs leading-snug text-mc-ink/80">
                      {feedback}
                    </p>
                  ) : null}
                </motion.div>
              )}

              <p
                className={cn(
                  "text-center text-xs font-medium",
                  voiceArmed && pipConnection === "connected"
                    ? "text-mc-purple"
                    : "text-mc-ink/55"
                )}
                data-testid="teachback-voice-status"
              >
                {voiceStatusLabel}
              </p>

              {!completed && feedback ? (
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-xs leading-snug sm:text-sm",
                    status === "developing" && "bg-mc-yellow-soft text-mc-ink/90",
                    status === "unclear" && "bg-mc-pink-soft text-mc-ink/90",
                    status === "ready" && "bg-[#FAF9F6] text-mc-ink/80",
                    status === "listening" && "bg-[#FAF9F6] text-mc-ink/80"
                  )}
                  role="status"
                  data-testid="teachback-feedback"
                >
                  {feedback}
                </div>
              ) : null}
            </div>

            {/* Pinned actions — always reachable on short iPad viewports. */}
            <div className="shrink-0 space-y-2 border-t border-mc-ink/8 bg-mc-white/95 p-3">
              {!completed ? (
                <>
                  <Button
                    className="w-full rounded-2xl bg-mc-purple text-white hover:bg-mc-purple/90"
                    onClick={startTeaching}
                    data-testid="teachback-start"
                  >
                    <Mic className="h-4 w-4" />
                    {voiceArmed && pipConnection === "connected"
                      ? "Remind Pip of the question"
                      : voiceArmed && pipConnection === "connecting"
                        ? "Connecting…"
                        : "Let’s teach Pip"}
                  </Button>
                  {attempts > 0 ? (
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl"
                      onClick={onRetry}
                      data-testid="teachback-retry"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try explaining again
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  <p
                    className="text-center text-sm font-semibold text-mc-ink"
                    data-testid="teachback-mastery-prompt"
                  >
                    Ready to show what you&apos;ve learned?
                  </p>
                  <Button
                    className="w-full rounded-2xl bg-mc-purple text-white hover:bg-mc-purple/90"
                    onClick={() => {
                      closeTeachBack();
                      openMasteryCheck({
                        source: "teachback",
                        assessmentType: "post_learning",
                      });
                    }}
                    data-testid="teachback-start-mastery"
                  >
                    Start my challenge
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full rounded-2xl"
                    onClick={closeTeachBack}
                    data-testid="teachback-done"
                  >
                    Done for now
                  </Button>
                </>
              )}
            </div>
          </aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
