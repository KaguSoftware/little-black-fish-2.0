"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ProjectCard } from "@/shared/data/cards";
import { STORY_SCROLL_VH, chapterHoldStart } from "@/shared/content/chapters";
import { SmoothScroll } from "./ui/SmoothScroll";
import { Narration } from "./ui/Narration";
import { TitleCard } from "./ui/TitleCard";
import { TellerSwitcher } from "./ui/TellerSwitcher";
import { CastList } from "./ui/CastList";
import { WatchButton } from "./ui/WatchButton";
import { Maker } from "./ui/Maker";
import { Autoplay } from "./ui/Autoplay";
import { ChapterIndicator } from "./ui/ChapterIndicator";

const SeriesStage = dynamic(() => import("./scene/SeriesStage"), { ssr: false });

/**
 * /projects/series. Layering:
 *   z0   fixed <Canvas> (SeriesStage)
 *   z10  fixed overlays (narration, title, chapter indicator, watch button, cast list)
 *   z20  teller switcher
 *   flow scroll spacer (STORY_SCROLL_VH) with MY MAKER content placed at its hold
 *
 * Story progress = scrollY / (spacerPx - viewportPx), see SmoothScroll.
 */
export default function SeriesPage({ projects, watchUrl }: { projects: ProjectCard[]; watchUrl: string | null }) {
  const t = useTranslations("series");
  const makerTopVh = Math.round(chapterHoldStart("maker") * STORY_SCROLL_VH + 55);
  return (
    <SmoothScroll>
      <SeriesStage />
      <main id="main" className="relative z-10">
        <h1 className="sr-only">{t("srHeading")}</h1>
        <div id="story-spacer" style={{ height: `${STORY_SCROLL_VH}vh` }} aria-hidden="true" />
        <div className="absolute inset-x-0" style={{ top: `${makerTopVh}vh` }}>
          <Maker projects={projects} />
        </div>
      </main>
      <div className="pointer-events-none fixed inset-0 z-10">
        <Narration />
        <TitleCard />
        <ChapterIndicator />
        <WatchButton href={watchUrl} />
        <CastList />
      </div>
      <TellerSwitcher />
      <Autoplay />
    </SmoothScroll>
  );
}
