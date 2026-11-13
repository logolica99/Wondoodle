import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyPage } from "@/components/journey/JourneyPage";

export const metadata: Metadata = {
  title: "My Journey · Wondoodle",
  description: "Your playful map of learning discoveries",
};

export default function JourneyRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] bg-[#FAF9F6] p-6 text-sm text-mc-ink/60">
          Loading your journey…
        </main>
      }
    >
      <JourneyPage />
    </Suspense>
  );
}
