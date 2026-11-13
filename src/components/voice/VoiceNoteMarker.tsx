"use client";

import { MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { VoiceNote } from "@/types/voice";
import { cn } from "@/lib/utils";

export function VoiceNoteMarker({
  note,
  left,
  top,
  onOpen,
}: {
  note: VoiceNote;
  left: number;
  top: number;
  onOpen: (noteId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const unanchored = note.anchor.type === "unanchored";

  return (
    <motion.button
      type="button"
      data-testid={`voice-marker-${note.id}`}
      aria-label={
        unanchored
          ? "Open saved explanation (unanchored)"
          : "Open saved explanation"
      }
      className={cn(
        "pointer-events-auto absolute z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border border-white text-white shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30",
        unanchored ? "bg-mc-yellow text-mc-ink" : "bg-mc-pink"
      )}
      style={{ left, top }}
      initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(note.id);
      }}
    >
      <MessageCircle className="h-5 w-5" />
    </motion.button>
  );
}
