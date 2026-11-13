"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { PipAvatar, type PipAnimState } from "@/components/mascot/PipAvatar";
import { useRealtimePip } from "@/hooks/useRealtimePip";
import { usePipFloatingLayout } from "@/hooks/usePipFloatingLayout";
import { usePipStore } from "@/store/pipStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useUiStore } from "@/store/uiStore";
import { useDiscoveryStore } from "@/store/discoveryStore";
import { useActivityStore } from "@/store/activityStore";
import { exportCanvasSnapshot } from "@/lib/canvas/snapshot";
import {
  recordCanvasSharedWithPip,
  recordPipTalkEnded,
  recordPipTalkStarted,
} from "@/lib/learning/recordHelpers";
import { hasMeaningfulPipExchange } from "@/lib/learning/meaningfulPipTalk";
import { buildActivityRoute } from "@/lib/learning/misconceptions";
import type { DiscoveryCardModel } from "@/lib/learning/observationSchema";
import { cn } from "@/lib/utils";

function statusLabel(
  connection: ReturnType<typeof useRealtimePip>["connection"],
  voiceState: ReturnType<typeof useRealtimePip>["voiceState"],
  muted: boolean
) {
  if (connection === "connecting") return "Connecting…";
  if (connection === "error") return "Connection trouble";
  if (connection !== "connected") return "Tap Talk to begin";
  if (muted) return "Microphone muted";
  if (voiceState === "listening") return "Listening…";
  if (voiceState === "speaking") return "Pip is talking";
  return "Say something";
}

function deriveAnimState(input: {
  muted: boolean;
  connection: ReturnType<typeof useRealtimePip>["connection"];
  voiceState: ReturnType<typeof useRealtimePip>["voiceState"];
  success: boolean;
}): PipAnimState {
  if (input.success) return "success";
  if (input.muted && input.connection === "connected") return "muted";
  if (input.connection === "connecting" || input.connection === "error") {
    return "thinking";
  }
  if (input.connection === "connected") {
    if (input.voiceState === "listening") return "listening";
    if (input.voiceState === "speaking") return "speaking";
  }
  return "idle";
}

/**
 * Canvas-only floating Pip companion.
 * Placement is viewport-aware so the launcher never covers zoom controls.
 * Collapse hides the panel only — End conversation disconnects.
 */
