import { Suspense } from "react";
import { LearnWorkspace } from "@/components/canvas/LearnWorkspace";

export const metadata = {
  title: "Smart Canvas · Wondoodle",
  description: "A multimodal learning workspace for drawing, writing, and organizing notes.",
};

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center text-sm text-mc-ink/60">
          Preparing your creative space…
        </div>
      }
    >
      <LearnWorkspace />
    </Suspense>
  );
}
