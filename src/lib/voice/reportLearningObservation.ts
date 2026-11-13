/**
 * Realtime function tool: report_learning_observation
 * Lets Pip surface structured learning hypotheses from the live conversation.
 */

export const REPORT_LEARNING_OBSERVATION_TOOL = {
  type: "function" as const,
  name: "report_learning_observation",
  description:
    "Report a structured learning observation when the student explains fraction reasoning that may show a supported misconception, or when you need clarification / find no misconception. Call only when the student has shared actual reasoning about fractions (spoken and/or visible on a shared canvas). Never invent student quotes. Treat findings as hypotheses, not diagnoses. Do not call for casual chat. Use misconceptionId no_misconception when reasoning looks sound. Use uncertain or clarificationNeeded=true when evidence is thin or the student says they guessed.",
  parameters: {
    type: "object",
    properties: {
      observationId: {
        type: "string",
        description:
          "Stable id for this reasoning episode (reuse if reporting the same idea again). Prefer a short slug like denom-size-1.",
      },
      conceptId: {
        type: "string",
        enum: [
          "unit_fraction_comparison",
          "fraction_addition",
          "equivalent_fractions",
        ],
        description: "Concept under discussion.",
      },
      misconceptionId: {
        type: "string",
        enum: [
          "denominator_size",
          "fraction_addition",
          "equivalent_fractions",
          "no_misconception",
          "uncertain",
        ],
        description:
          "denominator_size: thinks larger denominator means larger unit fraction (e.g. 1/4 > 1/3). fraction_addition: adds numerators and denominators (e.g. 1/2+1/3=2/5). equivalent_fractions: thinks equivalents are different amounts (e.g. 1/2 ≠ 2/4). no_misconception: sound reasoning. uncertain: not enough evidence.",
      },
      evidence: {
        type: "string",
        description:
          "Brief paraphrase grounded in what the student actually said or showed. Never invent quotations.",
      },
      guidingQuestion: {
        type: "string",
        description:
          "One short, age-appropriate question that invites reasoning (not the final answer).",
      },
      recommendedActivity: {
        type: "string",
        enum: [
          "fraction_comparison",
          "fraction_addition_practice",
          "equivalent_fractions_explore",
        ],
        description: "Suggested follow-up activity id for later features.",
      },
      clarificationNeeded: {
        type: "boolean",
        description:
          "True when you should ask a clarifying question instead of surfacing a discovery card (e.g. student said they guessed, or reasoning is ambiguous).",
      },
    },
    required: [
      "conceptId",
      "misconceptionId",
      "evidence",
      "guidingQuestion",
      "recommendedActivity",
      "clarificationNeeded",
    ],
    additionalProperties: false,
  },
};

export const REPORT_LEARNING_OBSERVATION_NAME =
  "report_learning_observation" as const;
