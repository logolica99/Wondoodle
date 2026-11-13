"use client";

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { VoiceNote, VoiceNoteAnchor } from "@/types/voice";
import { useCanvasStore } from "@/store/canvasStore";

type SessionAudio = {
  blob: Blob;
  objectUrl: string;
  mimeType: string;
};

type VoiceUiPhase =
  | "closed"
  | "idle"
  | "recording"
  | "transcribing"
  | "review"
  | "error";

type VoiceStore = {
  panelOpen: boolean;
  phase: VoiceUiPhase;
  activeNoteId: string | null;
  draftAnchor: VoiceNoteAnchor | null;
  draftDurationMs: number;
  draftOriginal: string;
  draftEdited: string;
  errorMessage: string | null;
  isTranscribing: boolean;
  sessionAudio: Record<string, SessionAudio>;

  openPanel: (anchor?: VoiceNoteAnchor) => void;
  closePanel: () => void;
  openNote: (noteId: string) => void;
  setPhase: (phase: VoiceUiPhase) => void;
  setDraftEdited: (text: string) => void;
  setError: (message: string | null) => void;
  setTranscribing: (value: boolean) => void;
  setDraftDuration: (ms: number) => void;
  beginReview: (payload: {
    original: string;
    durationMs: number;
    audioBlob: Blob;
    mimeType: string;
  }) => void;
  saveActiveNote: () => void;
  deleteActiveNote: () => void;
  discardDraft: () => void;
  attachSessionAudio: (noteId: string, blob: Blob, mimeType: string) => void;
  clearSessionAudio: (noteId: string) => void;
  getSessionAudioUrl: (noteId: string) => string | null;
};

function resolveDefaultAnchor(): VoiceNoteAnchor {
  const { selectedId, document } = useCanvasStore.getState();
  if (selectedId && document.objects.some((o) => o.id === selectedId)) {
    return { type: "object", objectId: selectedId };
  }
  // Viewport-center association in world coords is applied by caller when known;
  // fallback point near origin keeps the note recoverable.
  return { type: "point", x: 120, y: 120 };
}

function upsertVoiceNote(note: VoiceNote) {
  const store = useCanvasStore.getState();
  const doc = structuredClone(store.document);
  const list = doc.voiceNotes ?? [];
  const index = list.findIndex((n) => n.id === note.id);
  if (index >= 0) list[index] = note;
  else list.push(note);
  doc.voiceNotes = list;
  doc.updatedAt = Date.now();
  useCanvasStore.setState({ document: doc });
  // Trigger existing autosave path
  void store.flushSave();
}

