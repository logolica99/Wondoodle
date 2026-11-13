"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { AdventureStep } from "@/types/adventure";
import { Button } from "@/components/ui/button";
import { useAdventureStore } from "@/store/adventureStore";
import { cn } from "@/lib/utils";

type AdventureJourneyMapProps = {
  title: string;
  storyline: string;
  originalGoal: string;
  steps: AdventureStep[];
  onSelect?: (stepId: string) => void;
};

/**
 * Minimal problem-first Journey for AI adventures.
 */
export function AdventureJourneyMap({
  title,
  steps,
}: AdventureJourneyMapProps) {
  const clearAdventure = useAdventureStore((s) => s.clearAdventure);
  const [clearing, setClearing] = useState(false);
  const visible = steps
    .filter((s) => s.status !== "skipped")
    .sort((a, b) => a.order - b.order);

  const active =
    visible.find((s) => s.status === "active") ?? visible[0] ?? null;
  const completed = visible.filter((s) => s.status === "completed");
  const upcoming = visible.filter(
    (s) => s.status !== "completed" && s.id !== active?.id
  );
  const multi = visible.length > 1;
  const activeIndex = active
    ? Math.max(0, visible.findIndex((s) => s.id === active.id))
    : 0;
  const adventureDone =
    visible.length > 0 && visible.every((s) => s.status === "completed");

  return (
    <section
      className="rounded-2xl border border-[#E8E0FF] bg-white p-4 shadow-soft sm:p-5"
      data-testid="adventure-journey-map"
    >
      <h2 className="font-display text-xl font-semibold leading-tight text-mc-ink sm:text-2xl">
        {title}
      </h2>

      {multi && !adventureDone ? (
        <p
          className="mt-1 text-xs font-semibold text-mc-ink/45"
          data-testid="adventure-progress-track"
        >
          {activeIndex + 1}/{visible.length}
        </p>
      ) : null}

      {active && !adventureDone ? (
        <div
          className="mt-3 rounded-xl bg-[#F6F3FF] px-3 py-2.5"
          data-testid="adventure-current-focus"
        >
          <p className="font-display text-base font-semibold text-mc-ink">
            {active.title}
          </p>
        </div>
      ) : null}

      {adventureDone ? (
        <p
          className="mt-3 text-sm font-semibold text-mc-ink/70"
          data-testid="adventure-complete-banner"
        >
          Done
        </p>
      ) : null}

      {completed.length > 0 ? (
        <ul className="mt-3 space-y-1" data-testid="adventure-completed-list">
          {completed.map((step) => (
            <li
              key={step.id}
              className="flex items-center gap-2 text-sm text-mc-ink/50"
            >
              <Check className="h-3.5 w-3.5 shrink-0 text-[#58D9B0]" strokeWidth={3} />
              <span className="min-w-0 truncate">{step.title}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {upcoming.length > 0 ? (
        <ul className="mt-2 space-y-1" data-testid="adventure-upcoming-list">
          {upcoming.map((step) => {
            const idx = visible.findIndex((s) => s.id === step.id);
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-2 text-sm text-mc-ink/35",
                  step.insertedByRevisionId && "text-[#C45A7A]/70"
                )}
              >
                <span className="w-3.5 shrink-0 text-center text-[11px] font-bold">
                  {idx + 1}
                </span>
                <span className="min-w-0 truncate">{step.title}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-4 space-y-2">
        <Link
          href="/learn?adventureStep=1"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#7357E8] px-4 text-sm font-bold text-white transition hover:bg-[#6346d4]"
          data-testid="adventure-open-canvas"
        >
          Canvas
        </Link>
        <Button
          variant="outline"
          className="w-full rounded-2xl border-mc-ink/15 text-mc-ink/55"
          disabled={clearing}
          data-testid="adventure-clear"
          onClick={() => {
            if (!window.confirm("Clear adventure?")) return;
            setClearing(true);
            void clearAdventure().finally(() => setClearing(false));
          }}
        >
          {clearing ? "…" : "Clear"}
        </Button>
      </div>
    </section>
  );
}
