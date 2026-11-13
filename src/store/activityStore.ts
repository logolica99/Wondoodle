"use client";

import { create } from "zustand";
import type { ActivityRouteContract } from "@/lib/learning/misconceptions";
import { buildActivityRoute } from "@/lib/learning/misconceptions";

export type ActivityPipEvent = {
  id: string;
  kind:
    | "activity_opened"
    | "denominator_changed"
    | "answer_selected"
    | "answer_result"
    | "activity_completed";
  summary: string;
  payload: Record<string, unknown>;
  at: number;
};

type ActivityStore = {
  open: boolean;
  /** Only fraction_comparison is implemented in Feature 4. */
  activityId: "fraction_comparison" | null;
  route: ActivityRouteContract | null;
  runId: string | null;
  /** Append-only queue drained by PipCompanion. */
  pipEventQueue: ActivityPipEvent[];
  openFractionPlayground: (route?: ActivityRouteContract | null) => boolean;
  closeActivity: () => void;
  emitPipEvent: (
    event: Omit<ActivityPipEvent, "id" | "at"> & { id?: string }
  ) => void;
  drainPipEvents: () => ActivityPipEvent[];
};

function makeRunId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `activity-${Date.now()}`;
}

const DEFAULT_ROUTE = buildActivityRoute("denominator_size");

export const useActivityStore = create<ActivityStore>((set, get) => ({
  open: false,
  activityId: null,
  route: null,
  runId: null,
  pipEventQueue: [],
  openFractionPlayground: (route) => {
    const next = route ?? DEFAULT_ROUTE;
    if (next.activityId !== "fraction_comparison") return false;
    set({
      open: true,
      activityId: "fraction_comparison",
      route: next,
      runId: makeRunId(),
      pipEventQueue: [],
    });
    return true;
  },
  closeActivity: () =>
    set({
      open: false,
      activityId: null,
      route: null,
      runId: null,
    }),
  emitPipEvent: (event) =>
    set((state) => ({
      pipEventQueue: [
        ...state.pipEventQueue,
        {
          id: event.id ?? `pip-ev-${Date.now()}-${state.pipEventQueue.length}`,
          kind: event.kind,
          summary: event.summary,
          payload: event.payload,
          at: Date.now(),
        },
      ],
    })),
  drainPipEvents: () => {
    const events = get().pipEventQueue;
    if (events.length) set({ pipEventQueue: [] });
    return events;
  },
}));

export function isImplementedActivity(
  activityId: string
): activityId is "fraction_comparison" {
  return activityId === "fraction_comparison";
}
