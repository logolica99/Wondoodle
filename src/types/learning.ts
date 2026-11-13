export type LearningEventSource =
  | "canvas"
  | "voice"
  | "pip"
  | "journey"
  | "system"
  | "ai_observation";

export type LearningEventType =
  | "doodle_created"
  | "text_created"
  | "image_added"
  | "pip_talk_started"
  | "pip_talk_ended"
  | "canvas_shared_with_pip"
  | "journey_opened"
  | "misconception_identified"
  | "activity_started"
  | "fraction_visualization_changed"
  | "answer_submitted"
  | "activity_completed"
  | "teachback_started"
  | "teachback_attempted"
  | "teachback_completed"
  | "mastery_check_started"
  | "mastery_check_answered"
  | "mastery_check_completed";

export type LearningEventPayload = Record<string, unknown>;

export type LearningEvent = {
  eventId: string;
  sessionId: string;
  documentId: string;
  conceptId: string | null;
  eventType: LearningEventType;
  payload: LearningEventPayload;
  timestamp: number;
  source: LearningEventSource;
};

export type JourneyAvailability = "available" | "coming_soon";

export type JourneyFeatureId =
  | "create_first_doodle"
  | "talk_with_pip"
  | "discover_misconception"
  | "explore_visual_lesson"
  | "teach_it_back"
  | "show_what_you_learned";

export type JourneyDestination = {
  id: JourneyFeatureId;
  name: string;
  description: string;
  /** Short kid-facing mission for the adventure panel. */
  mission: string;
  /** Primary CTA label when the destination is available. */
  actionLabel: string;
  icon: "pencil" | "mic" | "radar" | "lesson" | "teach" | "star";
  availability: JourneyAvailability;
  /** Qualifying event type(s) that mark completion. Empty = never auto-complete. */
  completionEventTypes: LearningEventType[];
  /** Real in-app route when available; null for coming soon. */
  href: string | null;
  accent: string;
  map: { x: number; y: number };
};

/** Visual progress state — separate from configured availability. */
export type JourneyVisualStatus =
  | "completed"
  | "current"
  | "available"
  | "coming_soon";

export type JourneyNodeState = JourneyDestination & {
  completed: boolean;
  completedAt: number | null;
  /** Derived UI status for colors and glow. */
  status: JourneyVisualStatus;
};

export type LearningSummary = {
  currentConcept: string | null;
  lastActivity: {
    label: string;
    eventType: LearningEventType;
    timestamp: number;
  } | null;
  tried: string[];
  discovered: string[];
  evidence: string[];
  nextActivity: {
    id: JourneyFeatureId;
    name: string;
    href: string | null;
  } | null;
  completedFeatureIds: JourneyFeatureId[];
  eventCount: number;
};
