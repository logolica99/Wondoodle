"use client";

import { create } from "zustand";
import {
  ACCEPTED_IMAGE_TYPES,
  CanvasDocument,
  CanvasObject,
  DEFAULT_DOCUMENT_ID,
  ImageObject,
  MAX_IMAGE_SIZE_BYTES,
  PenSettings,
  SaveStatus,
  StrokeObject,
  TextObject,
  TextSettings,
  ToolType,
} from "@/types/canvas";
import {
  createEmptyDocument,
  createImageObject,
  createStrokeObject,
  createTextObject,
  hitTestStroke,
  nextZIndex,
  sortByZIndex,
} from "@/lib/canvas/document";
import { HistoryStack, snapshotFrom } from "@/lib/canvas/history";
import {
  createDebouncedSaver,
  loadDocument,
  saveDocument,
} from "@/lib/canvas/storage";
import {
  downloadBlob,
  exportDocument,
  fileToDataUrl,
  getImageDimensions,
} from "@/lib/canvas/export";
import { useUiStore } from "@/store/uiStore";

const history = new HistoryStack();
const debouncedSaver = createDebouncedSaver(saveDocument, 450);

type CanvasStore = {
  document: CanvasDocument;
  tool: ToolType;
  selectedId: string | null;
  editingTextId: string | null;
  pen: PenSettings;
  textSettings: TextSettings;
  saveStatus: SaveStatus;
  saveError: string | null;
  isHydrated: boolean;
  isDrawing: boolean;
  currentStrokeId: string | null;
  imageError: string | null;
  canUndo: boolean;
  canRedo: boolean;

  hydrate: () => Promise<void>;
  setTool: (tool: ToolType) => void;
  setTitle: (title: string) => void;
  setPenColor: (color: string) => void;
  setPenWidth: (width: number) => void;
  setTextColor: (color: string) => void;
  setTextSize: (size: number) => void;
  selectObject: (id: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  clearImageError: () => void;

  beginStroke: (x: number, y: number) => void;
  continueStroke: (x: number, y: number) => void;
  endStroke: () => void;
  eraseAt: (x: number, y: number) => void;

  addTextAt: (x: number, y: number) => void;
  updateTextContent: (id: string, text: string) => void;
  commitTextEdit: (id: string) => void;

  uploadImage: (file: File, x?: number, y?: number) => Promise<void>;

  updateObjectTransform: (
    id: string,
    patch: Partial<
      Pick<TextObject, "x" | "y" | "width" | "height" | "fontSize" | "color" | "text">
    > &
      Partial<Pick<ImageObject, "x" | "y" | "width" | "height">> &
      Partial<Pick<StrokeObject, "strokeWidth">> &
      Partial<{ points: number[] }>,
    options?: { recordHistory?: boolean }
  ) => void;
  beginTransform: () => void;
  endTransform: () => void;
  setCanvasSize: (width: number, height: number) => void;

  deleteSelected: () => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  exportPng: () => Promise<void>;
  getExportableDocument: () => CanvasDocument;
  flushSave: () => Promise<void>;
};

function syncHistoryFlags(set: (partial: Partial<CanvasStore>) => void) {
  set({
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
  });
}

function withHistory(
  get: () => CanvasStore,
  set: (partial: Partial<CanvasStore> | ((s: CanvasStore) => Partial<CanvasStore>)) => void,
  mutate: (doc: CanvasDocument) => CanvasDocument
) {
  const current = get().document;
  history.push(snapshotFrom(current.objects, current.title));
  const next = mutate(structuredClone(current));
  next.updatedAt = Date.now();
  set({
    document: next,
    saveStatus: "saving",
    saveError: null,
  });
  syncHistoryFlags(set);
  scheduleSave(get, set, next);
}

function scheduleSave(
  get: () => CanvasStore,
  set: (partial: Partial<CanvasStore>) => void,
  doc: CanvasDocument
) {
  set({ saveStatus: "saving", saveError: null });
  debouncedSaver.schedule(doc);
  window.setTimeout(async () => {
    try {
      await debouncedSaver.flushNow();
      if (get().document.updatedAt === doc.updatedAt || get().saveStatus === "saving") {
        set({ saveStatus: "saved", saveError: null });
      }
    } catch {
      set({
        saveStatus: "error",
        saveError: "We couldn't save your work yet. Please try again.",
      });
    }
  }, 500);
}

let transformSnapshotTaken = false;

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  document: createEmptyDocument(DEFAULT_DOCUMENT_ID),
  tool: "pen",
  selectedId: null,
  editingTextId: null,
  pen: { color: "#7357E8", strokeWidth: 4 },
  textSettings: { color: "#1F2937", fontSize: 24 },
  saveStatus: "idle",
  saveError: null,
  isHydrated: false,
  isDrawing: false,
  currentStrokeId: null,
  imageError: null,
  canUndo: false,
  canRedo: false,

  hydrate: async () => {
    try {
      const doc = await loadDocument(DEFAULT_DOCUMENT_ID);
      set({
        document: doc,
        isHydrated: true,
        saveStatus: "saved",
        saveError: null,
      });
      history.clear();
      syncHistoryFlags(set);
    } catch (error) {
      set({
        document: createEmptyDocument(DEFAULT_DOCUMENT_ID),
        isHydrated: true,
        saveStatus: "error",
        saveError:
          error instanceof Error
            ? error.message
            : "Could not restore your previous work.",
      });
    }
  },

  setTool: (tool) => {
    const { editingTextId, selectedId } = get();
    if (editingTextId) {
      get().commitTextEdit(editingTextId);
    }
    set({
      tool,
      selectedId: tool === "select" ? selectedId : null,
      editingTextId: null,
      imageError: null,
    });
  },

  setTitle: (title) => {
    const current = get().document;
    if (!transformSnapshotTaken) {
      history.push(snapshotFrom(current.objects, current.title));
      transformSnapshotTaken = true;
      syncHistoryFlags(set);
    }
    const next = { ...current, title, updatedAt: Date.now() };
    set({ document: next, saveStatus: "saving" });
    scheduleSave(get, set, next);
    // End title-edit history grouping shortly after typing pauses
    window.setTimeout(() => {
      transformSnapshotTaken = false;
    }, 800);
  },

  setPenColor: (color) => set((s) => ({ pen: { ...s.pen, color } })),
  setPenWidth: (strokeWidth) => set((s) => ({ pen: { ...s.pen, strokeWidth } })),
  setTextColor: (color) =>
    set((s) => ({ textSettings: { ...s.textSettings, color } })),
  setTextSize: (fontSize) =>
    set((s) => ({ textSettings: { ...s.textSettings, fontSize } })),

  selectObject: (id) => {
    const { editingTextId } = get();
    // Keep the active editor open if the same text object is re-selected.
    if (editingTextId && id !== editingTextId) {
      get().commitTextEdit(editingTextId);
    }
    set({
      selectedId: id,
      editingTextId: id && id === editingTextId ? editingTextId : null,
    });
  },
  setEditingTextId: (id) => {
    const { editingTextId } = get();
    if (editingTextId && editingTextId !== id) {
      get().commitTextEdit(editingTextId);
    }
    set({ editingTextId: id, selectedId: id ?? get().selectedId });
  },
  clearImageError: () => set({ imageError: null }),

  beginStroke: (x, y) => {
    const { tool, pen, document: doc } = get();
    if (tool !== "pen") return;

    history.push(snapshotFrom(doc.objects, doc.title));
    const stroke = createStrokeObject(
      [x, y],
      pen.color,
      pen.strokeWidth,
      nextZIndex(doc.objects)
    );
    const next = {
      ...doc,
      objects: [...doc.objects, stroke],
      updatedAt: Date.now(),
    };
    set({
      document: next,
      isDrawing: true,
      currentStrokeId: stroke.id,
      selectedId: null,
      saveStatus: "saving",
    });
    syncHistoryFlags(set);
  },

  continueStroke: (x, y) => {
    const { isDrawing, currentStrokeId, document: doc } = get();
    if (!isDrawing || !currentStrokeId) return;

    const objects = doc.objects.map((obj) => {
      if (obj.id !== currentStrokeId || obj.type !== "stroke") return obj;
      return {
        ...obj,
        points: [...obj.points, x, y],
        updatedAt: Date.now(),
      } satisfies StrokeObject;
    });

    set({
      document: { ...doc, objects, updatedAt: Date.now() },
    });
  },

  endStroke: () => {
    const { isDrawing, document: doc } = get();
    if (!isDrawing) return;
    set({ isDrawing: false, currentStrokeId: null });
    scheduleSave(get, set, doc);
  },

  eraseAt: (x, y) => {
    const { tool, document: doc } = get();
    if (tool !== "eraser") return;

    const sorted = sortByZIndex(doc.objects).reverse();
    const hit = sorted.find(
      (obj) => obj.type === "stroke" && hitTestStroke(obj, x, y)
    );
    if (!hit) return;

    withHistory(get, set, (d) => {
      d.objects = d.objects.filter((o) => o.id !== hit.id);
      return d;
    });
    set({ selectedId: null });
  },

  addTextAt: (x, y) => {
    const { textSettings, editingTextId } = get();
    if (editingTextId) {
      get().commitTextEdit(editingTextId);
    }
    let newId = "";
    withHistory(get, set, (d) => {
      const textObj = createTextObject(
        x,
        y,
        "",
        textSettings.color,
        textSettings.fontSize,
        nextZIndex(d.objects)
      );
      newId = textObj.id;
      d.objects = [...d.objects, textObj];
      return d;
    });
    // Open the editor after the pointer gesture ends so blur doesn't fire immediately.
    window.setTimeout(() => {
      set({
        selectedId: newId,
        editingTextId: newId,
        tool: "select",
      });
    }, 0);
  },

  updateTextContent: (id, text) => {
    const { editingTextId, document: doc } = get();
    // Capture one history snapshot at the start of an edit session.
    if (editingTextId === id && !transformSnapshotTaken) {
      history.push(snapshotFrom(doc.objects, doc.title));
      transformSnapshotTaken = true;
      syncHistoryFlags(set);
    }

    const objects = doc.objects.map((obj) => {
      if (obj.id !== id || obj.type !== "text") return obj;
      return { ...obj, text, updatedAt: Date.now() } satisfies TextObject;
    });
    const next = { ...doc, objects, updatedAt: Date.now() };
    set({ document: next, saveStatus: "saving" });
    scheduleSave(get, set, next);
  },

  commitTextEdit: (id) => {
    if (get().editingTextId !== id) return;

    const alreadySnapshotted = transformSnapshotTaken;
    transformSnapshotTaken = false;
    const current = get().document;
    const textObj = current.objects.find(
      (o): o is TextObject => o.id === id && o.type === "text"
    );

    if (!textObj) {
      set({ editingTextId: null });
      return;
    }

    const trimmed = textObj.text.trim();

    // Drop brand-new empty boxes; keep whitespace-only as cleared empty removal.
    if (trimmed === "") {
      if (alreadySnapshotted) {
        const next = {
          ...current,
          objects: current.objects.filter((o) => o.id !== id),
          updatedAt: Date.now(),
        };
        set({
          document: next,
          editingTextId: null,
          selectedId: null,
          saveStatus: "saving",
        });
        scheduleSave(get, set, next);
      } else {
        withHistory(get, set, (d) => {
          d.objects = d.objects.filter((o) => o.id !== id);
          return d;
        });
        set({ editingTextId: null, selectedId: null });
      }
      return;
    }

    if (textObj.text !== trimmed) {
      const objects = current.objects.map((obj) =>
        obj.id === id && obj.type === "text"
          ? { ...obj, text: trimmed, updatedAt: Date.now() }
          : obj
      );
      const next = { ...current, objects, updatedAt: Date.now() };
      set({ document: next, editingTextId: null, selectedId: id });
      syncHistoryFlags(set);
      scheduleSave(get, set, next);
      return;
    }

    set({ editingTextId: null, selectedId: id });
    syncHistoryFlags(set);
    scheduleSave(get, set, current);
  },

  uploadImage: async (file, x = 80, y = 80) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      set({
        imageError: "That picture didn't work. Try a PNG, JPG, or WebP.",
      });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      set({
        imageError: "That picture is too big. Try one under 10 MB.",
      });
      return;
    }

    try {
      const src = await fileToDataUrl(file);
      const { width: naturalWidth, height: naturalHeight } =
        await getImageDimensions(src);

      const maxDim = 480;
      const scale = Math.min(1, maxDim / Math.max(naturalWidth, naturalHeight));
      const width = Math.round(naturalWidth * scale);
      const height = Math.round(naturalHeight * scale);

      let newId = "";
      withHistory(get, set, (d) => {
        const image = createImageObject({
          x,
          y,
          width,
          height,
          src,
          naturalWidth,
          naturalHeight,
          mimeType: file.type,
          zIndex: nextZIndex(d.objects),
        });
        newId = image.id;
        d.objects = [...d.objects, image];
        return d;
      });
      set({
        selectedId: newId,
        tool: "select",
        imageError: null,
      });
    } catch {
      set({
        imageError: "That picture didn't work. Try a PNG, JPG, or WebP.",
      });
    }
  },

  beginTransform: () => {
    if (transformSnapshotTaken) return;
    const { document: doc } = get();
    history.push(snapshotFrom(doc.objects, doc.title));
    transformSnapshotTaken = true;
    // Do not syncHistoryFlags here — a React re-render mid-drag/resize
    // fights Konva's transient node scale/position and breaks transforming.
  },

  endTransform: () => {
    transformSnapshotTaken = false;
    const doc = get().document;
    syncHistoryFlags(set);
    scheduleSave(get, set, doc);
  },

  setCanvasSize: (width, height) => {
    const doc = get().document;
    if (doc.width === width && doc.height === height) return;
    set({
      document: {
        ...doc,
        width,
        height,
        updatedAt: Date.now(),
      },
    });
  },

  updateObjectTransform: (id, patch, options) => {
    if (options?.recordHistory) {
      get().beginTransform();
    }
    const doc = get().document;
    const objects = doc.objects.map((obj) => {
      if (obj.id !== id) return obj;
      if (obj.type === "stroke" && (patch.points || patch.strokeWidth != null)) {
        return {
          ...obj,
          ...(patch.points ? { points: patch.points } : {}),
          ...(patch.strokeWidth != null
            ? { strokeWidth: patch.strokeWidth }
            : {}),
          updatedAt: Date.now(),
        };
      }
      if (obj.type === "text" || obj.type === "image") {
        return {
          ...obj,
          ...patch,
          updatedAt: Date.now(),
        } as CanvasObject;
      }
      return obj;
    });
    const next = { ...doc, objects, updatedAt: Date.now() };
    set({ document: next, saveStatus: "saving" });
  },

  deleteSelected: () => {
    const { selectedId, editingTextId, document: doc } = get();
    if (!selectedId || editingTextId) return;
    if (!doc.objects.some((o) => o.id === selectedId)) return;

    withHistory(get, set, (d) => {
      d.objects = d.objects.filter((o) => o.id !== selectedId);
      // Preserve explanations: unanchor notes tied to the deleted object.
      d.voiceNotes = (d.voiceNotes ?? []).map((note) =>
        note.anchor.type === "object" && note.anchor.objectId === selectedId
          ? {
              ...note,
              anchor: { type: "unanchored" as const },
              updatedAt: Date.now(),
            }
          : note
      );
      return d;
    });
    set({ selectedId: null });
  },

  clearCanvas: () => {
    withHistory(get, set, (d) => {
      d.objects = [];
      // Keep transcripts, but detach them from removed drawings.
      d.voiceNotes = (d.voiceNotes ?? []).map((note) => ({
        ...note,
        anchor: { type: "unanchored" as const },
        updatedAt: Date.now(),
      }));
      return d;
    });
    set({ selectedId: null, editingTextId: null });
  },

  undo: () => {
    const current = get().document;
    const previous = history.undo(
      snapshotFrom(current.objects, current.title)
    );
    if (!previous) return;
    const next = {
      ...current,
      objects: previous.objects,
      title: previous.title,
      updatedAt: Date.now(),
    };
    set({
      document: next,
      selectedId: null,
      editingTextId: null,
      isDrawing: false,
      currentStrokeId: null,
    });
    syncHistoryFlags(set);
    scheduleSave(get, set, next);
  },

  redo: () => {
    const current = get().document;
    const nextSnap = history.redo(
      snapshotFrom(current.objects, current.title)
    );
    if (!nextSnap) return;
    const next = {
      ...current,
      objects: nextSnap.objects,
      title: nextSnap.title,
      updatedAt: Date.now(),
    };
    set({
      document: next,
      selectedId: null,
      editingTextId: null,
    });
    syncHistoryFlags(set);
    scheduleSave(get, set, next);
  },

  exportPng: async () => {
    const paperStyle = useUiStore.getState().paperStyle;
    const result = await exportDocument(get().document, { paperStyle });
    const safeTitle =
      get().document.title.replace(/[^\w\-]+/g, "_").slice(0, 40) ||
      "wondoodle";
    downloadBlob(result.imageBlob, `${safeTitle}.png`);
  },

  getExportableDocument: () => structuredClone(get().document),

  flushSave: async () => {
    try {
      await debouncedSaver.flushNow();
      await saveDocument(get().document);
      set({ saveStatus: "saved", saveError: null });
    } catch (error) {
      set({
        saveStatus: "error",
        saveError:
          error instanceof Error
            ? error.message
            : "Failed to save your work locally.",
      });
    }
  },
}));
