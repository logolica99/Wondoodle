"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HelpCircle,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
  RefreshCw,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { PipMascot } from "@/components/mascot/PipMascot";
import { PipVoiceOrb } from "./PipVoiceOrb";
import { useRealtimePip } from "@/hooks/useRealtimePip";
import { usePipStore } from "@/store/pipStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useUiStore } from "@/store/uiStore";
import { exportCanvasSnapshot } from "@/lib/canvas/snapshot";
import { cn } from "@/lib/utils";

function statusLabel(
  connection: ReturnType<typeof useRealtimePip>["connection"],
  voiceState: ReturnType<typeof useRealtimePip>["voiceState"],
  muted: boolean
) {
  if (connection === "connecting") return "Connecting to Pip…";
  if (connection === "error") return "Connection trouble";
  if (connection !== "connected") return "Ready when you are";
  if (muted) return "Microphone muted";
  if (voiceState === "listening") return "Listening…";
  if (voiceState === "speaking") return "Pip is talking";
  return "Connected — say something";
}

function companionMood(
  connection: ReturnType<typeof useRealtimePip>["connection"],
  voiceState: ReturnType<typeof useRealtimePip>["voiceState"]
) {
  if (connection === "connecting") return "thinking" as const;
  if (connection === "error") return "thinking" as const;
  if (voiceState === "speaking") return "celebrate" as const;
  if (voiceState === "listening") return "welcome" as const;
  if (connection === "connected") return "welcome" as const;
  return "idle" as const;
}

