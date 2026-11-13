"use client";

import { Lightbulb, Minus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDiscoveryStore } from "@/store/discoveryStore";
import { useActivityStore } from "@/store/activityStore";
import { reviewDiscoveryObservation } from "@/lib/learning/observationHandler";
import { buildActivityRoute, isSupportedMisconception } from "@/lib/learning/misconceptions";
import { isImplementedActivity } from "@/store/activityStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Compact floating discovery card — does not block canvas tools, zoom, or Pip.
 */
export function DiscoveryCard() {
  const reduceMotion = useReducedMotion();
  const card = useDiscoveryStore((s) => s.card);
  const minimized = useDiscoveryStore((s) => s.minimized);
  const dismiss = useDiscoveryStore((s) => s.dismiss);
  const minimize = useDiscoveryStore((s) => s.minimize);
  const expand = useDiscoveryStore((s) => s.expand);
  const openFractionPlayground = useActivityStore(
    (s) => s.openFractionPlayground
  );

  const canOpenPlayground =
    !!card &&
    isImplementedActivity(card.activityId) &&
    (card.misconceptionId === "denominator_size" ||
      card.activityId === "fraction_comparison");

  const markReviewed = () => {
    if (card?.eventId) {
      void reviewDiscoveryObservation(card.eventId);
    }
  };

  const onDismiss = () => {
    markReviewed();
    dismiss();
  };

  const onMinimize = () => {
    markReviewed();
    minimize();
  };

  const onTryPlayground = () => {
    if (!card || !canOpenPlayground) return;
    markReviewed();
    const route = isSupportedMisconception(card.misconceptionId)
      ? buildActivityRoute(card.misconceptionId)
      : buildActivityRoute("denominator_size");
    openFractionPlayground(route);
    minimize();
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-40",
        // Clear of top bar, left toolbar, bottom zoom, and right-side Pip.
        "left-3 top-[4.75rem] max-w-[min(100%-1.5rem,20rem)] sm:left-4 sm:top-[5.25rem]",
        "md:left-[5.5rem]"
      )}
      data-testid="discovery-card-anchor"
    >
      <AnimatePresence mode="wait">
        {card && minimized ? (
          <motion.button
            key="chip"
            type="button"
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-mc-ink/10 bg-mc-white/95 px-3 py-2 text-sm font-medium text-mc-ink shadow-sm backdrop-blur-sm"
            onClick={expand}
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            aria-label="Show discovery tip"
          >
            <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />
            Discovery tip
          </motion.button>
        ) : null}

        {card && !minimized ? (
          <motion.aside
            key="card"
            role="status"
            aria-live="polite"
            className="pointer-events-auto rounded-2xl border border-mc-ink/10 bg-mc-white/95 p-3.5 shadow-md backdrop-blur-sm"
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            data-testid="discovery-card"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Lightbulb className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-mc-ink">
                    {card.heading}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      className="rounded-md p-1 text-mc-ink/45 hover:bg-mc-ink/5 hover:text-mc-ink"
                      onClick={onMinimize}
                      aria-label="Minimize discovery tip"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 text-mc-ink/45 hover:bg-mc-ink/5 hover:text-mc-ink"
                      onClick={onDismiss}
                      aria-label="Dismiss discovery tip"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs font-medium text-mc-ink/55">
                  {card.conceptLabel}
                </p>
                <p className="mt-2 text-sm leading-snug text-mc-ink/85">
                  {card.guidingQuestion}
                </p>
                {canOpenPlayground ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      className="w-full rounded-xl bg-mc-mint text-mc-ink hover:bg-mc-mint/90"
                      onClick={onTryPlayground}
                      data-testid="discovery-try-playground"
                    >
                      Try Fraction Playground
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2.5 text-xs text-mc-ink/50">
                    Idea for later: {card.activityLabel}
                  </p>
                )}
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
