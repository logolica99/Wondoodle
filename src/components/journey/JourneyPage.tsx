"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { WondoodleLogo } from "@/components/brand/WondoodleLogo";
import { AppNav } from "@/components/nav/AppNav";
import { JourneyMap } from "./JourneyMap";
import { AdventurePanel } from "./AdventurePanel";
import { AdventureJourneyMap } from "./AdventureJourneyMap";
import { Button } from "@/components/ui/button";
import { useLearningStore } from "@/store/learningStore";
import { useAdventureStore } from "@/store/adventureStore";
import { recordJourneyOpened } from "@/lib/learning/recordHelpers";
import type { JourneyFeatureId } from "@/types/learning";

export function JourneyPage() {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const hydrate = useLearningStore((s) => s.hydrate);
  const hydrated = useLearningStore((s) => s.hydrated);
  const nodes = useLearningStore((s) => s.nodes);
  const summary = useLearningStore((s) => s.summary);
  const events = useLearningStore((s) => s.events);
  const [selectedId, setSelectedId] = useState<JourneyFeatureId | null>(null);

  const hydrateAdventure = useAdventureStore((s) => s.hydrate);
  const adventure = useAdventureStore((s) => s.adventure);
  const adventureSteps = useAdventureStore((s) => s.steps);
  const adventureHydrated = useAdventureStore((s) => s.hydrated);
  const revisionToast = useAdventureStore((s) => s.revisionToast);
  const clearRevisionToast = useAdventureStore((s) => s.clearRevisionToast);
  const [showClassic, setShowClassic] = useState(false);

  useEffect(() => {
    void hydrate();
    void hydrateAdventure();
    void recordJourneyOpened();
  }, [hydrate, hydrateAdventure]);

  useEffect(() => {
    if (searchParams.get("adventure") === "1") {
      setShowClassic(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!hydrated || selectedId) return;
    const current = nodes.find((n) => n.status === "current");
    if (current) setSelectedId(current.id);
  }, [hydrated, nodes, selectedId]);

  useEffect(() => {
    if (!revisionToast) return;
    const t = window.setTimeout(() => clearRevisionToast(), 7000);
    return () => window.clearTimeout(t);
  }, [revisionToast, clearRevisionToast]);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  const hasAdventure = Boolean(adventure) && adventureHydrated;
  const showAdventureView = hasAdventure && !showClassic;

  return (
    <main
      className="min-h-[100dvh] overflow-x-clip bg-[#FAF9F6] px-3 py-3 sm:px-5 sm:py-5"
      data-testid="journey-page"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-3 sm:max-w-4xl sm:gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white px-3 py-2.5 shadow-soft sm:px-4">
          <Link
            href="/"
            aria-label="Wondoodle home"
            className="block h-11 w-11 shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7357E8]/30"
          >
            <WondoodleLogo variant="icon" className="h-11 w-11" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold text-mc-ink sm:text-xl">
              Journey
            </p>
          </div>
          <AppNav />
        </header>

        {revisionToast ? (
          <p
            className="rounded-xl bg-mc-yellow-soft px-3 py-2 text-sm font-semibold text-mc-ink"
            data-testid="journey-revision-banner"
          >
            {revisionToast}
          </p>
        ) : null}

        {hasAdventure ? (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={showAdventureView ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setShowClassic(false)}
              data-testid="journey-tab-adventure"
            >
              Now
            </Button>
            <Button
              size="sm"
              variant={!showAdventureView ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setShowClassic(true)}
              data-testid="journey-tab-classic"
            >
              Map
            </Button>
          </div>
        ) : null}

        <motion.div
          className={
            showAdventureView
              ? "min-w-0"
              : "grid min-w-0 grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.85fr)]"
          }
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {showAdventureView && adventure ? (
            <AdventureJourneyMap
              title={adventure.title}
              storyline={adventure.storyline}
              originalGoal={adventure.originalGoal}
              steps={adventureSteps}
            />
          ) : (
            <>
              <div className="min-w-0">
                <JourneyMap
                  nodes={nodes}
                  selectedId={selectedId}
                  onSelect={(id) => setSelectedId(id as JourneyFeatureId)}
                />
              </div>
              <div className="min-w-0 lg:sticky lg:top-4">
                <AdventurePanel
                  selected={selected}
                  summary={summary}
                  events={events}
                  hydrated={hydrated}
                />
              </div>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}
