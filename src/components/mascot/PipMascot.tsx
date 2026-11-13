"use client";

import { PipMood } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { PipAvatar, type PipAnimState } from "./PipAvatar";

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

function moodToAnimState(mood: PipMood): PipAnimState {
  switch (mood) {
    case "celebrate":
      return "success";
    case "thinking":
      return "thinking";
    case "welcome":
    case "idle":
    default:
      return "idle";
  }
}

/**
 * Pip uses the original Wondoodle SVG with the same state-driven
 * animations as the /learn companion (float, blink, tilt, success).
 */
export function PipMascot({
  mood = "idle",
  size = "md",
  className,
  label = "Pip the Wondoodle mascot",
}: PipMascotProps) {
  return (
    <PipAvatar
      state={moodToAnimState(mood)}
      size={sizes[size]}
      label={label}
      className={cn("drop-shadow-sm", className)}
    />
  );
}
