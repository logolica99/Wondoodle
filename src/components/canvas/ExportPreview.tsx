"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";
import { downloadBlob } from "@/lib/canvas/export";

export function ExportPreview({
  onConfirmDownload,
}: {
  onConfirmDownload: () => Promise<Blob>;
}) {
  const open = useUiStore((s) => s.exportPreviewOpen);
  const url = useUiStore((s) => s.exportPreviewUrl);
  const closeExportPreview = useUiStore((s) => s.closeExportPreview);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeExportPreview();
      }}
    >
      <DialogContent data-testid="export-preview-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Your masterpiece!</DialogTitle>
          <DialogDescription>
            Here&apos;s a preview before you download the PNG.
          </DialogDescription>
        </DialogHeader>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Export preview"
            data-testid="export-preview-image"
            className="max-h-[360px] w-full rounded-2xl border border-mc-purple/15 object-contain bg-white"
          />
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={closeExportPreview}>
            Keep editing
          </Button>
          <Button
            data-testid="export-confirm-download"
            onClick={async () => {
              const blob = await onConfirmDownload();
              downloadBlob(blob, "wondoodle.png");
              closeExportPreview();
            }}
          >
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
