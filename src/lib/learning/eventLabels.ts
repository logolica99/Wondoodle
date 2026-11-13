import type { LearningEvent, LearningEventType } from "@/types/learning";

export function labelForEventType(type: LearningEventType): string {
  switch (type) {
    case "doodle_created":
      return "Drew on the canvas";
    case "text_created":
      return "Wrote on the canvas";
    case "image_added":
      return "Added a photo";
    case "pip_talk_started":
      return "Started talking with Pip";
    case "pip_talk_ended":
      return "Finished a chat with Pip";
    case "canvas_shared_with_pip":
      return "Showed Pip the canvas";
    case "journey_opened":
      return "Opened My Journey";
    case "misconception_identified":
      return "Spotted a sticky idea with Pip";
    case "activity_started":
      return "Started Fraction Playground";
    case "fraction_visualization_changed":
      return "Changed the fraction bars";
    case "answer_submitted":
      return "Tried a fraction answer";
    case "activity_completed":
      return "Finished Fraction Playground";
    case "teachback_started":
      return "Started teaching Pip";
    case "teachback_attempted":
      return "Practiced teaching Pip";
    case "teachback_completed":
      return "Taught Pip an idea";
    case "mastery_check_started":
      return "Started a check";
    case "mastery_check_answered":
      return "Answered a challenge question";
    case "mastery_check_completed":
      return "Finished a check";
    default:
      return "Learning activity";
  }
}

export function discoveryForEvent(event: LearningEvent): string | null {
  switch (event.eventType) {
    case "doodle_created":
      return "You can turn ideas into doodles.";
    case "text_created":
      return "Writing helps you explain your thinking.";
    case "image_added":
      return "Photos can join your learning space.";
    case "pip_talk_ended":
      return "You explained an idea and Pip answered back.";
    case "canvas_shared_with_pip":
      return "Pip can look at work you choose to share.";
    case "misconception_identified":
      return "Pip helped you notice a sticky idea to rethink.";
    case "activity_completed":
      return "You discovered how piece size changes when a whole is split into more parts.";
    case "teachback_completed":
      return "You explained a fraction idea clearly enough to teach Pip.";
    case "mastery_check_completed": {
      const correct = Number(event.payload.scoreCorrect ?? 0);
      const total = Number(event.payload.scoreTotal ?? 3);
      const kind =
        String(event.payload.assessmentType ?? "") === "baseline"
          ? "baseline"
          : "superpower";
      if (event.payload.assisted === true) {
        return `Tried the ${kind} check with help (${correct}/${total}).`;
      }
      return kind === "baseline"
        ? `Baseline: ${correct} of ${total} independently.`
        : `Solved ${correct} of ${total} independently.`;
    }
    default:
      return null;
  }
}

export function evidenceForEvent(event: LearningEvent): string | null {
  switch (event.eventType) {
    case "doodle_created":
    case "text_created":
    case "image_added":
      return "Canvas activity saved locally.";
    case "pip_talk_ended": {
      const seconds = Number(event.payload.durationSec ?? 0);
      if (seconds > 0) {
        return `Explained an idea to Pip (~${Math.round(seconds)}s).`;
      }
      return "Explained an idea and heard Pip’s reply.";
    }
    case "canvas_shared_with_pip":
      return "Shared a canvas snapshot with Pip.";
    case "misconception_identified": {
      const evidence = String(event.payload.evidence ?? "").trim();
      if (evidence) {
        return evidence.length > 120 ? `${evidence.slice(0, 117)}…` : evidence;
      }
      return "Learning observation saved from Pip.";
    }
    case "activity_completed": {
      const left = event.payload.leftDenom;
      const right = event.payload.rightDenom;
      if (left != null && right != null) {
        return `Compared 1/${left} and 1/${right} in Fraction Playground.`;
      }
      return "Completed Fraction Playground.";
    }
    case "answer_submitted":
      return event.payload.isCorrect
        ? "Chose the larger piece correctly."
        : "Tried an answer and got a hint.";
    case "teachback_completed": {
      const evidence = String(event.payload.evidence ?? "").trim();
      if (evidence) {
        return evidence.length > 120 ? `${evidence.slice(0, 117)}…` : evidence;
      }
      return "TeachBack completed for unit fractions.";
    }
    case "teachback_attempted":
      return "Tried explaining the idea to Pip.";
    case "mastery_check_completed": {
      const correct = Number(event.payload.scoreCorrect ?? 0);
      const total = Number(event.payload.scoreTotal ?? 3);
      const kind =
        String(event.payload.assessmentType ?? "") === "baseline"
          ? "Baseline"
          : "Superpower";
      return event.payload.assisted === true
        ? `${kind} assisted: ${correct}/${total}.`
        : `${kind} independent: ${correct}/${total}.`;
    }
    case "mastery_check_answered":
      return event.payload.isCorrect
        ? "Challenge answer was correct."
        : "Challenge answer was incorrect.";
    default:
      return null;
  }
}