function removeVoiceNote(noteId: string) {
  const store = useCanvasStore.getState();
  const doc = structuredClone(store.document);
  doc.voiceNotes = (doc.voiceNotes ?? []).filter((n) => n.id !== noteId);
  doc.updatedAt = Date.now();
  useCanvasStore.setState({ document: doc });
  void store.flushSave();
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  panelOpen: false,
  phase: "closed",
  activeNoteId: null,
  draftAnchor: null,
  draftDurationMs: 0,
  draftOriginal: "",
  draftEdited: "",
  errorMessage: null,
  isTranscribing: false,
  sessionAudio: {},

  openPanel: (anchor) =>
    set({
      panelOpen: true,
      phase: "idle",
      activeNoteId: null,
      draftAnchor: anchor ?? resolveDefaultAnchor(),
      draftDurationMs: 0,
      draftOriginal: "",
      draftEdited: "",
      errorMessage: null,
      isTranscribing: false,
    }),

  closePanel: () =>
    set({
      panelOpen: false,
      phase: "closed",
      activeNoteId: null,
      errorMessage: null,
      isTranscribing: false,
    }),

  openNote: (noteId) => {
    const note = useCanvasStore
      .getState()
      .document.voiceNotes?.find((n) => n.id === noteId);
    if (!note) return;
    set({
      panelOpen: true,
      phase: "review",
      activeNoteId: note.id,
      draftAnchor: note.anchor,
      draftDurationMs: note.durationMs,
      draftOriginal: note.originalTranscript,
      draftEdited: note.editedTranscript,
      errorMessage: null,
      isTranscribing: false,
    });
  },

  setPhase: (phase) => set({ phase }),
  setDraftEdited: (draftEdited) => set({ draftEdited }),
  setError: (errorMessage) => set({ errorMessage, phase: errorMessage ? "error" : get().phase }),
  setTranscribing: (isTranscribing) => set({ isTranscribing }),
  setDraftDuration: (draftDurationMs) => set({ draftDurationMs }),

  beginReview: ({ original, durationMs, audioBlob, mimeType }) => {
    const noteId = get().activeNoteId ?? uuidv4();
    get().attachSessionAudio(noteId, audioBlob, mimeType);
    set({
      activeNoteId: noteId,
      draftOriginal: original,
      draftEdited: original,
      draftDurationMs: durationMs,
      phase: "review",
      isTranscribing: false,
      errorMessage: null,
      panelOpen: true,
    });
  },

  saveActiveNote: () => {
    const state = get();
    const docId = useCanvasStore.getState().document.id;
    const noteId = state.activeNoteId ?? uuidv4();
    const now = Date.now();
    const existing = useCanvasStore
      .getState()
      .document.voiceNotes?.find((n) => n.id === noteId);

    const note: VoiceNote = {
      id: noteId,
      documentId: docId,
      anchor: state.draftAnchor ?? resolveDefaultAnchor(),
      originalTranscript: state.draftOriginal,
      editedTranscript: state.draftEdited.trim() || state.draftOriginal,
      durationMs: state.draftDurationMs,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      status: "saved",
      audioMimeType: null,
    };
    upsertVoiceNote(note);
    set({
      activeNoteId: noteId,
      phase: "review",
      panelOpen: true,
    });
  },

  deleteActiveNote: () => {
    const noteId = get().activeNoteId;
    if (noteId) {
      removeVoiceNote(noteId);
      get().clearSessionAudio(noteId);
    }
    get().discardDraft();
    get().closePanel();
  },

  discardDraft: () => {
    const noteId = get().activeNoteId;
    if (noteId) get().clearSessionAudio(noteId);
    set({
      activeNoteId: null,
      draftOriginal: "",
      draftEdited: "",
      draftDurationMs: 0,
      errorMessage: null,
      isTranscribing: false,
      phase: "idle",
    });
  },

  attachSessionAudio: (noteId, blob, mimeType) => {
    const prev = get().sessionAudio[noteId];
    if (prev) URL.revokeObjectURL(prev.objectUrl);
    const objectUrl = URL.createObjectURL(blob);
    set({
      sessionAudio: {
        ...get().sessionAudio,
        [noteId]: { blob, objectUrl, mimeType },
      },
    });
  },

  clearSessionAudio: (noteId) => {
    const prev = get().sessionAudio[noteId];
    if (prev) URL.revokeObjectURL(prev.objectUrl);
    const next = { ...get().sessionAudio };
    delete next[noteId];
    set({ sessionAudio: next });
  },

  getSessionAudioUrl: (noteId) => get().sessionAudio[noteId]?.objectUrl ?? null,
}));

/** When an object is deleted, unanchor its notes instead of deleting explanations. */
export function unanchorNotesForObject(objectId: string) {
  const store = useCanvasStore.getState();
  const doc = structuredClone(store.document);
  let changed = false;
  doc.voiceNotes = (doc.voiceNotes ?? []).map((note) => {
    if (note.anchor.type === "object" && note.anchor.objectId === objectId) {
      changed = true;
      return {
        ...note,
        anchor: { type: "unanchored" as const },
        updatedAt: Date.now(),
      };
    }
    return note;
  });
  if (!changed) return;
  doc.updatedAt = Date.now();
  useCanvasStore.setState({ document: doc });
  void store.flushSave();
}
