"use client";

import { motion, useReducedMotion } from "motion/react";
import type { LearningEvent } from "@/types/learning";
import { deriveLearningProof } from "@/lib/learning/masteryProof";
import { cn } from "@/lib/utils";

type LearningProofCardProps = {
  events: LearningEvent[];
};

/**
 * Compact before/after Learning Proof for My Journey.
 * Never invents a baseline; post-only when baseline is missing.
 */
export function LearningProofCard({ events }: LearningProofCardProps) {
  const reduceMotion = useReducedMotion();
  const proof = deriveLearningProof(events);

  if (!proof.post) return null;

  const hasBaseline = Boolean(proof.baseline);
  const delta = proof.deltaPoints;

  return (
    <motion.section
      className="rounded-2xl border border-[#E8E0FF] bg-white p-4 shadow-soft"
      data-testid="learning-proof-card"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-mc-ink/45">
            Learning proof
          </p>
          <h3 className="font-display text-lg font-semibold leading-tight text-mc-ink">
            {hasBaseline ? "Before & after" : "Superpower result"}
          </h3>
        </div>
        {delta !== null ? (
          <span
            className={cn(
              "shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold tabular-nums",
              delta > 0 && "bg-[#E8FBF4] text-emerald-700",
              delta === 0 && "bg-[#F3F0FF] text-mc-purple",
              delta < 0 && "bg-[#FFF0F5] text-[#C45A7A]"
            )}
            data-testid="learning-proof-delta"
          >
            {delta > 0 ? `+${delta}` : `${delta}`} pts
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-sm text-mc-ink/70">{proof.conceptLabel}</p>

      {hasBaseline && proof.baseline ? (
        <div
          className="mt-3 grid grid-cols-2 gap-3"
          data-testid="learning-proof-bars"
        >
          <ScoreBar
            label="Before"
            scoreCorrect={proof.baseline.scoreCorrect}
            scoreTotal={proof.baseline.scoreTotal}
            percent={proof.baseline.percent}
            tone="before"
          />
          <ScoreBar
            label="After"
            scoreCorrect={proof.post.scoreCorrect}
            scoreTotal={proof.post.scoreTotal}
            percent={proof.post.percent}
            tone="after"
          />
        </div>
      ) : (
        <div className="mt-3" data-testid="learning-proof-post-only">
          <ScoreBar
            label="Independent try"
            scoreCorrect={proof.post.scoreCorrect}
            scoreTotal={proof.post.scoreTotal}
            percent={proof.post.percent}
            tone="after"
          />
        </div>
      )}

      <p
        className="mt-3 text-sm font-semibold leading-snug text-mc-ink"
        data-testid="learning-proof-message"
      >
        {proof.message}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-mc-ink/65">
        <div>
          <dt className="font-semibold text-mc-ink/45">Questions</dt>
          <dd className="font-bold text-mc-ink" data-testid="learning-proof-q-count">
            {proof.questionsAnswered} independent
          </dd>
        </div>
        {proof.misconceptionLabel ? (
          <div>
            <dt className="font-semibold text-mc-ink/45">Focus</dt>
            <dd className="font-bold text-mc-ink">{proof.misconceptionLabel}</dd>
          </div>
        ) : null}
        {proof.activities.length ? (
          <div className="col-span-2">
            <dt className="font-semibold text-mc-ink/45">Activities</dt>
            <dd className="font-bold text-mc-ink">{proof.activities.join(" · ")}</dd>
          </div>
        ) : null}
      </dl>

      <p
        className="mt-3 rounded-xl bg-[#FAF9F6] px-3 py-2 text-xs leading-snug text-mc-ink/75"
        data-testid="learning-proof-next"
      >
        <span className="font-semibold text-mc-ink">Next: </span>
        {proof.nextStep}
      </p>
    </motion.section>
  );
}

function ScoreBar({
  label,
  scoreCorrect,
  scoreTotal,
  percent,
  tone,
}: {
  label: string;
  scoreCorrect: number;
  scoreTotal: number;
  percent: number;
  tone: "before" | "after";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-1">
        <span className="text-xs font-semibold text-mc-ink/55">{label}</span>
        <span className="font-display text-sm font-bold tabular-nums text-mc-ink">
          {scoreCorrect}/{scoreTotal}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-mc-ink/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${percent}%`}
      >
        <motion.div
          className={cn(
            "h-full rounded-full",
            tone === "before" ? "bg-[#A48CF3]" : "bg-[#58D9B0]"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1 text-[10px] font-semibold tabular-nums text-mc-ink/45">
        {percent}%
      </p>
    </div>
  );
}
