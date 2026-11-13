import { DEFAULT_DOCUMENT_ID } from "@/types/canvas";
import type {
  LearningEvent,
  LearningEventPayload,
  LearningEventSource,
  LearningEventType,
  LearningSummary,
} from "@/types/learning";
import { getDB } from "@/lib/canvas/storage";
import { getOrCreateSessionId } from "./session";
import {
  discoveryForEvent,
  evidenceForEvent,
  labelForEventType,
} from "./eventLabels";
import { JOURNEY_DESTINATIONS } from "./journeyConfig";
import { deriveCompletedFeatures } from "./journeyState";

export type RecordLearningEventInput = {
  /** Stable id for idempotency. Duplicates are ignored. */
  eventId: string;
  eventType: LearningEventType;
  source: LearningEventSource;
  documentId?: string;
  conceptId?: string | null;
  payload?: LearningEventPayload;
  sessionId?: string;
  timestamp?: number;
};

/**
 * Persist a learning event. Never stores raw audio.
 * Returns the stored event (existing or newly written).
 */
export async function recordLearningEvent(
  input: RecordLearningEventInput
): Promise<LearningEvent> {
  const db = getDB();
  const existing = await db.learningEvents.get(input.eventId);
  if (existing) return existing;

  const event: LearningEvent = {
    eventId: input.eventId,
    sessionId: input.sessionId ?? getOrCreateSessionId(),
    documentId: input.documentId ?? DEFAULT_DOCUMENT_ID,
    conceptId: input.conceptId ?? null,
    eventType: input.eventType,
    payload: sanitizePayload(input.payload ?? {}),
    timestamp: input.timestamp ?? Date.now(),
    source: input.source,
  };

  await db.learningEvents.put(event);
  return event;
}

export async function getSessionEvents(
  sessionId?: string
): Promise<LearningEvent[]> {
  const db = getDB();
  const id = sessionId ?? getOrCreateSessionId();
  const rows = await db.learningEvents.where("sessionId").equals(id).toArray();
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getConceptEvents(
  conceptId: string
): Promise<LearningEvent[]> {
  const db = getDB();
  const rows = await db.learningEvents
    .where("conceptId")
    .equals(conceptId)
    .toArray();
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getAllLearningEvents(): Promise<LearningEvent[]> {
  const db = getDB();
  const rows = await db.learningEvents.toArray();
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getLearningSummary(
  documentId: string = DEFAULT_DOCUMENT_ID
): Promise<LearningSummary> {
  const db = getDB();
  const events = (
    await db.learningEvents.where("documentId").equals(documentId).toArray()
  ).sort((a, b) => a.timestamp - b.timestamp);

  // Opening the journey map is telemetry, not student learning progress.
  const progressEvents = events.filter((e) => e.eventType !== "journey_opened");

  const completed = deriveCompletedFeatures(progressEvents);
  const last = progressEvents.length
    ? progressEvents[progressEvents.length - 1]
    : null;

  const tried = unique(
    progressEvents.map((e) => labelForEventType(e.eventType))
  ).slice(-6);

  const discovered = unique(
    progressEvents
      .map((e) => discoveryForEvent(e))
      .filter((v): v is string => Boolean(v))
  ).slice(-4);

  const evidence = unique(
    progressEvents
      .map((e) => evidenceForEvent(e))
      .filter((v): v is string => Boolean(v))
  ).slice(-4);

  const next = JOURNEY_DESTINATIONS.find(
    (d) => d.availability === "available" && !completed.has(d.id)
  );

  return {
    currentConcept: last?.conceptId ?? null,
    lastActivity: last
      ? {
          label: labelForEventType(last.eventType),
          eventType: last.eventType,
          timestamp: last.timestamp,
        }
      : null,
    tried,
    discovered,
    evidence,
    nextActivity: next
      ? { id: next.id, name: next.name, href: next.href }
      : null,
    completedFeatureIds: [...completed],
    eventCount: progressEvents.length,
  };
}

function sanitizePayload(payload: LearningEventPayload): LearningEventPayload {
  const next: LearningEventPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/audio|blob|base64|transcript_raw/i.test(key)) continue;
    if (typeof value === "string" && value.startsWith("data:audio")) continue;
    next[key] = value;
  }
  return next;
}

function unique(items: string[]) {
  return [...new Set(items)];
}
