import type {
  JourneyFeatureId,
  JourneyNodeState,
  JourneyVisualStatus,
  LearningEvent,
} from "@/types/learning";
import { JOURNEY_DESTINATIONS } from "./journeyConfig";

/** Pip talk only counts when a meaningful student↔Pip exchange was recorded. */
function eventCompletesDestination(
  dest: (typeof JOURNEY_DESTINATIONS)[number],
  event: LearningEvent
): boolean {
  if (!dest.completionEventTypes.includes(event.eventType)) return false;
  if (event.eventType === "pip_talk_ended") {
    return event.payload.meaningful === true;
  }
  // Mystery completes only after a supported observation was recorded and reviewed.
  if (event.eventType === "misconception_identified") {
    return event.payload.reviewed === true;
  }
  // Superpower completes only for independent post-learning (not baseline).
  if (event.eventType === "mastery_check_completed") {
    const type = String(event.payload.assessmentType ?? "post_learning");
    return (
      type === "post_learning" &&
      event.payload.independent === true &&
      event.payload.assisted !== true
    );
  }
  return true;
}

/**
 * Derive journey node completion from stored events only.
 * Availability stays configured — never inferred from completion.
 */
export function deriveCompletedFeatures(
  events: LearningEvent[]
): Set<JourneyFeatureId> {
  const completed = new Set<JourneyFeatureId>();

  for (const dest of JOURNEY_DESTINATIONS) {
    if (!dest.completionEventTypes.length) continue;
    const match = events.find((e) => eventCompletesDestination(dest, e));
    if (match) completed.add(dest.id);
  }

  return completed;
}

/** First available destination that is not yet completed. */
export function deriveCurrentFeatureId(
  events: LearningEvent[]
): JourneyFeatureId | null {
  const completed = deriveCompletedFeatures(events);
  const next = JOURNEY_DESTINATIONS.find(
    (d) => d.availability === "available" && !completed.has(d.id)
  );
  return next?.id ?? null;
}

export function deriveJourneyNodes(
  events: LearningEvent[]
): JourneyNodeState[] {
  const completed = deriveCompletedFeatures(events);
  const currentId = deriveCurrentFeatureId(events);

  return JOURNEY_DESTINATIONS.map((dest) => {
    const match = events
      .filter((e) => eventCompletesDestination(dest, e))
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    const isCompleted = completed.has(dest.id);
    let status: JourneyVisualStatus;
    if (dest.availability === "coming_soon") {
      status = "coming_soon";
    } else if (isCompleted) {
      status = "completed";
    } else if (dest.id === currentId) {
      status = "current";
    } else {
      status = "available";
    }

    return {
      ...dest,
      completed: isCompleted,
      completedAt: match?.timestamp ?? null,
      status,
    };
  });
}
