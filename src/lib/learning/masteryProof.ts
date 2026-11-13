import type { LearningEvent } from "@/types/learning";
import { MISCONCEPTION_META } from "./misconceptions";

export type AssessmentType = "baseline" | "post_learning";

export type MasteryScoreSnapshot = {
  assessmentType: AssessmentType;
  scoreCorrect: number;
  scoreTotal: number;
  percent: number;
  questionIds: string[];
  assisted: boolean;
  independent: boolean;
  sessionId: string;
  conceptId: string;
  runId: string;
  timestamp: number;
  eventId: string;
};

export type LearningProof = {
  conceptId: string;
  conceptLabel: string;
  baseline: MasteryScoreSnapshot | null;
  post: MasteryScoreSnapshot | null;
  /** Percentage-point change; null if either score missing. */
  deltaPoints: number | null;
  questionsAnswered: number;
  misconceptionLabel: string | null;
  activities: string[];
  message: string;
  nextStep: string;
};

function isIndependentMasteryCompletion(event: LearningEvent): boolean {
  if (event.eventType !== "mastery_check_completed") return false;
  if (event.payload.assisted === true) return false;
  if (event.payload.independent === false) return false;
  return true;
}

function snapshotFromEvent(event: LearningEvent): MasteryScoreSnapshot | null {
  if (!isIndependentMasteryCompletion(event)) return null;
  const scoreCorrect = Number(event.payload.scoreCorrect ?? 0);
  const scoreTotal = Math.max(1, Number(event.payload.scoreTotal ?? 3));
  const rawType = String(event.payload.assessmentType ?? "post_learning");
  const assessmentType: AssessmentType =
    rawType === "baseline" ? "baseline" : "post_learning";
  const answers = Array.isArray(event.payload.answers)
    ? (event.payload.answers as Array<{ questionId?: string }>)
    : [];
  const questionIds =
    (Array.isArray(event.payload.questionIds)
      ? (event.payload.questionIds as string[])
      : answers
          .map((a) => a.questionId)
          .filter((id): id is string => Boolean(id))) ?? [];

  return {
    assessmentType,
    scoreCorrect,
    scoreTotal,
    percent: Math.round((scoreCorrect / scoreTotal) * 100),
    questionIds,
    assisted: false,
    independent: true,
    sessionId: event.sessionId,
    conceptId: event.conceptId ?? "unit_fraction_comparison",
    runId: String(event.payload.runId ?? ""),
    timestamp: event.timestamp,
    eventId: event.eventId,
  };
}

function friendlyMessage(
  baseline: MasteryScoreSnapshot | null,
  post: MasteryScoreSnapshot | null
): string {
  if (!post) return "Finish your Superpower Challenge to see how you did.";
  if (!baseline) {
    return `You scored ${post.scoreCorrect}/${post.scoreTotal} on your own. Nice independent try!`;
  }
  const delta = post.percent - baseline.percent;
  if (delta > 0) {
    return `You grew about ${delta} points from before to after — that’s real progress with Pip!`;
  }
  if (delta === 0) {
    return `You stayed steady at ${post.scoreCorrect}/${post.scoreTotal}. Keep exploring with Pip.`;
  }
  return `This try was ${post.scoreCorrect}/${post.scoreTotal}. Let’s practice a little more together.`;
}

function nextStepFor(post: MasteryScoreSnapshot | null): string {
  if (!post) return "Take the Superpower Challenge when you’re ready.";
  if (post.scoreCorrect >= post.scoreTotal) {
    return "Celebrate, then try teaching a friend — or doodle a new fraction story.";
  }
  if (post.scoreCorrect >= 2) {
    return "Replay Fraction Playground or TeachBack for the trickier pieces.";
  }
  return "Visit Play with an idea, then try the challenge again.";
}

/**
 * Build before/after learning proof from persisted events.
 * Never invents a baseline of zero.
 */
export function deriveLearningProof(
  events: LearningEvent[],
  conceptId = "unit_fraction_comparison"
): LearningProof {
  const mastery = events
    .filter(
      (e) =>
        e.eventType === "mastery_check_completed" &&
        (e.conceptId === conceptId || !e.conceptId)
    )
    .map(snapshotFromEvent)
    .filter((s): s is MasteryScoreSnapshot => Boolean(s))
    .sort((a, b) => a.timestamp - b.timestamp);

  const baselines = mastery.filter((s) => s.assessmentType === "baseline");
  const posts = mastery.filter((s) => s.assessmentType === "post_learning");

  // Prefer same-session pair when possible; else latest of each.
  const baseline: MasteryScoreSnapshot | null = baselines.at(-1) ?? null;
  let post: MasteryScoreSnapshot | null = posts.at(-1) ?? null;
  if (baseline && posts.length) {
    const sameSession = posts
      .filter((p) => p.sessionId === baseline.sessionId)
      .at(-1);
    if (sameSession) post = sameSession;
  }

  const deltaPoints =
    baseline && post ? post.percent - baseline.percent : null;

  const misconception = events
    .filter(
      (e) =>
        e.eventType === "misconception_identified" &&
        e.payload.reviewed === true
    )
    .at(-1);
  const misconceptionId = String(
    misconception?.payload.misconceptionId ?? ""
  );
  const meta =
    misconceptionId && misconceptionId in MISCONCEPTION_META
      ? MISCONCEPTION_META[
          misconceptionId as keyof typeof MISCONCEPTION_META
        ]
      : null;

  const activities: string[] = [];
  if (events.some((e) => e.eventType === "activity_completed")) {
    activities.push("Fraction Playground");
  }
  if (events.some((e) => e.eventType === "teachback_completed")) {
    activities.push("TeachBack");
  }
  if (misconception) activities.unshift("Misconception Radar");

  const questionsAnswered =
    (baseline?.scoreTotal ?? 0) + (post?.scoreTotal ?? 0);

  return {
    conceptId,
    conceptLabel: "Comparing unit fractions",
    baseline,
    post,
    deltaPoints,
    questionsAnswered,
    misconceptionLabel: meta?.conceptLabel ?? null,
    activities,
    message: friendlyMessage(baseline, post),
    nextStep: nextStepFor(post),
  };
}

export function baselineQuestionIdsFromEvents(
  events: LearningEvent[],
  conceptId = "unit_fraction_comparison"
): string[] {
  const proof = deriveLearningProof(events, conceptId);
  return proof.baseline?.questionIds ?? [];
}

export function hasBaselineAssessment(
  events: LearningEvent[],
  conceptId = "unit_fraction_comparison"
): boolean {
  return Boolean(deriveLearningProof(events, conceptId).baseline);
}

export function hasPostLearningAssessment(
  events: LearningEvent[],
  conceptId = "unit_fraction_comparison"
): boolean {
  return Boolean(deriveLearningProof(events, conceptId).post);
}
