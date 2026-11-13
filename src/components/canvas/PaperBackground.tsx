"use client";

import { useMemo } from "react";
import { Circle, Line, Rect } from "react-konva";
import {
  PAPER_DOT,
  PAPER_FILL,
  PAPER_LINE,
  PAPER_RULE,
  type PaperStyle,
} from "@/lib/canvas/paper";

type Camera = { x: number; y: number; zoom: number };

/**
 * Screen-space paper pattern that stays behind drawing objects.
 * Not part of the document object model.
 */
export function PaperBackground({
  style,
  viewport,
  camera,
  step = 28,
}: {
  style: PaperStyle;
  viewport: { width: number; height: number };
  camera: Camera;
  step?: number;
}) {
  const worldStep = step * camera.zoom;

  const pattern = useMemo(() => {
    if (style === "blank" || worldStep < 8) {
      return { dots: [] as { x: number; y: number }[], lines: [] as number[][] };
    }

    const startX = ((camera.x % worldStep) + worldStep) % worldStep;
    const startY = ((camera.y % worldStep) + worldStep) % worldStep;
    const lines: number[][] = [];
    const dots: { x: number; y: number }[] = [];

    if (style === "dotted") {
      for (let x = startX; x <= viewport.width; x += worldStep) {
        for (let y = startY; y <= viewport.height; y += worldStep) {
          dots.push({ x, y });
        }
      }
      return { dots, lines };
    }

    if (style === "grid") {
      for (let x = startX; x <= viewport.width; x += worldStep) {
        lines.push([x, 0, x, viewport.height]);
      }
      for (let y = startY; y <= viewport.height; y += worldStep) {
        lines.push([0, y, viewport.width, y]);
      }
      return { dots, lines };
    }

    // ruled — horizontal only
    for (let y = startY; y <= viewport.height; y += worldStep) {
      lines.push([0, y, viewport.width, y]);
    }
    return { dots, lines };
  }, [style, worldStep, camera.x, camera.y, viewport.width, viewport.height]);

  return (
    <>
      <Rect
        name="board-bg"
        x={0}
        y={0}
        width={viewport.width}
        height={viewport.height}
        fill={PAPER_FILL}
      />
      {style === "dotted" &&
        pattern.dots.map((dot, index) => (
          <Circle
            key={`dot-${index}`}
            name="board-grid"
            x={dot.x}
            y={dot.y}
            radius={1.4}
            fill={PAPER_DOT}
            listening={false}
          />
        ))}
      {(style === "grid" || style === "ruled") &&
        pattern.lines.map((points, index) => (
          <Line
            key={`line-${index}`}
            name="board-grid"
            points={points}
            stroke={style === "ruled" ? PAPER_RULE : PAPER_LINE}
            strokeWidth={style === "ruled" ? 1.25 : 1}
            listening={false}
          />
        ))}
    </>
  );
}
