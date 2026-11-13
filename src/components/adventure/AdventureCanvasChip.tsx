"use client";

import { useAdventureStore } from "@/store/adventureStore";
import { usePipStore } from "@/store/pipStore";

/**
 * When Pip is collapsed, reopen the adventure talk card (goal-first label).
 */
export function AdventureCanvasChip() {
  const adventure = useAdventureStore((s) => s.adventure);
  const hydrated = useAdventureStore((s) => s.hydrated);
  const companionOpen = usePipStore((s) => s.companionOpen);
  const openCompanion = usePipStore((s) => s.openCompanion);

  if (!hydrated || !adventure || adventure.status !== "active") return null;
  if (companionOpen) return null;

  const label =
    adventure.originalGoal?.trim() || adventure.title?.trim() || "Adventure";

  return (
    <div
      className="pointer-events-auto absolute left-3 top-[4.35rem] z-[34] max-w-[min(16rem,48vw)] sm:left-[5.25rem]"
      data-testid="adventure-canvas-chip"
    >
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded-full border border-[#E8E0FF] bg-white/95 py-1.5 pl-3 pr-3 text-left shadow-soft backdrop-blur-sm transition hover:bg-white"
        onClick={() => openCompanion({ autoStartTalk: false })}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-mc-ink">
          {label}
        </span>
      </button>
    </div>
  );
}
