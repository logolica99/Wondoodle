"use client";

import { create } from "zustand";
import {
  TEACHBACK_STARTING_QUESTION,
  feedbackForResult,
  type TeachBackConceptId,
  type TeachBackResult,
  type TeachBackRubric,
} from "@/lib/learning/teachback";

export type TeachBackSource = "playground" | "journey" | "manual";

export type TeachBackUiStatus =
  | "ready"
  | "listening"
  | "assessing"
  | "developing"
  | "unclear"
  | "complete";

type TeachBackStore = {
  open: boolean;
  conceptId: TeachBackConceptId;
  runId: string | null;
  source: TeachBackSource | null;
  question: string;
  status: TeachBackUiStatus;
  feedback: string | null;
  followUpQuestion: string | null;
  attempts: number;
  lastRubric: TeachBackRubric | null;
  completed: boolean;
  /** Child pressed Let's teach Pip — voice should be linked. */
  voiceArmed: boolean;
  openTeachBack: (opts?: {
    conceptId?: TeachBackConceptId;
    source?: TeachBackSource;
  }) => string;
  closeTeachBack: () => void;
  setStatus: (status: TeachBackUiStatus) => void;
  armVoice: () => void;
  applyAssessment: (input: {
    result: TeachBackResult;
    rubric: TeachBackRubric;
    followUpQuestion: string | null;
  }) => void;
  resetForRetry: () => void;
};

function makeRunId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `teachback-${Date.now()}`;
}

export const useTeachBackStore = create<TeachBackStore>((set, get) => ({
  open: false,
  conceptId: "unit_fraction_comparison",
  runId: null,
  source: null,
  question: TEACHBACK_STARTING_QUESTION.unit_fraction_comparison,
  status: "ready",
  feedback: null,
  followUpQuestion: null,
  attempts: 0,
  lastRubric: null,
  completed: false,
  voiceArmed: false,
  openTeachBack: (opts) => {
    const conceptId = opts?.conceptId ?? "unit_fraction_comparison";
    const runId = makeRunId();
    set({
      open: true,
      conceptId,
      runId,
      source: opts?.source ?? "manual",
      question: TEACHBACK_STARTING_QUESTION[conceptId],
      status: "ready",
      feedback: null,
      followUpQuestion: null,
      attempts: 0,
      lastRubric: null,
      completed: false,
      voiceArmed: false,
    });
    return runId;
  },
  closeTeachBack: () =>
    set({
      open: false,
      runId: null,
      source: null,
      status: "ready",
      feedback: null,
      followUpQuestion: null,
      voiceArmed: false,
    }),
  setStatus: (status) => set({ status }),
  armVoice: () => set({ voiceArmed: true, status: "listening" }),
  applyAssessment: (input) => {
    if (get().completed) return;
    const attempts = get().attempts + 1;
    const feedback = feedbackForResult(input.result);
    if (input.result === "complete") {
      set({
        attempts,
        lastRubric: input.rubric,
        status: "complete",
        feedback,
        followUpQuestion: null,
        completed: true,
        question: get().question,
      });
      return;
    }
    const nextQuestion =
      input.followUpQuestion?.trim() ||
      "What happens to each piece when we cut the same whole into more equal parts?";
    set({
      attempts,
      lastRubric: input.rubric,
      status: input.result === "developing" ? "developing" : "unclear",
      feedback,
      followUpQuestion: nextQuestion,
      question: nextQuestion,
      completed: false,
    });
  },
  resetForRetry: () => {
    const conceptId = get().conceptId;
    set({
      status: "listening",
      feedback: null,
      followUpQuestion: null,
      question: TEACHBACK_STARTING_QUESTION[conceptId],
      voiceArmed: true,
      // keep attempts + runId so we don't duplicate started event
    });
  },
}));
