/**
 * Detect when a student is asking Pip to look at (or re-check) their canvas.
 * Kept intentionally broad for kid phrasing; still event-driven (one snapshot per ask).
 */
export function wantsCanvasLook(transcript: string): boolean {
  const t = transcript.toLowerCase().replace(/[’']/g, "'").trim();
  if (!t) return false;

  const patterns = [
    /\blook at (my |the )?(canvas|work|drawing|board|screen|problem|math)\b/,
    /\bsee (my |the )?(canvas|work|drawing|board|screen|problem)\b/,
    /\bcheck (out )?(my |the )?(canvas|work|drawing|board)\b/,
    /\bshow you (my |the )?(canvas|work|drawing)\b/,
    /\b(can|could) you (please )?(look|see|check)\b/,
    /\bi (just )?(updated|changed|fixed|drew|wrote|finished|erased)\b/,
    /\bi (have|ve) (updated|changed|fixed|drew|drawn|written|finished)\b/,
    /\btake a look\b/,
    /\bhere('?s| is) (my |the )?(work|drawing|canvas|problem)\b/,
    /\bwhat do you (think|see) (about|of) (this|my work|the canvas)\b/,
  ];

  return patterns.some((re) => re.test(t));
}

export const LOOK_AT_CANVAS_TOOL = {
  type: "function" as const,
  name: "look_at_canvas",
  description:
    "Capture the student's current Wondoodle canvas so you can see it. Call this whenever the student asks you to look at their work, canvas, drawing, or problem, or says they updated or changed it. Do not invent what is on the canvas without calling this.",
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "Short reason, e.g. student asked to look or said they updated their work.",
      },
    },
    additionalProperties: false,
  },
};
