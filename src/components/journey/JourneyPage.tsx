"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { WondoodleLogo } from "@/components/brand/WondoodleLogo";
import { AppNav } from "@/components/nav/AppNav";
import { JourneyMap } from "./JourneyMap";
import { AdventurePanel } from "./AdventurePanel";
import { useLearningStore } from "@/store/learningStore";
import { recordJourneyOpened } from "@/lib/learning/recordHelpers";
import type { JourneyFeatureId } from "@/types/learning";

export function JourneyPage() {
  const reduceMotion = useReducedMotion();
  const hydrate = useLearningStore((s) => s.hydrate);
  const hydrated = useLearningStore((s) => s.hydrated);
  const nodes = useLearningStore((s) => s.nodes);
  const summary = useLearningStore((s) => s.summary);
  const events = useLearningStore((s) => s.events);
  const [selectedId, setSelectedId] = useState<JourneyFeatureId | null>(null);

  useEffect(() => {
    void hydrate();
    void recordJourneyOpened();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || selectedId) return;
    const current = nodes.find((n) => n.status === "current");
    if (current) setSelectedId(current.id);
  }, [hydrated, nodes, selectedId]);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  return (
    <main
      className="min-h-[100dvh] overflow-x-clip bg-[#FAF9F6] px-3 py-3 sm:px-5 sm:py-5"
      data-testid="journey-page"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-3 sm:gap-4">
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
              My Journey
            </p>
          </div>
          <AppNav />
        </header>

        <motion.div
          className="grid min-w-0 grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.85fr)]"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
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
        </motion.div>
      </div>
    </main>
  );
}
