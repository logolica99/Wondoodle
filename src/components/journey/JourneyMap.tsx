"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { JourneyFeatureId, JourneyNodeState } from "@/types/learning";
import {
  resolveJourneyMapLayout,
  type ResolvedMapLayout,
} from "@/lib/learning/journeyMapLayout";
import { JOURNEY_CONNECTOR_PATH_D } from "@/lib/learning/journeyPath";
import { JourneyNode } from "./JourneyNode";
import { MapDecorations } from "./MapDecorations";

type JourneyMapProps = {
  nodes: JourneyNodeState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const STACKED_MQ = "(max-width: 1023px)";
const FALLBACK_LAYOUT = resolveJourneyMapLayout(900, { stacked: false });

export function JourneyMap({ nodes, selectedId, onSelect }: JourneyMapProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ResolvedMapLayout>(FALLBACK_LAYOUT);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const mq =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(STACKED_MQ)
        : null;

    const apply = () => {
      const stacked = mq?.matches ?? el.clientWidth < 1024;
      const next = resolveJourneyMapLayout(el.clientWidth, { stacked });
      setLayout((prev) =>
        prev.id === next.id &&
        prev.padX === next.padX &&
        prev.padY === next.padY &&
        prev.labelGutter === next.labelGutter &&
        prev.compact === next.compact &&
        prev.viewBoxWidth === next.viewBoxWidth
          ? prev
          : next
      );
    };

    apply();

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => apply())
        : null;
    ro?.observe(el);

    const onMq = () => apply();
    if (mq) {
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onMq);
      } else {
        mq.addListener(onMq);
      }
    }

    window.addEventListener("orientationchange", apply);
    window.addEventListener("resize", apply);

    return () => {
      ro?.disconnect();
      if (mq) {
        if (typeof mq.removeEventListener === "function") {
          mq.removeEventListener("change", onMq);
        } else {
          mq.removeListener(onMq);
        }
      }
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  const completedCount = nodes.filter((n) => n.completed).length;
  const progress = nodes.length ? completedCount / nodes.length : 0;
  const pathD = JOURNEY_CONNECTOR_PATH_D;

  return (
    <div
      ref={rootRef}
      className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#E8E0FF] bg-white shadow-soft"
      data-testid="journey-map"
      data-map-layout={layout.id}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-[#F7F4FF]/70"
      />

      <div
        className="relative mx-auto max-w-full"
        style={{
          paddingLeft: layout.padX,
          paddingRight: layout.padX,
          paddingTop: layout.padY,
          paddingBottom: layout.padY + layout.labelGutter,
        }}
      >
        <div
          className="relative mx-auto w-full"
          style={{
            aspectRatio: `${layout.viewBoxWidth} / ${layout.viewBoxHeight}`,
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`${layout.viewBoxX} ${layout.viewBoxY} ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <MapDecorations />
            <path
              d={pathD}
              fill="none"
              stroke="#A48CF3"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={reduceMotion ? undefined : "3 8"}
              opacity={0.9}
            />
            {progress > 0 && (
              <motion.path
                d={pathD}
                fill="none"
                stroke="#58D9B0"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                initial={false}
                animate={{
                  strokeDasharray: `${Math.max(0.08, progress)} 1`,
                }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.9, ease: "easeOut" }
                }
              />
            )}
          </svg>

          <div className="relative z-10 h-full w-full">
            {nodes.map((node, index) => {
              const point =
                layout.points[node.id as JourneyFeatureId] ?? node.map;
              return (
                <JourneyNode
                  key={node.id}
                  node={node}
                  index={index}
                  point={point}
                  compact={layout.compact}
                  selected={selectedId === node.id}
                  onSelect={() => onSelect(node.id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
