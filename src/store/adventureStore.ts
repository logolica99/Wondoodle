"use client";

import { create } from "zustand";
import type {
  AdventureEvidence,
  AdventureRevision,
  AdventureStep,
  AdventureStepStatus,
  LearningAdventure,
} from "@/types/adventure";
import type { AdventurePlanModel, StepEvaluationModel } from "@/lib/adventure/schemas";
import { normalizeEvaluationDecision } from "@/lib/adventure/schemas";
import {
  getActiveAdventure,
  getEvidenceForStep,
  getRevisionsForAdventure,
  getSnapshot,
  getStepsForAdventure,
  listAdventures,
  putAdventure,
  putEvidence,
  putRevision,
  putSnapshot,
  putStep,
  putSteps,
} from "@/lib/adventure/persistence";
import {
  newAdventureId,
  newEvidenceId,
  newRevisionId,
  newSnapshotId,
  newStepId,
} from "@/lib/adventure/ids";
import {
  buildAdventureCanvasContext,
  canvasFingerprint,
} from "@/lib/adventure/contextBuilder";
import type { CanvasDocument } from "@/types/canvas";
import type { PaperStyle } from "@/lib/canvas/paper";
import { getOrCreateSessionId } from "@/lib/learning/session";
import { recordLearningEvent } from "@/lib/learning/events";

const CREATE_DEDUPE_MS = 20_000;

type ReadyToast = {
  adventureId: string;
  title: string;
};

type CreateResult =
  | {
      ok: true;
      adventureId: string;
      title: string;
      duplicate?: boolean;
    }
  | {
      ok: false;
      error: string;
      code?:
        | "no_agreement"
        | "busy"
        | "empty_goal"
        | "capture"
        | "planner"
        | "duplicate_in_flight";
    };

type AdventureStore = {
  hydrated: boolean;
  adventure: LearningAdventure | null;
  steps: AdventureStep[];
  revisions: AdventureRevision[];
  createBusy: boolean;
  createError: string | null;
  readyToast: ReadyToast | null;
  activeStepPanelOpen: boolean;
  checkBusy: boolean;
  checkError: string | null;
  lastEvaluation: StepEvaluationModel | null;
  revisionToast: string | null;
  stepStartFingerprint: string | null;
  /** Dedupe key for recent successful creates. */
  lastCreateKey: string | null;
  lastCreateAt: number;
  hydrate: (documentId?: string) => Promise<void>;
  createAdventureFromConversation: (opts: {
    doc: CanvasDocument;
    paperStyle?: PaperStyle;
    goal: string;
    conversationContext?: string | null;
    studentAgreed: boolean;
  }) => Promise<CreateResult>;
  clearReadyToast: () => void;
  clearCreateError: () => void;
  /** Abandon the active adventure so it stops repeating / blocking a new one. */
  clearAdventure: () => Promise<void>;
  openActiveStep: () => void;
  closeStepPanel: () => void;
  markStepStarted: (doc: CanvasDocument) => void;
  submitStepCheck: (opts: {
    doc: CanvasDocument;
    paperStyle?: PaperStyle;
    explanationText: string | null;
  }) => Promise<{ ok: true; decision: string } | { ok: false; error: string }>;
  clearRevisionToast: () => void;
  syncPipContextSummary: () => string | null;
};

function now() {
  return Date.now();
}

function stepsFromPlan(
  adventureId: string,
  plan: AdventurePlanModel,
  revisionId: string | null
): AdventureStep[] {
  const t = now();
  return plan.steps.map((s, index) => ({
    id: newStepId(),
    adventureId,
    order: index,
    title: s.title,
    instruction: s.instruction,
    learningObjective: s.learningObjective,
    interactionType: s.interactionType,
    evidenceRubric: s.evidenceRubric,
    supportedActivityId: s.supportedActivityId ?? null,
    status: (index === 0 ? "active" : "available") as AdventureStepStatus,
    insertedByRevisionId: revisionId,
    createdAt: t,
    updatedAt: t,
    completedAt: null,
  }));
}

