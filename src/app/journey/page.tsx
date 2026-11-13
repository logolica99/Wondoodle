import type { Metadata } from "next";
import { JourneyPage } from "@/components/journey/JourneyPage";

export const metadata: Metadata = {
  title: "My Journey · Wondoodle",
  description: "Your playful map of learning discoveries",
};

export default function JourneyRoutePage() {
  return <JourneyPage />;
}
