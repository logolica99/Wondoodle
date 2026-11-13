"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { copy } from "@/lib/design-tokens";

function SparkSketch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      aria-hidden
      data-testid="empty-state-illustration"
    >
      <rect
        x="18"
        y="14"
        width="124"
        height="92"
        rx="18"
        fill="#FFFFFF"
        stroke="#E8E0FF"
        strokeWidth="3"
      />
      <path
        d="M42 78 C58 42, 78 42, 92 62 S118 88, 128 54"
        fill="none"
        stroke="#7357E8"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="48" cy="40" r="7" fill="#FF91B6" />
      <circle cx="118" cy="36" r="5" fill="#FFD66D" />
      <circle cx="104" cy="78" r="6" fill="#58D9B0" />
      <path
        d="M34 28 h18 M34 34 h12"
        stroke="#76B8FF"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CanvasEmptyState({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4"
          data-testid="canvas-empty-state"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.22 } }}
          transition={{ duration: 0.35 }}
        >
          <div className="max-w-sm rounded-[1.75rem] border border-white/90 bg-white/85 px-6 py-5 text-center shadow-float backdrop-blur-md">
            <SparkSketch className="mx-auto mb-3 h-24 w-32" />
            <p className="font-display text-xl font-semibold text-mc-ink">
              {copy.emptyCanvas}
            </p>
            <p className="mt-1 text-sm text-mc-ink/60">{copy.emptyHint}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
