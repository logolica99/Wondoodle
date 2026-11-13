"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useAdventureStore } from "@/store/adventureStore";

/**
 * Planning / error toasts on canvas. Success starts the step in-place.
 */
export function AdventureReadyToast() {
  const reduceMotion = useReducedMotion();
  const createBusy = useAdventureStore((s) => s.createBusy);
  const createError = useAdventureStore((s) => s.createError);
  const clearCreateError = useAdventureStore((s) => s.clearCreateError);

  return (
    <AnimatePresence>
      {createBusy ? (
        <motion.div
          className="pointer-events-auto absolute bottom-[6.5rem] left-1/2 z-[42] w-[min(92vw,18rem)] -translate-x-1/2 sm:bottom-8"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
          data-testid="adventure-planning-toast"
        >
          <div className="rounded-2xl border border-[#E8E0FF] bg-white/95 px-4 py-2.5 text-sm font-semibold text-mc-ink shadow-float backdrop-blur-sm">
            Planning…
          </div>
        </motion.div>
      ) : null}

      {createError && !createBusy ? (
        <motion.div
          className="pointer-events-auto absolute bottom-[6.5rem] left-1/2 z-[42] w-[min(92vw,18rem)] -translate-x-1/2 sm:bottom-8"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
          data-testid="adventure-error-toast"
        >
          <div className="flex items-start gap-2 rounded-2xl border border-[#FF91B6]/40 bg-[#FFF0F5] px-3 py-2.5 shadow-float">
            <p className="min-w-0 flex-1 text-sm text-[#C45A7A]">{createError}</p>
            <button
              type="button"
              className="rounded-lg p-1 text-mc-ink/40 hover:bg-black/5"
              onClick={clearCreateError}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
