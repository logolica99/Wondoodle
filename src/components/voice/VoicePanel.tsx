"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RecordButton } from "./RecordButton";
import { AudioMeter } from "./AudioMeter";
import { TranscriptCard } from "./TranscriptCard";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { transcribeAudioBlob } from "@/lib/voice/transcription";
import { useVoiceStore } from "@/store/voiceStore";
import { voiceCopy } from "@/types/voice";

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoicePanel() {
  const reduceMotion = useReducedMotion();
  const panelOpen = useVoiceStore((s) => s.panelOpen);
  const phase = useVoiceStore((s) => s.phase);
  const draftEdited = useVoiceStore((s) => s.draftEdited);
  const draftDurationMs = useVoiceStore((s) => s.draftDurationMs);
  const activeNoteId = useVoiceStore((s) => s.activeNoteId);
  const errorMessage = useVoiceStore((s) => s.errorMessage);
  const isTranscribing = useVoiceStore((s) => s.isTranscribing);
  const closePanel = useVoiceStore((s) => s.closePanel);
  const setPhase = useVoiceStore((s) => s.setPhase);
  const setDraftEdited = useVoiceStore((s) => s.setDraftEdited);
  const setError = useVoiceStore((s) => s.setError);
  const setTranscribing = useVoiceStore((s) => s.setTranscribing);
  const beginReview = useVoiceStore((s) => s.beginReview);
  const saveActiveNote = useVoiceStore((s) => s.saveActiveNote);
  const deleteActiveNote = useVoiceStore((s) => s.deleteActiveNote);
  const discardDraft = useVoiceStore((s) => s.discardDraft);
  const getSessionAudioUrl = useVoiceStore((s) => s.getSessionAudioUrl);

  const [transcribeToken, setTranscribeToken] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handledStopKey = useRef<string | null>(null);

  const recorder = useAudioRecorder();

  useEffect(() => {
    if (!panelOpen && recorder.isRecording) {
      recorder.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  useEffect(() => {
    if (recorder.phase !== "stopped" || !recorder.audioBlob) return;
    const key = `${recorder.audioBlob.size}-${recorder.durationMs}-${transcribeToken}`;
    if (handledStopKey.current === key) return;
    handledStopKey.current = key;

    let cancelled = false;
    void (async () => {
      setTranscribing(true);
      setPhase("transcribing");
      setError(null);
      const result = await transcribeAudioBlob(
        recorder.audioBlob!,
        recorder.mimeType || recorder.audioBlob!.type
      );
      if (cancelled) return;
      setTranscribing(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.transcript.trim()) {
        setError(voiceCopy.emptyTranscript);
        return;
      }
      beginReview({
        original: result.transcript,
        durationMs: recorder.durationMs,
        audioBlob: recorder.audioBlob!,
        mimeType: recorder.mimeType || recorder.audioBlob!.type,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    recorder.phase,
    recorder.audioBlob,
    recorder.durationMs,
    recorder.mimeType,
    transcribeToken,
    setTranscribing,
    setPhase,
    setError,
    beginReview,
  ]);

  const canReplay = Boolean(activeNoteId && getSessionAudioUrl(activeNoteId));
  const showRecorder =
    phase === "idle" ||
    phase === "recording" ||
    phase === "error" ||
    recorder.phase === "requesting" ||
    recorder.phase === "recording";

  return (
    <AnimatePresence>
      {panelOpen && (
        <motion.aside
          className="pointer-events-auto absolute right-3 top-[11rem] z-40 w-[min(100%-1.5rem,340px)] sm:right-5 sm:top-[5.5rem]"
          data-testid="voice-panel"
          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.2 }}
        >
          <div className="rounded-bubble border border-white/90 bg-white/95 p-4 shadow-toolbar backdrop-blur-md">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold text-mc-ink">
                  Explain
                </p>
                <p className="text-sm text-mc-ink/65" data-testid="voice-status-copy">
                  {recorder.isRecording
                    ? voiceCopy.listening
                    : isTranscribing
                      ? voiceCopy.transcribing
                      : phase === "review"
                        ? voiceCopy.heard
                        : voiceCopy.prompt}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Close explain panel"
                data-testid="voice-panel-close"
                onClick={() => {
                  recorder.cancel();
                  closePanel();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="mb-3 text-[11px] leading-snug text-mc-ink/50">
              {voiceCopy.disclosure}
            </p>

            {showRecorder && phase !== "review" && !isTranscribing && (
              <div className="space-y-3" data-testid="voice-record-section">
                <AudioMeter
                  level={recorder.level}
                  active={recorder.isRecording}
                />
                <div className="flex items-center justify-between gap-3">
                  <RecordButton
                    recording={recorder.isRecording}
                    disabled={
                      isTranscribing || recorder.phase === "requesting"
                    }
                    onClick={() => {
                      if (recorder.isRecording) {
                        recorder.stop();
                      } else {
                        handledStopKey.current = null;
                        setError(null);
                        setPhase("recording");
                        void recorder.start();
                      }
                    }}
                  />
                  <div className="flex-1">
                    <p
                      className="text-sm font-bold tabular-nums text-mc-ink"
                      data-testid="voice-timer"
                    >
                      {formatDuration(recorder.durationMs)}
                    </p>
                    <p className="text-xs text-mc-ink/50">Max 1:00</p>
                  </div>
                  {recorder.isRecording && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-xl"
                      data-testid="voice-cancel"
                      onClick={() => {
                        handledStopKey.current = "cancelled";
                        recorder.cancel();
                        setPhase("idle");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isTranscribing && (
              <div
                className="rounded-2xl bg-mc-mint-soft px-3 py-4 text-sm font-semibold text-mc-ink"
                data-testid="voice-transcribing"
              >
                {voiceCopy.transcribing}
              </div>
            )}

            {errorMessage && (
              <div
                className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700"
                data-testid="voice-error"
                role="alert"
              >
                <p>{errorMessage}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 rounded-xl"
                  data-testid="voice-error-retry"
                  onClick={() => {
                    handledStopKey.current = null;
                    setError(null);
                    discardDraft();
                    recorder.resetSession();
                    setPhase("idle");
                    setTranscribeToken((n) => n + 1);
                  }}
                >
                  {voiceCopy.retry}
                </Button>
              </div>
            )}

            {phase === "review" && (
              <div className="mt-3">
                <TranscriptCard
                  editedText={draftEdited}
                  durationMs={draftDurationMs}
                  canReplay={canReplay}
                  onChange={setDraftEdited}
                  onSave={() => saveActiveNote()}
                  onRetry={() => {
                    handledStopKey.current = null;
                    discardDraft();
                    recorder.resetSession();
                    setPhase("idle");
                    setTranscribeToken((n) => n + 1);
                  }}
                  onReplay={() => {
                    if (!activeNoteId) return;
                    const url = getSessionAudioUrl(activeNoteId);
                    if (!url) return;
                    if (!audioRef.current) audioRef.current = new Audio();
                    audioRef.current.src = url;
                    void audioRef.current.play();
                  }}
                  onDelete={() => deleteActiveNote()}
                />
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
