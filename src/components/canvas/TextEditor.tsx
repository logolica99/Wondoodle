"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { Check } from "lucide-react";
import { useCanvasStore } from "@/store/canvasStore";
import { TextObject } from "@/types/canvas";
import { Button } from "@/components/ui/button";

type TextEditorProps = {
  object: TextObject;
  scale: number;
  offset: { x: number; y: number };
};

export function TextEditor({ object, scale, offset }: TextEditorProps) {
  const updateTextContent = useCanvasStore((s) => s.updateTextContent);
  const commitTextEdit = useCanvasStore((s) => s.commitTextEdit);
  const updateObjectTransform = useCanvasStore((s) => s.updateObjectTransform);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ignoreBlurRef = useRef(true);
  const committedRef = useRef(false);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    ignoreBlurRef.current = true;
    commitTextEdit(object.id);
  };

  useEffect(() => {
    committedRef.current = false;
    ignoreBlurRef.current = true;
    const el = textareaRef.current;
    if (!el) return;

    // Defer focus until after the creating pointer gesture finishes,
    // otherwise the same click blurs the textarea immediately.
    const focusTimer = window.setTimeout(() => {
      el.focus();
      if (!object.text) {
        el.setSelectionRange(0, 0);
      } else {
        el.select();
      }
    }, 30);

    const unlockTimer = window.setTimeout(() => {
      ignoreBlurRef.current = false;
    }, 180);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(unlockTimer);
    };
    // Only re-run when opening a different text object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.id]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const nextHeight = Math.max(
      object.fontSize * scale * 1.6,
      el.scrollHeight
    );
    el.style.height = `${nextHeight}px`;

    const unscaledHeight = Math.max(
      Math.ceil(nextHeight / scale),
      object.fontSize * 1.6
    );
    if (Math.abs(unscaledHeight - object.height) > 4) {
      updateObjectTransform(object.id, { height: unscaledHeight });
    }
  }, [object.id, object.text, object.fontSize, object.height, scale, updateObjectTransform]);

  const left = offset.x + object.x * scale;
  const top = offset.y + object.y * scale;

  return (
    <div
      className="absolute z-40"
      style={{ left, top }}
      data-testid="text-editor-wrap"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        data-testid="text-editor"
        aria-label="Edit text"
        value={object.text}
        placeholder="Type here…"
        onChange={(e) => updateTextContent(object.id, e.target.value)}
        onBlur={() => {
          if (ignoreBlurRef.current || committedRef.current) return;
          // Allow clicking the Done button without losing the edit first.
          window.setTimeout(() => {
            if (committedRef.current || ignoreBlurRef.current) return;
            const active = document.activeElement;
            if (active?.closest?.("[data-testid='text-editor-wrap']")) return;
            commit();
          }, 0);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            commit();
            return;
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        className="block resize-none overflow-hidden rounded-lg border-2 border-canvas-indigo/70 bg-white/95 p-2 shadow-float outline-none placeholder:text-slate-400"
        style={{
          width: Math.max(object.width * scale, 160),
          minHeight: Math.max(object.height * scale, object.fontSize * scale * 1.6),
          fontSize: object.fontSize * scale,
          color: object.color,
          fontFamily: object.fontFamily,
          lineHeight: 1.35,
        }}
      />
      <div className="mt-1.5 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          data-testid="text-editor-done"
          onMouseDown={(e) => {
            e.preventDefault();
            ignoreBlurRef.current = true;
          }}
          onClick={commit}
        >
          <Check className="h-3.5 w-3.5" />
          Done
        </Button>
        <span className="text-[11px] text-slate-500">
          ⌘/Ctrl + Enter to finish
        </span>
      </div>
    </div>
  );
}
