"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { WondoodleLogo } from "@/components/brand/WondoodleLogo";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/design-tokens";
import { loadDocument } from "@/lib/canvas/storage";
import { useUiStore } from "@/store/uiStore";

export function WelcomeScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const markWorkspaceEntered = useUiStore((s) => s.markWorkspaceEntered);
  const [hasSavedWork, setHasSavedWork] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const doc = await loadDocument();
        if (!cancelled) {
          setHasSavedWork(
            doc.objects.length > 0 || doc.title !== "Untitled Notes"
          );
        }
      } catch {
        if (!cancelled) setHasSavedWork(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enter = () => {
    markWorkspaceEntered();
    router.push("/learn");
  };

  return (
    <main
      className="fixed inset-0 z-10 flex items-center justify-center overflow-hidden px-4 py-3"
      data-testid="welcome-screen"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-16 h-56 w-56 rounded-full bg-mc-pink/25 blur-3xl" />
        <div className="absolute right-0 top-24 h-64 w-64 rounded-full bg-mc-mint/25 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-52 w-52 rounded-full bg-mc-yellow/30 blur-3xl" />
      </div>

      <motion.section
        className="relative z-10 grid w-full max-w-md grid-rows-[auto_1fr_auto] items-center gap-3 rounded-[1.75rem] border border-white/80 bg-white/92 px-5 py-5 text-center shadow-float backdrop-blur-md sm:max-w-lg sm:gap-4 sm:px-8 sm:py-6"
        initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <WondoodleLogo
          variant="full"
          className="mx-auto h-[168px] w-auto max-w-[240px] sm:h-[200px] sm:max-w-[280px]"
        />

        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight text-mc-ink sm:text-[1.75rem]">
            {copy.welcomeTitle}
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-snug text-mc-ink/70 sm:text-[0.95rem]">
            {copy.welcomeBody}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1.5 pt-1">
          <Button
            size="lg"
            className="min-h-11 min-w-[200px] rounded-2xl bg-mc-purple px-8 text-base font-bold shadow-float hover:bg-[#6246d6]"
            data-testid="welcome-start"
            disabled={!ready}
            onClick={enter}
          >
            {hasSavedWork ? copy.continueCreating : copy.startCreating}
          </Button>
          {hasSavedWork && (
            <p
              className="text-xs text-mc-ink/55 sm:text-sm"
              data-testid="welcome-resume-hint"
            >
              Your saved canvas is waiting for you.
            </p>
          )}
        </div>
      </motion.section>
    </main>
  );
}
