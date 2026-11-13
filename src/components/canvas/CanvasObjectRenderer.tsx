"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Group,
  Image as KonvaImage,
  Line,
  Rect,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import { CanvasObject, ImageObject, StrokeObject, TextObject } from "@/types/canvas";
import { useCanvasStore } from "@/store/canvasStore";
import { getObjectBounds } from "@/lib/canvas/document";

type Props = {
  object: CanvasObject;
  isSelected: boolean;
  draggable: boolean;
};

function useHtmlImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return image;
}

function findNodeById(stage: Konva.Stage, id: string) {
  return stage.findOne((node: Konva.Node) => node.id() === id) ?? null;
}

export function SelectableTransformer({
  selectedId,
  enabled,
}: {
  selectedId: string | null;
  enabled: boolean;
}) {
  const trRef = useRef<Konva.Transformer>(null);

  useLayoutEffect(() => {
    const tr = trRef.current;
    if (!tr) return;

    const attach = () => {
      const stage = tr.getStage();
      if (!stage || !selectedId || !enabled) {
        tr.nodes([]);
        tr.getLayer()?.batchDraw();
        return;
      }
      const node = findNodeById(stage, selectedId);
      if (!node) {
        tr.nodes([]);
        tr.getLayer()?.batchDraw();
        return;
      }
      // Groups often report width/height 0 — use client rect instead.
      const rect = node.getClientRect({ skipTransform: true });
      if (rect.width < 1 && rect.height < 1 && node.width() < 1 && node.height() < 1) {
        tr.nodes([]);
        tr.getLayer()?.batchDraw();
        return;
      }
      tr.nodes([node]);
      tr.forceUpdate();
      tr.moveToTop();
      tr.getLayer()?.batchDraw();
    };

    attach();
    // Image nodes may mount/size after their HTMLImage loads.
    const raf = requestAnimationFrame(attach);
    const interval = window.setInterval(attach, 50);
    const timer = window.setTimeout(() => window.clearInterval(interval), 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [selectedId, enabled]);

  return (
    <Transformer
      ref={trRef}
      visible={enabled}
      enabledAnchors={[
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "middle-left",
        "middle-right",
        "top-center",
        "bottom-center",
      ]}
      rotateEnabled={false}
      ignoreStroke
      padding={4}
      anchorSize={12}
      anchorCornerRadius={2}
      anchorStroke="#5B4FCF"
      anchorFill="#FFFFFF"
      anchorStrokeWidth={2}
      borderStroke="#5B4FCF"
      borderStrokeWidth={1.5}
      borderDash={[5, 4]}
      boundBoxFunc={(oldBox, newBox) => {
        if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
          return oldBox;
        }
        return newBox;
      }}
      // Stop stage selection logic from treating anchor presses as empty clicks.
      onMouseDown={(e) => {
        e.cancelBubble = true;
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
      }}
    />
  );
}

function StrokeRenderer({
  object,
  draggable,
}: {
  object: StrokeObject;
  isSelected: boolean;
  draggable: boolean;
}) {
  const beginTransform = useCanvasStore((s) => s.beginTransform);
  const endTransform = useCanvasStore((s) => s.endTransform);
  const updateObjectTransform = useCanvasStore((s) => s.updateObjectTransform);
  const selectObject = useCanvasStore((s) => s.selectObject);
  const groupRef = useRef<Konva.Group>(null);
  const bounds = getObjectBounds(object);
  const localPoints = object.points.map((value, index) =>
    index % 2 === 0 ? value - bounds.x : value - bounds.y
  );

  const bakeTransform = () => {
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const nextX = node.x();
    const nextY = node.y();
    node.scaleX(1);
    node.scaleY(1);

    const points = localPoints.map((value, index) =>
      index % 2 === 0
        ? nextX + value * scaleX
        : nextY + value * scaleY
    );
    const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
    updateObjectTransform(object.id, {
      points,
      strokeWidth: Math.max(1, object.strokeWidth * avgScale),
    });
  };

  return (
    <Group
      id={object.id}
      name={`object-${object.id}`}
      ref={groupRef}
      x={bounds.x}
      y={bounds.y}
      width={Math.max(bounds.width, 8)}
      height={Math.max(bounds.height, 8)}
      draggable={draggable}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
        beginTransform();
      }}
      onDragEnd={(e) => {
        const node = e.target;
        const dx = node.x() - bounds.x;
        const dy = node.y() - bounds.y;
        if (dx !== 0 || dy !== 0) {
          const points = object.points.map((value, index) =>
            index % 2 === 0 ? value + dx : value + dy
          );
          updateObjectTransform(object.id, { points });
        }
        endTransform();
      }}
      onTransformStart={(e) => {
        e.cancelBubble = true;
        beginTransform();
      }}
      onTransformEnd={(e) => {
        e.cancelBubble = true;
        bakeTransform();
        endTransform();
      }}
    >
      {/* Invisible hit/size rect so Transformer can measure the stroke group */}
      <Rect
        width={Math.max(bounds.width, 8)}
        height={Math.max(bounds.height, 8)}
        fill="rgba(0,0,0,0.001)"
        listening={false}
      />
      <Line
        points={localPoints}
        stroke={object.color}
        strokeWidth={object.strokeWidth}
        opacity={object.opacity}
        tension={0.35}
        lineCap="round"
        lineJoin="round"
        perfectDrawEnabled={false}
        hitStrokeWidth={Math.max(24, object.strokeWidth + 16)}
      />
    </Group>
  );
}