export function PipCompanion() {
  const reduceMotion = useReducedMotion();
  const companionOpen = usePipStore((s) => s.companionOpen);
  const setCompanionOpen = usePipStore((s) => s.setCompanionOpen);
  const paperStyle = useUiStore((s) => s.paperStyle);
  const setPipMood = useUiStore((s) => s.setPipMood);
  const getExportableDocument = useCanvasStore((s) => s.getExportableDocument);

  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  const getCanvasSnapshot = useCallback(
    () =>
      exportCanvasSnapshot(getExportableDocument(), {
        paperStyle,
      }),
    [getExportableDocument, paperStyle]
  );

  const pip = useRealtimePip({
    getCanvasSnapshot,
    onShareStatus: setShareMessage,
  });

  useEffect(() => {
    if (!companionOpen) {
      if (pip.connection === "connected" || pip.connection === "connecting") {
        pip.disconnect();
      }
      setShareMessage(null);
      setMinimized(false);
      setTipOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionOpen]);

  useEffect(() => {
    setPipMood(companionMood(pip.connection, pip.voiceState));
  }, [pip.connection, pip.voiceState, setPipMood]);

  const endConversation = () => {
    pip.disconnect();
    setShareMessage(null);
    setCompanionOpen(false);
  };

  const mood = companionMood(pip.connection, pip.voiceState);

  return (
    <AnimatePresence>
      {companionOpen && (
        <motion.div
          className="pointer-events-auto absolute right-3 top-[5.25rem] z-40 w-[min(100%-1.5rem,340px)] sm:right-5"
          data-testid="pip-companion-anchor"
          initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.22 }}
        >
          {minimized ? (
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-white/90 bg-white/95 py-1.5 pl-1.5 pr-3 shadow-toolbar backdrop-blur-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30"
              data-testid="pip-companion-minimized"
              onClick={() => setMinimized(false)}
            >
              <PipMascot mood={mood} size="sm" />
              <span className="font-display text-sm font-semibold text-mc-ink">
                Pip
              </span>
              {pip.micActive && (
                <span
                  className="h-2.5 w-2.5 rounded-full bg-mc-mint"
                  data-testid="pip-mic-indicator"
                  aria-label="Microphone on"
                />
              )}
            </button>
          ) : (
            <aside data-testid="pip-companion">
              <div className="overflow-hidden rounded-bubble border border-white/90 bg-white/95 shadow-toolbar backdrop-blur-md">
                <div className="border-b border-mc-purple/10 bg-gradient-to-br from-mc-purple-soft via-white to-mc-pink-soft px-3 pb-3 pt-3">
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 rounded-full bg-white p-0.5 shadow-soft ring-2 ring-white">
                      <PipMascot mood={mood} size="sm" />
                    </div>

                    <div className="min-w-0 flex-1 pt-1">
                      <p className="font-display text-lg font-semibold leading-tight text-mc-ink">
                        Talk to Pip
                      </p>
                      <p
                        className="text-sm text-mc-ink/65"
                        data-testid="pip-connection-status"
                      >
                        {statusLabel(pip.connection, pip.voiceState, pip.muted)}
                      </p>
                      {pip.micActive && (
                        <span
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-mc-mint-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mc-ink"
                          data-testid="pip-mic-indicator"
                        >
                          <span className="h-2 w-2 animate-pulse rounded-full bg-mc-mint" />
                          Mic on
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label={tipOpen ? "Hide tip" : "Show tip"}
                        data-testid="pip-companion-help"
                        onClick={() => setTipOpen((v) => !v)}
                      >
                        <HelpCircle className="h-4 w-4 text-mc-purple" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label="Minimize Pip companion"
                        data-testid="pip-companion-minimize"
                        onClick={() => setMinimized(true)}
                      >
                        <Minimize2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label="Close Pip companion"
                        data-testid="pip-companion-close"
                        onClick={endConversation}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 px-4 py-4">
                  {tipOpen && (
                    <p
                      className="rounded-2xl bg-mc-purple-soft px-3 py-2 text-xs leading-snug text-mc-ink"
                      data-testid="pip-help-bubble"
                    >
                      Draw, write, or add a photo. Then talk with Pip — say
                      “look at my work” anytime you want Pip to see the canvas.
                    </p>
                  )}

                  <p className="text-center text-[11px] leading-snug text-mc-ink/50">
                    Ask Pip to look at your canvas by saying “look at my work”
                    or “I updated it.”
                  </p>

                  <PipVoiceOrb
                    state={pip.voiceState}
                    level={pip.level}
                    connecting={pip.connection === "connecting"}
                  />

                  {pip.connection === "idle" && (
                    <Button
                      size="lg"
                      className="w-full rounded-bubble text-base"
                      data-testid="pip-talk-button"
                      onClick={() => void pip.connect()}
                    >
                      <Mic className="h-5 w-5" />
                      Talk to Pip
                    </Button>
                  )}

                  {pip.connection === "connecting" && (
                    <div
                      className="space-y-2 rounded-2xl bg-mc-purple-soft px-3 py-3 text-center text-sm font-semibold text-mc-ink"
                      data-testid="pip-connecting"
                    >
                      <p>Connecting securely…</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        data-testid="pip-connect-cancel"
                        onClick={() => pip.disconnect()}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {pip.connection === "error" && (
                    <div
                      className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700"
                      data-testid="pip-error"
                      role="alert"
                    >
                      <p>{pip.error ?? "Couldn't connect to Pip."}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 rounded-xl"
                        data-testid="pip-retry"
                        onClick={() => void pip.connect()}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    </div>
                  )}

                  {pip.connection === "connected" && (
                    <div
                      className="space-y-2"
                      data-testid="pip-session-controls"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          className="rounded-2xl"
                          data-testid="pip-mute"
                          aria-pressed={pip.muted}
                          onClick={pip.toggleMute}
                        >
                          {pip.muted ? (
                            <MicOff className="h-4 w-4" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                          {pip.muted ? "Unmute" : "Mute"}
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-2xl"
                          data-testid="pip-interrupt"
                          onClick={pip.interrupt}
                          disabled={pip.voiceState !== "speaking"}
                        >
                          Interrupt
                        </Button>
                      </div>

                      <Button
                        variant="destructive"
                        className="w-full rounded-2xl"
                        data-testid="pip-end"
                        onClick={endConversation}
                      >
                        <PhoneOff className="h-4 w-4" />
                        End conversation
                      </Button>
                    </div>
                  )}

                  {shareMessage && (
                    <p
                      className="rounded-2xl bg-mc-mint-soft px-3 py-2 text-xs font-semibold text-mc-ink"
                      data-testid="pip-share-message"
                      role="status"
                    >
                      {shareMessage}
                    </p>
                  )}

                  {pip.captions.length > 0 && (
                    <div
                      className="max-h-36 space-y-2 overflow-y-auto rounded-2xl bg-mc-cream/80 p-3"
                      data-testid="pip-captions"
                      aria-live="polite"
                    >
                      {pip.captions.map((line) => (
                        <p
                          key={line.id}
                          className={cn(
                            "text-xs leading-snug",
                            line.role === "assistant"
                              ? "font-semibold text-mc-purple"
                              : "text-mc-ink/80"
                          )}
                          data-testid={`pip-caption-${line.role}`}
                        >
                          <span className="mr-1 opacity-60">
                            {line.role === "assistant" ? "Pip" : "You"}:
                          </span>
                          {line.text}
                          {line.partial ? "…" : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
