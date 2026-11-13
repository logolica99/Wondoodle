import type { VoiceNote } from "./voice";

export type ToolType = "select" | "hand" | "pen" | "eraser" | "text" | "image";

export type Point = {
  x: number;
  y: number;
};

export type BaseCanvasObject = {
  id: string;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
};

export type StrokeObject = BaseCanvasObject & {
  type: "stroke";
  points: number[];
  color: string;
  strokeWidth: number;
  opacity: number;
};

export type TextObject = BaseCanvasObject & {
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
};

export type ImageObject = BaseCanvasObject & {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  mimeType: string;
};

export type CanvasObject = StrokeObject | TextObject | ImageObject;

export type CanvasDocument = {
  schemaVersion: number;
  id: string;
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  objects: CanvasObject[];
  /** Present from schemaVersion 2+. Older docs migrate to []. */
  voiceNotes: VoiceNote[];
  createdAt: number;
  updatedAt: number;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PenSettings = {
  color: string;
  strokeWidth: number;
};

export type TextSettings = {
  color: string;
  fontSize: number;
};

export type HistorySnapshot = {
  objects: CanvasObject[];
  title: string;
};

export type ExportResult = {
  json: CanvasDocument;
  imageBlob: Blob;
  imageDataUrl: string;
};

export const DOCUMENT_SCHEMA_VERSION = 2;
export const DEFAULT_DOCUMENT_ID = "wondoodle-default";
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const PEN_COLORS = [
  "#28304A",
  "#7357E8",
  "#FF91B6",
  "#58D9B0",
  "#76B8FF",
  "#FFD66D",
  "#E85D5D",
  "#FFFFFF",
] as const;

export const DEFAULT_CANVAS_WIDTH = 1200;
export const DEFAULT_CANVAS_HEIGHT = 800;