export function PipCompanion() {
  const reduceMotion = useReducedMotion();
  const expanded = usePipStore((s) => s.companionOpen);
  const setCompanionOpen = usePipStore((s) => s.setCompanionOpen);
  const consumeAutoStartTalk = usePipStore((s) => s.consumeAutoStartTalk);
  const autoStartTalk = usePipStore((s) => s.autoStartTalk);
  const setRealtimeStatus = usePipStore((s) => s.setRealtimeStatus);
  const paperStyle = useUiStore((s) => s.paperStyle);
  const setPipMood = useUiStore((s) => s.setPipMood);
  const uiMood = useUiStore((s) => s.pipMood);
  const getExportableDocument = useCanvasStore((s) => s.getExportableDocument);
  const documentId = useCanvasStore((s) => s.document.id);
  const layout = usePipFloatingLayout(expanded);

  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const talkStartedAtRef = useRef<number | null>(null);
  const didStartTalkRef = useRef(false);
  const completionRecordedRef = useRef(false);
  const captionsScrollRef = useRef<HTMLDivElement | null>(null);

  const getCanvasSnapshot = useCallback(
    () =>
      exportCanvasSnapshot(getExportableDocument(), {
        paperStyle,
      }),
    [getExportableDocument, paperStyle]
  );

  const onShareStatus = useCallback(
    (message: string | null) => {
      setShareMessage(message);
      if (message && /looking at your work/i.test(message)) {
        void recordCanvasSharedWithPip(documentId);
      }
    },
    [documentId]
  );

  const showDiscoveryCard = useDiscoveryStore((s) => s.showCard);
  const openFractionPlayground = useActivityStore(
    (s) => s.openFractionPlayground
  );
  const pipEventQueue = useActivityStore((s) => s.pipEventQueue);
  const drainPipEvents = useActivityStore((s) => s.drainPipEvents);

  const onDiscoveryObservation = useCallback(
    (card: DiscoveryCardModel) => {
      showDiscoveryCard(card);
    },
    [showDiscoveryCard]
  );

  const onOpenActivity = useCallback(
    (activityId: string) => {
      if (activityId !== "fraction_comparison") return false;
      return openFractionPlayground(buildActivityRoute("denominator_size"));
    },
    [openFractionPlayground]
  );

  const pip = useRealtimePip({
    getCanvasSnapshot,
    onShareStatus,
    onDiscoveryObservation,
    onOpenActivity,
    documentId,
  });

  const notifyActivityEvent = pip.notifyActivityEvent;
  const pipConnection = pip.connection;

  // Forward real playground / TeachBack interactions into the live Pip session.
  useEffect(() => {
    if (!pipEventQueue.length) return;
    if (pipConnection !== "connected") return;
    const events = drainPipEvents();
    for (const event of events) {
      const isTeachback = event.payload?.mode === "teachback";
      const isMastery = event.payload?.mode === "mastery";
      const shouldSpeak = event.payload?.speak === true;
      if ((isTeachback || isMastery) && shouldSpeak) {
        pip.interrupt();
      }
      notifyActivityEvent(
        event.summary,
        {
          kind: event.kind,
          ...event.payload,
        },
        {
          createResponse: isTeachback || isMastery ? shouldSpeak : true,
          instructions:
            isTeachback &&
            shouldSpeak &&
            typeof event.payload?.question === "string"
              ? `Stay in TeachBack. Do NOT ask what they are working on today. Ask this question now and wait: "${event.payload.question}". Then call report_teachback_assessment after they explain.`
              : isMastery && shouldSpeak
                ? "Mastery challenge update only. Do not give fraction hints. Speak briefly in English using the activity event facts."
                : undefined,
        }
      );
    }
  }, [
    pipEventQueue,
    pipConnection,
    notifyActivityEvent,
    drainPipEvents,
    pip.interrupt,
  ]);

  const maybeRecordMeaningfulCompletion = useCallback(() => {
    if (completionRecordedRef.current) return false;
    if (!hasMeaningfulPipExchange(pip.captions)) return false;

    const started = talkStartedAtRef.current;
    const durationSec = started
      ? Math.max(0, (Date.now() - started) / 1000)
      : 0;
    const studentTurns = pip.captions.filter(
      (line) => line.role === "user" && !line.partial && line.text.trim()
    ).length;
    const pipTurns = pip.captions.filter(
      (line) => line.role === "assistant" && !line.partial && line.text.trim()
    ).length;

    completionRecordedRef.current = true;
    void recordPipTalkEnded(documentId, durationSec, {
      studentTurns,
      pipTurns,
    });
    return true;
  }, [documentId, pip.captions]);

  useEffect(() => {
    const el = captionsScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [pip.captions]);

  useEffect(() => {
    setRealtimeStatus(pip.connection, pip.voiceState);
  }, [pip.connection, pip.voiceState, setRealtimeStatus]);

  useEffect(() => {
    setPipMood(
      pip.connection === "connecting"
        ? "thinking"
        : pip.voiceState === "speaking"
          ? "celebrate"
          : pip.connection === "connected"
            ? "welcome"
            : "idle"
    );
    if (pip.connection === "connected" && !didStartTalkRef.current) {
      didStartTalkRef.current = true;
      talkStartedAtRef.current = Date.now();
      completionRecordedRef.current = false;
      void recordPipTalkStarted(documentId);
    }
  }, [pip.connection, pip.voiceState, setPipMood, documentId]);

  useEffect(() => {
    if (pip.connection !== "connected") return;
    maybeRecordMeaningfulCompletion();
  }, [pip.connection, pip.captions, maybeRecordMeaningfulCompletion]);

  // Auto-start when a flow explicitly requests it (e.g. TeachBack "Let's teach Pip").
  useEffect(() => {
    if (!expanded) return;
    if (pip.connection !== "idle") return;
    if (!autoStartTalk) return;
    if (!consumeAutoStartTalk()) return;
    void pip.connect();
  }, [
    expanded,
    pip.connection,
    autoStartTalk,
    consumeAutoStartTalk,
    pip.connect,
  ]);

  const endConversation = () => {
    maybeRecordMeaningfulCompletion();
    didStartTalkRef.current = false;
    talkStartedAtRef.current = null;
    pip.disconnect();
    setShareMessage(null);
    setCompanionOpen(false);
  };

  const toggleExpanded = () => {
    setCompanionOpen(!expanded);
  };

  const animState = useMemo(
    () =>
      deriveAnimState({
        muted: pip.muted,
        connection: pip.connection,
        voiceState: pip.voiceState,
        success: uiMood === "celebrate",
      }),
    [pip.muted, pip.connection, pip.voiceState, uiMood]
  );

  const sessionLive =
    pip.connection === "connected" || pip.connection === "connecting";

  const panel = expanded ? (
    <motion.aside
      id="pip-companion-panel"
      className={cn(
        "pointer-events-auto overflow-hidden rounded-3xl border border-white/90 bg-white/95 shadow-toolbar backdrop-blur-md",
        layout.fullWidthPanel ? "w-full" : "w-[min(100vw-2rem,20rem)]"
      )}
      style={{ maxHeight: layout.panelMaxHeight }}
      data-testid="pip-companion"
      data-placement={layout.mode}
      initial={
        reduceMotion
          ? false
          : { opacity: 0, y: layout.panelAbove ? 8 : -8, scale: 0.98 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduceMotion
          ? undefined
          : { opacity: 0, y: layout.panelAbove ? 6 : -6, scale: 0.98 }
      }
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-mc-purple/10 px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-mc-ink">
            Talk to Pip
          </p>
          <p
            className="text-sm text-mc-ink/60"
            data-testid="pip-connection-status"
          >
            {statusLabel(pip.connection, pip.voiceState, pip.muted)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 rounded-full"
          aria-label="Collapse Pip panel"
          data-testid="pip-collapse"
          onClick={() => setCompanionOpen(false)}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 overflow-y-auto px-4 py-3">
        {pip.connection === "idle" && (
          <Button
            size="lg"
            className="w-full rounded-2xl"
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
          <div className="space-y-2" data-testid="pip-session-controls">
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
            ref={captionsScrollRef}
            className="max-h-28 space-y-2 overflow-y-auto rounded-2xl bg-[#FAF9F6] p-3"
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
    </motion.aside>
  ) : null;

  const launcher = (
    <button
      type="button"
      className="pointer-events-auto relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/35"
      data-testid="pip-fab"
      aria-expanded={expanded}
      aria-controls={expanded ? "pip-companion-panel" : undefined}
      aria-label={expanded ? "Hide Pip panel" : "Show Pip panel"}
      onClick={toggleExpanded}
    >
      <span
        className="relative flex items-center justify-center rounded-full bg-white/90 shadow-toolbar ring-2 ring-white"
        style={{
          width: layout.launcherSize,
          height: layout.launcherSize,
        }}
      >
        <PipAvatar
          state={animState}
          level={pip.level}
          size={layout.launcherSize - 8}
          label="Pip the Wondoodle mascot"
        />
        {sessionLive && (
          <span
            className={cn(
              "absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white",
              pip.muted ? "bg-mc-ink/50" : "bg-mc-mint"
            )}
            data-testid="pip-session-indicator"
            aria-label={
              pip.muted ? "Pip session muted" : "Pip session active"
            }
          />
        )}
      </span>
    </button>
  );

  const launcherRow = (
    <div
      className={cn(
        "flex items-end gap-2",
        layout.fullWidthPanel && "justify-end"
      )}
    >
      {launcher}
    </div>
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-40 flex flex-col",
        layout.fullWidthPanel ? undefined : "items-end",
        layout.panelAbove ? "justify-end" : "justify-start"
      )}
      style={layout.wrapper}
      data-testid="pip-companion-anchor"
      data-layout-mode={layout.mode}
    >
      {/*
        panelAbove: card then Pip (opens upward, clear of zoom).
        else: Pip then card (opens downward under the launcher).
      */}
      <div
        className={cn(
          "flex gap-2",
          layout.fullWidthPanel ? "w-full flex-col" : "flex-col items-end"
        )}
      >
        {layout.panelAbove ? (
          <>
            <AnimatePresence initial={false}>{panel}</AnimatePresence>
            {launcherRow}
          </>
        ) : (
          <>
            {launcherRow}
            <AnimatePresence initial={false}>{panel}</AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
