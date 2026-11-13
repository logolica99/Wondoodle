import { z } from "zod";
import {
  ACTIVITY_IDS,
  CONCEPT_IDS,
  OBSERVATION_MISCONCEPTION_IDS,
  conceptMatchesMisconception,
  isSupportedMisconception,
  type ActivityId,
  type ConceptId,
} from "./misconceptions";

export const LearningObservationSchema = z
  .object({
    observationId: z.string().min(1).max(120).optional(),
    conceptId: z.enum(CONCEPT_IDS),
    misconceptionId: z.enum(OBSERVATION_MISCONCEPTION_IDS),
    evidence: z.string().min(1).max(600),
    guidingQuestion: z.string().min(1).max(280),
    recommendedActivity: z.enum(ACTIVITY_IDS),
    clarificationNeeded: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!conceptMatchesMisconception(value.conceptId, value.misconceptionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "conceptId does not match misconceptionId",
        path: ["conceptId"],
      });
    }

    if (isSupportedMisconception(value.misconceptionId)) {
      // Soft check: recommended activity should match taxonomy defaults when known.
      const expected = value.misconceptionId;
      const activityOk =
        (expected === "denominator_size" &&
          value.recommendedActivity === "fraction_comparison") ||
        (expected === "fraction_addition" &&
          value.recommendedActivity === "fraction_addition_practice") ||
        (expected === "equivalent_fractions" &&
          value.recommendedActivity === "equivalent_fractions_explore");
      if (!activityOk) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "recommendedActivity does not match misconceptionId",
          path: ["recommendedActivity"],
        });
      }
    }

    if (
      !value.clarificationNeeded &&
      isSupportedMisconception(value.misconceptionId)
    ) {
      const trimmed = value.evidence.trim();
      if (trimmed.length < 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "evidence too thin for a supported misconception",
          path: ["evidence"],
        });
      }
    }
  });

export type LearningObservation = z.infer<typeof LearningObservationSchema>;

export type ParsedObservationResult =
  | { ok: true; observation: LearningObservation }
  | { ok: false; error: string };

export function parseLearningObservationArgs(
  raw: unknown
): ParsedObservationResult {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Malformed tool arguments (invalid JSON)." };
    }
  }

  const parsed = LearningObservationSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid observation.";
    return { ok: false, error: msg };
  }
  return { ok: true, observation: parsed.data };
}

export type DiscoveryCardModel = {
  observationId: string;
  conceptId: ConceptId;
  misconceptionId: string;
  conceptLabel: string;
  heading: string;
  guidingQuestion: string;
  activityLabel: string;
  activityId: ActivityId;
  evidence: string;
  eventId: string;
  sessionId: string;
};
