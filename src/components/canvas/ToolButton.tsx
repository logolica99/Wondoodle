"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type ToolButtonProps = {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active?: boolean;
  disabled?: boolean;
  accent?: string;
  testId?: string;
  onClick?: () => void;
  className?: string;
};

export const ToolButton = forwardRef<HTMLButtonElement, ToolButtonProps>(
  function ToolButton(
    {
      label,
      icon: Icon,
      active = false,
      disabled = false,
      accent = "#7357E8",
      testId,
      onClick,
      className,
    },
    ref
  ) {
    const reduceMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={active}
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
        whileHover={
          reduceMotion || disabled ? undefined : { y: -2, scale: 1.03 }
        }
        whileTap={reduceMotion || disabled ? undefined : { scale: 0.94, y: 1 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "group relative flex min-h-touch min-w-touch flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30 disabled:cursor-not-allowed disabled:opacity-40",
          active
            ? "text-white shadow-float"
            : "bg-white text-mc-ink/80 shadow-soft hover:bg-white",
          className
        )}
        style={
          active
            ? {
                background: `linear-gradient(160deg, ${accent} 0%, ${accent}cc 100%)`,
              }
            : undefined
        }
      >
        <Icon
          className="h-5 w-5 sm:h-6 sm:w-6"
          style={active || disabled ? undefined : { color: accent }}
          aria-hidden
        />
        <span className="max-w-[4.5rem] truncate leading-tight">{label}</span>
      </motion.button>
    );
  }
);
