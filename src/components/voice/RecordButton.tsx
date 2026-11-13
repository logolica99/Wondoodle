"use client";

import { Mic, Square } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function RecordButton({
  recording,
  disabled,
  onClick,
}: {
  recording: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      data-testid={recording ? "voice-stop" : "voice-record"}
      aria-label={recording ? "Stop recording" : "Start recording"}
      disabled={disabled}
      onClick={onClick}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.94 }}
      className={cn(
        "inline-flex min-h-14 min-w-14 items-center justify-center rounded-full text-white shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30 disabled:opacity-50",
        recording
          ? "bg-rose-500 hover:bg-rose-600"
          : "bg-mc-purple hover:bg-[#6246d6]"
      )}
    >
      {recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
    </motion.button>
  );
}
