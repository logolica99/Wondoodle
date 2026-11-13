import { DEFAULT_DOCUMENT_ID } from "@/types/canvas";
import {
  feedbackForResult,
  type TeachBackConceptId,
} from "./teachback";
import type { TeachBackAssessment } from "./teachbackSchema";
import {
  recordTeachBackAttempted,
  recordTeachBackCompleted,
} from "./recordHelpers";
import { useTeachBackStore } from "@/store/teachbackStore";

export type TeachBackHandleResult = {
  ok: boolean;
  action: "complete" | "developing" | "unclear" | "rejected" | "inactive";
  message: string;
  followUpQuestion?: string | null;
};

/**
 * Apply a validated TeachBack assessment to UI + learning events.
 * Completes Journey only when result is complete (idempotent).
 */
export async function applyTeachBackAssessment(
  assessment: TeachBackAssessment,
  opts: {
    callId: string;
    documentId?: string;
  }
): Promise<TeachBackHandleResult> {
  const state = useTeachBackStore.getState();
  if (!state.open || !state.runId) {
    return {
      ok: false,
      action: "inactive",
      message:
        "TeachBack is not active. Ask a normal learning question; do not treat this as a TeachBack completion.",
    };
  }

  if (state.completed) {
    return {
      ok: true,
      action: "complete",
      message:
        "TeachBack already completed for this session. Celebrate briefly if needed; do not re-grade.",
      followUpQuestion: null,
    };
  }

  if (assessment.conceptId !== state.conceptId) {
    return {
      ok: false,
      action: "rejected",
      message: `TeachBack concept mismatch. Active concept is ${state.conceptId}.`,
    };
  }

  const documentId = opts.documentId ?? DEFAULT_DOCUMENT_ID;
  const runId = state.runId;
  const conceptId = assessment.conceptId as TeachBackConceptId;

  try {
    useTeachBackStore.getState().applyAssessment({
      result: assessment.result,
      rubric: assessment.rubric,
      followUpQuestion: assessment.followUpQuestion,
    });

    const attempts = useTeachBackStore.getState().attempts;

    if (assessment.result === "complete") {
      await recordTeachBackCompleted({
        documentId,
        runId,
        conceptId,
        rubric: assessment.rubric,
        evidence: assessment.evidence,
        attempts,
        callId: opts.callId,
      });

      return {
        ok: true,
        action: "complete",
        message: `${feedbackForResult("complete")} Celebrate briefly. Do not claim independent mastery. Do not start Feature 6.`,
        followUpQuestion: null,
      };
    }

    await recordTeachBackAttempted({
      documentId,
      runId,
      conceptId,
      result: assessment.result,
      rubric: assessment.rubric,
      evidence: assessment.evidence,
      attempts,
      followUpQuestion: assessment.followUpQuestion,
      callId: opts.callId,
    });

    const followUp = assessment.followUpQuestion;
    return {
      ok: true,
      action: assessment.result,
      message: `${feedbackForResult(assessment.result)} Ask this one follow-up, then wait: ${followUp}`,
      followUpQuestion: followUp,
    };
  } catch {
    return {
      ok: false,
      action: "rejected",
      message:
        "Could not save the TeachBack assessment. Keep the student in the activity and ask a gentle clarifying question.",
    };
  }
}
