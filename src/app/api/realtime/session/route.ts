import { NextResponse } from "next/server";
import {
  PIP_INSTRUCTIONS,
  PIP_REALTIME_MODEL,
  PIP_VOICE,
} from "@/lib/voice/pipInstructions";
import { LOOK_AT_CANVAS_TOOL } from "@/lib/voice/canvasLookIntent";
import { REPORT_LEARNING_OBSERVATION_TOOL } from "@/lib/voice/reportLearningObservation";
import { OPEN_LEARNING_ACTIVITY_TOOL } from "@/lib/voice/openLearningActivity";
import { REPORT_TEACHBACK_ASSESSMENT_TOOL } from "@/lib/voice/reportTeachbackAssessment";

export const runtime = "nodejs";

/**
 * Mints a short-lived Realtime client secret for browser WebRTC.
 * The standard OPENAI_API_KEY never leaves the server.
 */
export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Realtime voice isn't configured yet (missing API key).",
        code: "missing_api_key",
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": "wondoodle-hackathon-pip",
        },
        body: JSON.stringify({
          expires_after: {
            anchor: "created_at",
            seconds: 600,
          },
          session: {
            type: "realtime",
            model: PIP_REALTIME_MODEL,
            instructions: PIP_INSTRUCTIONS,
            output_modalities: ["audio"],
            tools: [
              LOOK_AT_CANVAS_TOOL,
              REPORT_LEARNING_OBSERVATION_TOOL,
              OPEN_LEARNING_ACTIVITY_TOOL,
              REPORT_TEACHBACK_ASSESSMENT_TOOL,
            ],
            tool_choice: "auto",
            audio: {
              input: {
                turn_detection: {
                  type: "semantic_vad",
                  create_response: true,
                  interrupt_response: true,
                  eagerness: "medium",
                },
                transcription: {
                  model: "gpt-4o-mini-transcribe",
                  // Bias captions toward English so Pip is less likely to mirror a mis-detected language.
                  language: "en",
                },
              },
              output: {
                voice: PIP_VOICE,
              },
            },
          },
        }),
      }
    );

    const payload = (await response.json()) as {
      value?: string;
      client_secret?: { value?: string; expires_at?: number };
      expires_at?: number;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            payload.error?.message ||
            "Could not start a voice session. Please try again.",
          code: "upstream",
        },
        { status: 502 }
      );
    }

    const value = payload.value ?? payload.client_secret?.value;
    const expiresAt =
      payload.expires_at ?? payload.client_secret?.expires_at ?? null;

    if (!value) {
      return NextResponse.json(
        {
          ok: false,
          error: "Realtime session token was empty. Please try again.",
          code: "server",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      clientSecret: value,
      expiresAt,
      model: PIP_REALTIME_MODEL,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not reach the voice service. Please try again.",
        code: "server",
      },
      { status: 500 }
    );
  }
}
