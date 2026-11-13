"use client";

import { motion, useReducedMotion } from "motion/react";
import { SaveStatus as SaveStatusType } from "@/types/canvas";
import { copy } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export function SaveStatusBadge({
  status,
  error,
}: {
  status: SaveStatusType;
  error?: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const label =
    status === "saving"
      ? copy.saving
      : status === "saved"
        ? copy.saved
        : status === "error"
          ? copy.saveError
          : "Ready";

  return (
    <div className="flex flex-col items-end gap-1">
      <motion.div
        key={status}
        initial={reduceMotion ? false : { opacity: 0, y: 4, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-soft",
          status === "saved" && "bg-mc-mint-soft text-mc-ink",
          status === "saving" && "bg-mc-yellow-soft text-mc-ink",
          status === "error" && "bg-rose-50 text-rose-700",
          status === "idle" && "bg-white/90 text-mc-ink"
        )}
        data-testid="save-status"
        role="status"
        aria-live="polite"
      >
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            status === "saving" && "animate-pulse-soft bg-mc-yellow",
            status === "saved" && "bg-mc-mint",
            status === "error" && "bg-rose-500",
            status === "idle" && "bg-slate-300"
          )}
        />
        <span>{label}</span>
      </motion.div>
      {status === "error" && error && (
        <p
          className="max-w-[220px] text-right text-xs text-rose-600"
          data-testid="save-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