function TextRenderer({
  object,
  isSelected,
  draggable,
}: {
  object: TextObject;
  isSelected: boolean;
  draggable: boolean;
}) {
  const beginTransform = useCanvasStore((s) => s.beginTransform);
  const endTransform = useCanvasStore((s) => s.endTransform);
  const updateObjectTransform = useCanvasStore((s) => s.updateObjectTransform);
  const selectObject = useCanvasStore((s) => s.selectObject);
  const setEditingTextId = useCanvasStore((s) => s.setEditingTextId);
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  const shapeRef = useRef<Konva.Text>(null);
  const transformingRef = useRef(false);

  if (editingTextId === object.id) {
    return null;
  }

  const applyTransform = () => {
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const nextWidth = Math.max(40, Math.abs(node.width() * scaleX));
    const nextFont = Math.max(
      12,
      Math.round(object.fontSize * ((Math.abs(scaleX) + Math.abs(scaleY)) / 2))
    );
    updateObjectTransform(object.id, {
      x: node.x(),
      y: node.y(),
      width: nextWidth,
      height: Math.max(object.height, nextFont * 1.6),
      fontSize: nextFont,
    });
  };

  return (
    <Text
      id={object.id}
      name={`object-${object.id}`}
      ref={shapeRef}
      x={object.x}
      y={object.y}
      width={object.width}
      text={object.text || " "}
      fontSize={object.fontSize}
      fontFamily={object.fontFamily}
      fill={object.color}
      draggable={draggable && !transformingRef.current}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        // Don't enter edit mode when the transformer just handled a resize.
        if (transformingRef.current) return;
        if (isSelected) {
          setEditingTextId(object.id);
        } else {
          selectObject(object.id);
        }
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (transformingRef.current) return;
        if (isSelected) {
          setEditingTextId(object.id);
        } else {
          selectObject(object.id);
        }
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        setEditingTextId(object.id);
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        setEditingTextId(object.id);
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
        beginTransform();
      }}
      onDragEnd={(e) => {
        updateObjectTransform(object.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
        endTransform();
      }}
      onTransformStart={(e) => {
        e.cancelBubble = true;
        transformingRef.current = true;
        beginTransform();
      }}
      onTransformEnd={(e) => {
        e.cancelBubble = true;
        applyTransform();
        endTransform();
        window.setTimeout(() => {
          transformingRef.current = false;
        }, 50);
      }}
    />
  );
}

function ImageRenderer({
  object,
  draggable,
}: {
  object: ImageObject;
  isSelected: boolean;
  draggable: boolean;
}) {
  const image = useHtmlImage(object.src);
  const beginTransform = useCanvasStore((s) => s.beginTransform);
  const endTransform = useCanvasStore((s) => s.endTransform);
  const updateObjectTransform = useCanvasStore((s) => s.updateObjectTransform);
  const selectObject = useCanvasStore((s) => s.selectObject);
  const shapeRef = useRef<Konva.Image>(null);
  const [revealOpacity, setRevealOpacity] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setRevealOpacity(1);
      return;
    }
    setRevealOpacity(0);
    const frame = requestAnimationFrame(() => setRevealOpacity(1));
    return () => cancelAnimationFrame(frame);
  }, [object.id]);

  const applyTransform = () => {
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    updateObjectTransform(object.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(24, Math.abs(object.width * scaleX)),
      height: Math.max(24, Math.abs(object.height * scaleY)),
    });
  };

  return (
    <KonvaImage
      id={object.id}
      name={`object-${object.id}`}
      ref={shapeRef}
      image={image ?? undefined}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      opacity={revealOpacity}
      listening={revealOpacity > 0.9}
      draggable={draggable}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        selectObject(object.id);
        beginTransform();
      }}
      onDragEnd={(e) => {
        updateObjectTransform(object.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
        endTransform();
      }}
      onTransformStart={(e) => {
        e.cancelBubble = true;
        beginTransform();
      }}
      onTransformEnd={(e) => {
        e.cancelBubble = true;
        applyTransform();
        endTransform();
      }}
    />
  );
}

export function CanvasObjectRenderer({ object, isSelected, draggable }: Props) {
  if (object.type === "stroke") {
    return (
      <StrokeRenderer
        object={object}
        isSelected={isSelected}
        draggable={draggable}
      />
    );
  }
  if (object.type === "text") {
    return (
      <TextRenderer
        object={object}
        isSelected={isSelected}
        draggable={draggable}
      />
    );
  }
  return (
    <ImageRenderer
      object={object}
      isSelected={isSelected}
      draggable={draggable}
    />
  );
}
