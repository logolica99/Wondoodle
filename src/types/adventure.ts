/**
 * Adaptive Canvas-to-Adventure types.
 * Interaction types are reusable capabilities — not subject templates.
 */

export type AdventureInteractionType =
  | "draw_and_explain"
  | "annotate_canvas"
  | "compare_drawings"
  | "predict_and_draw"
  | "revise_original"
  | "explain_to_pip";

export type AdventureStepStatus =
  | "locked"
  | "available"
  | "active"
  | "completed"
  | "skipped";

export type AdventureStatus = "draft" | "active" | "completed" | "abandoned";

export type EvaluationDecision =
  | "continue_current"
  | "add_step"
  | "complete"
  | "clarify_goal"
  /** @deprecated legacy values may exist in old Dexie rows */
  | "advance"
  | "clarify"
  | "revise";

export type AdventureStep = {
  id: string;
  adventureId: string;
  order: number;
  title: string;
  instruction: string;
  learningObjective: string;
  interactionType: AdventureInteractionType;
  /** Rubric the evaluator uses — kid-facing wording allowed. */
  evidenceRubric: string;
  /** Only known app activity IDs; never invent executable UIs. */
  supportedActivityId: "fraction_comparison" | null;
  status: AdventureStepStatus;
  insertedByRevisionId: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

export type AdventureRevision = {
  id: string;
  adventureId: string;
  reason: string;
  childFriendlyMessage: string;
  /** Step IDs that were added. */
  insertedStepIds: string[];
  /** Step IDs removed from the future plan (completed steps never removed). */
  removedFutureStepIds: string[];
  /** Snapshot of future step IDs after this revision. */
  futureStepIdsAfter: string[];
  trigger: "evaluation" | "goal_change" | "manual";
  createdAt: number;
};

export type AdventureEvidence = {
  id: string;
  adventureId: string;
  stepId: string;
  /** Latest canvas snapshot id for this attempt (may be null for explain-only). */
  snapshotId: string | null;
  explanationText: string | null;
  canvasChanged: boolean;
  objectCountDelta: number;
  evaluationDecision: EvaluationDecision | null;
  evaluationSummary: string | null;
  missingUnderstanding: string | null;
  guidingQuestion: string | null;
  replanTriggered: boolean;
  createdAt: number;
};

/** Lightweight immutable image blob reference (data URL stored separately). */
export type CanvasSnapshotRecord = {
  id: string;
  documentId: string;
  adventureId: string | null;
  width: number;
  height: number;
  /** JPEG data URL — stored once per capture, not duplicated on every event. */
  dataUrl: string;
  /** Lightweight object metadata at capture time (no large stroke points). */
  objectSummary: {
    objectCount: number;
    textSnippets: string[];
    hasImages: boolean;
    hasStrokes: boolean;
  };
  canvasVersion: number;
  createdAt: number;
};

export type LearningAdventure = {
  id: string;
  documentId: string;
  sessionId: string;
  status: AdventureStatus;
  title: string;
  storyline: string;
  subjectDescription: string;
  learningObjective: string;
  originalGoal: string;
  /** Immutable original canvas capture. */
  originSnapshotId: string;
  activeStepId: string | null;
  stepIds: string[];
  revisionIds: string[];
  latestRevisionMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

/** Client-facing plan after IDs are assigned. */
export type AdventurePlan = {
  adventureId: string;
  title: string;
  storyline: string;
  subjectDescription: string;
  learningObjective: string;
  originalGoal: string;
  originSnapshotId: string;
  steps: AdventureStep[];
  activeStepId: string;
};
