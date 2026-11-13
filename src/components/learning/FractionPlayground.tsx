"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { FractionBar } from "./FractionBar";
import { useActivityStore } from "@/store/activityStore";
import { useCanvasStore } from "@/store/canvasStore";
import {
  compareUnitFractions,
  formatUnitFraction,
  hintForIncorrectCompare,
  labelForChoice,
  MAX_DENOMINATOR,
  MIN_DENOMINATOR,
  type FractionCompareResult,
} from "@/lib/learning/fractionMath";
import {
  recordActivityCompleted,
  recordActivityStarted,
  recordAnswerSubmitted,
  recordFractionVisualizationChanged,
} from "@/lib/learning/recordHelpers";
import { useTeachBackStore } from "@/store/teachbackStore";
import { useCelebrationStore } from "@/store/celebrationStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

type Feedback = {
  tone: "hint" | "success" | "neutral";
  text: string;
};

/**
 * Interactive unit-fraction comparison playground (Feature 4).
 * Defaults to the reliable 1/3 vs 1/4 demo case.
 */
export function FractionPlayground() {
  const reduceMotion = useReducedMotion();
  const open = useActivityStore((s) => s.open);
  const activityId = useActivityStore((s) => s.activityId);
  const route = useActivityStore((s) => s.route);
  const runId = useActivityStore((s) => s.runId);
  const closeActivity = useActivityStore((s) => s.closeActivity);
  const emitPipEvent = useActivityStore((s) => s.emitPipEvent);
  const openTeachBack = useTeachBackStore((s) => s.openTeachBack);
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const setPipMood = useUiStore((s) => s.setPipMood);
  const documentId = useCanvasStore((s) => s.document.id);
  const celebratedRunRef = useRef<string | null>(null);

  const startTeachBack = useCallback(() => {
    closeActivity();
    openTeachBack({
      conceptId: "unit_fraction_comparison",
      source: "playground",
    });
  }, [closeActivity, openTeachBack]);

  const [leftDenom, setLeftDenom] = useState(3);
  const [rightDenom, setRightDenom] = useState(4);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [completed, setCompleted] = useState(false);
  const startedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!completed || !runId) return;
    if (celebratedRunRef.current === runId) return;
    celebratedRunRef.current = runId;
    celebrate("You figured it out!");
    setPipMood("celebrate");
    const t = window.setTimeout(() => setPipMood("idle"), 1600);
    return () => window.clearTimeout(t);
  }, [completed, runId, celebrate, setPipMood]);

  // Reset demo state when a new run opens.
  useEffect(() => {
    if (!open || !runId) return;
    setLeftDenom(3);
    setRightDenom(4);
    setFeedback({
      tone: "neutral",
      text: "Which highlighted piece is larger — or are they equal?",
    });
    setAttempts(0);
    setCompleted(false);
  }, [open, runId]);

  useEffect(() => {
    if (!open || !runId || activityId !== "fraction_comparison") return;
    if (startedRef.current === runId) return;
    startedRef.current = runId;

    void recordActivityStarted({
      documentId,
      runId,
      activityId: "fraction_comparison",
      conceptId: route?.conceptId ?? "unit_fraction_comparison",
      misconceptionId: route?.misconceptionId ?? "denominator_size",
      leftDenom: 3,
      rightDenom: 4,
    });

    emitPipEvent({
      kind: "activity_opened",
      summary:
        "The student opened Fraction Playground with bars showing 1/3 and 1/4. Invite them to compare the highlighted pieces. Do not tell them which is larger yet.",
      payload: {
        activityId: "fraction_comparison",
        left: "1/3",
        right: "1/4",
      },
    });
  }, [open, runId, activityId, documentId, route, emitPipEvent]);

  const bumpDenom = useCallback(
    (side: "left" | "right", delta: number) => {
      if (completed) return;
      const prev = side === "left" ? leftDenom : rightDenom;
      const next = Math.min(
        MAX_DENOMINATOR,
        Math.max(MIN_DENOMINATOR, prev + delta)
      );
      if (next === prev) return;

      const nextLeft = side === "left" ? next : leftDenom;
      const nextRight = side === "right" ? next : rightDenom;
      if (side === "left") setLeftDenom(next);
      else setRightDenom(next);

      void recordFractionVisualizationChanged({
        documentId,
        runId: runId ?? "unknown",
        side,
        denominator: next,
        leftDenom: nextLeft,
        rightDenom: nextRight,
      });

      emitPipEvent({
        kind: "denominator_changed",
        summary: `The student changed the ${side} bar to ${formatUnitFraction(next)}. Bars are now ${formatUnitFraction(nextLeft)} and ${formatUnitFraction(nextRight)}. React briefly; do not grade for them.`,
        payload: {
          side,
          denominator: next,
          left: formatUnitFraction(nextLeft),
          right: formatUnitFraction(nextRight),
        },
      });

      setFeedback({
        tone: "neutral",
        text: "Nice — which highlighted piece looks larger now?",
      });
    },
    [completed, documentId, runId, leftDenom, rightDenom, emitPipEvent]
  );

  const submitAnswer = useCallback(
    (choice: FractionCompareResult) => {
      if (completed) return;
      const correctChoice = compareUnitFractions(leftDenom, rightDenom);
      const isCorrect = choice === correctChoice;
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);

      emitPipEvent({
        kind: "answer_selected",
        summary: `The student chose "${labelForChoice(choice, leftDenom, rightDenom)}" comparing ${formatUnitFraction(leftDenom)} and ${formatUnitFraction(rightDenom)}.`,
        payload: {
          choice,
          left: formatUnitFraction(leftDenom),
          right: formatUnitFraction(rightDenom),
        },
      });

      void recordAnswerSubmitted({
        documentId,
        runId: runId ?? "unknown",
        choice,
        correctChoice,
        isCorrect,
        leftDenom,
        rightDenom,
        attempt: nextAttempts,
      });

      if (isCorrect) {
        setCompleted(true);
        setFeedback({
          tone: "success",
          text:
            correctChoice === "equal"
              ? "Yes — same-sized pieces when the wholes are split the same way!"
              : `Yes! ${formatUnitFraction(correctChoice === "left" ? leftDenom : rightDenom)} is the larger piece. Fewer equal parts means each piece is bigger.`,
        });

        void recordActivityCompleted({
          documentId,
          runId: runId ?? "unknown",
          activityId: "fraction_comparison",
          conceptId: route?.conceptId ?? "unit_fraction_comparison",
          misconceptionId: route?.misconceptionId ?? "denominator_size",
          leftDenom,
          rightDenom,
          correctChoice,
          attempts: nextAttempts,
        });

        emitPipEvent({
          kind: "activity_completed",
          summary: `Deterministic result: CORRECT. The student compared ${formatUnitFraction(leftDenom)} and ${formatUnitFraction(rightDenom)} and chose ${labelForChoice(choice, leftDenom, rightDenom)}. Fraction Playground is complete. Celebrate briefly. You may invite them to teach you next (TeachBack). Do not invent a different grade or claim mastery forever.`,
          payload: {
            correct: true,
            choice,
            correctChoice,
            left: formatUnitFraction(leftDenom),
            right: formatUnitFraction(rightDenom),
            activityId: "fraction_comparison",
            attempts: nextAttempts,
          },
        });
        return;
      }

      const hint = hintForIncorrectCompare(leftDenom, rightDenom);
      setFeedback({
        tone: "hint",
        text:
          nextAttempts >= 2
            ? `${hint} Try comparing the colored pieces side by side.`
            : hint,
      });

      emitPipEvent({
        kind: "answer_result",
        summary: `Deterministic result: INCORRECT. Student chose ${labelForChoice(choice, leftDenom, rightDenom)}; correct relation is ${labelForChoice(correctChoice, leftDenom, rightDenom)}. Give a short hint without revealing the answer. Do not override this grade.`,
        payload: {
          correct: false,
          choice,
          correctChoice,
          left: formatUnitFraction(leftDenom),
          right: formatUnitFraction(rightDenom),
          hint,
        },
      });
    },
    [
      completed,
      leftDenom,
      rightDenom,
      attempts,
      documentId,
      runId,
      route,
      emitPipEvent,
    ]
  );

  const visible = open && activityId === "fraction_comparison";

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className={cn(
            "pointer-events-none absolute z-[36]",
            // Clear top chrome; leave room for zoom / Pip / bottom nav.
            "left-3 right-3 top-[4.35rem]",
            "sm:left-[5.25rem] sm:right-[min(42vw,17rem)] sm:max-w-[26rem]",
            "md:right-auto md:w-[min(42vw,26rem)]"
          )}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          data-testid="fraction-playground-anchor"
        >
          <aside
            className={cn(
              "pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-3xl border border-mc-ink/10 bg-mc-white/95 shadow-float backdrop-blur-sm",
              "max-h-[calc(100dvh-4.35rem-6.5rem)]",
              "sm:max-h-[calc(100dvh-4.35rem-5.25rem)]"
            )}
            role="dialog"
            aria-label="Fraction Playground"
            data-testid="fraction-playground"
          >
            <header className="flex shrink-0 items-start justify-between gap-2 border-b border-mc-ink/8 bg-gradient-to-br from-mc-mint-soft via-mc-white to-mc-yellow-soft px-3 py-2.5 sm:px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mc-ink/50 sm:text-xs">
                  Fraction Playground
                </p>
                <h2 className="font-display text-base font-bold leading-tight text-mc-ink sm:text-lg">
                  {completed ? "You spotted it!" : "Which piece is larger?"}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-mc-ink/45 hover:bg-mc-ink/5 hover:text-mc-ink"
                onClick={closeActivity}
                aria-label="Close Fraction Playground"
                data-testid="fraction-playground-close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3 sm:space-y-3 sm:p-4">
              <div className="space-y-1.5">
                <FractionBar
                  denominator={leftDenom}
                  fillClass="bg-mc-purple/35"
                  highlightClass="bg-mc-purple"
                  label="Bar A"
                  compact
                  data-testid="fraction-bar-left"
                />
                <DenomStepper
                  value={leftDenom}
                  onDec={() => bumpDenom("left", -1)}
                  onInc={() => bumpDenom("left", 1)}
                  disabled={completed}
                  testId="left"
                />
              </div>

              <div className="space-y-1.5">
                <FractionBar
                  denominator={rightDenom}
                  fillClass="bg-mc-pink/40"
                  highlightClass="bg-mc-pink"
                  label="Bar B"
                  compact
                  data-testid="fraction-bar-right"
                />
                <DenomStepper
                  value={rightDenom}
                  onDec={() => bumpDenom("right", -1)}
                  onInc={() => bumpDenom("right", 1)}
                  disabled={completed}
                  testId="right"
                />
              </div>

              {feedback ? (
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-xs leading-snug sm:text-sm",
                    feedback.tone === "success" &&
                      "bg-mc-mint-soft font-semibold text-mc-ink",
                    feedback.tone === "hint" &&
                      "bg-mc-yellow-soft text-mc-ink/90",
                    feedback.tone === "neutral" &&
                      "bg-[#FAF9F6] text-mc-ink/80"
                  )}
                  role="status"
                  data-testid="fraction-feedback"
                >
                  {feedback.text}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 space-y-2 border-t border-mc-ink/8 bg-mc-white/95 p-3">
              {completed ? (
                <>
                  <p
                    className="text-center text-sm font-semibold text-mc-ink"
                    data-testid="fraction-teachback-prompt"
                  >
                    Now it&apos;s your turn to teach Pip!
                  </p>
                  <Button
                    className="w-full rounded-2xl bg-mc-purple text-white hover:bg-mc-purple/90"
                    onClick={startTeachBack}
                    data-testid="fraction-teachback-start"
                  >
                    Let&apos;s teach Pip
                  </Button>
                  <Button
                    className="w-full rounded-2xl"
                    variant="secondary"
                    onClick={closeActivity}
                    data-testid="fraction-playground-done"
                  >
                    Done for now
                  </Button>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <AnswerButton
                    label={formatUnitFraction(leftDenom)}
                    sub="Bar A"
                    onClick={() => submitAnswer("left")}
                    disabled={completed}
                    testId="answer-left"
                    className="bg-mc-purple-soft text-mc-purple"
                  />
                  <AnswerButton
                    label="Equal"
                    sub="Same size"
                    onClick={() => submitAnswer("equal")}
                    disabled={completed}
                    testId="answer-equal"
                    className="bg-mc-yellow-soft text-mc-ink"
                  />
                  <AnswerButton
                    label={formatUnitFraction(rightDenom)}
                    sub="Bar B"
                    onClick={() => submitAnswer("right")}
                    disabled={completed}
                    testId="answer-right"
                    className="bg-mc-pink-soft text-[#C45A7A]"
                  />
                </div>
              )}
            </div>
          </aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DenomStepper({
  value,
  onDec,
  onInc,
  disabled,
  testId,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FAF9F6] px-2 py-1">
      <span className="pl-1 text-[11px] font-medium text-mc-ink/55 sm:text-xs">
        Split into {value} equal parts
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-mc-white text-mc-ink shadow-sm disabled:opacity-40 sm:h-9 sm:w-9 sm:rounded-xl"
          onClick={onDec}
          disabled={disabled || value <= MIN_DENOMINATOR}
          aria-label={`Fewer parts on ${testId} bar`}
          data-testid={`denom-dec-${testId}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center text-sm font-bold tabular-nums sm:w-6">
          {value}
        </span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-mc-white text-mc-ink shadow-sm disabled:opacity-40 sm:h-9 sm:w-9 sm:rounded-xl"
          onClick={onInc}
          disabled={disabled || value >= MAX_DENOMINATOR}
          aria-label={`More parts on ${testId} bar`}
          data-testid={`denom-inc-${testId}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AnswerButton({
  label,
  sub,
  onClick,
  disabled,
  testId,
  className,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "flex min-h-[2.75rem] flex-col items-center justify-center rounded-xl px-1.5 py-1.5 text-center shadow-sm transition active:scale-[0.98] disabled:opacity-50 sm:min-h-[3.25rem] sm:rounded-2xl sm:px-2 sm:py-2",
        className
      )}
    >
      <span className="text-sm font-bold leading-none sm:text-base">{label}</span>
      <span className="mt-0.5 text-[10px] font-medium opacity-70 sm:text-[11px]">
        {sub}
      </span>
    </button>
  );
}
