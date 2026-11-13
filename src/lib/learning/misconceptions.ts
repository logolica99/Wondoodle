/**
 * Misconception taxonomy + Feature 4 activity routing contract.
 * Implemented activity: fraction_comparison (Fraction Playground).
 */

export const CONCEPT_IDS = [
  "unit_fraction_comparison",
  "fraction_addition",
  "equivalent_fractions",
] as const;

export type ConceptId = (typeof CONCEPT_IDS)[number];

export const SUPPORTED_MISCONCEPTION_IDS = [
  "denominator_size",
  "fraction_addition",
  "equivalent_fractions",
] as const;

export type SupportedMisconceptionId =
  (typeof SUPPORTED_MISCONCEPTION_IDS)[number];

export const OBSERVATION_MISCONCEPTION_IDS = [
  ...SUPPORTED_MISCONCEPTION_IDS,
  "no_misconception",
  "uncertain",
] as const;

export type ObservationMisconceptionId =
  (typeof OBSERVATION_MISCONCEPTION_IDS)[number];

export const ACTIVITY_IDS = [
  "fraction_comparison",
  "fraction_addition_practice",
  "equivalent_fractions_explore",
] as const;

export type ActivityId = (typeof ACTIVITY_IDS)[number];

/** Maps misconception → expected concept + recommended activity. */
export const MISCONCEPTION_META: Record<
  SupportedMisconceptionId,
  {
    conceptId: ConceptId;
    recommendedActivity: ActivityId;
    conceptLabel: string;
    activityLabel: string;
    heading: string;
  }
> = {
  denominator_size: {
    conceptId: "unit_fraction_comparison",
    recommendedActivity: "fraction_comparison",
    conceptLabel: "Comparing unit fractions",
    activityLabel: "Compare fraction pieces",
    heading: "Hmm, interesting idea…",
  },
  fraction_addition: {
    conceptId: "fraction_addition",
    recommendedActivity: "fraction_addition_practice",
    conceptLabel: "Adding fractions",
    activityLabel: "Add fraction pieces",
    heading: "Let's think about this…",
  },
  equivalent_fractions: {
    conceptId: "equivalent_fractions",
    recommendedActivity: "equivalent_fractions_explore",
    conceptLabel: "Equivalent fractions",
    activityLabel: "Match equal amounts",
    heading: "Curious match…",
  },
};

export const CONCEPT_LABELS: Record<ConceptId, string> = {
  unit_fraction_comparison: "Comparing unit fractions",
  fraction_addition: "Adding fractions",
  equivalent_fractions: "Equivalent fractions",
};

export const ACTIVITY_LABELS: Record<ActivityId, string> = {
  fraction_comparison: "Compare fraction pieces",
  fraction_addition_practice: "Add fraction pieces",
  equivalent_fractions_explore: "Match equal amounts",
};

/** Feature 4 activity routing contract. */
export type ActivityRouteContract = {
  activityId: ActivityId;
  conceptId: ConceptId;
  misconceptionId: SupportedMisconceptionId;
};

export function buildActivityRoute(
  misconceptionId: SupportedMisconceptionId
): ActivityRouteContract {
  const meta = MISCONCEPTION_META[misconceptionId];
  return {
    activityId: meta.recommendedActivity,
    conceptId: meta.conceptId,
    misconceptionId,
  };
}

export function isSupportedMisconception(
  id: string
): id is SupportedMisconceptionId {
  return (SUPPORTED_MISCONCEPTION_IDS as readonly string[]).includes(id);
}

export function conceptMatchesMisconception(
  conceptId: string,
  misconceptionId: ObservationMisconceptionId
): boolean {
  if (
    misconceptionId === "no_misconception" ||
    misconceptionId === "uncertain"
  ) {
    return (CONCEPT_IDS as readonly string[]).includes(conceptId);
  }
  return MISCONCEPTION_META[misconceptionId]?.conceptId === conceptId;
}
