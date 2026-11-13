"use client";

import { Play, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { voiceCopy } from "@/types/voice";

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptCard({
  title = voiceCopy.heard,
  editedText,
  durationMs,
  canReplay,
  onChange,
  onSave,
  onRetry,
  onReplay,
  onDelete,
}: {
  title?: string;
  editedText: string;
  durationMs: number;
  canReplay: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onRetry: () => void;
  onReplay: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-mc-purple/15 bg-white p-3 shadow-soft"
      data-testid="transcript-card"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold text-mc-ink">{title}</p>
        <span className="text-xs font-bold tabular-nums text-mc-ink/50">
          {formatDuration(durationMs)}
        </span>
      </div>

      <label className="sr-only" htmlFor="voice-transcript-editor">
        Edit your explanation
      </label>
      <textarea
        id="voice-transcript-editor"
        data-testid="transcript-editor"
        value={editedText}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-mc-purple/15 bg-mc-cream/60 px-3 py-2 text-sm font-semibold leading-relaxed text-mc-ink outline-none focus:border-mc-purple focus:ring-4 focus:ring-mc-purple/20"
      />

      {!canReplay && (
        <p className="mt-2 text-[11px] text-mc-ink/50">{voiceCopy.replayUnavailable}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          data-testid="transcript-save"
          className="rounded-xl"
          onClick={onSave}
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          data-testid="transcript-retry"
          className="rounded-xl"
          onClick={onRetry}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </Button>
        <Button
          size="sm"
          variant="secondary"
          data-testid="transcript-replay"
          className="rounded-xl"
          disabled={!canReplay}
          onClick={onReplay}
        >
          <Play className="h-3.5 w-3.5" />
          Replay
        </Button>
        <Button
          size="sm"
          variant="ghost"
          data-testid="transcript-delete"
          className="rounded-xl text-rose-600 hover:bg-rose-50"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
