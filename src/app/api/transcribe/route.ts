import { NextResponse } from "next/server";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  type TranscribeResponse,
} from "@/types/voice";
import { isAllowedAudioMime } from "@/lib/voice/mime";
import { transcribeWithProvider } from "@/lib/voice/serverTranscribe";

export const runtime = "nodejs";

function json(body: TranscribeResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const audio = form.get("audio");

    if (!(audio instanceof File)) {
      return json(
        {
          ok: false,
          error: "Please send an audio recording.",
          code: "invalid_file",
        },
        400
      );
    }

    if (audio.size <= 0) {
      return json(
        {
          ok: false,
          error: "That recording was empty. Please try again.",
          code: "empty_audio",
        },
        400
      );
    }

    if (audio.size > MAX_AUDIO_UPLOAD_BYTES) {
      return json(
        {
          ok: false,
          error: "That recording is too big. Try a shorter explanation.",
          code: "too_large",
        },
        413
      );
    }

    const mime = (audio.type || "").toLowerCase();
    if (!mime || !isAllowedAudioMime(mime)) {
      return json(
        {
          ok: false,
          error: "That audio format isn't supported.",
          code: "unsupported_type",
        },
        415
      );
    }

    // Re-wrap without trusting the client filename.
    const safe = new File([audio], "recording", { type: mime });
    const result = await transcribeWithProvider(safe);

    if (!result.ok) {
      const status =
        result.code === "missing_api_key"
          ? 503
          : result.code === "upstream"
            ? 502
            : 500;
      return json(result, status);
    }

    if (!result.transcript.trim()) {
      return json(
        {
          ok: false,
          error: "I couldn't hear clear words that time. Want to try again?",
          code: "empty_audio",
        },
        422
      );
    }

    // Do not log transcript or audio contents.
    return json(result, 200);
  } catch {
    return json(
      {
        ok: false,
        error: "Something went wrong while transcribing. Please try again.",
        code: "server",
      },
      500
    );
  }
}
