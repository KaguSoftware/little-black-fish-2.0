import type { Metadata } from "next";
import SeriesPage from "@/features/series/SeriesPage";
import { SITE } from "@/shared/content/site";

export const metadata: Metadata = {
  title: SITE.seriesTitle,
  description: "One story, six points of view. Switch teller at any moment and hear the same story from another side.",
};

export default function Page() {
  return <SeriesPage />;
}
