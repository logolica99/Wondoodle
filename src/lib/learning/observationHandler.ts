import {
  ACTIVITY_LABELS,
  MISCONCEPTION_META,
  isSupportedMisconception,
  type SupportedMisconceptionId,
} from "./misconceptions";
import type {
  DiscoveryCardModel,
  LearningObservation,
} from "./observationSchema";
import {
  markMisconceptionReviewed,
  recordMisconceptionIdentified,
} from "./recordHelpers";
import { getOrCreateSessionId } from "./session";
import { DEFAULT_DOCUMENT_ID } from "@/types/canvas";

export type ObservationHandleResult = {
  ok: boolean;
  action:
    | "recorded"
    | "duplicate"
    | "clarify"
    | "no_card"
    | "rejected";
  message: string;
  card?: DiscoveryCardModel;
  eventId?: string;
};

/**
 * Apply a validated observation: persist when supported, build discovery card model.
 * Never throws — persistence failures return rejected so voice can continue.
 */
export async function applyLearningObservation(
  observation: LearningObservation,
  opts: {
    callId: string;
    documentId?: string;
  }
): Promise<ObservationHandleResult> {
  const sessionId = getOrCreateSessionId();
  const documentId = opts.documentId ?? DEFAULT_DOCUMENT_ID;
  const observationId =
    observation.observationId?.trim() ||
    `obs-${opts.callId}`.slice(0, 120);

  if (observation.clarificationNeeded) {
    return {
      ok: true,
      action: "clarify",
      message:
        "Clarification needed. Ask one short clarifying question; do not treat this as a confirmed misconception.",
    };
  }

  if (
    observation.misconceptionId === "no_misconception" ||
    observation.misconceptionId === "uncertain"
  ) {
    return {
      ok: true,
      action: "no_card",
      message:
        observation.misconceptionId === "no_misconception"
          ? "No misconception card. Continue the conversation normally."
          : "Evidence uncertain. Ask a clarifying question if helpful; do not show a discovery card.",
    };
  }

  if (!isSupportedMisconception(observation.misconceptionId)) {
    return {
      ok: false,
      action: "rejected",
      message: "Unsupported misconception id.",
    };
  }

  const misconceptionId =
    observation.misconceptionId as SupportedMisconceptionId;
  const meta = MISCONCEPTION_META[misconceptionId];

  try {
    const { event, created } = await recordMisconceptionIdentified({
      observationId,
      documentId,
      sessionId,
      conceptId: observation.conceptId,
      misconceptionId,
      evidence: observation.evidence,
      guidingQuestion: observation.guidingQuestion,
      recommendedActivity: observation.recommendedActivity,
      callId: opts.callId,
    });

    if (!created) {
      return {
        ok: true,
        action: "duplicate",
        message:
          "Observation already recorded for this episode. Do not repeat the same discovery.",
        eventId: event.eventId,
      };
    }

    const card: DiscoveryCardModel = {
      observationId,
      conceptId: observation.conceptId,
      misconceptionId,
      conceptLabel: meta.conceptLabel,
      heading: meta.heading,
      guidingQuestion: observation.guidingQuestion,
      activityLabel:
        ACTIVITY_LABELS[observation.recommendedActivity] ?? meta.activityLabel,
      activityId: observation.recommendedActivity,
      evidence: observation.evidence,
      eventId: event.eventId,
      sessionId,
    };

    return {
      ok: true,
      action: "recorded",
      message:
        misconceptionId === "denominator_size"
          ? "Observation recorded. Ask your guiding question once, wait for their answer, then invite them to try Fraction Playground. If they agree, call open_learning_activity with activityId fraction_comparison. Do not reveal the correct solution yet."
          : "Observation recorded. Ask your guiding question once, then wait for the student's answer. Do not reveal the correct solution yet.",
      card,
      eventId: event.eventId,
    };
  } catch {
    return {
      ok: false,
      action: "rejected",
      message:
        "Could not save the observation. Continue the conversation without a discovery card.",
    };
  }
}

export async function reviewDiscoveryObservation(
  eventId: string
): Promise<void> {
  try {
    await markMisconceptionReviewed(eventId);
  } catch {
    // Journey review is best-effort; voice/canvas stay up.
  }
}
