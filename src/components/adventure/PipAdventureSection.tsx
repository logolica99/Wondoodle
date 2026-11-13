"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAdventureStore } from "@/store/adventureStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useUiStore } from "@/store/uiStore";
import { useActivityStore } from "@/store/activityStore";
import { usePipStore } from "@/store/pipStore";
import { getRecentPipConversationContext } from "@/lib/voice/pipCaptions";

/**
 * Adventure strip inside Pip — goal-first, not intermediate-step focused.
 */
export function PipAdventureSection() {
  const adventure = useAdventureStore((s) => s.adventure);
  const steps = useAdventureStore((s) => s.steps);
  const hydrated = useAdventureStore((s) => s.hydrated);
  const markStepStarted = useAdventureStore((s) => s.markStepStarted);
  const submitStepCheck = useAdventureStore((s) => s.submitStepCheck);
  const checkBusy = useAdventureStore((s) => s.checkBusy);
  const checkError = useAdventureStore((s) => s.checkError);
  const lastEvaluation = useAdventureStore((s) => s.lastEvaluation);
  const revisionToast = useAdventureStore((s) => s.revisionToast);
  const clearRevisionToast = useAdventureStore((s) => s.clearRevisionToast);
  const syncPipContextSummary = useAdventureStore((s) => s.syncPipContextSummary);
  const clearAdventure = useAdventureStore((s) => s.clearAdventure);

  const doc = useCanvasStore((s) => s.document);
  const paperStyle = useUiStore((s) => s.paperStyle);
  const emitPipEvent = useActivityStore((s) => s.emitPipEvent);

  const active =
    adventure?.status === "active"
      ? steps.find((s) => s.id === adventure.activeStepId) ??
        steps.find((s) => s.status === "active")
      : null;

  const visible = steps
    .filter((s) => s.status !== "skipped")
    .sort((a, b) => a.order - b.order);
  const completed = visible.filter((s) => s.status === "completed").length;
  const done =
    adventure?.status === "active" &&
    visible.length > 0 &&
    visible.every((s) => s.status === "completed");

  useEffect(() => {
    if (!adventure || adventure.status !== "active" || !active) return;
    markStepStarted(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventure?.id, active?.id]);

  useEffect(() => {
    if (!revisionToast) return;
    const t = window.setTimeout(() => clearRevisionToast(), 6000);
    return () => window.clearTimeout(t);
  }, [revisionToast, clearRevisionToast]);

  if (!hydrated || !adventure || adventure.status !== "active") return null;

  const onCheck = async () => {
    const spoken = getRecentPipConversationContext(900);
    const result = await submitStepCheck({
      doc,
      paperStyle,
      explanationText: spoken,
    });
    if (result.ok) {
      const summary = syncPipContextSummary();
      const evaluation = useAdventureStore.getState().lastEvaluation;
      const speakHint =
        result.decision === "complete"
          ? "Celebrate briefly — the goal is done. Do not ask them to define anything else."
          : result.decision === "continue_current"
            ? `Tell them the SPECIFIC part that is wrong or missing${
                evaluation?.guidingQuestion
                  ? `: ${evaluation.guidingQuestion}`
                  : ""
              }. One short sentence. Do not only ask “are you sure?” and do not give the full correct final answer yet.`
            : "Respond briefly using the adventure context.";
      emitPipEvent({
        kind: "activity_completed",
        summary: [
          `[Adventure step checked] Decision: ${result.decision}.`,
          evaluation?.explanation ? `Notes: ${evaluation.explanation}` : "",
          speakHint,
          summary ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
        payload: {
          mode: "adventure",
          speak: true,
          decision: result.decision,
          phase: "evaluated",
        },
      });
      if (usePipStore.getState().connection !== "connected") {
        usePipStore.getState().openCompanion({ autoStartTalk: true });
      }
    }
  };

  const feedbackLabel =
    lastEvaluation?.decision === "complete"
      ? "Done"
      : lastEvaluation?.decision === "add_step"
        ? "New step"
        : lastEvaluation?.decision === "clarify_goal"
          ? "Clarify"
          : lastEvaluation
            ? "Keep going"
            : null;

  const goal =
    adventure.originalGoal?.trim() ||
    adventure.title?.trim() ||
    "Your adventure";

  return (
    <div
      className="rounded-xl border border-[#E8E0FF] bg-[#F6F3FF]/90 px-3 py-2"
      data-testid="adventure-step-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7357E8]/80">
            Current adventure
            {!done ? (
              <span className="font-medium normal-case tracking-normal text-mc-ink/40">
                {" "}
                · in progress
                {visible.length > 1 ? ` ${completed}/${visible.length}` : ""}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 line-clamp-2 font-display text-sm font-semibold leading-snug text-mc-ink">
            {done ? "Done" : goal}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-mc-ink/40 hover:text-mc-ink/70"
          data-testid="adventure-chip-clear"
          onClick={() => {
            if (!window.confirm("Clear adventure?")) return;
            void clearAdventure();
          }}
        >
          Clear
        </button>
      </div>

      {checkError ? (
        <p className="mt-1.5 text-xs text-[#C45A7A]">{checkError}</p>
      ) : null}

      {feedbackLabel ? (
        <p
          className="mt-1.5 text-xs font-semibold text-mc-ink/70"
          data-testid="adventure-eval-feedback"
        >
          {feedbackLabel}
        </p>
      ) : null}

      {revisionToast ? (
        <p
          className="mt-1.5 text-xs font-semibold text-mc-ink/70"
          data-testid="adventure-revision-toast"
        >
          {revisionToast}
        </p>
      ) : null}

      {!done ? (
        <Button
          className="mt-2 h-8 w-full rounded-lg bg-[#7357E8] text-white hover:bg-[#6346d4]"
          size="sm"
          disabled={checkBusy}
          onClick={() => void onCheck()}
          data-testid="adventure-check-discovery"
        >
          {checkBusy ? "…" : "Check"}
        </Button>
      ) : (
        <Link
          href="/journey?adventure=1"
          className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-lg border border-mc-ink/10 text-xs font-bold text-mc-ink/70 hover:bg-white/80"
        >
          Journey
        </Link>
      )}
    </div>
  );
}
