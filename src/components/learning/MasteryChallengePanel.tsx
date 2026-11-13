"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HelpCircle, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useMasteryStore } from "@/store/masteryStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useActivityStore } from "@/store/activityStore";
import { useCelebrationStore } from "@/store/celebrationStore";
import { useUiStore } from "@/store/uiStore";
import { useTeachBackStore } from "@/store/teachbackStore";
import {
  choiceLabel,
  feedbackForScore,
  type MasteryChoice,
} from "@/lib/learning/masteryBank";
import { formatUnitFraction } from "@/lib/learning/fractionMath";
import {
  recordMasteryCheckAnswered,
  recordMasteryCheckCompleted,
  recordMasteryCheckStarted,
} from "@/lib/learning/recordHelpers";
import { cn } from "@/lib/utils";

const CHOICES: MasteryChoice[] = ["left", "equal", "right"];

/**
 * Independent Mastery Check — three questions, no AI hints, score after submit.
 * Shared UI for baseline and post_learning Superpower Challenge.
 */
export function MasteryChallengePanel() {
  const reduceMotion = useReducedMotion();
  const open = useMasteryStore((s) => s.open);
  const runId = useMasteryStore((s) => s.runId);
  const source = useMasteryStore((s) => s.source);
  const assessmentType = useMasteryStore((s) => s.assessmentType);
  const questions = useMasteryStore((s) => s.questions);
  const index = useMasteryStore((s) => s.index);
  const answers = useMasteryStore((s) => s.answers);
  const submitted = useMasteryStore((s) => s.submitted);
  const assisted = useMasteryStore((s) => s.assisted);
  const independentMode = useMasteryStore((s) => s.independentMode);
  const scoreCorrect = useMasteryStore((s) => s.scoreCorrect);
  const scoreTotal = useMasteryStore((s) => s.scoreTotal);
  const selectAnswer = useMasteryStore((s) => s.selectAnswer);
  const goNext = useMasteryStore((s) => s.goNext);
  const submitChallenge = useMasteryStore((s) => s.submitChallenge);
  const requestAssistance = useMasteryStore((s) => s.requestAssistance);
  const abandonMasteryCheck = useMasteryStore((s) => s.abandonMasteryCheck);
  const closeMasteryCheck = useMasteryStore((s) => s.closeMasteryCheck);
  const openMasteryCheck = useMasteryStore((s) => s.openMasteryCheck);
  const lastUsedQuestionIds = useMasteryStore((s) => s.lastUsedQuestionIds);

  const documentId = useCanvasStore((s) => s.document.id);
  const emitPipEvent = useActivityStore((s) => s.emitPipEvent);
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const setPipMood = useUiStore((s) => s.setPipMood);
  const closeTeachBack = useTeachBackStore((s) => s.closeTeachBack);

  const [helpOpen, setHelpOpen] = useState(false);
  const startedRef = useRef<string | null>(null);
  const celebratedRef = useRef<string | null>(null);

  const isBaseline = assessmentType === "baseline";

  useEffect(() => {
    if (!open || !runId || questions.length === 0) return;
    if (startedRef.current === runId) return;
    startedRef.current = runId;

    void recordMasteryCheckStarted({
      documentId,
      runId,
      conceptId: "unit_fraction_comparison",
      questionIds: questions.map((q) => q.id),
      source: source ?? "manual",
      assessmentType,
    });

    emitPipEvent({
      kind: "activity_opened",
      summary: isBaseline
        ? "[Baseline check started] Independent quick check is active. Do NOT give math hints, answers, or correctness feedback. Only help with navigation. This is a before-learning baseline — do not unlock Superpower Journey completion."
        : "[Mastery check started] Independent Superpower Challenge is active. Do NOT give math hints, answers, or correctness feedback. Only help with navigation (e.g. how to tap Next). If they ask for help on the math, tell them they can exit independent mode and return to guided learning.",
      payload: {
        mode: "mastery",
        speak: false,
        independent: true,
        runId,
        assessmentType,
      },
    });
  }, [
    open,
    runId,
    questions,
    documentId,
    source,
    assessmentType,
    isBaseline,
    emitPipEvent,
  ]);

  useEffect(() => {
    if (!submitted || !runId) return;
    if (celebratedRef.current === runId) return;
    celebratedRef.current = runId;
    if (!assisted && scoreCorrect >= 2) {
      celebrate(
        isBaseline
          ? "Nice baseline!"
          : scoreCorrect === scoreTotal
            ? "Superpower unlocked!"
            : "Great try!"
      );
      setPipMood("celebrate");
      const t = window.setTimeout(() => setPipMood("idle"), 1600);
      return () => window.clearTimeout(t);
    }
  }, [
    submitted,
    runId,
    assisted,
    scoreCorrect,
    scoreTotal,
    isBaseline,
    celebrate,
    setPipMood,
  ]);

  const question = questions[index];
  const currentAnswer = answers[index];
  const isLast = index >= questions.length - 1;
  const canAdvance = Boolean(currentAnswer?.studentAnswer);

  const onSelect = useCallback(
    (choice: MasteryChoice) => {
      if (submitted || !independentMode) return;
      selectAnswer(choice);
    },
    [submitted, independentMode, selectAnswer]
  );

  const onPrimary = useCallback(async () => {
    if (!runId || !question || !currentAnswer?.studentAnswer) return;

    const answerPayload = {
      documentId,
      runId,
      conceptId: "unit_fraction_comparison" as const,
      questionId: question.id,
      studentAnswer: currentAnswer.studentAnswer,
      correctAnswer: currentAnswer.correctAnswer,
      isCorrect: currentAnswer.isCorrect,
      assisted,
      index,
      assessmentType,
    };

    if (!isLast) {
      void recordMasteryCheckAnswered(answerPayload);
      goNext();
      return;
    }

    void recordMasteryCheckAnswered(answerPayload);

    const result = submitChallenge();
    if (!result) return;

    await recordMasteryCheckCompleted({
      documentId,
      runId: result.runId,
      conceptId: "unit_fraction_comparison",
      scoreCorrect: result.scoreCorrect,
      scoreTotal: result.scoreTotal,
      assisted: result.assisted,
      assessmentType: result.assessmentType,
      questionIds: result.questionIds,
      answers: result.answers.map((a) => ({
        questionId: a.questionId,
        studentAnswer: a.studentAnswer,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
        assisted: a.assisted,
        answeredAt: a.answeredAt,
        leftDenom: a.leftDenom,
        rightDenom: a.rightDenom,
      })),
    });

    emitPipEvent({
      kind: "activity_completed",
      summary: result.assisted
        ? `[${isBaseline ? "Baseline" : "Mastery"} check ended] Assisted attempt finished ${result.scoreCorrect}/${result.scoreTotal}. Resume normal tutoring. Do not claim permanent mastery.`
        : isBaseline
          ? `[Baseline check completed] Independent baseline ${result.scoreCorrect}/${result.scoreTotal}. Celebrate briefly. Invite them to learn with Pip next. Do not claim mastery or unlock Superpower Journey completion.`
          : `[Mastery check completed] Independent score ${result.scoreCorrect}/${result.scoreTotal}. Celebrate briefly using that score. Resume normal tutoring. Do not claim permanent mastery.`,
      payload: {
        mode: "mastery",
        speak: true,
        scoreCorrect: result.scoreCorrect,
        scoreTotal: result.scoreTotal,
        assisted: result.assisted,
        assessmentType: result.assessmentType,
      },
    });
  }, [
    runId,
    question,
    currentAnswer,
    isLast,
    documentId,
    assisted,
    index,
    assessmentType,
    isBaseline,
    goNext,
    submitChallenge,
    emitPipEvent,
  ]);

  const onConfirmHelp = () => {
    requestAssistance();
    setHelpOpen(false);
    abandonMasteryCheck();
    emitPipEvent({
      kind: "answer_selected",
      summary: isBaseline
        ? "[Baseline check exited] Student asked for help. Independent baseline not recorded. Resume guided tutoring."
        : "[Mastery check exited] Student asked for help. Independent mode ended — this attempt is not counted as independent. Resume guided tutoring for unit fractions.",
      payload: {
        mode: "mastery",
        speak: true,
        assisted: true,
        assessmentType,
      },
    });
  };

  const onRetry = () => {
    closeMasteryCheck();
    openMasteryCheck({
      source: "manual",
      assessmentType,
      excludeIds: lastUsedQuestionIds,
    });
  };

  const onStartFromTeachBackDone = () => {
    closeTeachBack();
  };

  const titleIdle = isBaseline ? "Quick check" : "Superpower Challenge!";
  const titleDone = isBaseline ? "Baseline saved!" : "Challenge complete!";
  const eyebrow = isBaseline ? "Before learning" : "Show your superpower";

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
          data-testid="mastery-challenge-anchor"
        >
          <aside
            className={cn(
              "pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-3xl border border-mc-ink/10 bg-mc-white/95 shadow-float backdrop-blur-sm",
              "max-h-[calc(100dvh-4.35rem-6.5rem)]",
              "sm:max-h-[calc(100dvh-4.35rem-5.25rem)]"
            )}
            role="dialog"
            aria-label={isBaseline ? "Baseline quick check" : "Superpower Challenge"}
            data-testid="mastery-challenge-panel"
            data-assessment-type={assessmentType}
          >
            <header
              className={cn(
                "flex shrink-0 items-start justify-between gap-2 border-b border-mc-ink/8 px-3 py-2.5 sm:px-4",
                isBaseline
                  ? "bg-gradient-to-br from-mc-yellow-soft via-mc-white to-mc-pink-soft"
                  : "bg-gradient-to-br from-mc-purple-soft via-mc-white to-mc-yellow-soft"
              )}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mc-ink/50 sm:text-xs">
                  {eyebrow}
                </p>
                <h2 className="font-display text-base font-bold leading-tight text-mc-ink sm:text-lg">
                  {submitted ? titleDone : titleIdle}
                </h2>
              </div>
              <div className="flex items-center gap-0.5">
                {!submitted ? (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-mc-ink/45 hover:bg-mc-ink/5 hover:text-mc-ink"
                    onClick={() => setHelpOpen(true)}
                    aria-label="Need help?"
                    data-testid="mastery-help"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-mc-ink/45 hover:bg-mc-ink/5 hover:text-mc-ink"
                  onClick={() => {
                    if (submitted) closeMasteryCheck();
                    else {
                      abandonMasteryCheck();
                      emitPipEvent({
                        kind: "answer_selected",
                        summary: isBaseline
                          ? "[Baseline check exited early] No baseline recorded. Resume normal tutoring."
                          : "[Mastery check exited early] No independent completion recorded. Resume normal tutoring.",
                        payload: {
                          mode: "mastery",
                          speak: false,
                          assessmentType,
                        },
                      });
                    }
                  }}
                  aria-label="Close challenge"
                  data-testid="mastery-close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4">
              {!submitted && question ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-mc-ink/55">
                      Question {index + 1} of {questions.length}
                    </p>
                    <div className="flex gap-1" aria-hidden>
                      {questions.map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-1.5 w-5 rounded-full",
                            i < index
                              ? "bg-mc-purple"
                              : i === index
                                ? "bg-mc-pink"
                                : "bg-mc-ink/15"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-center text-sm font-semibold text-mc-ink">
                    {question.prompt}
                  </p>

                  <div className="flex items-center justify-center gap-3 py-2">
                    <span className="font-display text-3xl font-bold tabular-nums text-mc-purple sm:text-4xl">
                      {formatUnitFraction(question.leftDenom)}
                    </span>
                    <span className="text-lg font-bold text-mc-ink/35">vs</span>
                    <span className="font-display text-3xl font-bold tabular-nums text-[#C45A7A] sm:text-4xl">
                      {formatUnitFraction(question.rightDenom)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {CHOICES.map((choice) => {
                      const selected = currentAnswer?.studentAnswer === choice;
                      return (
                        <button
                          key={choice}
                          type="button"
                          disabled={!independentMode}
                          onClick={() => onSelect(choice)}
                          data-testid={`mastery-choice-${choice}`}
                          className={cn(
                            "min-h-12 rounded-2xl border-2 px-3 py-2.5 text-center text-base font-bold transition active:scale-[0.98] disabled:opacity-50",
                            selected
                              ? "border-mc-purple bg-mc-purple-soft text-mc-purple"
                              : "border-mc-ink/10 bg-[#FAF9F6] text-mc-ink hover:border-mc-purple/30"
                          )}
                        >
                          {choiceLabel(choice, question)}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-center text-[11px] text-mc-ink/45">
                    Independent mode — Pip won’t give answer hints right now.
                  </p>
                </>
              ) : null}

              {submitted ? (
                <div className="space-y-3" data-testid="mastery-summary">
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-3 text-center",
                      isBaseline ? "bg-mc-yellow-soft" : "bg-mc-purple-soft"
                    )}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-mc-ink/50">
                      Comparing unit fractions
                    </p>
                    <p className="mt-1 font-display text-3xl font-bold text-mc-purple">
                      {scoreCorrect}/{scoreTotal}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-mc-ink">
                      {feedbackForScore(scoreCorrect, scoreTotal)}
                    </p>
                    {assisted ? (
                      <p className="mt-2 text-xs text-mc-ink/60">
                        This try used help, so it isn’t counted as independent.
                      </p>
                    ) : isBaseline ? (
                      <p className="mt-2 text-xs text-mc-ink/60">
                        Saved as your before-learning baseline. Now learn with
                        Pip — then try Show your Superpower!
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-mc-ink/60">
                        One try doesn’t mean forever mastery — nice independent
                        work!
                      </p>
                    )}
                  </div>

                  <ul className="space-y-1.5 text-sm">
                    {answers.map((a, i) => (
                      <li
                        key={a.questionId}
                        className="flex items-center justify-between rounded-xl bg-[#FAF9F6] px-3 py-2"
                      >
                        <span className="font-medium text-mc-ink/80">
                          Q{i + 1}: {formatUnitFraction(a.leftDenom)} vs{" "}
                          {formatUnitFraction(a.rightDenom)}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-bold",
                            a.isCorrect ? "text-mc-mint" : "text-mc-pink"
                          )}
                        >
                          {a.isCorrect ? "Correct" : "Not yet"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {helpOpen ? (
                <div
                  className="rounded-2xl border border-mc-yellow/40 bg-mc-yellow-soft p-3"
                  data-testid="mastery-help-card"
                >
                  <p className="text-sm font-semibold text-mc-ink">
                    Need a little help?
                  </p>
                  <p className="mt-1 text-xs leading-snug text-mc-ink/75">
                    {isBaseline
                      ? "If we leave independent mode, this won’t count as your baseline. We can practice with Pip instead."
                      : "If we leave independent mode, this try won’t count as your Superpower Challenge. We can practice together with Pip instead."}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      className="w-full rounded-2xl"
                      onClick={onConfirmHelp}
                      data-testid="mastery-exit-help"
                    >
                      Exit & learn with Pip
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl"
                      onClick={() => setHelpOpen(false)}
                    >
                      Keep trying alone
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 space-y-2 border-t border-mc-ink/8 bg-mc-white/95 p-3">
              {!submitted ? (
                <Button
                  className="w-full rounded-2xl bg-mc-purple text-white hover:bg-mc-purple/90"
                  disabled={!canAdvance || !independentMode}
                  onClick={() => void onPrimary()}
                  data-testid="mastery-next"
                >
                  {isLast ? "Submit challenge" : "Next question"}
                </Button>
              ) : (
                <>
                  {isBaseline ? (
                    <Button
                      className="w-full rounded-2xl bg-mc-purple text-white hover:bg-mc-purple/90"
                      onClick={() => closeMasteryCheck()}
                      data-testid="mastery-continue-learn"
                    >
                      Learn with Pip
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="w-full rounded-2xl bg-mc-purple text-white hover:bg-mc-purple/90"
                      data-testid="mastery-to-journey"
                    >
                      <Link href="/journey" onClick={() => closeMasteryCheck()}>
                        Back to My Journey
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl"
                    onClick={onRetry}
                    data-testid="mastery-retry"
                  >
                    Try different questions
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full rounded-2xl"
                    onClick={() => {
                      onStartFromTeachBackDone();
                      closeMasteryCheck();
                    }}
                    data-testid="mastery-done"
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
