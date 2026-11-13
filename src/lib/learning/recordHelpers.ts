import { DEFAULT_DOCUMENT_ID } from "@/types/canvas";
import { getDB } from "@/lib/canvas/storage";
import type { LearningEvent } from "@/types/learning";
import { recordLearningEvent } from "./events";
import { getOrCreateSessionId } from "./session";

/** Idempotent: one first-doodle event per document. */
export async function recordFirstDoodle(documentId = DEFAULT_DOCUMENT_ID) {
  return recordLearningEvent({
    eventId: `doodle_created:${documentId}`,
    eventType: "doodle_created",
    source: "canvas",
    documentId,
    payload: { kind: "stroke" },
  });
}

export async function recordTextCreated(documentId = DEFAULT_DOCUMENT_ID) {
  return recordLearningEvent({
    eventId: `text_created:${documentId}`,
    eventType: "text_created",
    source: "canvas",
    documentId,
    payload: { kind: "text" },
  });
}

export async function recordImageAdded(documentId = DEFAULT_DOCUMENT_ID) {
  return recordLearningEvent({
    eventId: `image_added:${documentId}`,
    eventType: "image_added",
    source: "canvas",
    documentId,
    payload: { kind: "image" },
  });
}

export async function recordPipTalkStarted(documentId = DEFAULT_DOCUMENT_ID) {
  return recordLearningEvent({
    eventId: `pip_talk_started:${documentId}:${Date.now()}`,
    eventType: "pip_talk_started",
    source: "pip",
    documentId,
    payload: {},
  });
}

/**
 * Idempotent journey completion for "Tell Pip your idea".
 * Only call after a meaningful student explanation + Pip response.
 * Upgrades any older non-meaningful pip_talk_ended row for this document.
 */
export async function recordPipTalkEnded(
  documentId = DEFAULT_DOCUMENT_ID,
  durationSec = 0,
  extras: { studentTurns?: number; pipTurns?: number } = {}
): Promise<LearningEvent> {
  const eventId = `pip_talk_ended:${documentId}`;
  const db = getDB();
  const existing = await db.learningEvents.get(eventId);
  if (existing?.payload?.meaningful === true) return existing;

  const event: LearningEvent = {
    eventId,
    sessionId: existing?.sessionId ?? getOrCreateSessionId(),
    documentId,
    conceptId: existing?.conceptId ?? null,
    eventType: "pip_talk_ended",
    payload: {
      durationSec,
      meaningful: true,
      studentTurns: extras.studentTurns ?? 0,
      pipTurns: extras.pipTurns ?? 0,
    },
    timestamp: Date.now(),
    source: "pip",
  };

  await db.learningEvents.put(event);
  return event;
}

export async function recordCanvasSharedWithPip(
  documentId = DEFAULT_DOCUMENT_ID
) {
  return recordLearningEvent({
    eventId: `canvas_shared_with_pip:${documentId}:${Date.now()}`,
    eventType: "canvas_shared_with_pip",
    source: "pip",
    documentId,
    payload: {},
  });
}

export async function recordJourneyOpened(documentId = DEFAULT_DOCUMENT_ID) {
  return recordLearningEvent({
    eventId: `journey_opened:${documentId}:${Date.now()}`,
    eventType: "journey_opened",
    source: "journey",
    documentId,
    payload: {},
  });
}

const EPISODE_DEDUP_MS = 12 * 60 * 1000;

/**
 * Idempotent misconception observation for a reasoning episode.
 * Dedupes by observationId and by recent same misconception in-session.
 * Does not mark concepts mastered or lessons completed.
 */
export async function recordMisconceptionIdentified(input: {
  observationId: string;
  documentId?: string;
  sessionId?: string;
  conceptId: string;
  misconceptionId: string;
  evidence: string;
  guidingQuestion: string;
  recommendedActivity: string;
  callId?: string;
}): Promise<{ event: LearningEvent; created: boolean }> {
  const sessionId = input.sessionId ?? getOrCreateSessionId();
  const documentId = input.documentId ?? DEFAULT_DOCUMENT_ID;
  const eventId = `misconception_identified:${sessionId}:${input.observationId}`;
  const db = getDB();
  const existing = await db.learningEvents.get(eventId);
  if (existing) return { event: existing, created: false };

  const recent = await db.learningEvents
    .where("sessionId")
    .equals(sessionId)
    .toArray();
  const now = Date.now();
  const episodeTwin = recent.find(
    (e) =>
      e.eventType === "misconception_identified" &&
      e.documentId === documentId &&
      e.conceptId === input.conceptId &&
      e.payload.misconceptionId === input.misconceptionId &&
      now - e.timestamp < EPISODE_DEDUP_MS
  );
  if (episodeTwin) return { event: episodeTwin, created: false };

  const event: LearningEvent = {
    eventId,
    sessionId,
    documentId,
    conceptId: input.conceptId,
    eventType: "misconception_identified",
    payload: {
      misconceptionId: input.misconceptionId,
      evidence: input.evidence,
      guidingQuestion: input.guidingQuestion,
      recommendedActivity: input.recommendedActivity,
      observationId: input.observationId,
      callId: input.callId ?? null,
      reviewed: false,
    },
    timestamp: now,
    source: "ai_observation",
  };

  await db.learningEvents.put(event);
  return { event, created: true };
}

