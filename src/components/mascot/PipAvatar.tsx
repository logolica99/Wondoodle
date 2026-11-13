"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { MicOff } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  PIP_AVATAR_MARKUP,
  PIP_AVATAR_UID_TOKEN,
} from "./pipAvatarMarkup";

export type PipAnimState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "success";

type PipAvatarProps = {
  state?: PipAnimState;
  /** Mic level 0–1 — listening ring only (real meter). */
  level?: number;
  size?: number;
  className?: string;
  label?: string;
};

/**
 * Exact Wondoodle Pip SVG with part IDs for state-driven CSS animation.
 * Listening uses real mic level; speaking uses realtime voiceState only.
 */
export function PipAvatar({
  state = "idle",
  level = 0,
  size = 88,
  className,
  label = "Pip",
}: PipAvatarProps) {
  const reduceMotion = useReducedMotion();
  const reactId = useId().replace(/:/g, "");
  const ringRef = useRef<HTMLSpanElement>(null);

  const markup = useMemo(
    () => PIP_AVATAR_MARKUP.split(PIP_AVATAR_UID_TOKEN).join(reactId),
    [reactId]
  );

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    if (state !== "listening" || reduceMotion) {
      ring.style.setProperty("--pip-level", "0");
      return;
    }
    ring.style.setProperty(
      "--pip-level",
      String(Math.max(0, Math.min(1, level)))
    );
  }, [level, state, reduceMotion]);

  return (
    <div
      className={cn("pip-avatar relative inline-flex select-none", className)}
      style={{ width: size, height: size }}
      data-testid="pip-avatar"
      data-pip-state={reduceMotion ? "static" : state}
      role="img"
      aria-label={label}
    >
      {state === "listening" && (
        <span
          ref={ringRef}
          className="pip-listen-ring pointer-events-none absolute inset-[-10%] rounded-full border-2 border-[#58D9B0]"
          aria-hidden
        />
      )}

      <div
        className="pip-avatar-stage relative h-full w-full"
        dangerouslySetInnerHTML={{ __html: markup }}
      />

      {state === "muted" && (
        <span
          className="pointer-events-none absolute bottom-0.5 right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-mc-ink/85 text-white shadow-soft"
          aria-hidden
          title="Muted"
        >
          <MicOff className="h-3.5 w-3.5" />
        </span>
      )}

      <style>{pipAvatarCss(reactId)}</style>
    </div>
  );
}

function pipAvatarCss(uid: string) {
  return `
.pip-avatar { --pip-level: 0; }
.pip-listen-ring {
  opacity: calc(0.25 + var(--pip-level) * 0.55);
  transform: scale(calc(1 + var(--pip-level) * 0.42));
  transition: transform 80ms linear, opacity 80ms linear;
  box-shadow: 0 0 0 4px rgba(88, 217, 176, 0.15);
}
.pip-avatar[data-pip-state="idle"] .pip-avatar-stage {
  animation: pip-float-${uid} 3.6s ease-in-out infinite;
}
.pip-avatar[data-pip-state="idle"] [data-pip-part="eyes"] {
  animation: pip-blink-${uid} 5.5s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
.pip-avatar[data-pip-state="thinking"] .pip-avatar-stage {
  animation: pip-tilt-${uid} 1.8s ease-in-out infinite;
}
.pip-avatar[data-pip-state="thinking"] [data-pip-part="sparkles"] {
  animation: pip-sparkle-${uid} 1.4s ease-in-out infinite;
}
.pip-avatar[data-pip-state="speaking"] [data-pip-part="mouth"] {
  animation: pip-talk-${uid} 0.35s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
.pip-avatar[data-pip-state="speaking"] #${uid}-bars {
  animation: pip-eq-${uid} 0.45s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
.pip-avatar[data-pip-state="muted"] .pip-avatar-stage {
  filter: grayscale(0.3) brightness(0.96);
}
.pip-avatar[data-pip-state="success"] .pip-avatar-stage {
  animation: pip-success-${uid} 0.7s ease-out 1;
}
.pip-avatar[data-pip-state="success"] [data-pip-part="sparkles"],
.pip-avatar[data-pip-state="success"] [data-pip-part="star"] {
  animation: pip-sparkle-${uid} 0.55s ease-out 1;
}
.pip-avatar[data-pip-state="static"] .pip-avatar-stage,
.pip-avatar[data-pip-state="static"] [data-pip-part] {
  animation: none !important;
}
@keyframes pip-float-${uid} {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes pip-blink-${uid} {
  0%, 92%, 100% { transform: scaleY(1); }
  94%, 96% { transform: scaleY(0.12); }
}
@keyframes pip-tilt-${uid} {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-5deg); }
}
@keyframes pip-sparkle-${uid} {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
}
@keyframes pip-talk-${uid} {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.8); }
}
@keyframes pip-eq-${uid} {
  0%, 100% { transform: scaleY(0.88); }
  50% { transform: scaleY(1.12); }
}
@keyframes pip-success-${uid} {
  0% { transform: translateY(0) scale(1); }
  40% { transform: translateY(-10px) scale(1.06); }
  100% { transform: translateY(0) scale(1); }
}
`;
}
