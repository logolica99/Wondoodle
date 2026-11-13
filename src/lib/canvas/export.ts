import {
  CanvasDocument,
  CanvasObject,
  ExportResult,
  ImageObject,
  StrokeObject,
  TextObject,
} from "@/types/canvas";
import { getObjectBounds, sortByZIndex } from "./document";
import { paintPaperBackground, type PaperStyle } from "./paper";

export function getDocumentExportBounds(doc: CanvasDocument) {
  if (doc.objects.length === 0) {
    return {
      x: 0,
      y: 0,
      width: Math.max(800, doc.width || 800),
      height: Math.max(600, doc.height || 600),
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of doc.objects) {
    const bounds = getObjectBounds(obj);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  const pad = 48;
  return {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(100, maxX - minX + pad * 2),
    height: Math.max(100, maxY - minY + pad * 2),
  };
}

export function exportDocumentJson(doc: CanvasDocument): CanvasDocument {
  return structuredClone(doc);
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for export"));
    img.src = src;
  });
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeObject
) {
  const { points, color, strokeWidth, opacity } = stroke;
  if (points.length < 4) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, textObj: TextObject) {
  ctx.save();
  ctx.fillStyle = textObj.color;
  ctx.font = `${textObj.fontSize}px ${textObj.fontFamily}`;
  ctx.textBaseline = "top";

  const lines = textObj.text.split("\n");
  const lineHeight = textObj.fontSize * 1.35;
  lines.forEach((line, index) => {
    ctx.fillText(line, textObj.x, textObj.y + index * lineHeight, textObj.width);
  });
  ctx.restore();
}

async function drawImage(
  ctx: CanvasRenderingContext2D,
  imageObj: ImageObject
) {
  const img = await loadImageElement(imageObj.src);
  ctx.drawImage(
    img,
    imageObj.x,
    imageObj.y,
    imageObj.width,
    imageObj.height
  );
}

export async function renderDocumentToCanvas(
  doc: CanvasDocument,
  options?: { width?: number; height?: number; paperStyle?: PaperStyle }
): Promise<HTMLCanvasElement> {
  const bounds = getDocumentExportBounds(doc);
  const width = options?.width ?? Math.ceil(bounds.width);
  const height = options?.height ?? Math.ceil(bounds.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas context for export");
  }

  ctx.save();
  ctx.translate(-bounds.x, -bounds.y);
  paintPaperBackground(
    ctx,
    options?.paperStyle ?? "blank",
    bounds.x,
    bounds.y,
    width,
    height
  );

  const objects = sortByZIndex(doc.objects);
  for (const obj of objects) {
    await drawObject(ctx, obj);
  }
  ctx.restore();

  return canvas;
}

async function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject
) {
  switch (obj.type) {
    case "stroke":
      drawStroke(ctx, obj);
      break;
    case "text":
      drawText(ctx, obj);
      break;
    case "image":
      await drawImage(ctx, obj);
      break;
  }
}

export async function exportDocument(
  doc: CanvasDocument,
  options?: { paperStyle?: PaperStyle }
): Promise<ExportResult> {
  const json = exportDocumentJson(doc);
  const canvas = await renderDocumentToCanvas(doc, {
    paperStyle: options?.paperStyle ?? "blank",
  });
  const imageDataUrl = canvas.toDataURL("image/png");
  const imageBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Failed to create PNG blob"));
      else resolve(blob);
    }, "image/png");
  });

  return { json, imageBlob, imageDataUrl };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Invalid image file"));
    img.src = src;
  });
}
