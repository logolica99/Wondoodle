"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Eraser, Redo2, Sparkles, Undo2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WondoodleLogo } from "@/components/brand/WondoodleLogo";
import { AppNav } from "@/components/nav/AppNav";
import { useCanvasStore } from "@/store/canvasStore";
import { useUiStore } from "@/store/uiStore";
import { copy } from "@/lib/design-tokens";
import { exportDocument } from "@/lib/canvas/export";
import { requestConversationalAdventureCreate } from "@/lib/adventure/requestConversationalCreate";

export function CanvasTopBar() {
  const title = useCanvasStore((s) => s.document.title);
  const setTitle = useCanvasStore((s) => s.setTitle);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const getExportableDocument = useCanvasStore((s) => s.getExportableDocument);
  const objectCount = useCanvasStore((s) => s.document.objects.length);
  const openExportPreview = useUiStore((s) => s.openExportPreview);
  const paperStyle = useUiStore((s) => s.paperStyle);
  const reduceMotion = useReducedMotion();
  const [clearOpen, setClearOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  return (
    <>
      <header
        className="relative z-20 flex items-center justify-between gap-3 rounded-bubble border border-white/80 bg-white/85 px-3 py-2.5 shadow-soft backdrop-blur-md sm:px-4"
        data-testid="canvas-topbar"
      >
        <div className="flex min-w-0 items-center gap-3">
          <motion.div
            initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <Link
              href="/"
              aria-label="Wondoodle home"
              className="block h-11 w-11 shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30"
            >
              <WondoodleLogo variant="icon" className="h-11 w-11" />
            </Link>
          </motion.div>
          <div className="min-w-0">
            <input
              data-testid="document-title"
              aria-label="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full max-w-[240px] truncate border-none bg-transparent font-display text-base font-semibold text-mc-ink outline-none placeholder:text-mc-ink/35 focus:text-mc-purple sm:max-w-[320px] sm:text-lg"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <AppNav className="hidden md:flex" />

          <TooltipProvider delayDuration={180}>
            <div
              className="flex items-center gap-0.5 rounded-xl border border-mc-purple/15 bg-white/90 p-0.5 shadow-soft"
              data-testid="history-controls"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-lg"
                    data-testid="tool-undo"
                    aria-label="Undo"
                    disabled={!canUndo}
                    onClick={() => undo()}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-lg"
                    data-testid="tool-redo"
                    aria-label="Redo"
                    disabled={!canRedo}
                    onClick={() => redo()}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <Button
            variant="secondary"
            size="sm"
            className="min-h-10 rounded-xl border border-[#7357E8]/25 bg-[#F6F3FF] text-[#7357E8] hover:bg-[#EFEAFF]"
            data-testid="make-adventure-button"
            aria-label="Make an Adventure"
            disabled={objectCount === 0}
            onClick={() => requestConversationalAdventureCreate()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Adventure
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="min-h-10 rounded-xl"
            data-testid="clear-canvas-button"
            aria-label="Clear canvas"
            onClick={() => setClearOpen(true)}
            disabled={objectCount === 0}
          >
            <Eraser className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </Button>

          <Button
            size="sm"
            className="min-h-10 rounded-xl bg-mc-purple hover:bg-[#6246d6]"
            data-testid="export-button"
            aria-label="Export as PNG"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const result = await exportDocument(getExportableDocument(), {
                  paperStyle,
                });
                openExportPreview(result.imageDataUrl);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {exporting ? "Preparing…" : "Export"}
            </span>
          </Button>
        </div>
      </header>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent data-testid="clear-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">{copy.clearTitle}</DialogTitle>
            <DialogDescription>{copy.clearBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              data-testid="clear-cancel"
              onClick={() => setClearOpen(false)}
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              data-testid="clear-confirm"
              onClick={() => {
                clearCanvas();
                setClearOpen(false);
              }}
            >
              Clear canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
