export type PaperStyle = "blank" | "dotted" | "grid" | "ruled";

export const PAPER_STYLES: {
  id: PaperStyle;
  label: string;
  description: string;
}[] = [
  { id: "blank", label: "Blank", description: "Clean white paper" },
  { id: "dotted", label: "Dotted", description: "Soft guide dots" },
  { id: "grid", label: "Grid", description: "Square guide lines" },
  { id: "ruled", label: "Ruled", description: "Notebook lines" },
];

export const PAPER_FILL = "#F7F5FC";
export const PAPER_LINE = "rgba(115, 87, 232, 0.11)";
export const PAPER_DOT = "rgba(115, 87, 232, 0.22)";
export const PAPER_RULE = "rgba(118, 184, 255, 0.28)";

export function isPaperStyle(value: unknown): value is PaperStyle {
  return (
    value === "blank" ||
    value === "dotted" ||
    value === "grid" ||
    value === "ruled"
  );
}

/** Draw paper fill + pattern into an export canvas context (world space). */
export function paintPaperBackground(
  ctx: CanvasRenderingContext2D,
  style: PaperStyle,
  x: number,
  y: number,
  width: number,
  height: number,
  step = 28
) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, width, height);

  // Soft lavender wash so exports match the in-app canvas.
  ctx.fillStyle = PAPER_FILL;
  ctx.fillRect(x, y, width, height);

  if (style === "blank") return;

  const startX = Math.floor(x / step) * step;
  const startY = Math.floor(y / step) * step;
  const endX = x + width;
  const endY = y + height;

  if (style === "dotted") {
    ctx.fillStyle = PAPER_DOT;
    for (let px = startX; px <= endX; px += step) {
      for (let py = startY; py <= endY; py += step) {
        ctx.beginPath();
        ctx.arc(px, py, 1.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (style === "grid") {
    ctx.strokeStyle = PAPER_LINE;
    ctx.lineWidth = 1;
    for (let px = startX; px <= endX; px += step) {
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, endY);
      ctx.stroke();
    }
    for (let py = startY; py <= endY; py += step) {
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(endX, py);
      ctx.stroke();
    }
    return;
  }

  // ruled
  ctx.strokeStyle = PAPER_RULE;
  ctx.lineWidth = 1.25;
  for (let py = startY; py <= endY; py += step) {
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(endX, py);
    ctx.stroke();
  }
}
