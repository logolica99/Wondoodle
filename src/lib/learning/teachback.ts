/**
 * TeachBack ("Be the Teacher") — explanation assessment for Feature 5.
 * Not an independent mastery check.
 */

export const TEACHBACK_CONCEPT_IDS = ["unit_fraction_comparison"] as const;
export type TeachBackConceptId = (typeof TEACHBACK_CONCEPT_IDS)[number];

export const TEACHBACK_RESULTS = ["complete", "developing", "unclear"] as const;
export type TeachBackResult = (typeof TEACHBACK_RESULTS)[number];

export type TeachBackRubric = {
  sameSizedWhole: boolean;
  equalParts: boolean;
  morePartsSmallerPieces: boolean;
};

export const TEACHBACK_STARTING_QUESTION: Record<TeachBackConceptId, string> = {
  unit_fraction_comparison:
    "Why is one-third bigger than one-fourth when both come from the same-sized whole?",
};

export const TEACHBACK_CONCEPT_LABEL: Record<TeachBackConceptId, string> = {
  unit_fraction_comparison: "Comparing unit fractions",
};

export const TEACHBACK_RUBRIC_HINTS = {
  sameSizedWhole: "Both fractions come from equal-sized wholes.",
  equalParts: "The denominator is how many equal parts the whole is split into.",
  morePartsSmallerPieces:
    "More equal parts means each piece is smaller.",
} as const;

export function feedbackForResult(result: TeachBackResult): string {
  switch (result) {
    case "complete":
      return "Wonderful explanation! You helped Pip understand!";
    case "developing":
      return "You're getting there! Let's think about one more thing.";
    case "unclear":
      return "Can you tell Pip a little more?";
  }
}

export function rubricAllMet(rubric: TeachBackRubric): boolean {
  return (
    rubric.sameSizedWhole &&
    rubric.equalParts &&
    rubric.morePartsSmallerPieces
  );
}

/** Coerce inconsistent model output: complete requires full rubric. */
export function normalizeTeachBackResult(
  result: TeachBackResult,
  rubric: TeachBackRubric
): TeachBackResult {
  if (result === "complete" && !rubricAllMet(rubric)) {
    return "developing";
  }
  if (result !== "complete" && rubricAllMet(rubric)) {
    return "complete";
  }
  return result;
}

export function isTeachBackConceptId(id: string): id is TeachBackConceptId {
  return (TEACHBACK_CONCEPT_IDS as readonly string[]).includes(id);
}

/** First utterance when TeachBack starts a voice session. */
export function teachBackOpeningInstructions(question: string): string {
  return [
    "LANGUAGE LOCK: Speak ONLY in clear English. Never use Spanish, French, or any other language.",
    "You are starting TeachBack (Be the Teacher) for unit_fraction_comparison.",
    "Do NOT ask what they are working on today.",
    "Warmly invite them to be the teacher in one short sentence,",
    `then ask this exact question: "${question}"`,
    "Then wait and listen. After their explanation, call report_teachback_assessment.",
    "Do not reveal the answer. Do not claim you can see the canvas unless they ask you to look.",
  ].join(" ");
}
