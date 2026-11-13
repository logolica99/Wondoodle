"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { PipVoiceState } from "@/hooks/useRealtimePip";

type PipVoiceOrbProps = {
  state: PipVoiceState;
  level: number;
  connecting?: boolean;
  className?: string;
};

export function PipVoiceOrb({
  state,
  level,
  connecting = false,
  className,
}: PipVoiceOrbProps) {
  const reduceMotion = useReducedMotion();
  const pulse = Math.max(0.08, Math.min(1, level));
  const scale =
    reduceMotion
      ? 1
      : connecting
        ? 1.04
        : state === "listening"
          ? 1 + pulse * 0.18
          : state === "speaking"
            ? 1.08
            : 1;

  const ringColor =
    state === "listening"
      ? "rgba(88, 217, 176, 0.45)"
      : state === "speaking"
        ? "rgba(255, 145, 182, 0.5)"
        : connecting
          ? "rgba(115, 87, 232, 0.35)"
          : "rgba(168, 148, 248, 0.28)";

  return (
    <div
      className={cn(
        "relative mx-auto flex h-28 w-28 items-center justify-center",
        className
      )}
      data-testid="pip-voice-orb"
      data-state={connecting ? "connecting" : state}
      aria-hidden
    >
      {!reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: ringColor }}
          animate={
            connecting || state === "listening" || state === "speaking"
              ? { scale: [1, 1.22, 1], opacity: [0.55, 0.2, 0.55] }
              : { scale: 1, opacity: 0.35 }
          }
          transition={
            connecting || state !== "idle"
              ? { duration: state === "speaking" ? 1.1 : 1.6, repeat: Infinity }
              : { duration: 0.3 }
          }
        />
      )}
      <motion.div
        className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full shadow-float"
        style={{
          background:
            state === "listening"
              ? "linear-gradient(145deg, #58D9B0 0%, #7357E8 100%)"
              : state === "speaking"
                ? "linear-gradient(145deg, #FF91B6 0%, #7357E8 100%)"
                : "linear-gradient(145deg, #A894F8 0%, #7357E8 100%)",
        }}
        animate={{ scale }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 220, damping: 18 }
        }
      >
        <div className="h-10 w-10 rounded-full bg-white/25 backdrop-blur-[2px]" />
        {(state === "listening" || state === "speaking") && !reduceMotion && (
          <div className="absolute inset-0 flex items-center justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 rounded-full bg-white/90"
                animate={{
                  height:
                    state === "listening"
                      ? [8, 10 + pulse * 18, 8]
                      : [10, 22, 10],
                }}
                transition={{
                  duration: 0.55 + i * 0.12,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
