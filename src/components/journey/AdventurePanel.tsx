"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Lightbulb,
  Lock,
  Mic,
  Pencil,
  Radar,
  Sparkles,
  Star,
} from "lucide-react";
import type {
  JourneyNodeState,
  LearningEvent,
  LearningSummary,
} from "@/types/learning";
import { Button } from "@/components/ui/button";
import { PipMascot } from "@/components/mascot/PipMascot";
import { LearningProofCard } from "@/components/journey/LearningProofCard";
import { labelForEventType } from "@/lib/learning/eventLabels";
import { cn } from "@/lib/utils";
import { hasPostLearningAssessment } from "@/lib/learning/masteryProof";

const icons = {
  pencil: Pencil,
  mic: Mic,
  radar: Radar,
  lesson: BookOpen,
  teach: Lightbulb,
  star: Star,
} as const;

type AdventurePanelProps = {
  selected: JourneyNodeState | null;
  summary: LearningSummary | null;
  events: LearningEvent[];
  hydrated: boolean;
};

export function AdventurePanel({
  selected,
  summary,
  events,
  hydrated,
}: AdventurePanelProps) {
  const reduceMotion = useReducedMotion();
  const empty = !summary || summary.eventCount === 0;
  const node = selected;
  const Icon = node ? icons[node.icon] : Sparkles;
  const pipMood = !node
    ? empty
      ? "idle"
      : "welcome"
    : node.status === "completed"
      ? "celebrate"
      : node.status === "coming_soon"
        ? "thinking"
        : "welcome";

  const showProof = hydrated && hasPostLearningAssessment(events);

  return (
    <div className="space-y-3">
      {showProof ? <LearningProofCard events={events} /> : null}

      <section
        className="rounded-2xl border border-[#E8E0FF] bg-white p-4 shadow-soft sm:p-5"
        data-testid="adventure-panel"
        aria-live="polite"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-lg font-semibold text-mc-ink">Now</p>
          <PipMascot mood={pipMood} size="sm" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={node?.id ?? (empty ? "empty" : "overview")}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {!hydrated ? (
              <p className="text-sm text-mc-ink/55">Loading your journey…</p>
            ) : node ? (
              <SelectedDestination node={node} Icon={Icon} events={events} />
            ) : empty ? (
              <EmptyAdventure />
            ) : (
              <Overview summary={summary!} events={events} />
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function actionButtonClass(node: JourneyNodeState) {
  if (node.id === "talk_with_pip") {
    return "w-full rounded-2xl bg-[#FF91B6] text-white hover:bg-[#f07aa3]";
  }
  return "w-full rounded-2xl bg-[#7357E8] text-white hover:bg-[#6346d4]";
}

function SelectedDestination({
  node,
  Icon,
  events,
}: {
  node: JourneyNodeState;
  Icon: React.ComponentType<{ className?: string }>;
  events: LearningEvent[];
}) {
  const isComingSoon = node.status === "coming_soon";
  const isCompleted = node.status === "completed";
  const canAct = Boolean(node.href) && !isComingSoon;

  return (
    <div className="space-y-3" data-testid="adventure-selected">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-soft",
            isComingSoon && "bg-[#E8F4FF] text-[#3D8FD9]",
            isCompleted && "bg-[#58D9B0] text-mc-ink",
            !isComingSoon &&
              !isCompleted &&
              node.id === "talk_with_pip" &&
              "bg-[#FF91B6] text-white",
            !isComingSoon &&
              !isCompleted &&
              node.id !== "talk_with_pip" &&
              "bg-[#7357E8] text-white"
          )}
          aria-hidden
        >
          {isComingSoon ? (
            <Lock className="h-4 w-4" />
          ) : isCompleted ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </span>
        <p className="font-display text-base font-semibold leading-tight text-mc-ink">
          {node.name}
        </p>
      </div>

      {canAct && (
        <Button
          asChild
          className={actionButtonClass(node)}
          data-testid={isCompleted ? "journey-revisit" : "journey-go"}
        >
          <Link href={node.href!}>
            {isCompleted ? "Again" : node.actionLabel}
          </Link>
        </Button>
      )}

      {isComingSoon && (
        <p
          className="text-sm font-semibold text-[#3D8FD9]"
          data-testid="journey-coming-soon"
        >
          Soon
        </p>
      )}

      {isCompleted && (
        <p
          className="text-sm font-semibold text-emerald-700"
          data-testid="journey-completed-detail"
        >
          Done
        </p>
      )}

      <DiscoveryLog events={events} />
    </div>
  );
}

function EmptyAdventure() {
  return (
    <div className="space-y-3" data-testid="lesson-summary-empty">
      <Button
        asChild
        className="w-full rounded-2xl bg-[#7357E8] text-white hover:bg-[#6346d4]"
        data-testid="summary-start-doodle"
      >
        <Link href="/learn">Canvas</Link>
      </Button>
    </div>
  );
}

function Overview({
  summary,
  events,
}: {
  summary: LearningSummary;
  events: LearningEvent[];
}) {
  return (
    <div className="space-y-3" data-testid="lesson-summary-content">
      {summary.nextActivity?.href ? (
        <Button
          asChild
          className="w-full rounded-2xl bg-[#7357E8] text-white hover:bg-[#6346d4]"
          data-testid="summary-next-activity"
        >
          <Link href={summary.nextActivity.href}>
            {summary.nextActivity.name}
          </Link>
        </Button>
      ) : null}
      <DiscoveryLog events={events} />
    </div>
  );
}

function DiscoveryLog({ events }: { events: LearningEvent[] }) {
  const [open, setOpen] = useState(false);
  const entries = events
    .filter((event) => event.eventType !== "journey_opened")
    .slice(-5)
    .reverse();

  if (!entries.length) return null;

  return (
    <div className="border-t border-[#E8E0FF] pt-3" data-testid="discovery-log">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-xl py-1 text-left text-sm font-semibold text-mc-ink/60 transition hover:text-mc-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7357E8]/25"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="discovery-log-toggle"
      >
        Log
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {entries.map((event) => (
            <li
              key={event.eventId}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate text-mc-ink/80">
                {labelForEventType(event.eventType)}
              </span>
              <time
                className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-mc-ink/40"
                dateTime={new Date(event.timestamp).toISOString()}
              >
                {formatCompactTime(event.timestamp)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatCompactTime(timestamp: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}
