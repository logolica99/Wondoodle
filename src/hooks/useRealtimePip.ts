"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wantsCanvasLook } from "@/lib/voice/canvasLookIntent";
import type { CanvasSnapshotResult } from "@/lib/canvas/snapshot";

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
  item?: {
    type?: string;
    name?: string;
    call_id?: string;
  };
  response?: {
    output?: Array<{
      type?: string;
      name?: string;
      call_id?: string;
    }>;
  };
};

export type UseRealtimePipOptions = {
  getCanvasSnapshot?: () => Promise<CanvasSnapshotResult>;
  onShareStatus?: (message: string | null) => void;
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

  useEffect(() => {
    getSnapshotRef.current = options.getCanvasSnapshot;
    onShareStatusRef.current = options.onShareStatus;
  }, [options.getCanvasSnapshot, options.onShareStatus]);

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
                instructions:
                  "The canvas snapshot failed or was empty. Tell the student kindly, and invite them to draw something if it was empty. Do not invent what is on the canvas.",
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

        const prompt = opts?.fromTool
          ? "Here is the latest snapshot of my Wondoodle canvas. Briefly acknowledge that you can see it, then ask one helpful question. Do not give the final answer away."
          : "I asked you to look at my Wondoodle canvas. Here is a fresh snapshot. Briefly acknowledge that you can see it, then ask one helpful question. Do not give the final answer away.";

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

        sendEvent({
          type: "response.create",
          response: { output_modalities: ["audio"] },
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
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
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
          if (item.type === "function_call" && item.name === "look_at_canvas") {
            if (item.call_id) handleLookAtCanvasCall(item.call_id);
          }
        }
      } else if (
        type === "response.function_call_arguments.done" &&
        event.name === "look_at_canvas" &&
        event.call_id
      ) {
        handleLookAtCanvasCall(event.call_id);
      } else if (
        type === "response.output_item.done" &&
        event.item?.type === "function_call" &&
        event.item.name === "look_at_canvas" &&
        event.item.call_id
      ) {
        handleLookAtCanvasCall(event.item.call_id);
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
    [deliverCanvasSnapshot, handleLookAtCanvasCall]
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
          dc.send(
            JSON.stringify({
              type: "response.create",
              response: {
                instructions:
                  "Greet the student briefly as Pip and invite them to talk about what they're working on. Do not claim you can see their canvas yet. If they ask you to look, call look_at_canvas.",
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
    cleanup();
    clearCaptionHistory();
    setCaptions([]);
    setConnection("idle");
    setError(null);
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
    isConnected: connection === "connected",
  };
}
