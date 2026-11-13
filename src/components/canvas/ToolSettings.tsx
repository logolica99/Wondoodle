"use client";

import { motion, useReducedMotion } from "motion/react";
import { Slider } from "@/components/ui/slider";
import { useCanvasStore } from "@/store/canvasStore";
import { useUiStore } from "@/store/uiStore";
import { PEN_COLORS } from "@/types/canvas";
import { PAPER_STYLES } from "@/lib/canvas/paper";
import { cn } from "@/lib/utils";

export function ToolSettings() {
  const tool = useCanvasStore((s) => s.tool);
  const pen = useCanvasStore((s) => s.pen);
  const textSettings = useCanvasStore((s) => s.textSettings);
  const setPenColor = useCanvasStore((s) => s.setPenColor);
  const setPenWidth = useCanvasStore((s) => s.setPenWidth);
  const setTextColor = useCanvasStore((s) => s.setTextColor);
  const setTextSize = useCanvasStore((s) => s.setTextSize);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const objects = useCanvasStore((s) => s.document.objects);
  const updateObjectTransform = useCanvasStore((s) => s.updateObjectTransform);
  const paperStyle = useUiStore((s) => s.paperStyle);
  const setPaperStyle = useUiStore((s) => s.setPaperStyle);
  const reduceMotion = useReducedMotion();

  const selected = objects.find((o) => o.id === selectedId);
  const showPen = tool === "pen" || tool === "eraser";
  const showText =
    tool === "text" || (tool === "select" && selected?.type === "text");

  return (
    <motion.div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/90 bg-white/92 px-2.5 py-2 shadow-toolbar backdrop-blur-md"
      data-testid="canvas-settings"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-1" data-testid="paper-style-picker">
        <span className="sr-only">Paper style</span>
        {PAPER_STYLES.map((paper) => (
          <button
            key={paper.id}
            type="button"
            aria-label={`Paper style ${paper.label}`}
            aria-pressed={paperStyle === paper.id}
            title={paper.description}
            data-testid={`paper-${paper.id}`}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30",
              paperStyle === paper.id
                ? "bg-mc-purple text-white shadow-soft"
                : "bg-mc-purple-soft/70 text-mc-ink hover:bg-white"
            )}
            onClick={() => setPaperStyle(paper.id)}
          >
            {paper.label}
          </button>
        ))}
      </div>

      {(showPen || showText) && (
        <div className="hidden h-7 w-px bg-mc-purple/15 sm:block" />
      )}

      {showPen && (
        <>
          {tool === "pen" && (
            <div className="flex items-center gap-1" data-testid="pen-colors">
              {PEN_COLORS.map((color) => (
                <motion.button
                  key={color}
                  type="button"
                  aria-label={`Pen color ${color}`}
                  data-testid={`pen-color-${color.replace("#", "")}`}
                  whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30",
                    pen.color === color
                      ? "scale-110 border-mc-purple shadow-soft"
                      : "border-white hover:scale-105",
                    color === "#FFFFFF" && "border-slate-200"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setPenColor(color)}
                />
              ))}
            </div>
          )}

          <div className="flex min-w-[120px] max-w-[180px] flex-1 items-center gap-2">
            <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-mc-ink/45">
              {tool === "eraser" ? "Size" : "Thick"}
            </span>
            <Slider
              data-testid="pen-width"
              min={1}
              max={24}
              step={1}
              value={[pen.strokeWidth]}
              onValueChange={([value]) => setPenWidth(value)}
              aria-label="Pen thickness"
            />
            <span className="w-4 text-right text-xs font-bold tabular-nums text-mc-ink/70">
              {pen.strokeWidth}
            </span>
          </div>
        </>
      )}

      {showText && (
        <>
          <div className="flex items-center gap-1">
            {PEN_COLORS.filter((c) => c !== "#FFFFFF").map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Text color ${color}`}
                data-testid={`text-color-${color.replace("#", "")}`}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30",
                  textSettings.color === color
                    ? "scale-110 border-mc-purple shadow-soft"
                    : "border-white hover:scale-105"
                )}
                style={{ backgroundColor: color }}
                onClick={() => {
                  setTextColor(color);
                  if (selected?.type === "text") {
                    updateObjectTransform(
                      selected.id,
                      { color },
                      { recordHistory: true }
                    );
                    useCanvasStore.getState().endTransform();
                  }
                }}
              />
            ))}
          </div>

          <div className="flex min-w-[120px] max-w-[180px] flex-1 items-center gap-2">
            <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-mc-ink/45">
              Size
            </span>
            <Slider
              data-testid="text-size"
              min={12}
              max={64}
              step={1}
              value={[textSettings.fontSize]}
              onValueChange={([value]) => {
                setTextSize(value);
                if (selected?.type === "text") {
                  updateObjectTransform(
                    selected.id,
                    { fontSize: value },
                    { recordHistory: true }
                  );
                }
              }}
              onValueCommit={() => useCanvasStore.getState().endTransform()}
              aria-label="Text size"
            />
            <span className="w-4 text-right text-xs font-bold tabular-nums text-mc-ink/70">
              {textSettings.fontSize}
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

/** @deprecated Prefer ToolSettings */
export { ToolSettings as CanvasSettings };
