"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  Check,
  Lightbulb,
  Lock,
  Mic,
  Pencil,
  Radar,
  Star,
} from "lucide-react";
import type { JourneyNodeState, JourneyVisualStatus } from "@/types/learning";
import type { MapPoint } from "@/lib/learning/journeyMapLayout";
import { cn } from "@/lib/utils";

const icons = {
  pencil: Pencil,
  mic: Mic,
  radar: Radar,
  lesson: BookOpen,
  teach: Lightbulb,
  star: Star,
} as const;

const statusCopy: Record<JourneyVisualStatus, string> = {
  completed: "Completed",
  current: "Up next",
  available: "Ready",
  coming_soon: "Coming soon",
};

/** Soft pastel fills for inviting upcoming / available stops */
const pastelByIcon: Record<
  JourneyNodeState["icon"],
  { bg: string; fg: string; border: string }
> = {
  pencil: { bg: "#EFEAFF", fg: "#7357E8", border: "#D8CFFF" },
  mic: { bg: "#FFE8F1", fg: "#E0568A", border: "#FFD0E0" },
  radar: { bg: "#E8F4FF", fg: "#3D8FD9", border: "#C8E4FF" },
  lesson: { bg: "#E6FBF4", fg: "#2A9F7C", border: "#B8EEDC" },
  teach: { bg: "#FFF6D9", fg: "#C49212", border: "#FFE9A8" },
  star: { bg: "#F3EEFF", fg: "#7357E8", border: "#DDD0FF" },
};

type JourneyNodeProps = {
  node: JourneyNodeState;
  index: number;
  point: MapPoint;
  compact?: boolean;
  selected: boolean;
  onSelect: () => void;
};

export function JourneyNode({
  node,
  index,
  point,
  compact = false,
  selected,
  onSelect,
}: JourneyNodeProps) {
  const reduceMotion = useReducedMotion();
  const Icon = icons[node.icon];
  const { status } = node;
  const pastel = pastelByIcon[node.icon];
  // Desktop ~72–80px; compact tablet still ≥56px for touch
  const iconSize = compact ? "h-14 w-14" : "h-[4.75rem] w-[4.75rem] sm:h-20 sm:w-20";
  const iconOffset = compact ? "1.75rem" : "2.35rem";
  const isCurrent = status === "current";
  const isCompleted = status === "completed";
  const isSoon = status === "coming_soon";

  return (
    <div
      className={cn(
        "absolute z-10",
        compact ? "w-[7rem]" : "w-[8.5rem] sm:w-[9.5rem]",
        selected && "z-20",
        isCurrent && "z-[15]"
      )}
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: "translateX(-50%)",
        marginTop: `calc(-1 * ${iconOffset})`,
      }}
    >
      <motion.button
        type="button"
        data-testid={`journey-node-${node.id}`}
        data-available={node.availability}
        data-status={status}
        data-completed={node.completed ? "true" : "false"}
        aria-label={`${node.name}. ${statusCopy[status]}`}
        aria-current={isCurrent ? "step" : undefined}
        onClick={onSelect}
        whileHover={
          reduceMotion
            ? undefined
            : { y: -3, scale: 1.03, transition: { duration: 0.16 } }
        }
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        className="group w-full touch-manipulation focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7357E8]/35"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: isSoon && !selected ? 0.92 : 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : index * 0.05, duration: 0.28 }}
      >
        <span className="relative flex flex-col items-center gap-2 text-center">
          {/* Soft golden halo — current only, no pulsing glow */}
          {isCurrent && (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1 rounded-full bg-[#FFD66D]/35 blur-[2px]",
                compact ? "h-[4.25rem] w-[4.25rem]" : "h-[5.75rem] w-[5.75rem] sm:h-[6.25rem] sm:w-[6.25rem]"
              )}
            />
          )}

          <span
            className={cn(
              "relative flex items-center justify-center rounded-full border-[3px] shadow-soft",
              iconSize,
              isCompleted && "border-white bg-[#58D9B0] text-mc-ink",
              isCurrent && "border-[#FFD66D] bg-[#7357E8] text-white",
              status === "available" && "bg-white",
              isSoon && "bg-white",
              selected && isCurrent && "ring-2 ring-[#FFD66D]/80",
              selected && !isCurrent && "ring-2 ring-[#7357E8]/30"
            )}
            style={
              isCurrent || isCompleted
                ? undefined
                : {
                    backgroundColor: pastel.bg,
                    color: pastel.fg,
                    borderColor: pastel.border,
                  }
            }
          >
            <Icon
              className={compact ? "h-6 w-6" : "h-7 w-7 sm:h-8 sm:w-8"}
              aria-hidden
            />

            {isCompleted && (
              <motion.span
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-emerald-700 shadow-soft"
                data-testid={`journey-node-check-${node.id}`}
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                aria-hidden
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </motion.span>
            )}

            {isSoon && (
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-white text-mc-ink/55 shadow-soft"
                aria-hidden
              >
                <Lock className="h-3 w-3" />
              </span>
            )}
          </span>

          <span
            className={cn(
              "block w-full truncate font-display font-semibold leading-snug text-mc-ink",
              compact ? "text-[13px]" : "text-[15px] sm:text-[17px]",
              isCurrent && "text-[#7357E8]",
              isSoon && "text-mc-ink/50"
            )}
          >
            {node.name}
          </span>
        </span>
      </motion.button>
    </div>
  );
}
