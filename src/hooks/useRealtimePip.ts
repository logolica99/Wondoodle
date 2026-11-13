"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wantsCanvasLook } from "@/lib/voice/canvasLookIntent";
import type { CanvasSnapshotResult } from "@/lib/canvas/snapshot";
import { REPORT_LEARNING_OBSERVATION_NAME } from "@/lib/voice/reportLearningObservation";
import { OPEN_LEARNING_ACTIVITY_NAME } from "@/lib/voice/openLearningActivity";
import { REPORT_TEACHBACK_ASSESSMENT_NAME } from "@/lib/voice/reportTeachbackAssessment";
import {
  CREATE_ADVENTURE_NAME,
  CREATE_LEARNING_ADVENTURE_NAME,
  parseCreateAdventureArgs,
  type CreateAdventureToolArgs,
} from "@/lib/voice/createAdventureTool";
import { parseLearningObservationArgs } from "@/lib/learning/observationSchema";
import { applyLearningObservation } from "@/lib/learning/observationHandler";
import { parseTeachBackAssessmentArgs } from "@/lib/learning/teachbackSchema";
import { applyTeachBackAssessment } from "@/lib/learning/teachbackHandler";
import type { DiscoveryCardModel } from "@/lib/learning/observationSchema";
import { buildActivityRoute } from "@/lib/learning/misconceptions";
import {
  isImplementedActivity,
  useActivityStore,
} from "@/store/activityStore";
import { usePipStore } from "@/store/pipStore";
import { isMasteryIndependentActive } from "@/store/masteryStore";
import { withEnglishLock } from "@/lib/voice/pipInstructions";

export type PipConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export type PipVoiceState = "idle" | "listening" | "speaking";

export type CaptionLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
  partial?: boolean;
};

const CAPTION_HISTORY_KEY = "wondoodle-pip-captions";
const SHARE_COOLDOWN_MS = 4000;

/** Optional text-only caption history for the current browser tab. Never stores audio. */
function persistCaptionHistory(lines: CaptionLine[]) {
  try {
    const compact = lines
      .filter((l) => !l.partial && l.text.trim())
      .map(({ id, role, text }) => ({ id, role, text }));
    sessionStorage.setItem(CAPTION_HISTORY_KEY, JSON.stringify(compact));
  } catch {
    // sessionStorage may be unavailable
  }
}

function clearCaptionHistory() {
  try {
    sessionStorage.removeItem(CAPTION_HISTORY_KEY);
  } catch {
    // ignore
  }
}

