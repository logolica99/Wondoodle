import Dexie, { type Table } from "dexie";
import {
  CanvasDocument,
  DEFAULT_DOCUMENT_ID,
  DOCUMENT_SCHEMA_VERSION,
} from "@/types/canvas";
import { createEmptyDocument } from "./document";
import type { VoiceNote } from "@/types/voice";
import type { LearningEvent } from "@/types/learning";
import type {
  AdventureEvidence,
  AdventureRevision,
  AdventureStep,
  CanvasSnapshotRecord,
  LearningAdventure,
} from "@/types/adventure";

export type DocumentRecord = {
  id: string;
  schemaVersion: number;
  title: string;
  data: CanvasDocument;
  updatedAt: number;
};

class WondoodleDB extends Dexie {
  documents!: Table<DocumentRecord, string>;
  learningEvents!: Table<LearningEvent, string>;
  learningAdventures!: Table<LearningAdventure, string>;
  adventureSteps!: Table<AdventureStep, string>;
  adventureRevisions!: Table<AdventureRevision, string>;
  adventureEvidence!: Table<AdventureEvidence, string>;
  canvasSnapshots!: Table<CanvasSnapshotRecord, string>;

  constructor() {
    super("WondoodleDB");
    this.version(1).stores({
      documents: "id, updatedAt, schemaVersion",
    });
    // v2 keeps the same IndexedDB store shape; voice notes live inside document JSON.
    this.version(2).stores({
      documents: "id, updatedAt, schemaVersion",
    });
    // v3 adds typed learning events for Journey progress (no raw audio).
    this.version(3).stores({
      documents: "id, updatedAt, schemaVersion",
      learningEvents:
        "eventId, sessionId, documentId, conceptId, eventType, timestamp",
    });
    // v4 — Adaptive Canvas-to-Adventure entities (preserves v3 learningEvents).
    this.version(4).stores({
      documents: "id, updatedAt, schemaVersion",
      learningEvents:
        "eventId, sessionId, documentId, conceptId, eventType, timestamp",
      learningAdventures: "id, documentId, sessionId, status, updatedAt",
      adventureSteps: "id, adventureId, order, status",
      adventureRevisions: "id, adventureId, createdAt",
      adventureEvidence: "id, adventureId, stepId, createdAt",
      canvasSnapshots: "id, documentId, adventureId, createdAt",
    });
  }
}

let dbInstance: WondoodleDB | null = null;

export function getDB(): WondoodleDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbInstance) {
    dbInstance = new WondoodleDB();
  }
  return dbInstance;
}

export async function loadDocument(
  id: string = DEFAULT_DOCUMENT_ID
): Promise<CanvasDocument> {
  const db = getDB();
  const record = await db.documents.get(id);
  if (!record) {
    return createEmptyDocument(id);
  }
  return migrateDocument(record.data);
}

export async function saveDocument(doc: CanvasDocument): Promise<void> {
  const db = getDB();
  // Never persist session-only audio fields.
  const sanitized: CanvasDocument = {
    ...doc,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    voiceNotes: (doc.voiceNotes ?? []).map(sanitizeVoiceNote),
  };
  const record: DocumentRecord = {
    id: sanitized.id,
    schemaVersion: sanitized.schemaVersion,
    title: sanitized.title,
    data: sanitized,
    updatedAt: Date.now(),
  };
  await db.documents.put(record);
}

export async function deleteDocument(
  id: string = DEFAULT_DOCUMENT_ID
): Promise<void> {
  const db = getDB();
  await db.documents.delete(id);
}

function sanitizeVoiceNote(note: VoiceNote): VoiceNote {
  return {
    id: note.id,
    documentId: note.documentId,
    anchor: note.anchor,
    originalTranscript: note.originalTranscript,
    editedTranscript: note.editedTranscript,
    durationMs: note.durationMs,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    status: note.status,
    audioMimeType: null,
  };
}

export function migrateDocument(doc: CanvasDocument): CanvasDocument {
  const voiceNotes = Array.isArray(
    (doc as CanvasDocument & { voiceNotes?: VoiceNote[] }).voiceNotes
  )
    ? (doc as CanvasDocument).voiceNotes.map(sanitizeVoiceNote)
    : [];

  return {
    ...doc,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    voiceNotes,
  };
}

export function createDebouncedSaver(
  saveFn: (doc: CanvasDocument) => Promise<void>,
  delayMs = 500
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: CanvasDocument | null = null;
  let inFlight: Promise<void> | null = null;

  const flush = async () => {
    if (!pending) return;
    const doc = pending;
    pending = null;
    inFlight = saveFn(doc).finally(() => {
      inFlight = null;
      if (pending) {
        void flush();
      }
    });
    await inFlight;
  };

  return {
    schedule(doc: CanvasDocument) {
      pending = doc;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, delayMs);
    },
    async flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (inFlight) await inFlight;
      await flush();
    },
  };
}
