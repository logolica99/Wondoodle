"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Layer, Rect, Stage } from "react-konva";
import type Konva from "konva";
import { CanvasObjectRenderer, SelectableTransformer } from "./CanvasObjectRenderer";
import { TextEditor } from "./TextEditor";
import { CanvasEmptyState } from "./CanvasEmptyState";
import { PaperBackground } from "./PaperBackground";
import { ZoomControls } from "./ZoomControls";
import { VoiceNoteMarkersLayer } from "@/components/voice/VoiceNoteMarkersLayer";
import { useCanvasStore } from "@/store/canvasStore";
import { useUiStore } from "@/store/uiStore";
import { sortByZIndex } from "@/lib/canvas/document";

type Size = { width: number; height: number };
type Camera = { x: number; y: number; zoom: number };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const GRID_SIZE = 24;

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function SmartCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [viewport, setViewport] = useState<Size>({ width: 800, height: 600 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [emptyHidden, setEmptyHidden] = useState(false);
  const panSession = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const document = useCanvasStore((s) => s.document);
  const paperStyle = useUiStore((s) => s.paperStyle);
  const tool = useCanvasStore((s) => s.tool);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  const isHydrated = useCanvasStore((s) => s.isHydrated);
  const isDrawing = useCanvasStore((s) => s.isDrawing);

  const hydrate = useCanvasStore((s) => s.hydrate);
  const beginStroke = useCanvasStore((s) => s.beginStroke);
  const continueStroke = useCanvasStore((s) => s.continueStroke);
  const endStroke = useCanvasStore((s) => s.endStroke);
  const eraseAt = useCanvasStore((s) => s.eraseAt);
  const addTextAt = useCanvasStore((s) => s.addTextAt);
  const selectObject = useCanvasStore((s) => s.selectObject);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const flushSave = useCanvasStore((s) => s.flushSave);

  const isPanningTool = tool === "hand" || spacePressed;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewport({
        width: Math.max(320, Math.floor(entry.contentRect.width)),
        height: Math.max(320, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing =
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "INPUT" ||
        target?.isContentEditable;

      if (e.code === "Space" && !editing) {
        e.preventDefault();
        setSpacePressed(true);
      }

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if (
        !editing &&
        (e.key === "Delete" || e.key === "Backspace") &&
        !useCanvasStore.getState().editingTextId
      ) {
        e.preventDefault();
        deleteSelected();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePressed(false);
        panSession.current = null;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [undo, redo, deleteSelected]);

  useEffect(() => {
    const onVisibility = () => {
      if (window.document.visibilityState === "hidden") {
        void flushSave();
      }
    };
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", () => void flushSave());
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushSave]);

  // Wheel: zoom toward cursor, or pan with trackpad/shift.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      // Pinch-zoom / ctrl+wheel → zoom; otherwise pan the camera.
      if (e.ctrlKey || e.metaKey) {
        setCamera((prev) => {
          const nextZoom = clampZoom(prev.zoom * (e.deltaY > 0 ? 0.92 : 1.08));
          const worldX = (pointerX - prev.x) / prev.zoom;
          const worldY = (pointerY - prev.y) / prev.zoom;
          return {
            zoom: nextZoom,
            x: pointerX - worldX * nextZoom,
            y: pointerY - worldY * nextZoom,
          };
        });
        return;
      }

      setCamera((prev) => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const objects = useMemo(
    () => sortByZIndex(document.objects),
    [document.objects]
  );

  const editingText = objects.find(
    (o): o is Extract<typeof o, { type: "text" }> =>
      o.type === "text" && o.id === editingTextId
  );

  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => ({
      x: (screenX - camera.x) / camera.zoom,
      y: (screenY - camera.y) / camera.zoom,
    }),
    [camera]
  );

  const getPointer = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return screenToWorld(pos.x, pos.y);
  }, [screenToWorld]);

  const beginPan = useCallback(
    (screenX: number, screenY: number) => {
      panSession.current = {
        active: true,
        startX: screenX,
        startY: screenY,
        originX: camera.x,
        originY: camera.y,
      };
      setIsPanning(true);
    },
    [camera.x, camera.y]
  );

  const movePan = useCallback((screenX: number, screenY: number) => {
    const session = panSession.current;
    if (!session?.active) return;
    setCamera((prev) => ({
      ...prev,
      x: session.originX + (screenX - session.startX),
      y: session.originY + (screenY - session.startY),
    }));
  }, []);

  const endPan = useCallback(() => {
    panSession.current = null;
    setIsPanning(false);
  }, []);

  const handlePointerDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      if ("touches" in e.evt) {
        e.evt.preventDefault();
      }

      const pointerScreen = stage.getPointerPosition();
      if (!pointerScreen) return;

      const targetName = e.target.getClassName();
      const isTransformerHandle =
        e.target.getParent()?.getClassName() === "Transformer" ||
        e.target.name()?.includes("_anchor") ||
        e.target.name() === "back";

      const clickedOnEmpty =
        !isTransformerHandle &&
        (e.target === stage ||
          targetName === "Rect" ||
          e.target.name() === "board-bg" ||
          e.target.name() === "board-grid");

      if (isPanningTool) {
        beginPan(pointerScreen.x, pointerScreen.y);
        return;
      }

      if (tool === "select") {
        if (clickedOnEmpty) {
          selectObject(null);
        }
        return;
      }

      if (tool === "text") return;

      const pointer = screenToWorld(pointerScreen.x, pointerScreen.y);

      if (tool === "pen") {
        beginStroke(pointer.x, pointer.y);
      } else if (tool === "eraser") {
        eraseAt(pointer.x, pointer.y);
      }
    },
    [
      isPanningTool,
      tool,
      beginPan,
      selectObject,
      screenToWorld,
      beginStroke,
      eraseAt,
    ]
  );

  const handlePointerMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if ("touches" in e.evt && (isDrawing || tool === "eraser" || panSession.current?.active)) {
        e.evt.preventDefault();
      }

      const stage = stageRef.current;
      const pointerScreen = stage?.getPointerPosition();
      if (!pointerScreen) return;

      if (panSession.current?.active) {
        movePan(pointerScreen.x, pointerScreen.y);
        return;
      }

      const pointer = screenToWorld(pointerScreen.x, pointerScreen.y);

      if (tool === "pen" && isDrawing) {
        continueStroke(pointer.x, pointer.y);
      } else if (
        tool === "eraser" &&
        (("buttons" in e.evt && e.evt.buttons === 1) || "touches" in e.evt)
      ) {
        eraseAt(pointer.x, pointer.y);
      }
    },
    [tool, isDrawing, movePan, screenToWorld, continueStroke, eraseAt]
  );

  const handlePointerUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (panSession.current?.active) {
        endPan();
        return;
      }

      if (tool === "pen") {
        endStroke();
        return;
      }

      if (tool === "text") {
        const clickedOnEmpty =
          e.target === stageRef.current ||
          e.target.getClassName() === "Rect" ||
          e.target.name() === "board-bg" ||
          e.target.name() === "board-grid";
        if (!clickedOnEmpty) return;
        const pointer = getPointer();
        if (!pointer) return;
        addTextAt(pointer.x, pointer.y);
      }
    },
    [tool, endPan, endStroke, getPointer, addTextAt]
  );

  const cursor = isPanning
    ? "grabbing"
    : isPanningTool
      ? "grab"
      : tool === "pen"
        ? "crosshair"
        : tool === "eraser"
          ? "cell"
          : tool === "text"
            ? "text"
            : "default";

  useEffect(() => {
    if (!isHydrated) return;
    if (objects.length > 0) {
      setEmptyHidden(true);
    } else {
      // Show again after clear / undo-to-empty; never over saved work.
      setEmptyHidden(false);
    }
  }, [isHydrated, objects.length]);

  const showEmpty = isHydrated && objects.length === 0 && !emptyHidden;

  const zoomTowardCenter = useCallback(
    (nextZoom: number) => {
      setCamera((prev) => {
        const z = clampZoom(nextZoom);
        const cx = viewport.width / 2;
        const cy = viewport.height / 2;
        const worldX = (cx - prev.x) / prev.zoom;
        const worldY = (cy - prev.y) / prev.zoom;
        return {
          zoom: z,
          x: cx - worldX * z,
          y: cy - worldY * z,
        };
      });
    },
    [viewport.width, viewport.height]
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-white"
      data-testid="smart-canvas"
      style={{ touchAction: "none" }}
    >
      {!isHydrated && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-[#FFFEFB]/80 text-sm text-slate-500"
          data-testid="canvas-loading"
        >
          Restoring your workspace…
        </div>
      )}

      <CanvasEmptyState visible={showEmpty} />

      <VoiceNoteMarkersLayer camera={camera} />

      <div className="pointer-events-none absolute bottom-[12.5rem] right-3 z-20 sm:bottom-5 sm:right-5">
        <ZoomControls
          zoom={camera.zoom}
          onZoomIn={() => zoomTowardCenter(camera.zoom * 1.12)}
          onZoomOut={() => zoomTowardCenter(camera.zoom / 1.12)}
          onReset={() => setCamera({ x: 0, y: 0, zoom: 1 })}
        />
      </div>

      <Stage
        ref={stageRef}
        width={viewport.width}
        height={viewport.height}
        onMouseDown={(e) => {
          if (objects.length === 0) setEmptyHidden(true);
          handlePointerDown(e);
        }}
        onMousemove={handlePointerMove}
        onMouseup={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={(e) => {
          if (objects.length === 0) setEmptyHidden(true);
          handlePointerDown(e);
        }}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{ cursor }}
        data-testid="konva-stage"
      >
        <Layer listening={false}>
          <PaperBackground
            style={paperStyle}
            viewport={viewport}
            camera={camera}
            step={GRID_SIZE}
          />
        </Layer>

        {/* World layer — pan/zoom like Excalidraw */}
        <Layer x={camera.x} y={camera.y} scaleX={camera.zoom} scaleY={camera.zoom}>
          <Rect
            name="board-bg"
            x={-4000}
            y={-4000}
            width={8000}
            height={8000}
            fill="rgba(255,254,251,0.01)"
          />
          {objects.map((obj) => (
            <CanvasObjectRenderer
              key={obj.id}
              object={obj}
              isSelected={selectedId === obj.id}
              draggable={tool === "select" && !isPanningTool}
            />
          ))}
          <SelectableTransformer
            selectedId={selectedId}
            enabled={
              tool === "select" &&
              !isPanningTool &&
              !!selectedId &&
              !editingTextId &&
              objects.some((o) => o.id === selectedId)
            }
          />
        </Layer>
      </Stage>

      {editingText && (
        <TextEditor
          object={editingText}
          scale={camera.zoom}
          offset={{ x: camera.x, y: camera.y }}
        />
      )}
    </div>
  );
}
