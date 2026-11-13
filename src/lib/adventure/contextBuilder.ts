"use client";

import type { CanvasDocument, CanvasObject } from "@/types/canvas";
import { exportCanvasSnapshot } from "@/lib/canvas/snapshot";
import type { PaperStyle } from "@/lib/canvas/paper";

export type CanvasObjectSummary = {
  objectCount: number;
  textSnippets: string[];
  hasImages: boolean;
  hasStrokes: boolean;
};

export type AdventureCanvasContext = {
  snapshotDataUrl: string;
  width: number;
  height: number;
  canvasVersion: number;
  documentId: string;
  objectSummary: CanvasObjectSummary;
  textContent: string;
};

function isStroke(o: CanvasObject): boolean {
  return o.type === "stroke";
}

function isText(o: CanvasObject): boolean {
  return o.type === "text";
}

function isImage(o: CanvasObject): boolean {
  return o.type === "image";
}

export function summarizeCanvasObjects(doc: CanvasDocument): CanvasObjectSummary {
  const textSnippets: string[] = [];
  let hasImages = false;
  let hasStrokes = false;
  for (const obj of doc.objects) {
    if (isStroke(obj)) hasStrokes = true;
    if (isImage(obj)) hasImages = true;
    if (isText(obj) && obj.type === "text") {
      const t = obj.text.trim();
      if (t) textSnippets.push(t.slice(0, 120));
    }
  }
  return {
    objectCount: doc.objects.length,
    textSnippets: textSnippets.slice(0, 12),
    hasImages,
    hasStrokes,
  };
}

/**
 * Capture an actual JPEG of the canvas for vision planning.
 * Fails honestly when empty or capture fails — never fabricates a description.
 */
export async function buildAdventureCanvasContext(
  doc: CanvasDocument,
  options?: { paperStyle?: PaperStyle }
): Promise<
  | { ok: true; context: AdventureCanvasContext }
  | { ok: false; error: string; empty?: boolean }
> {
  const snap = await exportCanvasSnapshot(doc, {
    paperStyle: options?.paperStyle ?? "blank",
    maxEdge: 1280,
    quality: 0.78,
  });

  if (!snap.ok) {
    return {
      ok: false,
      error: snap.error,
      empty: snap.empty,
    };
  }

  const objectSummary = summarizeCanvasObjects(doc);
  return {
    ok: true,
    context: {
      snapshotDataUrl: snap.dataUrl,
      width: snap.width,
      height: snap.height,
      canvasVersion: doc.schemaVersion,
      documentId: doc.id,
      objectSummary,
      textContent: objectSummary.textSnippets.join(" · "),
    },
  };
}

/** Hash-ish fingerprint of object ids + counts for change detection. */
export function canvasFingerprint(doc: CanvasDocument): string {
  const parts = doc.objects
    .map((o) => {
      if (o.type === "stroke") {
        const x = Math.round(o.points[0] ?? 0);
        const y = Math.round(o.points[1] ?? 0);
        return `${o.id}:stroke:${x}:${y}:${o.points.length}`;
      }
      return `${o.id}:${o.type}:${Math.round(o.x)}:${Math.round(o.y)}`;
    })
    .sort();
  return `${doc.objects.length}|${parts.join("|")}`;
}
