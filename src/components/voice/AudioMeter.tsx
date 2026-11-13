"use client";

import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const BARS = 16;

export function AudioMeter({
  level,
  active,
}: {
  level: number;
  active: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="flex h-12 items-end justify-center gap-1 rounded-2xl bg-mc-purple-soft/60 px-3 py-2"
      data-testid="audio-meter"
      aria-hidden
    >
      {Array.from({ length: BARS }).map((_, index) => {
        const threshold = (index + 1) / BARS;
        const lit = active && level >= threshold * 0.55;
        const height = reduceMotion
          ? lit
            ? 70
            : 18
          : lit
            ? Math.max(18, Math.min(100, level * 100 * (0.55 + threshold * 0.6)))
            : 14;
        return (
          <span
            key={index}
            className={cn(
              "w-1.5 rounded-full transition-[height,background-color] duration-75",
              lit ? "bg-mc-purple" : "bg-mc-purple/25"
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
