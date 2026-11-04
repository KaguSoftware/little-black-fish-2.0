"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useLayoutEffect } from "react";
import { Link } from "@/i18n/navigation";
import { countWord } from "@/shared/content/roster";
import { useLocale } from "next-intl";
import { useRoster } from "@/shared/data/SiteData";
import { resetTellerWeights } from "@/shared/lib/runtime";
import { useSeries } from "@/shared/state/store";
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
  const locale = useLocale();
  const roster = useRoster();
  const rosterKey = roster.map((x) => x.id).join(",");
  // The story opens with the first voice that is switched on in /admin; if the current teller is
  // one that was switched off, hand the stage to the first visible one (before the stage mounts).
  useLayoutEffect(() => {
    const first = roster[0];
    const cur = useSeries.getState().teller;
    if (first && !roster.some((x) => x.id === cur)) {
      useSeries.getState().switchTeller(first.id, "init");
      resetTellerWeights(first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);
  if (roster.length === 0) {
    return (
      <main id="main" className="relative z-10 grid min-h-svh place-items-center px-[var(--gutter)] text-center">
        <div className="max-w-[34rem]">
          <h1 className="display text-[length:var(--step-3)]">{t("empty.title")}</h1>
          <p className="mt-4" style={{ color: "var(--ink-dim)" }}>{t("empty.text")}</p>
          <Link href="/" className="lbf-textbtn mt-8 inline-block">{t("empty.back")}</Link>
        </div>
      </main>
    );
  }
  const makerTopVh = Math.round(chapterHoldStart("maker") * STORY_SCROLL_VH + 55);
  return (
    <SmoothScroll>
      <SeriesStage key={rosterKey} />
      <main id="main" className="relative z-10">
        <h1 className="sr-only">{roster.length === 1 ? t("srHeadingOne") : t("srHeading", { count: countWord(roster.length, locale, true) })}</h1>
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
