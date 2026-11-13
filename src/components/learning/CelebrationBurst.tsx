"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useCelebrationStore } from "@/store/celebrationStore";

const COLORS = ["#7357E8", "#FF91B6", "#58D9B0", "#FFD66D", "#76B8FF"];

type Piece = {
  id: number;
  left: string;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  x: number;
  size: number;
  round: boolean;
};

/**
 * Short, restrained confetti burst for real accomplishments.
 * Respects reduced motion — shows a soft flash only.
 */
export function CelebrationBurst() {
  const reduceMotion = useReducedMotion();
  const token = useCelebrationStore((s) => s.token);
  const label = useCelebrationStore((s) => s.label);
  const clear = useCelebrationStore((s) => s.clear);
  const [activeToken, setActiveToken] = useState(0);

  useEffect(() => {
    if (!token) return;
    setActiveToken(token);
    const t = window.setTimeout(() => {
      clear();
      setActiveToken(0);
    }, reduceMotion ? 900 : 1800);
    return () => window.clearTimeout(t);
  }, [token, clear, reduceMotion]);

  const pieces = useMemo(() => {
    if (!activeToken || reduceMotion) return [] as Piece[];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: `${6 + ((i * 17) % 88)}%`,
      delay: (i % 7) * 0.04,
      duration: 1.15 + (i % 5) * 0.08,
      color: COLORS[i % COLORS.length],
      rotate: (i % 2 === 0 ? 1 : -1) * (120 + (i % 6) * 40),
      x: ((i % 9) - 4) * 18,
      size: 6 + (i % 4) * 2,
      round: i % 3 === 0,
    }));
  }, [activeToken, reduceMotion]);

  if (!activeToken) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[50] overflow-hidden"
      aria-hidden
      data-testid="celebration-burst"
    >
      {!reduceMotion
        ? pieces.map((p) => (
            <motion.span
              key={`${activeToken}-${p.id}`}
              className="absolute top-[-4%]"
              style={{
                left: p.left,
                width: p.size,
                height: p.round ? p.size : p.size * 0.55,
                borderRadius: p.round ? 999 : 2,
                background: p.color,
              }}
              initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: ["0vh", "105vh"],
                x: [0, p.x],
                rotate: p.rotate,
                scale: [0.6, 1, 0.9],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: "easeOut",
              }}
            />
          ))
        : null}

      <motion.div
        className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full bg-mc-white/95 px-4 py-2 text-sm font-bold text-mc-ink shadow-float"
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28 }}
        data-testid="celebration-label"
      >
        {label || "Nice work!"}
      </motion.div>
    </div>
  );
}
