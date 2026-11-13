import type { JourneyFeatureId } from "@/types/learning";

export type MapPoint = { x: number; y: number };

/** Original artboard the connector path was authored in. */
export const JOURNEY_VIEWBOX_WIDTH = 1184;
export const JOURNEY_VIEWBOX_HEIGHT = 754;

/**
 * Tighter display frame around the path + labels (same coordinate system).
 * Path `d` is unchanged — we only crop empty margins for a fuller composition.
 */
export const JOURNEY_DISPLAY_FRAME = {
  x: 90,
  y: 70,
  width: 980,
  height: 520,
} as const;

/**
 * Exact connector path (authored in 0 0 1184 754).
 * Six cubic endpoints are the milestone centers — no extra bends.
 */
export const JOURNEY_CONNECTOR_PATH_D =
  "M 186 156 C 260 190, 349 290, 460 290 C 565 290, 636 168, 788 168 C 915 168, 990 257, 962 332 C 928 425, 760 451, 610 455 C 470 460, 355 510, 260 507";

/**
 * Milestone centers = path segment endpoints in the shared SVG coordinate system.
 */
export const JOURNEY_PATH_ANCHORS: Record<JourneyFeatureId, MapPoint> = {
  create_first_doodle: { x: 186, y: 156 },
  talk_with_pip: { x: 460, y: 290 },
  discover_misconception: { x: 788, y: 168 },
  explore_visual_lesson: { x: 962, y: 332 },
  teach_it_back: { x: 610, y: 455 },
  show_what_you_learned: { x: 260, y: 507 },
};

/** Percent within the display frame — matches the cropped SVG viewBox. */
export function journeyAnchorPercent(id: JourneyFeatureId): MapPoint {
  const a = JOURNEY_PATH_ANCHORS[id];
  const { x, y, width, height } = JOURNEY_DISPLAY_FRAME;
  return {
    x: ((a.x - x) / width) * 100,
    y: ((a.y - y) / height) * 100,
  };
}

export function allJourneyAnchorPercents(): Record<JourneyFeatureId, MapPoint> {
  return {
    create_first_doodle: journeyAnchorPercent("create_first_doodle"),
    talk_with_pip: journeyAnchorPercent("talk_with_pip"),
    discover_misconception: journeyAnchorPercent("discover_misconception"),
    explore_visual_lesson: journeyAnchorPercent("explore_visual_lesson"),
    teach_it_back: journeyAnchorPercent("teach_it_back"),
    show_what_you_learned: journeyAnchorPercent("show_what_you_learned"),
  };
}
