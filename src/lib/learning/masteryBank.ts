import {
  compareUnitFractions,
  formatUnitFraction,
  type FractionCompareResult,
} from "./fractionMath";

/**
 * Fixed unit-fraction comparison bank for Independent Mastery Check.
 * Intentionally excludes the classic 1/3 vs 1/4 misconception demo pair.
 */

export type MasteryQuestion = {
  id: string;
  conceptId: "unit_fraction_comparison";
  leftDenom: number;
  rightDenom: number;
  prompt: string;
};

export const MASTERY_QUESTION_BANK: MasteryQuestion[] = [
  {
    id: "ufc-1-2-vs-1-5",
    conceptId: "unit_fraction_comparison",
    leftDenom: 2,
    rightDenom: 5,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-5-vs-1-2",
    conceptId: "unit_fraction_comparison",
    leftDenom: 5,
    rightDenom: 2,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-2-vs-1-2",
    conceptId: "unit_fraction_comparison",
    leftDenom: 2,
    rightDenom: 2,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-6-vs-1-3",
    conceptId: "unit_fraction_comparison",
    leftDenom: 6,
    rightDenom: 3,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-3-vs-1-6",
    conceptId: "unit_fraction_comparison",
    leftDenom: 3,
    rightDenom: 6,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-8-vs-1-2",
    conceptId: "unit_fraction_comparison",
    leftDenom: 8,
    rightDenom: 2,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-2-vs-1-8",
    conceptId: "unit_fraction_comparison",
    leftDenom: 2,
    rightDenom: 8,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-5-vs-1-5",
    conceptId: "unit_fraction_comparison",
    leftDenom: 5,
    rightDenom: 5,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-7-vs-1-4",
    conceptId: "unit_fraction_comparison",
    leftDenom: 7,
    rightDenom: 4,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-4-vs-1-7",
    conceptId: "unit_fraction_comparison",
    leftDenom: 4,
    rightDenom: 7,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-8-vs-1-5",
    conceptId: "unit_fraction_comparison",
    leftDenom: 8,
    rightDenom: 5,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-5-vs-1-8",
    conceptId: "unit_fraction_comparison",
    leftDenom: 5,
    rightDenom: 8,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-6-vs-1-6",
    conceptId: "unit_fraction_comparison",
    leftDenom: 6,
    rightDenom: 6,
    prompt: "Which is larger?",
  },
  {
    id: "ufc-1-7-vs-1-2",
    conceptId: "unit_fraction_comparison",
    leftDenom: 7,
    rightDenom: 2,
    prompt: "Which is larger?",
  },
];

export type MasteryChoice = FractionCompareResult;

export function correctChoiceForQuestion(
  q: MasteryQuestion
): MasteryChoice {
  return compareUnitFractions(q.leftDenom, q.rightDenom);
}

export function choiceLabel(
  choice: MasteryChoice,
  q: MasteryQuestion
): string {
  if (choice === "equal") return "Equal";
  if (choice === "left") return formatUnitFraction(q.leftDenom);
  return formatUnitFraction(q.rightDenom);
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/**
 * Pick 3 distinct questions, preferring a mix of left/right/equal answers.
 * Avoids IDs in `excludeIds` when enough alternatives remain.
 */
export function pickMasteryQuestions(
  excludeIds: string[] = [],
  count = 3
): MasteryQuestion[] {
  const excluded = new Set(excludeIds);
  let pool = MASTERY_QUESTION_BANK.filter((q) => !excluded.has(q.id));
  // Prefer non-excluded IDs; only fill from excluded when the bank is too small.
  if (pool.length < count) {
    const fill = MASTERY_QUESTION_BANK.filter((q) => excluded.has(q.id));
    pool = [...pool, ...fill];
  }

  const byResult: Record<MasteryChoice, MasteryQuestion[]> = {
    left: [],
    right: [],
    equal: [],
  };
  for (const q of shuffle(pool)) {
    byResult[correctChoiceForQuestion(q)].push(q);
  }

  const picked: MasteryQuestion[] = [];
  const order: MasteryChoice[] = shuffle(["left", "right", "equal"]);
  for (const kind of order) {
    const candidate = byResult[kind].find(
      (q) => !picked.some((p) => p.id === q.id)
    );
    if (candidate) picked.push(candidate);
    if (picked.length >= count) break;
  }

  if (picked.length < count) {
    for (const q of shuffle(pool)) {
      if (picked.some((p) => p.id === q.id)) continue;
      picked.push(q);
      if (picked.length >= count) break;
    }
  }

  return shuffle(picked).slice(0, count);
}

export function feedbackForScore(correct: number, total: number): string {
  if (correct >= total) {
    return "Amazing progress! You solved all three independently.";
  }
  if (correct === 2) {
    return "Nice work! You solved two on your own.";
  }
  return "You gave it a try! Let's explore together some more.";
}
