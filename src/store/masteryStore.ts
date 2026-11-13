"use client";

import { create } from "zustand";
import {
  correctChoiceForQuestion,
  pickMasteryQuestions,
  type MasteryChoice,
  type MasteryQuestion,
} from "@/lib/learning/masteryBank";
import type { AssessmentType } from "@/lib/learning/masteryProof";

export type MasterySource = "teachback" | "journey" | "welcome" | "manual";

export type MasteryAnswerRecord = {
  questionId: string;
  leftDenom: number;
  rightDenom: number;
  studentAnswer: MasteryChoice | null;
  correctAnswer: MasteryChoice;
  isCorrect: boolean;
  assisted: boolean;
  answeredAt: number | null;
};

type MasteryStore = {
  open: boolean;
  runId: string | null;
  source: MasterySource | null;
  assessmentType: AssessmentType;
  conceptId: "unit_fraction_comparison";
  questions: MasteryQuestion[];
  index: number;
  answers: MasteryAnswerRecord[];
  /** True while independent assessment is active — blocks AI task hints. */
  independentMode: boolean;
  assisted: boolean;
  submitted: boolean;
  scoreCorrect: number;
  scoreTotal: number;
  lastUsedQuestionIds: string[];
  /** Baseline question IDs this session — excluded from post assessment. */
  baselineQuestionIds: string[];
  openMasteryCheck: (opts?: {
    source?: MasterySource;
    assessmentType?: AssessmentType;
    excludeIds?: string[];
  }) => string;
  closeMasteryCheck: () => void;
  /** Exit without recording completion (early leave / request help). */
  abandonMasteryCheck: () => void;
  selectAnswer: (choice: MasteryChoice) => void;
  goNext: () => void;
  requestAssistance: () => void;
  rememberBaselineQuestions: (ids: string[]) => void;
  submitChallenge: () => {
    scoreCorrect: number;
    scoreTotal: number;
    assisted: boolean;
    answers: MasteryAnswerRecord[];
    runId: string;
    assessmentType: AssessmentType;
    questionIds: string[];
  } | null;
};

function makeRunId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mastery-${Date.now()}`;
}

function recordsForQuestions(questions: MasteryQuestion[]): MasteryAnswerRecord[] {
  return questions.map((q) => ({
    questionId: q.id,
    leftDenom: q.leftDenom,
    rightDenom: q.rightDenom,
    studentAnswer: null,
    correctAnswer: correctChoiceForQuestion(q),
    isCorrect: false,
    assisted: false,
    answeredAt: null,
  }));
}

export const useMasteryStore = create<MasteryStore>((set, get) => ({
  open: false,
  runId: null,
  source: null,
  assessmentType: "post_learning",
  conceptId: "unit_fraction_comparison",
  questions: [],
  index: 0,
  answers: [],
  independentMode: false,
  assisted: false,
  submitted: false,
  scoreCorrect: 0,
  scoreTotal: 3,
  lastUsedQuestionIds: [],
  baselineQuestionIds: [],

  openMasteryCheck: (opts) => {
    const assessmentType = opts?.assessmentType ?? "post_learning";
    const exclude = [
      ...(opts?.excludeIds ?? []),
      ...(assessmentType === "post_learning" ? get().baselineQuestionIds : []),
      ...(opts?.excludeIds ? [] : get().lastUsedQuestionIds),
    ];
    // Deduplicate exclude list
    const excludeUnique = [...new Set(exclude)];
    const questions = pickMasteryQuestions(excludeUnique, 3);
    const runId = makeRunId();
    set({
      open: true,
      runId,
      source: opts?.source ?? "manual",
      assessmentType,
      questions,
      index: 0,
      answers: recordsForQuestions(questions),
      independentMode: true,
      assisted: false,
      submitted: false,
      scoreCorrect: 0,
      scoreTotal: questions.length,
      lastUsedQuestionIds: questions.map((q) => q.id),
    });
    return runId;
  },

  closeMasteryCheck: () =>
    set({
      open: false,
      independentMode: false,
      runId: null,
      source: null,
    }),

  abandonMasteryCheck: () =>
    set({
      open: false,
      independentMode: false,
      runId: null,
      source: null,
      submitted: false,
    }),

  selectAnswer: (choice) => {
    const state = get();
    if (!state.open || state.submitted || !state.independentMode) return;
    const idx = state.index;
    const answers = state.answers.map((a, i) => {
      if (i !== idx) return a;
      const isCorrect = choice === a.correctAnswer;
      return {
        ...a,
        studentAnswer: choice,
        isCorrect,
        assisted: state.assisted,
        answeredAt: Date.now(),
      };
    });
    set({ answers });
  },

  goNext: () => {
    const state = get();
    if (state.submitted) return;
    const current = state.answers[state.index];
    if (!current?.studentAnswer) return;
    if (state.index < state.questions.length - 1) {
      set({ index: state.index + 1 });
    }
  },

  requestAssistance: () => {
    set({ assisted: true, independentMode: false });
  },

  rememberBaselineQuestions: (ids) =>
    set({ baselineQuestionIds: [...new Set(ids.filter(Boolean))] }),

  submitChallenge: () => {
    const state = get();
    if (!state.open || state.submitted || !state.runId) return null;
    if (state.answers.some((a) => !a.studentAnswer)) return null;

    const scoreCorrect = state.answers.filter((a) => a.isCorrect).length;
    const scoreTotal = state.answers.length;
    const questionIds = state.questions.map((q) => q.id);
    if (state.assessmentType === "baseline" && !state.assisted) {
      set({ baselineQuestionIds: questionIds });
    }
    set({
      submitted: true,
      independentMode: false,
      scoreCorrect,
      scoreTotal,
    });
    return {
      scoreCorrect,
      scoreTotal,
      assisted: state.assisted,
      answers: state.answers,
      runId: state.runId,
      assessmentType: state.assessmentType,
      questionIds,
    };
  },
}));

export function isMasteryIndependentActive(): boolean {
  const s = useMasteryStore.getState();
  return s.open && s.independentMode && !s.submitted;
}
