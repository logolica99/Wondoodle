"use client";

import { useMemo } from "react";
import { VoiceNoteMarker } from "./VoiceNoteMarker";
import { useCanvasStore } from "@/store/canvasStore";
import { useVoiceStore } from "@/store/voiceStore";
import { getObjectBounds } from "@/lib/canvas/document";

type Camera = { x: number; y: number; zoom: number };

export function VoiceNoteMarkersLayer({ camera }: { camera: Camera }) {
  const objects = useCanvasStore((s) => s.document.objects);
  const voiceNotes = useCanvasStore((s) => s.document.voiceNotes ?? []);
  const openNote = useVoiceStore((s) => s.openNote);

  const markers = useMemo(() => {
    let unanchoredIndex = 0;
    return voiceNotes
      .filter((n) => n.status === "saved" || n.editedTranscript)
      .map((note) => {
        if (note.anchor.type === "object") {
          const objectId = note.anchor.objectId;
          const obj = objects.find((o) => o.id === objectId);
          if (!obj) {
            const left = 72 + unanchoredIndex * 48;
            const top = 96;
            unanchoredIndex += 1;
            return { note, left, top };
          }
          const bounds = getObjectBounds(obj);
          const worldX = bounds.x + bounds.width;
          const worldY = bounds.y;
          return {
            note,
            left: worldX * camera.zoom + camera.x,
            top: worldY * camera.zoom + camera.y,
          };
        }
        if (note.anchor.type === "point") {
          const { x, y } = note.anchor;
          return {
            note,
            left: x * camera.zoom + camera.x,
            top: y * camera.zoom + camera.y,
          };
        }
        const left = 72 + unanchoredIndex * 48;
        const top = 96;
        unanchoredIndex += 1;
        return { note, left, top };
      });
  }, [voiceNotes, objects, camera.x, camera.y, camera.zoom]);

  if (markers.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      data-testid="voice-markers-layer"
    >
      {markers.map(({ note, left, top }) => (
        <VoiceNoteMarker
          key={note.id}
          note={note}
          left={left}
          top={top}
          onOpen={openNote}
        />
      ))}
    </div>
  );
}
