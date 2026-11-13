import { z } from "zod";

export const INTERACTION_TYPES = [
  "draw_and_explain",
  "annotate_canvas",
  "compare_drawings",
  "predict_and_draw",
  "revise_original",
  "explain_to_pip",
] as const;

export const InteractionTypeSchema = z.enum(INTERACTION_TYPES);

/** Model output for planning — app assigns stable IDs afterward. */
export const PlannedStepSchema = z.object({
  title: z.string().min(2).max(80),
  instruction: z.string().min(8).max(400),
  learningObjective: z.string().min(4).max(200),
  interactionType: InteractionTypeSchema,
  evidenceRubric: z.string().min(8).max(400),
  supportedActivityId: z.enum(["fraction_comparison"]).nullable(),
});

export const AdventurePlanModelSchema = z.object({
  title: z.string().min(2).max(80),
  storyline: z.string().min(4).max(400),
  subjectDescription: z.string().min(4).max(200),
  learningObjective: z.string().min(4).max(240),
  /** 1 is preferred for simple problems; never pad to look impressive. */
  steps: z.array(PlannedStepSchema).min(1).max(5),
});

export type AdventurePlanModel = z.infer<typeof AdventurePlanModelSchema>;

export const EvaluationDecisionSchema = z.enum([
  "continue_current",
  "add_step",
  "complete",
  "clarify_goal",
]);

export const StepEvaluationModelSchema = z.object({
  decision: EvaluationDecisionSchema,
  explanation: z.string().min(8).max(500),
  missingUnderstanding: z.string().max(300).nullable(),
  guidingQuestion: z.string().max(240).nullable(),
  meaningfulCanvasChangeObserved: z.boolean(),
  /** Only when decision is add_step — why a new Journey card is justified. */
  addStepReason: z.string().max(300).nullable(),
});

export type StepEvaluationModel = z.infer<typeof StepEvaluationModelSchema>;

export const ReplanModelSchema = z.object({
  childFriendlyMessage: z.string().min(8).max(200),
  reason: z.string().min(8).max(400),
  replaceFutureSteps: z.boolean(),
  insertBeforeNext: z.array(PlannedStepSchema).max(2),
  futureSteps: z.array(PlannedStepSchema).max(4),
});

export type ReplanModel = z.infer<typeof ReplanModelSchema>;

export const PlanRequestSchema = z.object({
  goal: z.string().min(3).max(400),
  snapshotDataUrl: z.string().min(32).max(6_000_000),
  objectSummary: z.object({
    objectCount: z.number().int().nonnegative(),
    textSnippets: z.array(z.string().max(120)).max(12),
    hasImages: z.boolean(),
    hasStrokes: z.boolean(),
  }),
  conversationContext: z.string().max(800).nullable().optional(),
  canvasVersion: z.number().int().nonnegative(),
  documentId: z.string().min(1).max(80),
});

export const EvaluateRequestSchema = z.object({
  adventureId: z.string().min(1),
  stepId: z.string().min(1),
  originalGoal: z.string().min(1).max(400),
  stepTitle: z.string().min(1).max(80),
  stepInstruction: z.string().min(1).max(400),
  learningObjective: z.string().min(1).max(240),
  evidenceRubric: z.string().min(1).max(400),
  interactionType: InteractionTypeSchema,
  originSnapshotDataUrl: z.string().min(32).max(6_000_000).nullable(),
  latestSnapshotDataUrl: z.string().min(32).max(6_000_000).nullable(),
  explanationText: z.string().max(1200).nullable(),
  canvasChanged: z.boolean(),
  objectCountDelta: z.number().int(),
  previousEvidenceNotes: z.string().max(600).nullable().optional(),
});

export const ReplanRequestSchema = z.object({
  adventureId: z.string().min(1),
  originalGoal: z.string().min(1).max(400),
  learningObjective: z.string().min(1).max(240),
  completedStepsSummary: z.array(
    z.object({
      title: z.string(),
      learningObjective: z.string(),
    })
  ),
  remainingStepsSummary: z.array(
    z.object({
      title: z.string(),
      learningObjective: z.string(),
      interactionType: InteractionTypeSchema,
    })
  ),
  evaluationExplanation: z.string().min(1).max(500),
  missingUnderstanding: z.string().max(300).nullable(),
  replanReason: z.string().min(1).max(400),
  originSnapshotDataUrl: z.string().min(32).max(6_000_000).nullable(),
  latestSnapshotDataUrl: z.string().min(32).max(6_000_000).nullable(),
});

/** Map legacy evaluator decisions if an older client/cached path appears. */
export function normalizeEvaluationDecision(
  raw: string
): z.infer<typeof EvaluationDecisionSchema> {
  if (raw === "advance") return "complete";
  if (raw === "clarify") return "continue_current";
  if (raw === "revise") return "add_step";
  if (
    raw === "continue_current" ||
    raw === "add_step" ||
    raw === "complete" ||
    raw === "clarify_goal"
  ) {
    return raw;
  }
  return "continue_current";
}
