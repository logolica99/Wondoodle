"use client";

import { useActivityStore } from "@/store/activityStore";
import { useAdventureStore } from "@/store/adventureStore";
import { usePipStore } from "@/store/pipStore";
import { withEnglishLock } from "@/lib/voice/pipInstructions";

const ADVENTURE_INVITE_INSTRUCTIONS = withEnglishLock(`The student tapped Make an Adventure.

REQUIRED FLOW — follow exactly:
1) Call look_at_canvas immediately (if no recent snapshot).
2) Do NOT describe the canvas. Do NOT explain the math. Do NOT ask tutoring questions yet.
3) In ONE short spoken turn, name the adventure you guessed and ask for a yes/no:
   Say exactly in this style:
   “Is this your adventure: help fix the missing angle on your triangle?”
   or
   “Is this your adventure: check if your answer is right?”
   Fill in the blank from what you see — keep it under ~12 words after the colon.
4) Wait for yes / no / a short correction.
5) On yes (or after they correct it), call create_adventure right away with that goal, studentAgreed=true.
6) Do not ask “what do you know about…” or any teaching question in this invite turn.

Stay in this voice session. English only. No forms.`);

/**
 * Always open a live Pip voice call and steer the adventure-create conversation.
 * No typed fallback — voice is required.
 */
export function requestConversationalAdventureCreate() {
  const pip = usePipStore.getState();

  // Forces the next look_at_canvas reply to guess the adventure (not tutor).
  pip.setAdventureInvitePending(true);
  pip.setOpeningInstructions(ADVENTURE_INVITE_INSTRUCTIONS);
  pip.openCompanion({ autoStartTalk: true });

  // If already live, push the invite into the current call immediately.
  if (pip.connection === "connected") {
    useActivityStore.getState().emitPipEvent({
      kind: "activity_opened",
      summary: `[Adventure invite]\n${ADVENTURE_INVITE_INSTRUCTIONS}`,
      payload: { mode: "adventure", speak: true, phase: "create_invite" },
    });
  }
}

/**
 * Open (or refresh) Pip voice with the active adventure step context.
 */
export function requestAdventureStepVoice() {
  const pip = usePipStore.getState();
  const { adventure, steps, syncPipContextSummary, openActiveStep } =
    useAdventureStore.getState();

  openActiveStep();

  const step = steps.find((s) => s.id === adventure?.activeStepId);
  const context =
    syncPipContextSummary() ??
    "[Adventure context] Continue the active adventure step with the student.";

  const instructions = withEnglishLock(
    [
      "The student opened their adventure step on the canvas.",
      context,
      step
        ? `Guide them through this step only: "${step.title}" — ${step.instruction}`
        : "Guide them using the adventure context.",
      "Stay in this voice session. Help them finish the goal — do not turn it into a vocabulary lesson.",
      "If this is an equation or solve-for problem: tell them once to WRITE the equation and their answer out on the canvas.",
      "NEVER give the final answer or finish the equation for them until they have clearly given their own solution (written or spoken).",
      "Hints only — no revealing the number/result early.",
      "If they already wrote or clearly said their solution: call look_at_canvas, say if it’s right, invite Check, and STOP — no more questions.",
      "If wrong: tell them which SPECIFIC part is wrong (which number or step) in one short sentence, then wait for them to fix it.",
      "Forbidden after a correct solution: how sure are you, how did you get that number, does it match, define it, or any extra quiz.",
      "Do not ask them to type in a form.",
    ].join("\n")
  );

  pip.setOpeningInstructions(instructions);
  pip.openCompanion({ autoStartTalk: true });

  useActivityStore.getState().emitPipEvent({
    kind: "activity_opened",
    summary: instructions,
    payload: {
      mode: "adventure",
      speak: true,
      phase: "step",
      stepId: step?.id ?? null,
    },
  });
}
