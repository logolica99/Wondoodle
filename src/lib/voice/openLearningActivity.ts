/**
 * Realtime tool: open a validated learning activity (Feature 4).
 * Only known activityIds are accepted — never invent UI from freeform AI text.
 */

export const OPEN_LEARNING_ACTIVITY_TOOL = {
  type: "function" as const,
  name: "open_learning_activity",
  description:
    "Open a validated interactive learning activity for the student. Call this only after they agree to try it (or clearly ask to open it). Supported activityId: fraction_comparison (unit fraction comparison playground for denominator_size misconceptions). Do not invent other activities.",
  parameters: {
    type: "object",
    properties: {
      activityId: {
        type: "string",
        enum: ["fraction_comparison"],
        description: "Must be fraction_comparison for Feature 4.",
      },
      reason: {
        type: "string",
        description: "Short reason, e.g. student wants to explore with Fraction Playground.",
      },
    },
    required: ["activityId"],
    additionalProperties: false,
  },
};

export const OPEN_LEARNING_ACTIVITY_NAME = "open_learning_activity" as const;