/** Mark a discovery observation as reviewed (e.g. card dismissed). */
export async function markMisconceptionReviewed(
  eventId: string
): Promise<LearningEvent | null> {
  const db = getDB();
  const existing = await db.learningEvents.get(eventId);
  if (!existing || existing.eventType !== "misconception_identified") {
    return null;
  }
  if (existing.payload.reviewed === true) return existing;

  const event: LearningEvent = {
    ...existing,
    payload: { ...existing.payload, reviewed: true },
  };
  await db.learningEvents.put(event);
  return event;
}

export async function recordActivityStarted(input: {
  documentId?: string;
  runId: string;
  activityId: string;
  conceptId: string;
  misconceptionId?: string;
  leftDenom?: number;
  rightDenom?: number;
}) {
  return recordLearningEvent({
    eventId: `activity_started:${input.runId}`,
    eventType: "activity_started",
    source: "system",
    documentId: input.documentId,
    conceptId: input.conceptId,
    payload: {
      activityId: input.activityId,
      misconceptionId: input.misconceptionId ?? null,
      leftDenom: input.leftDenom ?? null,
      rightDenom: input.rightDenom ?? null,
      runId: input.runId,
    },
  });
}

export async function recordFractionVisualizationChanged(input: {
  documentId?: string;
  runId: string;
  side: "left" | "right";
  denominator: number;
  leftDenom: number;
  rightDenom: number;
}) {
  return recordLearningEvent({
    eventId: `fraction_visualization_changed:${input.runId}:${Date.now()}`,
    eventType: "fraction_visualization_changed",
    source: "system",
    documentId: input.documentId,
    conceptId: "unit_fraction_comparison",
    payload: {
      activityId: "fraction_comparison",
      side: input.side,
      denominator: input.denominator,
      leftDenom: input.leftDenom,
      rightDenom: input.rightDenom,
      runId: input.runId,
    },
  });
}

export async function recordAnswerSubmitted(input: {
  documentId?: string;
  runId: string;
  choice: string;
  correctChoice: string;
  isCorrect: boolean;
  leftDenom: number;
  rightDenom: number;
  attempt: number;
}) {
  return recordLearningEvent({
    eventId: `answer_submitted:${input.runId}:${input.attempt}`,
    eventType: "answer_submitted",
    source: "system",
    documentId: input.documentId,
    conceptId: "unit_fraction_comparison",
    payload: {
      activityId: "fraction_comparison",
      choice: input.choice,
      correctChoice: input.correctChoice,
      isCorrect: input.isCorrect,
      leftDenom: input.leftDenom,
      rightDenom: input.rightDenom,
      attempt: input.attempt,
      runId: input.runId,
    },
  });
}

/**
 * Idempotent completion for Journey "Play with an idea".
 * Opening the panel alone does not complete the destination.
 */
export async function recordActivityCompleted(input: {
  documentId?: string;
  runId: string;
  activityId: string;
  conceptId: string;
  misconceptionId?: string;
  leftDenom: number;
  rightDenom: number;
  correctChoice: string;
  attempts: number;
}): Promise<LearningEvent> {
  const documentId = input.documentId ?? DEFAULT_DOCUMENT_ID;
  const eventId = `activity_completed:${documentId}:${input.activityId}`;
  const db = getDB();
  const existing = await db.learningEvents.get(eventId);
  if (existing) return existing;

  return recordLearningEvent({
    eventId,
    eventType: "activity_completed",
    source: "system",
    documentId,
    conceptId: input.conceptId,
    payload: {
      activityId: input.activityId,
      misconceptionId: input.misconceptionId ?? null,
      leftDenom: input.leftDenom,
      rightDenom: input.rightDenom,
      correctChoice: input.correctChoice,
      attempts: input.attempts,
      runId: input.runId,
      mastered: false,
    },
  });
}

export async function recordTeachBackStarted(input: {
  documentId?: string;
  runId: string;
  conceptId: string;
  source?: string;
}) {
  return recordLearningEvent({
    eventId: `teachback_started:${input.runId}`,
    eventType: "teachback_started",
    source: "pip",
    documentId: input.documentId,
    conceptId: input.conceptId,
    payload: {
      runId: input.runId,
      source: input.source ?? null,
      mastered: false,
    },
  });
}

export async function recordTeachBackAttempted(input: {
  documentId?: string;
  runId: string;
  conceptId: string;
  result: string;
  rubric: Record<string, boolean>;
  evidence: string;
  attempts: number;
  followUpQuestion?: string | null;
  callId?: string;
}) {
  return recordLearningEvent({
    eventId: `teachback_attempted:${input.runId}:${input.attempts}`,
    eventType: "teachback_attempted",
    source: "ai_observation",
    documentId: input.documentId,
    conceptId: input.conceptId,
    payload: {
      runId: input.runId,
      result: input.result,
      rubric: input.rubric,
      evidence: input.evidence,
      attempts: input.attempts,
      followUpQuestion: input.followUpQuestion ?? null,
      callId: input.callId ?? null,
      mastered: false,
    },
  });
}