export const useAdventureStore = create<AdventureStore>((set, get) => ({
  hydrated: false,
  adventure: null,
  steps: [],
  revisions: [],
  createBusy: false,
  createError: null,
  readyToast: null,
  activeStepPanelOpen: false,
  checkBusy: false,
  checkError: null,
  lastEvaluation: null,
  revisionToast: null,
  stepStartFingerprint: null,
  lastCreateKey: null,
  lastCreateAt: 0,

  hydrate: async (documentId) => {
    try {
      const adventure = await getActiveAdventure(documentId);
      if (!adventure) {
        set({
          hydrated: true,
          adventure: null,
          steps: [],
          revisions: [],
        });
        return;
      }
      const [steps, revisions] = await Promise.all([
        getStepsForAdventure(adventure.id),
        getRevisionsForAdventure(adventure.id),
      ]);
      set({
        hydrated: true,
        adventure,
        steps,
        revisions,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  createAdventureFromConversation: async ({
    doc,
    paperStyle,
    goal,
    conversationContext,
    studentAgreed,
  }) => {
    if (!studentAgreed) {
      return {
        ok: false,
        error: "Wait until the student clearly agrees to create an adventure.",
        code: "no_agreement",
      };
    }
    const trimmedGoal = goal.trim();
    if (trimmedGoal.length < 3) {
      return {
        ok: false,
        error: "Goal is unclear — ask one short clarifying question first.",
        code: "empty_goal",
      };
    }

    const state = get();
    if (state.createBusy) {
      return {
        ok: false,
        error: "An adventure is already being planned. Please wait.",
        code: "busy",
      };
    }

    const fingerprint = canvasFingerprint(doc);
    const dedupeKey = `${trimmedGoal.toLowerCase()}|${fingerprint}`;
    if (
      state.lastCreateKey === dedupeKey &&
      now() - state.lastCreateAt < CREATE_DEDUPE_MS &&
      state.adventure
    ) {
      return {
        ok: true,
        adventureId: state.adventure.id,
        title: state.adventure.title,
        duplicate: true,
      };
    }

    set({
      createBusy: true,
      createError: null,
      readyToast: null,
    });

    try {
      const built = await buildAdventureCanvasContext(doc, { paperStyle });
      if (!built.ok) {
        set({ createBusy: false, createError: built.error });
        return { ok: false, error: built.error, code: "capture" };
      }

      const res = await fetch("/api/adventure/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: trimmedGoal,
          snapshotDataUrl: built.context.snapshotDataUrl,
          objectSummary: built.context.objectSummary,
          conversationContext: conversationContext?.trim() || null,
          canvasVersion: built.context.canvasVersion,
          documentId: built.context.documentId,
        }),
      });
      const payload = (await res.json()) as {
        ok: boolean;
        plan?: AdventurePlanModel;
        error?: string;
      };
      if (!payload.ok || !payload.plan) {
        const error = payload.error || "Couldn’t create the adventure.";
        set({ createBusy: false, createError: error });
        return { ok: false, error, code: "planner" };
      }

      // Soft-abandon any previous active adventures for this document.
      try {
        const existing = await listAdventures();
        for (const adv of existing) {
          if (
            adv.status === "active" &&
            adv.documentId === built.context.documentId
          ) {
            await putAdventure({
              ...adv,
              status: "abandoned",
              updatedAt: now(),
            });
          }
        }
      } catch {
        // Non-fatal — continue creating.
      }

      const adventureId = newAdventureId();
      const snapshotId = newSnapshotId();
      const t = now();
      const steps = stepsFromPlan(adventureId, payload.plan, null);
      const normalized = steps.map((s, i) => ({
        ...s,
        status: (i === 0 ? "active" : "locked") as AdventureStepStatus,
      }));

      await putSnapshot({
        id: snapshotId,
        documentId: built.context.documentId,
        adventureId,
        width: built.context.width,
        height: built.context.height,
        dataUrl: built.context.snapshotDataUrl,
        objectSummary: built.context.objectSummary,
        canvasVersion: built.context.canvasVersion,
        createdAt: t,
      });

      const adventure: LearningAdventure = {
        id: adventureId,
        documentId: built.context.documentId,
        sessionId: getOrCreateSessionId(),
        status: "active",
        title: payload.plan.title,
        storyline: payload.plan.storyline,
        subjectDescription: payload.plan.subjectDescription,
        learningObjective: payload.plan.learningObjective,
        originalGoal: trimmedGoal,
        originSnapshotId: snapshotId,
        activeStepId: normalized[0]?.id ?? null,
        stepIds: normalized.map((s) => s.id),
        revisionIds: [],
        latestRevisionMessage: null,
        createdAt: t,
        updatedAt: t,
      };

      await putSteps(normalized);
      await putAdventure(adventure);

      void recordLearningEvent({
        eventId: `adventure_created:${adventureId}`,
        eventType: "activity_started",
        source: "system",
        documentId: adventure.documentId,
        conceptId: null,
        payload: {
          kind: "adventure_created",
          adventureId,
          title: adventure.title,
          stepCount: normalized.length,
          originalGoal: trimmedGoal,
          originSnapshotId: snapshotId,
        },
      });

      set({
        createBusy: false,
        createError: null,
        adventure,
        steps: normalized,
        revisions: [],
        activeStepPanelOpen: true,
        revisionToast: null,
        readyToast: null,
        lastCreateKey: dedupeKey,
        lastCreateAt: t,
      });

      return { ok: true, adventureId, title: adventure.title };
    } catch {
      const error = "Couldn’t reach adventure AI. Please try again.";
      set({ createBusy: false, createError: error });
      return { ok: false, error, code: "planner" };
    }
  },

  clearReadyToast: () => set({ readyToast: null }),
  clearCreateError: () => set({ createError: null }),

  clearAdventure: async () => {
    const current = get().adventure;
    if (current && current.status === "active") {
      try {
        await putAdventure({
          ...current,
          status: "abandoned",
          activeStepId: null,
          updatedAt: now(),
        });
      } catch {
        // Still clear local UI even if persist fails.
      }
    }
    // Also abandon any other active rows for this document (dedupe leftovers).
    try {
      const all = await listAdventures();
      const docId = current?.documentId;
      for (const adv of all) {
        if (
          adv.status === "active" &&
          (!docId || adv.documentId === docId) &&
          adv.id !== current?.id
        ) {
          await putAdventure({
            ...adv,
            status: "abandoned",
            activeStepId: null,
            updatedAt: now(),
          });
        }
      }
    } catch {
      // ignore
    }

    set({
      adventure: null,
      steps: [],
      revisions: [],
      activeStepPanelOpen: false,
      checkBusy: false,
      checkError: null,
      lastEvaluation: null,
      revisionToast: null,
      readyToast: null,
      createError: null,
      createBusy: false,
      stepStartFingerprint: null,
      lastCreateKey: null,
      lastCreateAt: 0,
    });
  },

  openActiveStep: () => set({ activeStepPanelOpen: true, checkError: null }),
  closeStepPanel: () => set({ activeStepPanelOpen: false }),

  markStepStarted: (doc) => {
    set({ stepStartFingerprint: canvasFingerprint(doc) });
  },

  submitStepCheck: async ({ doc, paperStyle, explanationText }) => {
    const { adventure, steps, stepStartFingerprint } = get();
    if (!adventure?.activeStepId) {
      return { ok: false, error: "No active adventure step." };
    }
    const step = steps.find((s) => s.id === adventure.activeStepId);
    if (!step) return { ok: false, error: "Step not found." };

    set({ checkBusy: true, checkError: null });

    const startFp = stepStartFingerprint ?? canvasFingerprint(doc);
    const endFp = canvasFingerprint(doc);
    const canvasChanged = startFp !== endFp;
    const objectCountDelta =
      doc.objects.length -
      (startFp.split("|")[0] ? Number(startFp.split("|")[0]) : doc.objects.length);

    const needsDrawing =
      step.interactionType === "draw_and_explain" ||
      step.interactionType === "compare_drawings" ||
      step.interactionType === "predict_and_draw" ||
      step.interactionType === "revise_original" ||
      step.interactionType === "annotate_canvas";

    // Soft gate only: allow Check when the answer may already be on the canvas
    // (written before the step started). Still nudge explain-only steps for speech.
    if (
      step.interactionType === "explain_to_pip" &&
      !(explanationText && explanationText.trim().length >= 8) &&
      !canvasChanged
    ) {
      set({
        checkBusy: false,
        checkError: "Tell Pip your idea out loud, then check again.",
      });
      return {
        ok: false,
        error: "Tell Pip your idea out loud, then check again.",
      };
    }

    try {
      const origin = await getSnapshot(adventure.originSnapshotId);
      let latestDataUrl: string | null = null;
      let latestSnapshotId: string | null = null;

      // Always capture the latest canvas so a correct answer already drawn can complete.
      {
        const built = await buildAdventureCanvasContext(doc, { paperStyle });
        if (built.ok) {
          latestSnapshotId = newSnapshotId();
          await putSnapshot({
            id: latestSnapshotId,
            documentId: doc.id,
            adventureId: adventure.id,
            width: built.context.width,
            height: built.context.height,
            dataUrl: built.context.snapshotDataUrl,
            objectSummary: built.context.objectSummary,
            canvasVersion: built.context.canvasVersion,
            createdAt: now(),
          });
          latestDataUrl = built.context.snapshotDataUrl;
        } else if (needsDrawing) {
          set({ checkBusy: false, checkError: built.error });
          return { ok: false, error: built.error };
        }
      }

      const prior = await getEvidenceForStep(step.id);
      const previousNotes = prior
        .map((e) => e.evaluationSummary)
        .filter(Boolean)
        .slice(-2)
        .join(" · ");

      const evalRes = await fetch("/api/adventure/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adventureId: adventure.id,
          stepId: step.id,
          originalGoal: adventure.originalGoal,
          stepTitle: step.title,
          stepInstruction: step.instruction,
          learningObjective: step.learningObjective,
          evidenceRubric: step.evidenceRubric,
          interactionType: step.interactionType,
          originSnapshotDataUrl: origin?.dataUrl ?? null,
          latestSnapshotDataUrl: latestDataUrl,
          explanationText,
          canvasChanged,
          objectCountDelta: Number.isFinite(objectCountDelta)
            ? objectCountDelta
            : 0,
          previousEvidenceNotes: previousNotes || null,
        }),
      });

      const evalPayload = (await evalRes.json()) as {
        ok: boolean;
        evaluation?: StepEvaluationModel;
        error?: string;
      };

      if (!evalPayload.ok || !evalPayload.evaluation) {
        set({
          checkBusy: false,
          checkError: evalPayload.error || "Couldn’t check your discovery.",
        });
        return {
          ok: false,
          error: evalPayload.error || "Couldn’t check your discovery.",
        };
      }

      const evaluationRaw = evalPayload.evaluation;
      const decision = normalizeEvaluationDecision(evaluationRaw.decision);
      const evaluationNormalized: StepEvaluationModel = {
        ...evaluationRaw,
        decision,
        addStepReason:
          "addStepReason" in evaluationRaw
            ? ((evaluationRaw as StepEvaluationModel).addStepReason ?? null)
            : null,
      };

      const evidence: AdventureEvidence = {
        id: newEvidenceId(),
        adventureId: adventure.id,
        stepId: step.id,
        snapshotId: latestSnapshotId,
        explanationText,
        canvasChanged,
        objectCountDelta: Number.isFinite(objectCountDelta)
          ? objectCountDelta
          : 0,
        evaluationDecision: decision,
        evaluationSummary: evaluationNormalized.explanation,
        missingUnderstanding: evaluationNormalized.missingUnderstanding,
        guidingQuestion: evaluationNormalized.guidingQuestion,
        replanTriggered: false,
        createdAt: now(),
      };
      await putEvidence(evidence);

      let nextSteps = [...get().steps];
      let nextAdventure = { ...adventure, updatedAt: now() };
      let revisionToast: string | null = null;
      let revisions = [...get().revisions];

      const completeCurrentAndAdvance = async () => {
        const completed: AdventureStep = {
          ...step,
          status: "completed",
          completedAt: now(),
          updatedAt: now(),
        };
        await putStep(completed);
        nextSteps = nextSteps.map((s) => (s.id === step.id ? completed : s));

        const remaining = nextSteps
          .filter((s) => s.status !== "completed" && s.status !== "skipped")
          .sort((a, b) => a.order - b.order);
        const next = remaining[0];
        if (next) {
          const activated = {
            ...next,
            status: "active" as const,
            updatedAt: now(),
          };
          await putStep(activated);
          nextSteps = nextSteps.map((s) =>
            s.id === next.id ? activated : s
          );
          nextAdventure.activeStepId = next.id;
        } else {
          nextAdventure.activeStepId = null;
          nextAdventure.status = "completed";
        }
        await putAdventure(nextAdventure);
      };

      if (decision === "complete") {
        await completeCurrentAndAdvance();
      } else if (decision === "add_step") {
        // Only expand the Journey when a distinct investigation is justified.
        const replanRes = await fetch("/api/adventure/replan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adventureId: adventure.id,
            originalGoal: adventure.originalGoal,
            learningObjective: adventure.learningObjective,
            completedStepsSummary: nextSteps
              .filter((s) => s.status === "completed")
              .map((s) => ({
                title: s.title,
                learningObjective: s.learningObjective,
              })),
            remainingStepsSummary: nextSteps
              .filter(
                (s) =>
                  s.id !== step.id &&
                  s.status !== "completed" &&
                  s.status !== "skipped"
              )
              .map((s) => ({
                title: s.title,
                learningObjective: s.learningObjective,
                interactionType: s.interactionType,
              })),
            evaluationExplanation: evaluationNormalized.explanation,
            missingUnderstanding: evaluationNormalized.missingUnderstanding,
            replanReason:
              evaluationNormalized.addStepReason ||
              evaluationNormalized.missingUnderstanding ||
              evaluationNormalized.explanation,
            originSnapshotDataUrl: origin?.dataUrl ?? null,
            latestSnapshotDataUrl: latestDataUrl,
          }),
        });

        const replanPayload = (await replanRes.json()) as {
          ok: boolean;
          replan?: {
            childFriendlyMessage: string;
            reason: string;
            replaceFutureSteps: boolean;
            insertBeforeNext: AdventurePlanModel["steps"];
            futureSteps: AdventurePlanModel["steps"];
          };
        };

        if (replanPayload.ok && replanPayload.replan) {
          const replan = replanPayload.replan;
          // Prefer a single insert; ignore padded future replacements unless empty inserts.
          const insertPlans = (
            replan.insertBeforeNext.length
              ? replan.insertBeforeNext
              : replan.futureSteps
          ).slice(0, 1);

          if (insertPlans.length === 0) {
            // Nothing useful to add — stay on current (treat like continue).
          } else {
            const revisionId = newRevisionId();
            const completedKeep = nextSteps.filter(
              (s) => s.status === "completed"
            );
            const current = { ...step, updatedAt: now() };
            const futureOld = nextSteps.filter(
              (s) =>
                s.id !== step.id &&
                s.status !== "completed" &&
                s.status !== "skipped"
            );
            const removedIds = futureOld.map((s) => s.id);

            for (const old of futureOld) {
              await putStep({
                ...old,
                status: "skipped",
                updatedAt: now(),
              });
            }

            const baseOrder = Math.max(
              current.order,
              ...completedKeep.map((s) => s.order),
              0
            );

            const inserts = insertPlans.map((s, i) => {
              const t = now();
              return {
                id: newStepId(),
                adventureId: adventure.id,
                order: baseOrder + 1 + i,
                title: s.title,
                instruction: s.instruction,
                learningObjective: s.learningObjective,
                interactionType: s.interactionType,
                evidenceRubric: s.evidenceRubric,
                supportedActivityId: s.supportedActivityId ?? null,
                status: (i === 0 ? "active" : "locked") as AdventureStepStatus,
                insertedByRevisionId: revisionId,
                createdAt: t,
                updatedAt: t,
                completedAt: null,
              } satisfies AdventureStep;
            });

            // Finish the current problem-facing step; move into the new investigation.
            const completedCurrent: AdventureStep = {
              ...current,
              status: "completed",
              completedAt: now(),
              updatedAt: now(),
            };
            await putStep(completedCurrent);
            await putSteps(inserts);

            // Restore any non-replaced future that wasn't skipped if replan failed inserts — already handled.

            const revision: AdventureRevision = {
              id: revisionId,
              adventureId: adventure.id,
              reason: replan.reason,
              childFriendlyMessage: replan.childFriendlyMessage,
              insertedStepIds: inserts.map((s) => s.id),
              removedFutureStepIds: removedIds,
              futureStepIdsAfter: inserts.map((s) => s.id),
              trigger: "evaluation",
              createdAt: now(),
            };
            await putRevision(revision);

            evidence.replanTriggered = true;
            await putEvidence(evidence);

            nextSteps = [
              ...completedKeep,
              completedCurrent,
              ...inserts,
              ...futureOld.map((s) => ({
                ...s,
                status: "skipped" as const,
              })),
            ];
            const byId = new Map<string, AdventureStep>();
            for (const s of nextSteps) byId.set(s.id, s);
            nextSteps = [...byId.values()].sort((a, b) => a.order - b.order);

            nextAdventure = {
              ...nextAdventure,
              stepIds: nextSteps
                .filter((s) => s.status !== "skipped")
                .map((s) => s.id),
              revisionIds: [...adventure.revisionIds, revisionId],
              latestRevisionMessage: replan.childFriendlyMessage,
              activeStepId: inserts[0]?.id ?? null,
              updatedAt: now(),
            };
            await putAdventure(nextAdventure);
            revisions = [...revisions, revision];
            revisionToast = replan.childFriendlyMessage;
          }
        }
      }
      // continue_current | clarify_goal — stay on the same step; Pip asks one question.

      set({
        checkBusy: false,
        adventure: nextAdventure,
        steps: nextSteps,
        revisions,
        lastEvaluation: evaluationNormalized,
        revisionToast,
        stepStartFingerprint: canvasFingerprint(doc),
      });

      return { ok: true, decision };
    } catch {
      set({
        checkBusy: false,
        checkError: "Check failed. Your adventure is safe — try again.",
      });
      return {
        ok: false,
        error: "Check failed. Your adventure is safe — try again.",
      };
    }
  },

  clearRevisionToast: () => set({ revisionToast: null }),

  syncPipContextSummary: () => {
    const { adventure, steps } = get();
    if (!adventure) return null;
    const active = steps.find((s) => s.id === adventure.activeStepId);
    const completed = steps.filter((s) => s.status === "completed").length;
    return [
      `[Adventure context] Title: ${adventure.title}`,
      `Goal: ${adventure.originalGoal}`,
      `Objective: ${adventure.learningObjective}`,
      active
        ? `Active step (${active.order + 1}): ${active.title} — ${active.instruction}`
        : "No active step (adventure may be complete).",
      `Progress: ${completed} completed of ${steps.filter((s) => s.status !== "skipped").length}.`,
      adventure.latestRevisionMessage
        ? `Recent revision: ${adventure.latestRevisionMessage}`
        : "No recent revision.",
      "Help them solve THIS problem naturally in conversation. Prefer one useful question or hint over inventing new Journey steps. Do not invent other adventures. Do not force TeachBack or Superpower.",
      "If this is a math problem, tell them clearly to WRITE the solution on the canvas (not only say it). Then look at the canvas to check.",
    ].join("\n");
  },
}));
