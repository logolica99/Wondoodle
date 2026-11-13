"use client";

import { cn } from "@/lib/utils";
import { clampDenominator } from "@/lib/learning/fractionMath";

type FractionBarProps = {
  denominator: number;
  /** 0-based index of the highlighted piece. */
  highlightIndex?: number;
  fillClass: string;
  highlightClass: string;
  label: string;
  compact?: boolean;
  "data-testid"?: string;
};

/**
 * Equal-width segments of a fixed-width whole. Highlight marks one unit piece.
 */
export function FractionBar({
  denominator,
  highlightIndex = 0,
  fillClass,
  highlightClass,
  label,
  compact = false,
  "data-testid": testId,
}: FractionBarProps) {
  const d = clampDenominator(denominator);
  const hi = Math.min(d - 1, Math.max(0, highlightIndex));

  return (
    <div className="w-full" data-testid={testId}>
      <div
        className={cn(
          "flex items-baseline justify-between gap-2",
          compact ? "mb-1" : "mb-1.5"
        )}
      >
        <span
          className={cn(
            "font-semibold text-mc-ink/70",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "font-display font-bold tabular-nums text-mc-ink",
            compact ? "text-base" : "text-lg"
          )}
        >
          1/{d}
        </span>
      </div>
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-xl border-2 border-mc-ink/10 bg-mc-cream shadow-sm",
          compact ? "h-9" : "h-12 sm:h-14"
        )}
        role="img"
        aria-label={`Bar divided into ${d} equal parts; piece ${hi + 1} highlighted as 1 over ${d}`}
      >
        {Array.from({ length: d }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-full border-r border-white/70 last:border-r-0 transition-colors duration-200",
              i === hi ? highlightClass : fillClass
            )}
            style={{ width: `${100 / d}%`, flex: "0 0 auto" }}
            data-highlighted={i === hi ? "true" : "false"}
          />
        ))}
      </div>
    </div>
  );
}
