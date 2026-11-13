import { z } from "zod";
import {
  TEACHBACK_CONCEPT_IDS,
  TEACHBACK_RESULTS,
  normalizeTeachBackResult,
  type TeachBackConceptId,
  type TeachBackResult,
  type TeachBackRubric,
} from "./teachback";

export const TeachBackAssessmentSchema = z.object({
  conceptId: z.enum(TEACHBACK_CONCEPT_IDS),
  rubric: z.object({
    sameSizedWhole: z.boolean(),
    equalParts: z.boolean(),
    morePartsSmallerPieces: z.boolean(),
  }),
  evidence: z.string().min(1).max(800),
  result: z.enum(TEACHBACK_RESULTS),
  followUpQuestion: z.string().min(1).max(280).nullable(),
});

export type TeachBackAssessment = z.infer<typeof TeachBackAssessmentSchema>;

export type ParsedTeachBackResult =
  | {
      ok: true;
      assessment: TeachBackAssessment & {
        result: TeachBackResult;
        rubric: TeachBackRubric;
        conceptId: TeachBackConceptId;
      };
    }
  | { ok: false; error: string };

export function parseTeachBackAssessmentArgs(
  raw: unknown
): ParsedTeachBackResult {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Malformed teachback arguments (invalid JSON)." };
    }
  }

  const parsed = TeachBackAssessmentSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid teachback assessment.";
    return { ok: false, error: msg };
  }

  const evidence = parsed.data.evidence.trim();
  if (evidence.length < 8) {
    return { ok: false, error: "Evidence too thin — do not invent student words." };
  }

  const result = normalizeTeachBackResult(
    parsed.data.result,
    parsed.data.rubric
  );

  let followUp = parsed.data.followUpQuestion;
  if (result === "complete") {
    followUp = null;
  } else if (!followUp || !followUp.trim()) {
    followUp =
      "What happens to each piece when we cut the same whole into more equal parts?";
  }

  return {
    ok: true,
    assessment: {
      ...parsed.data,
      evidence,
      result,
      followUpQuestion: followUp,
    },
  };
}
