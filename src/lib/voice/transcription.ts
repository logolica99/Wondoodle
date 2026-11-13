import type { TranscribeResponse } from "@/types/voice";
import { extensionForMime } from "./mime";

export async function transcribeAudioBlob(
  blob: Blob,
  mimeType: string
): Promise<TranscribeResponse> {
  const form = new FormData();
  const ext = extensionForMime(mimeType || blob.type || "audio/webm");
  const file = new File([blob], `recording.${ext}`, {
    type: mimeType || blob.type || "audio/webm",
  });
  form.append("audio", file);

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
  });

  let payload: TranscribeResponse;
  try {
    payload = (await response.json()) as TranscribeResponse;
  } catch {
    return {
      ok: false,
      error: "We couldn't read the transcription response. Please try again.",
      code: "server",
    };
  }
  return payload;
}
