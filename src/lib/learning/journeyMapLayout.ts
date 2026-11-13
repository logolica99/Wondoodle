import type { JourneyFeatureId } from "@/types/learning";
import { JOURNEY_DESTINATIONS } from "./journeyConfig";
import {
  allJourneyAnchorPercents,
  JOURNEY_DISPLAY_FRAME,
  type MapPoint,
} from "./journeyPath";

export type { MapPoint };

/**
 * Visual density only — path + node anchors stay identical across layouts
 * so the connector never scales independently of the milestones.
 */
export type JourneyMapLayoutId = "desktop" | "compactWide" | "compactTall";

const ORDER = JOURNEY_DESTINATIONS.map((d) => d.id);

/** Shared percent coords derived from the exact SVG path anchors. */
const SHARED_POINTS = allJourneyAnchorPercents();

export const JOURNEY_MAP_LAYOUTS: Record<
  JourneyMapLayoutId,
  Record<JourneyFeatureId, MapPoint>
> = {
  desktop: SHARED_POINTS,
  compactWide: SHARED_POINTS,
  compactTall: SHARED_POINTS,
};

export type ResolvedMapLayout = {
  id: JourneyMapLayoutId;
  padX: number;
  padY: number;
  labelGutter: number;
  compact: boolean;
  points: Record<JourneyFeatureId, MapPoint>;
  viewBoxX: number;
  viewBoxY: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type ResolveMapLayoutOptions = {
  stacked?: boolean;
};

/**
 * Padding / compact chrome from container size.
 * Path geometry stays fixed; display frame crops empty margins.
 */
export function resolveJourneyMapLayout(
  containerWidth: number,
  options: ResolveMapLayoutOptions = {}
): ResolvedMapLayout {
  const w = Math.max(0, containerWidth);
  const stacked = Boolean(options.stacked);

  let id: JourneyMapLayoutId;
  if (stacked || w < 560) {
    id = "compactTall";
  } else if (w < 900) {
    id = "compactWide";
  } else {
    id = "desktop";
  }

  const compact = id !== "desktop";

  let padX: number;
  let padY: number;
  let labelGutter: number;

  if (id === "compactWide") {
    padX = Math.round(clamp(w * 0.03, 14, 24));
    padY = Math.round(clamp(w * 0.018, 10, 16));
    labelGutter = 56;
  } else if (id === "compactTall") {
    padX = Math.round(clamp(w * 0.035, 12, 22));
    padY = Math.round(clamp(w * 0.016, 8, 14));
    labelGutter = 60;
  } else {
    padX = Math.round(clamp(w * 0.035, 20, 36));
    padY = Math.round(clamp(w * 0.02, 14, 24));
    labelGutter = 72;
  }

  return {
    id,
    padX,
    padY,
    labelGutter,
    compact,
    points: SHARED_POINTS,
    viewBoxX: JOURNEY_DISPLAY_FRAME.x,
    viewBoxY: JOURNEY_DISPLAY_FRAME.y,
    viewBoxWidth: JOURNEY_DISPLAY_FRAME.width,
    viewBoxHeight: JOURNEY_DISPLAY_FRAME.height,
  };
}

export function orderedMapPoints(
  points: Record<JourneyFeatureId, MapPoint>
): MapPoint[] {
  return ORDER.map((id) => points[id]);
}
