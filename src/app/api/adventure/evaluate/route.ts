import { NextResponse } from "next/server";
import { structuredVisionCompletion } from "@/lib/adventure/openaiVision";
import { EVALUATOR_SYSTEM } from "@/lib/adventure/prompts";
import {
  EvaluateRequestSchema,
  StepEvaluationModelSchema,
  normalizeEvaluationDecision,
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

  const parsed = EvaluateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Evaluation request looked incomplete.",
        code: "invalid",
      },
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

  const needsDrawing =
    input.interactionType === "draw_and_explain" ||
    input.interactionType === "compare_drawings" ||
    input.interactionType === "predict_and_draw" ||
    input.interactionType === "revise_original" ||
    input.interactionType === "annotate_canvas";

  if (needsDrawing && !input.canvasChanged && !input.latestSnapshotDataUrl) {
    return NextResponse.json({
      ok: true,
      evaluation: {
        decision: "continue_current" as const,
        explanation:
          "I still need to see a change on the canvas for this problem.",
        missingUnderstanding: "Canvas action not completed yet.",
        guidingQuestion:
          "Can you update your drawing to show your latest thinking?",
        meaningfulCanvasChangeObserved: false,
        addStepReason: null,
      },
      model: "app-gate",
    });
  }

  if (
    input.interactionType === "explain_to_pip" &&
    !(input.explanationText && input.explanationText.trim().length >= 8)
  ) {
    return NextResponse.json({
      ok: true,
      evaluation: {
        decision: "continue_current" as const,
        explanation:
          "Tell Pip your idea out loud before we decide you’re done.",
        missingUnderstanding: "Explanation not provided yet.",
        guidingQuestion: "What are you figuring out right now?",
        meaningfulCanvasChangeObserved: input.canvasChanged,
        addStepReason: null,
      },
      model: "app-gate",
    });
  }

  if (images.length === 0 && input.interactionType !== "explain_to_pip") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "I couldn’t see your canvas for this check. Please try again or describe what you drew.",
        code: "missing_image",
      },
      { status: 400 }
    );
  }

  const imageNote =
    images.length === 0
      ? "No canvas images were available — evaluate from the explanation only. Do NOT claim you saw a drawing."
      : images.length === 1
        ? "One canvas image is attached (treat as the latest work). Do not invent unseen changes."
        : "Two canvas images are attached: first is the original adventure snapshot, second is the latest submission. Compare them carefully.";

  const userText = `Adventure goal: ${input.originalGoal}
Step title: ${input.stepTitle}
Step instruction: ${input.stepInstruction}
Learning objective: ${input.learningObjective}
Evidence rubric: ${input.evidenceRubric}
Interaction type: ${input.interactionType}
App-observed canvasChanged: ${input.canvasChanged}
Object count delta: ${input.objectCountDelta}
Student explanation: ${input.explanationText?.trim() || "(none)"}
Previous notes: ${input.previousEvidenceNotes?.trim() || "(none)"}
${imageNote}

If the goal is met (correct answer visible and/or clearly spoken), choose complete — do not ask them to define concepts again. Use continue_current only when the answer is still missing or wrong. Use add_step rarely.`;

  const result = await structuredVisionCompletion({
    system: EVALUATOR_SYSTEM,
    userText,
    imageDataUrls: images,
    schema: StepEvaluationModelSchema,
    schemaName: "step_evaluation",
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

  // Trust the vision evaluator. Do not downgrade complete just because the
  // in-step fingerprint didn't change — the answer may already be on the canvas.
  const evaluation = {
    ...result.data,
    decision: normalizeEvaluationDecision(result.data.decision),
  };

  return NextResponse.json({
    ok: true,
    evaluation,
    model: result.model,
  });
}
