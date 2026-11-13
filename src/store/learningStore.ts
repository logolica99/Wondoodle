"use client";

import { create } from "zustand";
import { DEFAULT_DOCUMENT_ID } from "@/types/canvas";
import type {
  JourneyNodeState,
  LearningEvent,
  LearningSummary,
} from "@/types/learning";
import {
  getAllLearningEvents,
  getLearningSummary,
  recordLearningEvent as persistEvent,
  type RecordLearningEventInput,
} from "@/lib/learning/events";
import { deriveJourneyNodes } from "@/lib/learning/journeyState";

export type { RecordLearningEventInput };

type LearningStore = {
  hydrated: boolean;
  events: LearningEvent[];
  nodes: JourneyNodeState[];
  summary: LearningSummary | null;
  hydrate: (documentId?: string) => Promise<void>;
  record: (input: RecordLearningEventInput) => Promise<LearningEvent>;
  refreshSummary: (documentId?: string) => Promise<void>;
};

const emptySummary = (): LearningSummary => ({
  currentConcept: null,
  lastActivity: null,
  tried: [],
  discovered: [],
  evidence: [],
  nextActivity: null,
  completedFeatureIds: [],
  eventCount: 0,
});

export const useLearningStore = create<LearningStore>((set, get) => ({
  hydrated: false,
  events: [],
  nodes: deriveJourneyNodes([]),
  summary: null,

  hydrate: async (documentId = DEFAULT_DOCUMENT_ID) => {
    try {
      const events = await getAllLearningEvents();
      const summary = await getLearningSummary(documentId);
      set({
        hydrated: true,
        events,
        nodes: deriveJourneyNodes(events),
        summary,
      });
    } catch {
      set({
        hydrated: true,
        events: [],
        nodes: deriveJourneyNodes([]),
        summary: emptySummary(),
      });
    }
  },

  record: async (input) => {
    const event = await persistEvent(input);
    const events = await getAllLearningEvents();
    const summary = await getLearningSummary(
      input.documentId ?? DEFAULT_DOCUMENT_ID
    );
    set({
      events,
      nodes: deriveJourneyNodes(events),
      summary,
      hydrated: true,
    });
    return event;
  },

  refreshSummary: async (documentId = DEFAULT_DOCUMENT_ID) => {
    const summary = await getLearningSummary(documentId);
    set({ summary, nodes: deriveJourneyNodes(get().events) });
  },
}));
