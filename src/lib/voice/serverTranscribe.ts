import OpenAI from "openai";
import type { TranscribeResponse } from "@/types/voice";

/**
 * Provider-agnostic transcription entrypoint.
 * Swap the OpenAI implementation here without changing the route contract.
 */
export async function transcribeWithProvider(
  file: File
): Promise<TranscribeResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Transcription isn't configured yet (missing API key).",
      code: "missing_api_key",
    };
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

  try {
    const result = await client.audio.transcriptions.create({
      file,
      model,
      response_format: "json",
    });

    const transcript = (result.text ?? "").trim();
    return {
      ok: true,
      transcript,
      language: null,
      durationMs: null,
      model,
    };
  } catch {
    return {
      ok: false,
      error: "Transcription failed. Please try again in a moment.",
      code: "upstream",
    };
  }
}
