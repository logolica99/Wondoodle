import { NextResponse } from "next/server";
import { structuredVisionCompletion } from "@/lib/adventure/openaiVision";
import { PLANNER_SYSTEM } from "@/lib/adventure/prompts";
import {
  AdventurePlanModelSchema,
  PlanRequestSchema,
} from "@/lib/adventure/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body.", code: "invalid" },
      { status: 400 }
    );
  }

  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Adventure request looked incomplete. Try again.",
        code: "invalid",
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  if (!input.snapshotDataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "I couldn’t see your canvas picture. Please try capturing again or describe what’s missing.",
        code: "missing_image",
      },
      { status: 400 }
    );
  }

  const conversation = input.conversationContext?.trim()
    ? `\nRecent conversation (trimmed):\n${input.conversationContext.trim()}`
    : "\nNo reliable conversation context was available.";

  const userText = `Student goal (confirmed by the student):
"${input.goal}"

Canvas metadata (not a substitute for the image):
- Objects: ${input.objectSummary.objectCount}
- Has strokes: ${input.objectSummary.hasStrokes}
- Has images: ${input.objectSummary.hasImages}
- Visible text snippets: ${
    input.objectSummary.textSnippets.length
      ? input.objectSummary.textSnippets.join(" | ")
      : "(none)"
  }
- Canvas version: ${input.canvasVersion}
${conversation}

Look at the attached canvas image carefully.
Plan the MINIMUM sufficient adventure for THIS problem.
Default to ONE step if this is a single homework question.
Only add more steps when the work clearly needs distinct stages.
Do not invent a multi-lesson curriculum.`;

  const result = await structuredVisionCompletion({
    system: PLANNER_SYSTEM,
    userText,
    imageDataUrls: [input.snapshotDataUrl],
    schema: AdventurePlanModelSchema,
    schemaName: "adventure_plan",
  });

  if (!result.ok) {
    const status =
      result.code === "missing_api_key"
        ? 503
        : result.code === "invalid"
          ? 422
          : 502;
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    plan: result.data,
    model: result.model,
  });
}
