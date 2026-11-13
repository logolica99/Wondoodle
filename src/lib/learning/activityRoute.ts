/**
 * Feature 4 activity routing contract (data only).
 * Do not render a CTA that navigates to an unimplemented activity.
 */
export type {
  ActivityRouteContract,
  ActivityId,
  ConceptId,
  SupportedMisconceptionId,
} from "./misconceptions";

export { buildActivityRoute, ACTIVITY_IDS, ACTIVITY_LABELS } from "./misconceptions";
