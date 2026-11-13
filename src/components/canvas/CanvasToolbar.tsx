"use client";

import { useRef } from "react";
import {
  AudioLines,
  Eraser,
  Hand,
  ImagePlus,
  MousePointer2,
  Pencil,
  Type,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToolButton } from "./ToolButton";
import { useCanvasStore } from "@/store/canvasStore";
import { usePipStore } from "@/store/pipStore";
import { ToolType } from "@/types/canvas";
import { colors } from "@/lib/design-tokens";

const tools: {
  id: ToolType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  accent: string;
}[] = [
  { id: "select", label: "Move", icon: MousePointer2, testId: "tool-select", accent: colors.blue },
  { id: "hand", label: "Hand", icon: Hand, testId: "tool-hand", accent: colors.yellow },
  { id: "pen", label: "Draw", icon: Pencil, testId: "tool-pen", accent: colors.purple },
  { id: "eraser", label: "Erase", icon: Eraser, testId: "tool-eraser", accent: colors.pink },
  { id: "text", label: "Write", icon: Type, testId: "tool-text", accent: colors.mint },
];

export function CanvasToolbar() {
  const tool = useCanvasStore((s) => s.tool);
  const setTool = useCanvasStore((s) => s.setTool);
  const uploadImage = useCanvasStore((s) => s.uploadImage);
  const imageError = useCanvasStore((s) => s.imageError);
  const clearImageError = useCanvasStore((s) => s.clearImageError);
  const openCompanion = usePipStore((s) => s.openCompanion);
  const companionOpen = usePipStore((s) => s.companionOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  return (
    <TooltipProvider delayDuration={180}>
      <aside className="pointer-events-none absolute bottom-3 left-1/2 z-30 w-[min(100%-1rem,720px)] -translate-x-1/2 sm:bottom-auto sm:left-4 sm:top-1/2 sm:w-auto sm:-translate-x-0 sm:-translate-y-1/2">
        <motion.div
          className="pointer-events-auto flex flex-row gap-1.5 overflow-x-auto rounded-bubble border border-white/90 bg-white/95 p-2 shadow-toolbar backdrop-blur-md sm:flex-col sm:overflow-visible"
          data-testid="canvas-toolbar"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="mc-shine-border shrink-0" data-testid="tool-talk-pip-shine">
            <Tooltip>
              <TooltipTrigger asChild>
                <ToolButton
                  label="Talk"
                  icon={AudioLines}
                  accent={colors.purple}
                  active={companionOpen}
                  className="mc-shine-inner w-full"
                  testId="tool-talk-pip"
                  onClick={() => openCompanion()}
                />
              </TooltipTrigger>
              <TooltipContent side="right">Talk to Pip</TooltipContent>
            </Tooltip>
          </div>

          <div className="mx-1 hidden w-px self-stretch bg-mc-purple/15 sm:mx-0 sm:my-1 sm:h-px sm:w-auto" />

          {tools.map(({ id, label, icon, testId, accent }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <ToolButton
                  label={label}
                  icon={icon}
                  active={tool === id}
                  accent={accent}
                  testId={testId}
                  onClick={() => setTool(id)}
                />
              </TooltipTrigger>
              <TooltipContent side="right" className="hidden sm:block">
                {label}
              </TooltipContent>
            </Tooltip>
          ))}

          <div className="mx-1 hidden w-px self-stretch bg-mc-purple/15 sm:mx-0 sm:my-1 sm:h-px sm:w-auto" />

          <Tooltip>
            <TooltipTrigger asChild>
              <ToolButton
                label="Photo"
                icon={ImagePlus}
                accent={colors.blue}
                testId="tool-image"
                onClick={() => {
                  clearImageError();
                  fileInputRef.current?.click();
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="right">Photo</TooltipContent>
          </Tooltip>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            data-testid="image-file-input"
            aria-label="Choose a picture to add."
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) await uploadImage(file);
            }}
          />
        </motion.div>

        {imageError && (
          <p
            className="pointer-events-auto mt-2 max-w-[220px] rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-soft sm:mt-3"
            data-testid="image-error"
            role="alert"
          >
            {imageError}
          </p>
        )}
      </aside>
    </TooltipProvider>
  );
}
