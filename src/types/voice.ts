export type VoiceNoteStatus =
  | "recording"
  | "transcribing"
  | "review"
  | "saved"
  | "error";

export type VoiceNoteAnchor =
  | { type: "object"; objectId: string }
  | { type: "point"; x: number; y: number }
  | { type: "unanchored" };

export type VoiceNote = {
  id: string;
  documentId: string;
  anchor: VoiceNoteAnchor;
  originalTranscript: string;
  editedTranscript: string;
  durationMs: number;
  createdAt: number;
  updatedAt: number;
  status: VoiceNoteStatus;
  /** Session-only; never persisted to Dexie. */
  audioMimeType?: string | null;
};

export type TranscribeSuccessResponse = {
  ok: true;
  transcript: string;
  language?: string | null;
  durationMs?: number | null;
  model: string;
};

export type TranscribeErrorResponse = {
  ok: false;
  error: string;
  code:
    | "missing_api_key"
    | "invalid_file"
    | "too_large"
    | "unsupported_type"
    | "empty_audio"
    | "upstream"
    | "server";
};

export type TranscribeResponse =
  | TranscribeSuccessResponse
  | TranscribeErrorResponse;

export const MAX_VOICE_DURATION_MS = 60_000;
export const MAX_AUDIO_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/x-m4a",
] as const;

export const voiceCopy = {
  prompt: "Tell me how you solved it!",
  listening: "I'm listening...",
  transcribing: "Turning your words into text...",
  heard: "Here's what I heard.",
  retry: "Want to try again?",
  disclosure:
    "Your recording is sent to a transcription service, then deleted from our servers. We don't keep the audio file.",
  replayUnavailable:
    "Replay is only available during this session. Refreshing the page clears temporary audio.",
  permissionDenied:
    "We couldn't use your microphone. Check browser permissions and try again.",
  unsupported: "Voice recording isn't supported in this browser yet.",
  emptyTranscript:
    "I couldn't hear clear words that time. Want to try again?",
  saveSuccess: "Explanation saved!",
} as const;
