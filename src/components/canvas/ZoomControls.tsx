"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const pct = Math.round(zoom * 100);

  return (
    <motion.div
      className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/90 bg-white/95 p-1 shadow-toolbar backdrop-blur-md"
      data-testid="zoom-controls"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-mc-ink transition hover:bg-mc-purple-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30 active:scale-95"
        aria-label="Zoom out"
        data-testid="zoom-out"
        onClick={onZoomOut}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        className="min-w-[3.25rem] text-center text-xs font-bold tabular-nums text-mc-ink/70"
        data-testid="zoom-label"
      >
        {pct}%
      </span>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-mc-ink transition hover:bg-mc-purple-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30 active:scale-95"
        aria-label="Zoom in"
        data-testid="zoom-in"
        onClick={onZoomIn}
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-mc-ink/70 transition hover:bg-mc-mint-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30 active:scale-95"
        aria-label="Reset zoom"
        data-testid="zoom-reset"
        onClick={onReset}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
