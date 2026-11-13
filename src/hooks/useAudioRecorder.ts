"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_VOICE_DURATION_MS, voiceCopy } from "@/types/voice";
import { pickSupportedMimeType } from "@/lib/voice/mime";

export type RecorderPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "error";

export type RecorderErrorKind =
  | "unsupported"
  | "permission"
  | "device"
  | "unknown";

type UseAudioRecorderOptions = {
  maxDurationMs?: number;
  onAutoStop?: (blob: Blob, durationMs: number) => void;
};

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const maxDurationMs = options.maxDurationMs ?? MAX_VOICE_DURATION_MS;
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<RecorderErrorKind | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string>("");

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const onAutoStopRef = useRef(options.onAutoStop);
  onAutoStopRef.current = options.onAutoStop;

  const clearMeter = useCallback(() => {
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    setLevel(0);
  }, []);

  const stopTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  const closeAudioGraph = useCallback(() => {
    clearMeter();
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, [clearMeter]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    clearTimers();
    closeAudioGraph();
    stopTracks();
    recorderRef.current = null;
    chunksRef.current = [];
    setDurationMs(0);
    setAudioBlob(null);
    revokeObjectUrl();
    setError(null);
    setErrorKind(null);
    setPhase("idle");
  }, [clearTimers, closeAudioGraph, stopTracks, revokeObjectUrl]);

  useEffect(() => {
    return () => {
      clearTimers();
      closeAudioGraph();
      stopTracks();
      revokeObjectUrl();
      try {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      } catch {
        // ignore
      }
    };
  }, [clearTimers, closeAudioGraph, stopTracks, revokeObjectUrl]);

  const startMeter = useCallback((stream: MediaStream) => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      const node = analyserRef.current;
      if (!node) return;
      node.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 3.2));
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
  }, []);

  const finalizeBlob = useCallback(
    (blob: Blob) => {
      const elapsed = Math.min(
        maxDurationMs,
        Date.now() - startedAtRef.current
      );
      setDurationMs(elapsed);
      setAudioBlob(blob);
      setPhase("stopped");
      closeAudioGraph();
      stopTracks();
      clearTimers();
      onAutoStopRef.current?.(blob, elapsed);
    },
    [maxDurationMs, closeAudioGraph, stopTracks, clearTimers]
  );

  const start = useCallback(async () => {
    if (phase === "recording" || phase === "requesting") return;

    setError(null);
    setErrorKind(null);
    setAudioBlob(null);
    revokeObjectUrl();
    chunksRef.current = [];

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setPhase("error");
      setErrorKind("unsupported");
      setError(voiceCopy.unsupported);
      return;
    }

    const mime = pickSupportedMimeType();
    if (mime === null) {
      setPhase("error");
      setErrorKind("unsupported");
      setError(voiceCopy.unsupported);
      return;
    }

    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;
      const resolvedMime = mime || "";
      setMimeType(resolvedMime || "audio/webm");

      const recorder = resolvedMime
        ? new MediaRecorder(stream, { mimeType: resolvedMime })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setPhase("error");
        setErrorKind("device");
        setError("Recording failed. Please try again.");
        resetSession();
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || resolvedMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        finalizeBlob(blob);
      };

      startMeter(stream);
      startedAtRef.current = Date.now();
      setDurationMs(0);
      recorder.start(250);
      setPhase("recording");

      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, 200);

      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, maxDurationMs);
    } catch (err) {
      stopTracks();
      closeAudioGraph();
      setPhase("error");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorKind("permission");
        setError(voiceCopy.permissionDenied);
      } else {
        setErrorKind("device");
        setError("We couldn't start the microphone. Please try again.");
      }
    }
  }, [
    phase,
    maxDurationMs,
    revokeObjectUrl,
    startMeter,
    finalizeBlob,
    resetSession,
    stopTracks,
    closeAudioGraph,
  ]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    try {
      if (recorderRef.current) {
        recorderRef.current.onstop = null;
        if (recorderRef.current.state === "recording") {
          recorderRef.current.stop();
        }
      }
    } catch {
      // ignore
    }
    resetSession();
  }, [resetSession]);

  const getObjectUrl = useCallback(() => {
    if (!audioBlob) return null;
    if (!objectUrlRef.current) {
      objectUrlRef.current = URL.createObjectURL(audioBlob);
    }
    return objectUrlRef.current;
  }, [audioBlob]);

  return {
    phase,
    error,
    errorKind,
    durationMs,
    level,
    audioBlob,
    mimeType,
    start,
    stop,
    cancel,
    resetSession,
    getObjectUrl,
    isRecording: phase === "recording",
  };
}
