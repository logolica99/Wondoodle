"use client";

import { motion, useReducedMotion } from "motion/react";
import { PipMood } from "@/store/uiStore";
import { cn } from "@/lib/utils";

type PipMascotProps = {
  mood?: PipMood;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

const sizes = {
  sm: 64,
  md: 96,
  lg: 148,
};

/**
 * Pip is the official Wondoodle brand character (logo art) —
 * same face, headphones, and pencil body as the mark.
 */
export function PipMascot({
  mood = "idle",
  size = "md",
  className,
  label = "Pip the Wondoodle mascot",
}: PipMascotProps) {
  const reduceMotion = useReducedMotion();
  const px = sizes[size];

  const bounce =
    reduceMotion || mood === "idle"
      ? undefined
      : mood === "celebrate"
        ? ({
            y: [0, -8, 0],
            transition: { duration: 0.55, ease: "easeOut" as const },
          })
        : mood === "welcome"
          ? ({
              y: [0, -4, 0],
              transition: { duration: 0.7, ease: "easeOut" as const },
            })
          : ({
              rotate: [0, -4, 4, 0],
              transition: { duration: 0.75, ease: "easeInOut" as const },
            });

  return (
    <motion.div
      className={cn(
        "relative inline-flex select-none items-center justify-center drop-shadow-sm",
        className
      )}
      style={{ width: px, height: px }}
      animate={bounce}
      aria-label={label}
      role="img"
      data-testid="pip-mascot"
      data-mood={mood}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/pip.png"
        alt=""
        width={px}
        height={px}
        draggable={false}
        className="h-full w-full object-contain"
        aria-hidden
      />
    </motion.div>
  );
}
