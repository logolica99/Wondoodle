import type { CanvasDocument } from "@/types/canvas";
import { exportDocument, renderDocumentToCanvas } from "./export";
import type { PaperStyle } from "./paper";

export type CanvasSnapshotResult =
  | {
      ok: true;
      dataUrl: string;
      width: number;
      height: number;
      empty: boolean;
    }
  | {
      ok: false;
      error: string;
      empty?: boolean;
    };

/**
 * Event-driven canvas snapshot for Pip. Resizes to a modest max edge
 * so Realtime image input stays reliable over the data channel.
 */
export async function exportCanvasSnapshot(
  doc: CanvasDocument,
  options?: {
    paperStyle?: PaperStyle;
    maxEdge?: number;
    quality?: number;
  }
): Promise<CanvasSnapshotResult> {
  try {
    if (!doc.objects.length) {
      return {
        ok: false,
        empty: true,
        error:
          "Your canvas is empty. Draw or write something first, then show Pip.",
      };
    }

    const maxEdge = options?.maxEdge ?? 1024;
    const quality = options?.quality ?? 0.72;
    const canvas = await renderDocumentToCanvas(doc, {
      paperStyle: options?.paperStyle ?? "blank",
    });

    const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
    const width = Math.max(1, Math.round(canvas.width * scale));
    const height = Math.max(1, Math.round(canvas.height * scale));

    const resized = document.createElement("canvas");
    resized.width = width;
    resized.height = height;
    const ctx = resized.getContext("2d");
    if (!ctx) {
      return { ok: false, error: "Could not prepare a picture of your work." };
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(canvas, 0, 0, width, height);

    const dataUrl = resized.toDataURL("image/jpeg", quality);
    return { ok: true, dataUrl, width, height, empty: false };
  } catch {
    // Fallback path through full export helper if needed
    try {
      const result = await exportDocument(doc, {
        paperStyle: options?.paperStyle ?? "blank",
      });
      return {
        ok: true,
        dataUrl: result.imageDataUrl,
        width: 800,
        height: 600,
        empty: false,
      };
    } catch {
      return {
        ok: false,
        error: "I couldn't capture your canvas. Please try again.",
      };
    }
  }
}
