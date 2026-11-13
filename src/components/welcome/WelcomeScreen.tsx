"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PipAvatar, type PipAnimState } from "@/components/mascot/PipAvatar";
import { Button } from "@/components/ui/button";
import { loadDocument } from "@/lib/canvas/storage";
import {
  TITLE_SUGGESTIONS,
  sanitizeDocumentTitle,
  setPendingDocumentTitle,
} from "@/lib/canvas/pendingTitle";
import { getAllLearningEvents } from "@/lib/learning/events";
import { hasBaselineAssessment } from "@/lib/learning/masteryProof";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

const FIRST = {
  heading: "Ready to make your first discovery?",
  description: "Draw something, then tell Pip about it!",
  primary: "Start creating",
} as const;

const RETURNING = {
  heading: "Welcome back, explorer!",
  description: "Your next discovery is waiting.",
  primary: "Continue my adventure",
} as const;

type WelcomeStep = "home" | "name";

export function WelcomeScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const markWorkspaceEntered = useUiStore((s) => s.markWorkspaceEntered);
  const [returning, setReturning] = useState(false);
  const [ready, setReady] = useState(false);
  const [offerBaseline, setOfferBaseline] = useState(false);
  const [pipState, setPipState] = useState<PipAnimState>("idle");
  const [step, setStep] = useState<WelcomeStep>("home");
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [doc, events] = await Promise.all([
          loadDocument(),
          getAllLearningEvents(),
        ]);
        if (cancelled) return;
        const progressEvents = events.filter(
          (e) => e.eventType !== "journey_opened"
        );
        setReturning(doc.objects.length > 0 || progressEvents.length > 0);
        setOfferBaseline(!hasBaselineAssessment(events));
      } catch {
        if (!cancelled) {
          setReturning(false);
          setOfferBaseline(true);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Brief welcome bounce/sparkle once — not continuous, no mic.
  useEffect(() => {
    if (reduceMotion) {
      setPipState("idle");
      return;
    }
    setPipState("success");
    const t = window.setTimeout(() => setPipState("idle"), 900);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

  const copy = returning ? RETURNING : FIRST;
  const cleanedName = sanitizeDocumentTitle(projectName);

  const enterLearn = (title?: string) => {
    const next = sanitizeDocumentTitle(title ?? projectName);
    if (next) setPendingDocumentTitle(next);
    markWorkspaceEntered();
    router.push("/learn");
  };

  const onPrimary = () => {
    if (!ready) return;
    if (returning) {
      enterLearn();
      return;
    }
    // First visit: ask what this adventure is called.
    setStep("name");
  };

  return (
    <main
      className="min-h-[100dvh] overflow-x-clip overflow-y-auto bg-[#FAF9F6] px-4 py-6 sm:px-6 sm:py-8"
      data-testid="welcome-screen"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <WelcomeDoodles />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-lg items-center justify-center sm:min-h-[calc(100dvh-4rem)]">
        <motion.section
          className="w-full rounded-[1.75rem] border border-[#E8E0FF] bg-white px-5 py-6 text-center shadow-soft sm:px-8 sm:py-7"
          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <AnimatePresence mode="wait">
            {step === "home" ? (
              <motion.div
                key="home"
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mx-auto flex justify-center">
                  <PipAvatar
                    state={pipState}
                    size={150}
                    className="sm:scale-105"
                    label="Pip the Wondoodle mascot"
                  />
                </div>

                <div className="mt-3 sm:mt-4">
                  <p
                    className="font-display text-[2rem] font-bold leading-none tracking-tight sm:text-[2.35rem]"
                    style={{ color: "#7040C5", letterSpacing: "-0.04em" }}
                    data-testid="welcome-brand"
                  >
                    Wondoodle
                  </p>
                  <p
                    className="mt-1.5 font-sans text-[0.95rem] font-bold leading-snug sm:text-[1.05rem]"
                    style={{ color: "#8B61BB" }}
                    data-testid="welcome-tagline"
                  >
                    Every doodle is a discovery
                  </p>
                </div>

                <h1 className="mt-4 font-display text-[1.35rem] font-semibold leading-tight text-mc-ink sm:mt-5 sm:text-2xl">
                  {copy.heading}
                </h1>
                <p className="mx-auto mt-1.5 max-w-sm text-base leading-snug text-mc-ink/70 sm:text-lg">
                  {copy.description}
                </p>

                <div className="mt-6 flex flex-col items-stretch gap-2.5 sm:mt-7 sm:items-center">
                  <Button
                    size="lg"
                    className="min-h-12 w-full rounded-2xl bg-[#7357E8] px-8 text-base font-bold text-white shadow-soft transition hover:bg-[#6246d6] active:scale-[0.98] sm:min-w-[240px] sm:w-auto"
                    data-testid="welcome-start"
                    disabled={!ready}
                    onClick={onPrimary}
                  >
                    {ready ? copy.primary : "Loading…"}
                  </Button>
                  {offerBaseline ? (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="min-h-11 w-full rounded-2xl border-2 border-[#FF91B6]/50 bg-[#FFF0F5] px-8 text-base font-semibold text-[#C45A7A] transition hover:bg-[#ffe8f1] active:scale-[0.98] sm:min-w-[240px] sm:w-auto"
                      data-testid="welcome-baseline"
                    >
                      <Link href="/learn?baseline=1">
                        Quick check first
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="min-h-11 w-full rounded-2xl border-2 border-[#7357E8]/35 bg-transparent px-8 text-base font-semibold text-[#7357E8] transition hover:bg-[#EFEAFF] active:scale-[0.98] sm:min-w-[240px] sm:w-auto"
                    data-testid="welcome-journey"
                  >
                    <Link href="/journey">My Journey</Link>
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="name"
                className="text-left"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                data-testid="welcome-name-card"
              >
                <div className="mx-auto mb-3 flex justify-center">
                  <PipAvatar
                    state="idle"
                    size={96}
                    label="Pip the Wondoodle mascot"
                  />
                </div>
                <p className="text-center font-display text-xl font-semibold text-mc-ink sm:text-2xl">
                  What are we exploring today?
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-center text-sm leading-snug text-mc-ink/65 sm:text-base">
                  Give your doodle a name so it doesn’t stay “Untitled Notes.”
                </p>

                <label className="mt-5 block">
                  <span className="sr-only">Adventure name</span>
                  <input
                    data-testid="welcome-project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && cleanedName) {
                        enterLearn(cleanedName);
                      }
                    }}
                    placeholder="Type a name…"
                    maxLength={48}
                    autoFocus
                    className="w-full rounded-2xl border-2 border-mc-purple/20 bg-[#FAF9F6] px-4 py-3 text-base font-semibold text-mc-ink outline-none placeholder:font-medium placeholder:text-mc-ink/35 focus:border-mc-purple/45 focus:bg-white"
                  />
                </label>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-mc-ink/45">
                  Try one of these
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TITLE_SUGGESTIONS.map((suggestion) => {
                    const selected = cleanedName === suggestion;
                    return (
                      <button
                        key={suggestion}
                        type="button"
                        data-testid={`welcome-suggestion-${suggestion}`}
                        onClick={() => setProjectName(suggestion)}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-sm font-semibold transition active:scale-[0.98]",
                          selected
                            ? "border-mc-purple bg-mc-purple-soft text-mc-purple"
                            : "border-mc-ink/10 bg-white text-mc-ink/75 hover:border-mc-purple/30 hover:text-mc-ink"
                        )}
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                  <Button
                    size="lg"
                    className="min-h-12 w-full rounded-2xl bg-[#7357E8] px-8 text-base font-bold text-white shadow-soft transition hover:bg-[#6246d6] active:scale-[0.98] sm:w-auto"
                    data-testid="welcome-name-continue"
                    disabled={!cleanedName}
                    onClick={() => enterLearn(cleanedName)}
                  >
                    Start my adventure
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-h-11 w-full rounded-2xl border-2 border-[#7357E8]/35 bg-transparent px-6 text-base font-semibold text-[#7357E8] transition hover:bg-[#EFEAFF] active:scale-[0.98] sm:w-auto"
                    data-testid="welcome-name-back"
                    onClick={() => setStep("home")}
                  >
                    Back
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </main>
  );
}

/** A few restrained doodle accents — no large gradients. */
function WelcomeDoodles() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 800 600"
      fill="none"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <path
        d="M70 120c40 10 70-20 90-10"
        stroke="#FF91B6"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M720 90c-30 20-20 50-50 55"
        stroke="#76B8FF"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M680 480c25-15 55 5 70-20"
        stroke="#58D9B0"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M90 460l8 18 18 2-14 12 4 18-16-10-16 10 4-18-14-12 18-2z"
        fill="#FFD66D"
        opacity="0.55"
      />
      <path
        d="M740 320l6 12 13 1-10 9 3 13-12-7-12 7 3-13-10-9 13-1z"
        fill="#A48CF3"
        opacity="0.45"
      />
      <circle cx="140" cy="280" r="5" fill="#FF91B6" opacity="0.35" />
      <circle cx="650" cy="200" r="4" fill="#58D9B0" opacity="0.4" />
    </svg>
  );
}
