/**
 * Realtime tool: create a learning adventure after conversational agreement.
 * Captures the real canvas snapshot in the app — never trusts Pip’s description alone.
 */

export const CREATE_ADVENTURE_TOOL = {
  type: "function" as const,
  name: "create_adventure",
  description:
    "Create a personalized learning adventure from the student’s current canvas AFTER they clearly agree in conversation. Call look_at_canvas first if you have not seen a recent snapshot. Pass their confirmed goal in their own words. Set studentAgreed=true only when they said yes to making an adventure. Never invent a goal from an ambiguous doodle. Never call this just because they asked for help — offer the adventure, wait for agreement. Do not call repeatedly while planning is in progress.",
  parameters: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description:
          "The student’s confirmed goal in their own words (what they want to figure out or create).",
      },
      studentAgreed: {
        type: "boolean",
        description:
          "True only if the student clearly agreed to create an adventure.",
      },
      conversationSummary: {
        type: "string",
        description:
          "Optional short summary of the relevant exchange (no audio).",
      },
    },
    required: ["goal", "studentAgreed"],
    additionalProperties: false,
  },
};

/** @deprecated alias kept for session migrations during rollout */
export const CREATE_LEARNING_ADVENTURE_TOOL = CREATE_ADVENTURE_TOOL;

export const CREATE_ADVENTURE_NAME = "create_adventure" as const;
export const CREATE_LEARNING_ADVENTURE_NAME = "create_learning_adventure" as const;

export type CreateAdventureToolArgs = {
  goal: string;
  studentAgreed: boolean;
  conversationSummary: string | null;
};

export function parseCreateAdventureArgs(raw: string): CreateAdventureToolArgs {
  try {
    const data = JSON.parse(raw) as {
      goal?: unknown;
      suggestedGoal?: unknown;
      studentAgreed?: unknown;
      conversationSummary?: unknown;
      reason?: unknown;
    };
    const goal = String(data.goal ?? data.suggestedGoal ?? "").trim();
    const agreed =
      data.studentAgreed === true ||
      data.studentAgreed === "true" ||
      data.studentAgreed === 1;
    const summary = String(
      data.conversationSummary ?? data.reason ?? ""
    ).trim();
    return {
      goal,
      studentAgreed: Boolean(agreed),
      conversationSummary: summary || null,
    };
  } catch {
    return { goal: "", studentAgreed: false, conversationSummary: null };
  }
}
