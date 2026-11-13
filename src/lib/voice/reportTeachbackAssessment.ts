/**
 * Realtime tool: report_teachback_assessment
 * Structured explanation rubric during TeachBack ("Be the Teacher").
 */

export const REPORT_TEACHBACK_ASSESSMENT_TOOL = {
  type: "function" as const,
  name: "report_teachback_assessment",
  description:
    "Report a TeachBack explanation assessment while the student is teaching you a concept. Call after the student explains (or attempts to). Evaluate actual reasoning only — never tone, accent, fluency, or speed. Never invent student words. result=complete only when all three rubric flags are true from their explanation. Otherwise use developing or unclear and set one followUpQuestion. Do not mark complete just because they spoke.",
  parameters: {
    type: "object",
    properties: {
      conceptId: {
        type: "string",
        enum: ["unit_fraction_comparison"],
        description: "Concept being taught back.",
      },
      rubric: {
        type: "object",
        properties: {
          sameSizedWhole: {
            type: "boolean",
            description:
              "True if they convey both fractions come from equal-sized wholes (explicitly or clearly implied).",
          },
          equalParts: {
            type: "boolean",
            description:
              "True if they convey the denominator is the number of equal parts.",
          },
          morePartsSmallerPieces: {
            type: "boolean",
            description:
              "True if they convey that more equal parts means smaller pieces (so 1/3 > 1/4).",
          },
        },
        required: [
          "sameSizedWhole",
          "equalParts",
          "morePartsSmallerPieces",
        ],
        additionalProperties: false,
      },
      evidence: {
        type: "string",
        description:
          "Brief paraphrase of what the student actually said or showed. Never invent quotations.",
      },
      result: {
        type: "string",
        enum: ["complete", "developing", "unclear"],
        description:
          "complete = all rubric true. developing = partial understanding. unclear = not enough / off-topic.",
      },
      followUpQuestion: {
        type: ["string", "null"],
        description:
          "One short follow-up when not complete; null when complete.",
      },
    },
    required: [
      "conceptId",
      "rubric",
      "evidence",
      "result",
      "followUpQuestion",
    ],
    additionalProperties: false,
  },
};

export const REPORT_TEACHBACK_ASSESSMENT_NAME =
  "report_teachback_assessment" as const;