type SessionResponse =
  | {
      ok: true;
      clientSecret: string;
      expiresAt: number | null;
      model: string;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

type RealtimeServerEvent = {
  type?: string;
  transcript?: string;
  delta?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  item?: {
    type?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
  };
  response?: {
    output?: Array<{
      type?: string;
      name?: string;
      call_id?: string;
      arguments?: string;
    }>;
  };
};

export type UseRealtimePipOptions = {
  getCanvasSnapshot?: () => Promise<CanvasSnapshotResult>;
  onShareStatus?: (message: string | null) => void;
  onDiscoveryObservation?: (card: DiscoveryCardModel) => void;
  /** Open a validated activity from a realtime tool call. */
  onOpenActivity?: (activityId: string) => boolean;
  /** Create adventure after conversational agreement (captures real canvas). */
  onCreateAdventure?: (
    args: CreateAdventureToolArgs
  ) => Promise<{
    ok: boolean;
    adventureId?: string;
    title?: string;
    duplicate?: boolean;
    error?: string;
  }>;
  documentId?: string;
};

export function useRealtimePip(options: UseRealtimePipOptions = {}) {
  const [connection, setConnection] = useState<PipConnectionState>("idle");
  const [voiceState, setVoiceState] = useState<PipVoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [level, setLevel] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const assistantPartialRef = useRef("");
  const connectedRef = useRef(false);
  const sharingRef = useRef(false);
  const lastShareAtRef = useRef(0);
  const handledCallsRef = useRef<Set<string>>(new Set());
  const getSnapshotRef = useRef(options.getCanvasSnapshot);
  const onShareStatusRef = useRef(options.onShareStatus);
  const onDiscoveryRef = useRef(options.onDiscoveryObservation);
  const onOpenActivityRef = useRef(options.onOpenActivity);
  const onCreateAdventureRef = useRef(options.onCreateAdventure);
  const documentIdRef = useRef(options.documentId);

  useEffect(() => {
    getSnapshotRef.current = options.getCanvasSnapshot;
    onShareStatusRef.current = options.onShareStatus;
    onDiscoveryRef.current = options.onDiscoveryObservation;
    onOpenActivityRef.current = options.onOpenActivity;
    onCreateAdventureRef.current = options.onCreateAdventure;
    documentIdRef.current = options.documentId;
  }, [
    options.getCanvasSnapshot,
    options.onShareStatus,
    options.onDiscoveryObservation,
    options.onOpenActivity,
    options.onCreateAdventure,
    options.documentId,
  ]);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    setLevel(0);
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    connectedRef.current = false;
    sharingRef.current = false;
    handledCallsRef.current.clear();
    stopMeter();

    try {
      dcRef.current?.close();
    } catch {
      // ignore
    }
    dcRef.current = null;

    try {
      pcRef.current?.getSenders().forEach((s) => {
        try {
          s.track?.stop();
        } catch {
          // ignore
        }
      });
      pcRef.current?.close();
    } catch {
      // ignore
    }
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setMicActive(false);

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.pause();
      remoteAudioRef.current = null;
    }

    setVoiceState("idle");
    setMuted(false);
  }, [stopMeter]);

  useEffect(() => () => cleanup(), [cleanup]);

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return false;
    dc.send(JSON.stringify(event));
    return true;
  }, []);

  const deliverCanvasSnapshot = useCallback(
    async (opts?: { callId?: string; fromTool?: boolean }) => {
      if (sharingRef.current) return false;
      const now = Date.now();
      if (now - lastShareAtRef.current < SHARE_COOLDOWN_MS) return false;

      const getter = getSnapshotRef.current;
      if (!getter) {
        if (opts?.callId) {
          sendEvent({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: opts.callId,
              output: JSON.stringify({
                ok: false,
                error: "Canvas snapshot is unavailable.",
              }),
            },
          });
          sendEvent({
            type: "response.create",
            response: { output_modalities: ["audio"] },
          });
        }
        return false;
      }

      sharingRef.current = true;
      onShareStatusRef.current?.("Looking at your canvas…");
      try {
        const snap = await getter();
        if (!snap.ok) {
          onShareStatusRef.current?.(snap.error);
          if (opts?.callId) {
            sendEvent({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: opts.callId,
                output: JSON.stringify({
                  ok: false,
                  empty: Boolean(snap.empty),
                  error: snap.error,
                }),
              },
            });
            sendEvent({
              type: "response.create",
              response: {
                output_modalities: ["audio"],
                instructions: withEnglishLock(
                  "The canvas snapshot failed or was empty. Tell the student kindly, and invite them to draw something if it was empty. Do not invent what is on the canvas."
                ),
              },
            });
          }
          return false;
        }

        if (opts?.callId) {
          sendEvent({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: opts.callId,
              output: JSON.stringify({
                ok: true,
                message: "Snapshot captured and attached as an image.",
              }),
            },
          });
        }

        const adventureInvite =
          usePipStore.getState().consumeAdventureInvitePending();

        let adventureActive = false;
        try {
          const { useAdventureStore } = await import("@/store/adventureStore");
          adventureActive =
            useAdventureStore.getState().adventure?.status === "active";
        } catch {
          adventureActive = false;
        }

        const prompt = adventureInvite
          ? "Here is the latest snapshot of my Wondoodle canvas. The student tapped Make an Adventure. Do NOT describe the drawing and do NOT ask a tutoring question. Reply with exactly one short line in this form: “Is this your adventure: <short guessed goal>?” Then wait for yes/no."
          : adventureActive
            ? "Here is the latest snapshot of my Wondoodle canvas for the active adventure. If their equation/answer for the goal looks correct, say it’s right, invite Check, and STOP. If wrong or incomplete, say which SPECIFIC part is wrong (which number/step) in one short sentence — do not only ask a vague question, and do not give the full correct final answer yet."
            : opts?.fromTool
              ? "Here is the latest snapshot of my Wondoodle canvas. If the solution looks correct, confirm briefly and stop. If wrong or incomplete, point to the SPECIFIC wrong part (which number/step) in one short sentence. Do not give away the full correct answer before they retry."
              : "I asked you to look at my Wondoodle canvas. Here is a fresh snapshot. If the solution looks correct, confirm briefly and stop. If wrong or incomplete, point to the SPECIFIC wrong part (which number/step) in one short sentence. Do not give away the full correct answer before they retry.";

        const sent = sendEvent({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: snap.dataUrl },
            ],
          },
        });
        if (!sent) {
          onShareStatusRef.current?.(
            "I couldn't send the picture. Check the connection and try again."
          );
          return false;
        }

        const lookInstructions = adventureInvite
          ? withEnglishLock(
              "Make an Adventure invite only. Say exactly one sentence like: “Is this your adventure: <short goal from the image>?” Do not describe the canvas. Do not ask what angles add up to. Do not teach. Wait for yes/no."
            )
          : adventureActive
            ? withEnglishLock(
                "Adventure canvas check. If the written solution matches the goal, say it’s correct, invite Check, and ask NOTHING else. If wrong/incomplete, name the exact wrong part (e.g. “the 70 you used for the two angles looks off”) in one sentence. Do not only ask “are you sure?” and do not state the full correct final answer yet."
              )
            : withEnglishLock(
                "If the canvas shows a complete correct solution, confirm and stop. If wrong/incomplete, name the specific wrong part in one sentence. Do not quiz vaguely and do not reveal the full correct answer first."
              );

        sendEvent({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: lookInstructions,
          },
        });
        lastShareAtRef.current = Date.now();
        onShareStatusRef.current?.("Pip is looking at your work.");
        return true;
      } catch {
        onShareStatusRef.current?.(
          "I couldn't capture your canvas. Please try again."
        );
        if (opts?.callId) {
          sendEvent({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: opts.callId,
              output: JSON.stringify({
                ok: false,
                error: "Capture failed.",
              }),
            },
          });
          sendEvent({
            type: "response.create",
            response: { output_modalities: ["audio"] },
          });
        }
        return false;
      } finally {
        sharingRef.current = false;
      }
    },
    [sendEvent]
  );

  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastPublish = 0;
      let lastLevel = 0;
      const tick = (now: number) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const next = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
        // Throttle React updates (~12fps) to protect canvas performance.
        if (now - lastPublish > 80 && Math.abs(next - lastLevel) > 0.03) {
          lastPublish = now;
          lastLevel = next;
          setLevel(next);
        }
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch {
      // Meter is optional.
    }
  }, []);

  const handleLookAtCanvasCall = useCallback(
    (callId: string) => {
      if (handledCallsRef.current.has(callId)) return;
      handledCallsRef.current.add(callId);
      void deliverCanvasSnapshot({ callId, fromTool: true });
    },
    [deliverCanvasSnapshot]
  );

  const ackToolCall = useCallback(
    (callId: string, output: Record<string, unknown>) => {
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(output),
        },
      });
      sendEvent({
        type: "response.create",
        response: { output_modalities: ["audio"] },
      });
    },
    [sendEvent]
  );

  const handleObservationCall = useCallback(
    (callId: string, argsRaw: string | undefined) => {
      if (handledCallsRef.current.has(callId)) return;
      handledCallsRef.current.add(callId);

      if (isMasteryIndependentActive()) {
        ackToolCall(callId, {
          ok: false,
          blocked: true,
          error: "Independent mastery check is active.",
          guidance:
            "Do not give math hints or observations. Only help with navigation. If they need math help, invite them to exit the challenge.",
        });
        return;
      }

      void (async () => {
        try {
          const parsed = parseLearningObservationArgs(argsRaw ?? "{}");
          if (!parsed.ok) {
            ackToolCall(callId, {
              ok: false,
              error: parsed.error,
              guidance:
                "Tool arguments were invalid. Ask a clarifying question if needed and continue normally.",
            });
            return;
          }

          const result = await applyLearningObservation(parsed.observation, {
            callId,
            documentId: documentIdRef.current,
          });

          if (result.card) {
            try {
              onDiscoveryRef.current?.(result.card);
            } catch {
              // UI update must not break voice.
            }
          }

          ackToolCall(callId, {
            ok: result.ok,
            action: result.action,
            message: result.message,
            eventId: result.eventId ?? null,
          });
        } catch {
          ackToolCall(callId, {
            ok: false,
            error: "Observation handling failed.",
            guidance: "Continue the conversation without a discovery card.",
          });
        }
      })();
    },
    [ackToolCall]
  );

  const handleUnsupportedTool = useCallback(
    (callId: string, name: string) => {
      if (handledCallsRef.current.has(callId)) return;
      handledCallsRef.current.add(callId);
      ackToolCall(callId, {
        ok: false,
        error: `Unsupported tool: ${name}`,
        guidance: "Continue speaking with the student normally.",
      });
    },
    [ackToolCall]
  );

  const handleTeachBackCall = useCallback(
    (callId: string, argsRaw: string | undefined) => {
      if (handledCallsRef.current.has(callId)) return;
      handledCallsRef.current.add(callId);

      if (isMasteryIndependentActive()) {
        ackToolCall(callId, {
          ok: false,
          blocked: true,
          error: "Independent mastery check is active.",
          guidance:
            "Do not assess TeachBack or give fraction hints during the Superpower Challenge.",
        });
        return;
      }

      void (async () => {
        try {
          const parsed = parseTeachBackAssessmentArgs(argsRaw ?? "{}");
          if (!parsed.ok) {
            ackToolCall(callId, {
              ok: false,
              error: parsed.error,
              guidance:
                "Assessment arguments were invalid. Ask one clarifying question and keep TeachBack open.",
            });
            return;
          }

          const result = await applyTeachBackAssessment(parsed.assessment, {
            callId,
            documentId: documentIdRef.current,
          });

          ackToolCall(callId, {
            ok: result.ok,
            action: result.action,
            message: result.message,
            followUpQuestion: result.followUpQuestion ?? null,
          });
        } catch {
          ackToolCall(callId, {
            ok: false,
            error: "TeachBack assessment handling failed.",
            guidance:
              "Keep the student in TeachBack and ask a gentle clarifying question.",
          });
        }
      })();
    },
    [ackToolCall]
  );

  const handleCreateAdventureCall = useCallback(
    (callId: string, argsRaw: string | undefined) => {
      if (handledCallsRef.current.has(callId)) return;
      handledCallsRef.current.add(callId);

      if (isMasteryIndependentActive()) {
        ackToolCall(callId, {
          ok: false,
          blocked: true,
          error: "Independent mastery check is active.",
          guidance: "Finish or exit the Superpower Challenge first.",
        });
        return;
      }

      const parsed = parseCreateAdventureArgs(argsRaw ?? "{}");
      void (async () => {
        if (!parsed.studentAgreed) {
          ackToolCall(callId, {
            ok: false,
            error: "studentAgreed must be true.",
            guidance:
              "Ask if they want an adventure and wait for a clear yes before calling create_adventure again.",
          });
          return;
        }
        if (parsed.goal.length < 3) {
          ackToolCall(callId, {
            ok: false,
            error: "Goal too short or missing.",
            guidance:
              "Ask ONE short clarifying question about what they want to figure out, then call create_adventure after they answer and agree.",
          });
          return;
        }

        const handler = onCreateAdventureRef.current;
        if (!handler) {
          ackToolCall(callId, {
            ok: false,
            error: "Adventure creator unavailable.",
            guidance: "Invite them to tap Make an Adventure on the toolbar.",
          });
          return;
        }

        try {
          const result = await handler(parsed);
          ackToolCall(callId, {
            ok: result.ok,
            adventureId: result.adventureId ?? null,
            title: result.title ?? null,
            duplicate: Boolean(result.duplicate),
            error: result.error ?? null,
            message: result.ok
              ? result.duplicate
                ? "Adventure already exists for this request. Celebrate briefly and invite them to view it when ready."
                : `Adventure created: "${result.title}". Celebrate briefly. A small ready card is on screen — do not force them off the canvas.`
              : result.error || "Could not create adventure.",
            guidance: result.ok
              ? "Stay in this voice session. Answer questions about the adventure using later [Adventure context] events."
              : "Stay supportive. You may ask one clarifying question or invite them to try Make an Adventure again.",
          });
        } catch {
          ackToolCall(callId, {
            ok: false,
            error: "Adventure creation failed.",
            guidance: "Apologize briefly and offer to try again later.",
          });
        }
      })();
    },
    [ackToolCall]
  );

  const handleOpenActivityCall = useCallback(
    (callId: string, argsRaw: string | undefined) => {
      if (handledCallsRef.current.has(callId)) return;
      handledCallsRef.current.add(callId);

      let activityId = "";
      try {
        const parsed = JSON.parse(argsRaw || "{}") as { activityId?: string };
        activityId = String(parsed.activityId ?? "");
      } catch {
        ackToolCall(callId, {
          ok: false,
          error: "Malformed open_learning_activity arguments.",
        });
        return;
      }

      if (isMasteryIndependentActive()) {
        ackToolCall(callId, {
          ok: false,
          blocked: true,
          error: "Independent mastery check is active.",
          guidance:
            "Do not open guided activities during the Superpower Challenge.",
        });
        return;
      }

      if (!isImplementedActivity(activityId)) {
        ackToolCall(callId, {
          ok: false,
          error: `Activity not available: ${activityId || "(missing)"}`,
          guidance:
            "Only fraction_comparison is available. Invite the student to tap Try playground on the discovery card.",
        });
        return;
      }

      let opened = false;
      try {
        opened = Boolean(onOpenActivityRef.current?.(activityId));
      } catch {
        opened = false;
      }

      if (!opened) {
        try {
          opened = useActivityStore
            .getState()
            .openFractionPlayground(buildActivityRoute("denominator_size"));
        } catch {
          opened = false;
        }
      }

      ackToolCall(callId, {
        ok: opened,
        activityId,
        message: opened
          ? "Fraction Playground is open. Guide the student using activity events; do not grade for them."
          : "Could not open the activity. Ask them to tap Try playground on the discovery card.",
      });
    },
    [ackToolCall]
  );

  /** Push structured activity ground-truth into the live conversation. */
  const notifyActivityEvent = useCallback(
    (
      summary: string,
      payload?: Record<string, unknown>,
      opts?: { createResponse?: boolean; instructions?: string }
    ) => {
      if (!connectedRef.current) return false;
      const body = [
        "[Activity event]",
        summary,
        payload ? `data: ${JSON.stringify(payload)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const sent = sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: body }],
        },
      });
      if (!sent) return false;
      if (opts?.createResponse === false) return true;
      sendEvent({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions: withEnglishLock(
            opts?.instructions?.trim() ||
              "Respond briefly using the activity event facts."
          ),
        },
      });
      return true;
    },
    [sendEvent]
  );

  const handleServerEvent = useCallback(
    (raw: MessageEvent) => {
      let event: RealtimeServerEvent;
      try {
        event = JSON.parse(String(raw.data));
      } catch {
        return;
      }
      const type = event.type ?? "";

      if (type === "input_audio_buffer.speech_started") {
        setVoiceState("listening");
        assistantPartialRef.current = "";
      } else if (type === "input_audio_buffer.speech_stopped") {
        setVoiceState((s) => (s === "listening" ? "idle" : s));
      } else if (
        type === "response.created" ||
        type === "response.output_audio.delta" ||
        type === "output_audio_buffer.started"
      ) {
        setVoiceState("speaking");
      } else if (
        type === "response.done" ||
        type === "response.cancelled" ||
        type === "output_audio_buffer.stopped"
      ) {
        setVoiceState("idle");
        assistantPartialRef.current = "";

        const outputs = event.response?.output ?? [];
        for (const item of outputs) {
          if (item.type !== "function_call" || !item.call_id) continue;
          if (item.name === "look_at_canvas") {
            handleLookAtCanvasCall(item.call_id);
          } else if (item.name === REPORT_LEARNING_OBSERVATION_NAME) {
            handleObservationCall(item.call_id, item.arguments);
          } else if (item.name === OPEN_LEARNING_ACTIVITY_NAME) {
            handleOpenActivityCall(item.call_id, item.arguments);
          } else if (item.name === REPORT_TEACHBACK_ASSESSMENT_NAME) {
            handleTeachBackCall(item.call_id, item.arguments);
          } else if (
            item.name === CREATE_ADVENTURE_NAME ||
            item.name === CREATE_LEARNING_ADVENTURE_NAME
          ) {
            handleCreateAdventureCall(item.call_id, item.arguments);
          } else if (item.name) {
            handleUnsupportedTool(item.call_id, item.name);
          }
        }
      } else if (
        type === "response.function_call_arguments.done" &&
        event.call_id
      ) {
        if (event.name === "look_at_canvas") {
          handleLookAtCanvasCall(event.call_id);
        } else if (event.name === REPORT_LEARNING_OBSERVATION_NAME) {
          handleObservationCall(event.call_id, event.arguments);
        } else if (event.name === OPEN_LEARNING_ACTIVITY_NAME) {
          handleOpenActivityCall(event.call_id, event.arguments);
        } else if (event.name === REPORT_TEACHBACK_ASSESSMENT_NAME) {
          handleTeachBackCall(event.call_id, event.arguments);
        } else if (
          event.name === CREATE_ADVENTURE_NAME ||
          event.name === CREATE_LEARNING_ADVENTURE_NAME
        ) {
          handleCreateAdventureCall(event.call_id, event.arguments);
        } else if (event.name) {
          handleUnsupportedTool(event.call_id, event.name);
        }
      } else if (
        type === "response.output_item.done" &&
        event.item?.type === "function_call" &&
        event.item.call_id
      ) {
        if (event.item.name === "look_at_canvas") {
          handleLookAtCanvasCall(event.item.call_id);
        } else if (event.item.name === REPORT_LEARNING_OBSERVATION_NAME) {
          handleObservationCall(event.item.call_id, event.item.arguments);
        } else if (event.item.name === OPEN_LEARNING_ACTIVITY_NAME) {
          handleOpenActivityCall(
            event.item.call_id,
            event.item.arguments
          );
        } else if (event.item.name === REPORT_TEACHBACK_ASSESSMENT_NAME) {
          handleTeachBackCall(event.item.call_id, event.item.arguments);
        } else if (
          event.item.name === CREATE_ADVENTURE_NAME ||
          event.item.name === CREATE_LEARNING_ADVENTURE_NAME
        ) {
          handleCreateAdventureCall(
            event.item.call_id,
            event.item.arguments
          );
        } else if (event.item.name) {
          handleUnsupportedTool(event.item.call_id, event.item.name);
        }
      } else if (
        type === "conversation.item.input_audio_transcription.completed" &&
        event.transcript
      ) {
        const text = event.transcript.trim();
        if (text) {
          setCaptions((prev) => {
            const next = [
              ...prev.slice(-12),
              { id: `u-${Date.now()}`, role: "user" as const, text },
            ];
            persistCaptionHistory(next);
            return next;
          });
          if (wantsCanvasLook(text)) {
            void deliverCanvasSnapshot({ fromTool: false });
          }
        }
      } else if (
        type === "response.output_audio_transcript.delta" &&
        event.delta
      ) {
        assistantPartialRef.current += event.delta;
        const partial = assistantPartialRef.current;
        setCaptions((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && last.partial) {
            next[next.length - 1] = { ...last, text: partial };
          } else {
            next.push({
              id: `a-${Date.now()}`,
              role: "assistant",
              text: partial,
              partial: true,
            });
          }
          return next.slice(-12);
        });
      } else if (
        type === "response.output_audio_transcript.done" &&
        event.transcript
      ) {
        const text = event.transcript.trim();
        assistantPartialRef.current = "";
        if (text) {
          setCaptions((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant" && last.partial) {
              next[next.length - 1] = {
                id: last.id,
                role: "assistant",
                text,
              };
            } else {
              next.push({ id: `a-${Date.now()}`, role: "assistant", text });
            }
            const sliced = next.slice(-12);
            persistCaptionHistory(sliced);
            return sliced;
          });
        }
      } else if (type === "error") {
        setError("Pip had trouble hearing that. You can retry the connection.");
      }
    },
    [
      deliverCanvasSnapshot,
      handleLookAtCanvasCall,
      handleObservationCall,
      handleOpenActivityCall,
      handleTeachBackCall,
      handleCreateAdventureCall,
      handleUnsupportedTool,
    ]
  );

  const connect = useCallback(async () => {
    if (connection === "connecting" || connection === "connected") return;

    setError(null);
    setConnection("connecting");
    setCaptions([]);
    handledCallsRef.current.clear();
    onShareStatusRef.current?.(null);
    cleanup();

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === "undefined"
    ) {
      setConnection("error");
      setError("Live voice isn't supported in this browser yet.");
      return;
    }

    try {
      const tokenRes = await fetch("/api/realtime/session", { method: "POST" });
      const tokenJson = (await tokenRes.json()) as SessionResponse;
      if (!tokenJson.ok) {
        setConnection("error");
        setError(tokenJson.error);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      localStreamRef.current = stream;
      setMicActive(true);
      startMeter(stream);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;
      pc.ontrack = (e) => {
        remoteAudio.srcObject = e.streams[0];
        void remoteAudio.play().catch(() => undefined);
      };

      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, stream);
      });

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("message", handleServerEvent);

      let greeted = false;
      const markConnected = () => {
        if (pcRef.current !== pc || connectedRef.current) return;
        connectedRef.current = true;
        setConnection("connected");
        setError(null);
        if (!greeted && dc.readyState === "open") {
          greeted = true;
          // TeachBack (and similar flows) can replace the generic greeting.
          const opening = withEnglishLock(
            usePipStore.getState().consumeOpeningInstructions() ??
              "Greet the student briefly as Pip and invite them to talk about what they're working on. Do not claim you can see their canvas yet. If they ask you to look, call look_at_canvas."
          );
          dc.send(
            JSON.stringify({
              type: "response.create",
              response: {
                instructions: opening,
              },
            })
          );
        }
      };

      dc.addEventListener("open", markConnected);

      pc.addEventListener("connectionstatechange", () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          if (connectedRef.current) {
            setConnection("error");
            setError("The voice connection dropped. Tap retry to talk again.");
            cleanup();
          }
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${tokenJson.clientSecret}`,
            "Content-Type": "application/sdp",
          },
        }
      );

      if (!sdpResponse.ok) {
        throw new Error("Failed to establish realtime call");
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      if (dc.readyState === "open") {
        markConnected();
      }
    } catch (err) {
      cleanup();
      setConnection("error");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError(
          "We couldn't use your microphone. Check browser permissions and try again."
        );
      } else {
        setError("Couldn't connect to Pip. Please try again.");
      }
    }
  }, [connection, cleanup, startMeter, handleServerEvent]);

  const disconnect = useCallback(() => {
    // Cancel any in-flight model speech before tearing down WebRTC.
    try {
      const dc = dcRef.current;
      if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify({ type: "response.cancel" }));
      }
    } catch {
      // ignore
    }
    cleanup();
    clearCaptionHistory();
    setCaptions([]);
    setConnection("idle");
    setError(null);
    setVoiceState("idle");
    onShareStatusRef.current?.(null);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const interrupt = useCallback(() => {
    sendEvent({ type: "response.cancel" });
    setVoiceState("idle");
  }, [sendEvent]);

  return {
    connection,
    voiceState,
    muted,
    error,
    captions,
    micActive,
    level,
    connect,
    disconnect,
    toggleMute,
    interrupt,
    notifyActivityEvent,
    isConnected: connection === "connected",
  };
}