/**
 * Idempotent Journey completion for "Be the Teacher".
 * Only after rubric result is complete — not merely speaking.
 */
export async function recordTeachBackCompleted(input: {
  documentId?: string;
  runId: string;
  conceptId: string;
  rubric: Record<string, boolean>;
  evidence: string;
  attempts: number;
  callId?: string;
}): Promise<LearningEvent> {
  const documentId = input.documentId ?? DEFAULT_DOCUMENT_ID;
  const eventId = `teachback_completed:${documentId}:${input.conceptId}`;
  const db = getDB();
  const existing = await db.learningEvents.get(eventId);
  if (existing) return existing;

  return recordLearningEvent({
    eventId,
    eventType: "teachback_completed",
    source: "ai_observation",
    documentId,
    conceptId: input.conceptId,
    payload: {
      runId: input.runId,
      rubric: input.rubric,
      evidence: input.evidence,
      attempts: input.attempts,
      callId: input.callId ?? null,
      completedAt: Date.now(),
      mastered: false,
      independentMastery: false,
    },
  });
}

export async function recordMasteryCheckStarted(input: {
  documentId?: string;
  runId: string;
  conceptId: string;
  questionIds: string[];
  source?: string;
  assessmentType?: "baseline" | "post_learning";
}) {
  const assessmentType = input.assessmentType ?? "post_learning";
  return recordLearningEvent({
    eventId: `mastery_check_started:${input.runId}`,
    eventType: "mastery_check_started",
    source: "system",
    documentId: input.documentId,
    conceptId: input.conceptId,
    payload: {
      runId: input.runId,
      questionIds: input.questionIds,
      source: input.source ?? null,
      assessmentType,
      independent: true,
      assisted: false,
    },
  });
}

export async function recordMasteryCheckAnswered(input: {
  documentId?: string;
  runId: string;
  conceptId: string;
  questionId: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  assisted: boolean;
  index: number;
  assessmentType?: "baseline" | "post_learning";
}) {
  return recordLearningEvent({
    eventId: `mastery_check_answered:${input.runId}:${input.questionId}`,
    eventType: "mastery_check_answered",
    source: "system",
    documentId: input.documentId,
    conceptId: input.conceptId,
    payload: {
      runId: input.runId,
      questionId: input.questionId,
      studentAnswer: input.studentAnswer,
      correctAnswer: input.correctAnswer,
      isCorrect: input.isCorrect,
      assisted: input.assisted,
      index: input.index,
      assessmentType: input.assessmentType ?? "post_learning",
      timestamp: Date.now(),
    },
  });
}

/**
 * Persist a completed mastery assessment.
 * Baseline and post_learning use separate idempotent IDs.
 * Only independent post_learning unlocks Journey "Show your superpower".
 */
export async function recordMasteryCheckCompleted(input: {
  documentId?: string;
  runId: string;
  conceptId: string;
  scoreCorrect: number;
  scoreTotal: number;
  assisted: boolean;
  answers: Array<Record<string, unknown>>;
  assessmentType?: "baseline" | "post_learning";
  questionIds?: string[];
}): Promise<{ event: LearningEvent; created: boolean }> {
  const documentId = input.documentId ?? DEFAULT_DOCUMENT_ID;
  const assessmentType = input.assessmentType ?? "post_learning";
  const questionIds =
    input.questionIds ??
    input.answers
      .map((a) => String(a.questionId ?? ""))
      .filter(Boolean);

  const sharedPayload = {
    runId: input.runId,
    scoreCorrect: input.scoreCorrect,
    scoreTotal: input.scoreTotal,
    assessmentType,
    questionIds,
    answers: input.answers,
    permanentMastery: false,
    completedAt: Date.now(),
  };

  if (input.assisted) {
    const eventId = `mastery_check_completed_assisted:${assessmentType}:${input.runId}`;
    const event = await recordLearningEvent({
      eventId,
      eventType: "mastery_check_completed",
      source: "system",
      documentId,
      conceptId: input.conceptId,
      payload: {
        ...sharedPayload,
        assisted: true,
        independent: false,
      },
    });
    return { event, created: true };
  }

  const eventId =
    assessmentType === "baseline"
      ? `mastery_check_completed:baseline:${documentId}:${input.conceptId}`
      : `mastery_check_completed:${documentId}:${input.conceptId}`;

  const db = getDB();
  const existing = await db.learningEvents.get(eventId);
  if (existing) return { event: existing, created: false };

  const event = await recordLearningEvent({
    eventId,
    eventType: "mastery_check_completed",
    source: "system",
    documentId,
    conceptId: input.conceptId,
    payload: {
      ...sharedPayload,
      assisted: false,
      independent: true,
    },
  });
  return { event, created: true };
}
