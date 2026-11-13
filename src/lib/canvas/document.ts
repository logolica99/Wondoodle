import { v4 as uuidv4 } from "uuid";
import {
  CanvasDocument,
  CanvasObject,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_DOCUMENT_ID,
  DOCUMENT_SCHEMA_VERSION,
  ImageObject,
  StrokeObject,
  TextObject,
} from "@/types/canvas";

/** Prefer the live UI font so Konva text matches Baloo 2 on the page. */
export function getCanvasFontFamily(): string {
  if (typeof window !== "undefined") {
    const family = window.getComputedStyle(document.body).fontFamily;
    if (family) return family;
  }
  return '"Nunito", system-ui, sans-serif';
}

export function createEmptyDocument(
  id: string = DEFAULT_DOCUMENT_ID,
  title = "Untitled Notes"
): CanvasDocument {
  const now = Date.now();
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id,
    title,
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
    backgroundColor: "#FFFEFB",
    objects: [],
    voiceNotes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createStrokeObject(
  points: number[],
  color: string,
  strokeWidth: number,
  zIndex: number
): StrokeObject {
  const now = Date.now();
  return {
    id: uuidv4(),
    type: "stroke",
    points,
    color,
    strokeWidth,
    opacity: 1,
    zIndex,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTextObject(
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number,
  zIndex: number
): TextObject {
  const now = Date.now();
  return {
    id: uuidv4(),
    type: "text",
    x,
    y,
    width: Math.max(160, fontSize * 8),
    height: Math.max(40, fontSize * 1.6),
    text,
    fontSize,
    color,
    fontFamily: getCanvasFontFamily(),
    zIndex,
    createdAt: now,
    updatedAt: now,
  };
}

export function createImageObject(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  mimeType: string;
  zIndex: number;
}): ImageObject {
  const now = Date.now();
  return {
    id: uuidv4(),
    type: "image",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

export function nextZIndex(objects: CanvasObject[]): number {
  if (objects.length === 0) return 1;
  return Math.max(...objects.map((o) => o.zIndex)) + 1;
}

export function sortByZIndex(objects: CanvasObject[]): CanvasObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex);
}

export function cloneObjects(objects: CanvasObject[]): CanvasObject[] {
  return structuredClone(objects);
}

export function getObjectBounds(obj: CanvasObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (obj.type === "stroke") {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < obj.points.length; i += 2) {
      xs.push(obj.points[i]);
      ys.push(obj.points[i + 1]);
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = obj.strokeWidth;
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
  };
}

export function hitTestStroke(
  obj: StrokeObject,
  x: number,
  y: number,
  threshold = 8
): boolean {
  const points = obj.points;
  const hitRadius = Math.max(threshold, obj.strokeWidth / 2 + 4);
  for (let i = 0; i < points.length - 2; i += 2) {
    const dist = distanceToSegment(
      x,
      y,
      points[i],
      points[i + 1],
      points[i + 2],
      points[i + 3]
    );
    if (dist <= hitRadius) return true;
  }
  return false;
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
  );
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export function serializeDocument(doc: CanvasDocument): string {
  return JSON.stringify(doc);
}

export function deserializeDocument(raw: string): CanvasDocument {
  const parsed = JSON.parse(raw) as CanvasDocument;
  if (!parsed.schemaVersion || !parsed.id || !Array.isArray(parsed.objects)) {
    throw new Error("Invalid document schema");
  }
  return parsed;
}
