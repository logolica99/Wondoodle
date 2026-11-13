import { NextResponse } from "next/server";
import { structuredVisionCompletion } from "@/lib/adventure/openaiVision";
import { REPLANNER_SYSTEM } from "@/lib/adventure/prompts";
import {
  ReplanModelSchema,
  ReplanRequestSchema,
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

  const parsed = ReplanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Replan request looked incomplete.", code: "invalid" },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const images: string[] = [];
  if (input.originSnapshotDataUrl?.startsWith("data:image/")) {
    images.push(input.originSnapshotDataUrl);
  }
  if (input.latestSnapshotDataUrl?.startsWith("data:image/")) {
    images.push(input.latestSnapshotDataUrl);
  }

  const userText = `Original goal: ${input.originalGoal}
Learning objective: ${input.learningObjective}
Why we need to revise: ${input.replanReason}
Evaluation notes: ${input.evaluationExplanation}
Missing understanding: ${input.missingUnderstanding ?? "(none)"}

Completed steps (immutable):
${
  input.completedStepsSummary.length
    ? input.completedStepsSummary
        .map((s, i) => `${i + 1}. ${s.title} — ${s.learningObjective}`)
        .join("\n")
    : "(none yet)"
}

Current remaining future steps:
${
  input.remainingStepsSummary.length
    ? input.remainingStepsSummary
        .map(
          (s, i) =>
            `${i + 1}. ${s.title} [${s.interactionType}] — ${s.learningObjective}`
        )
        .join("\n")
    : "(none)"
}

If images are attached, use them. Prefer inserting a short discovery step when a prerequisite is missing. Keep the original goal.`;

  const result = await structuredVisionCompletion({
    system: REPLANNER_SYSTEM,
    userText,
    imageDataUrls: images,
    schema: ReplanModelSchema,
    schemaName: "adventure_replan",
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

  // Bound runaway inserts
  const data = {
    ...result.data,
    insertBeforeNext: result.data.insertBeforeNext.slice(0, 2),
    futureSteps: result.data.futureSteps.slice(0, 4),
  };

  return NextResponse.json({ ok: true, replan: data, model: result.model });
}
