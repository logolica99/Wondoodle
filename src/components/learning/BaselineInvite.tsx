"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BaselineInviteProps = {
  open: boolean;
  onStart: () => void;
  onSkip: () => void;
};

/**
 * Explicit start gate for the independent baseline check.
 * No questions, hints, or scoring until the child begins.
 */
export function BaselineInvite({ open, onStart, onSkip }: BaselineInviteProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            "pointer-events-none absolute z-[36]",
            "left-3 right-3 top-[4.35rem]",
            "sm:left-[5.25rem] sm:right-[min(42vw,17rem)] sm:max-w-[24rem]",
            "md:right-auto md:w-[min(42vw,24rem)]"
          )}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          data-testid="baseline-invite-anchor"
        >
          <aside
            className={cn(
              "pointer-events-auto overflow-hidden rounded-3xl border border-mc-ink/10 bg-mc-white/95 shadow-float backdrop-blur-sm"
            )}
            role="dialog"
            aria-label="Quick check before learning"
            data-testid="baseline-invite"
          >
            <header className="flex items-start justify-between gap-2 border-b border-mc-ink/8 bg-gradient-to-br from-mc-yellow-soft via-mc-white to-mc-pink-soft px-3 py-2.5 sm:px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mc-ink/50 sm:text-xs">
                  Before we learn
                </p>
                <h2 className="font-display text-base font-bold leading-tight text-mc-ink sm:text-lg">
                  Quick check!
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-mc-ink/45 hover:bg-mc-ink/5 hover:text-mc-ink"
                onClick={onSkip}
                aria-label="Skip quick check"
                data-testid="baseline-invite-close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-3 p-3 sm:p-4">
              <p className="text-sm leading-snug text-mc-ink/80">
                Three short questions on your own — no hints, no tricks. Then we
                learn with Pip and see how you grow!
              </p>
              <ul className="space-y-1.5 text-xs font-semibold text-mc-ink/65">
                <li className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-mc-pink"
                    aria-hidden
                  />
                  Independent try
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-mc-purple"
                    aria-hidden
                  />
                  Score after you finish
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-mc-mint"
                    aria-hidden
                  />
                  Compare later in My Journey
                </li>
              </ul>
            </div>

            <div className="space-y-2 border-t border-mc-ink/8 p-3">
              <Button
                className="w-full rounded-2xl bg-mc-purple text-white hover:bg-mc-purple/90"
                onClick={onStart}
                data-testid="baseline-invite-start"
              >
                Start my quick check
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={onSkip}
                data-testid="baseline-invite-skip"
              >
                Skip for now
              </Button>
            </div>
          </aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
