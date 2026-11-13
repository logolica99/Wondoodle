import type { JourneyDestination, JourneyFeatureId } from "@/types/learning";

/**
 * Central feature availability. Do not infer availability from completion.
 * `map` percents = path anchors inside JOURNEY_DISPLAY_FRAME (same SVG crop).
 */
export const JOURNEY_DESTINATIONS: JourneyDestination[] = [
  {
    id: "create_first_doodle",
    name: "Make your first doodle",
    description: "Open the canvas and draw, write, or add a photo.",
    mission: "Draw something on the canvas.",
    actionLabel: "Open canvas",
    icon: "pencil",
    availability: "available",
    completionEventTypes: ["doodle_created", "text_created", "image_added"],
    href: "/learn",
    accent: "#7357E8",
    map: { x: 9.796, y: 16.538 },
  },
  {
    id: "talk_with_pip",
    name: "Tell Pip your idea",
    description: "Start a live voice chat with your learning companion.",
    mission: "Explain something you drew.",
    actionLabel: "Talk with Pip",
    icon: "mic",
    availability: "available",
    completionEventTypes: ["pip_talk_ended"],
    href: "/learn?talk=1",
    accent: "#FF91B6",
    map: { x: 37.755, y: 42.308 },
  },
  {
    id: "discover_misconception",
    name: "Solve a mystery",
    description: "Pip helps spot sticky ideas so you can rethink them.",
    mission: "Explain your fractions work to Pip.",
    actionLabel: "Talk with Pip",
    icon: "radar",
    availability: "available",
    completionEventTypes: ["misconception_identified"],
    href: "/learn?talk=1",
    accent: "#76B8FF",
    map: { x: 71.224, y: 18.846 },
  },
  {
    id: "explore_visual_lesson",
    name: "Play with an idea",
    description: "Follow a short visual adventure about your topic.",
    mission: "Compare fraction pieces in the playground.",
    actionLabel: "Open playground",
    icon: "lesson",
    availability: "available",
    completionEventTypes: ["activity_completed"],
    href: "/learn?activity=fraction_comparison",
    accent: "#58D9B0",
    map: { x: 88.98, y: 50.385 },
  },
  {
    id: "teach_it_back",
    name: "Be the teacher",
    description: "Explain the idea in your own words — Pip listens.",
    mission: "Teach Pip why 1/3 is bigger than 1/4.",
    actionLabel: "Teach Pip",
    icon: "teach",
    availability: "available",
    completionEventTypes: ["teachback_completed"],
    href: "/learn?teachback=1",
    accent: "#FFD66D",
    map: { x: 53.061, y: 74.038 },
  },
  {
    id: "show_what_you_learned",
    name: "Show your superpower",
    description: "Try three fraction questions on your own.",
    mission: "Solve three questions independently.",
    actionLabel: "Start challenge",
    icon: "star",
    availability: "available",
    completionEventTypes: ["mastery_check_completed"],
    href: "/learn?mastery=1",
    accent: "#A894F8",
    map: { x: 17.347, y: 84.038 },
  },
];

export function getJourneyDestination(
  id: JourneyFeatureId
): JourneyDestination | undefined {
  return JOURNEY_DESTINATIONS.find((d) => d.id === id);
}
