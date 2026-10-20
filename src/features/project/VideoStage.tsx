"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useUI } from "@/shared/state/store";

type Img = { src: string; srcSet?: string; sizes?: string };

/**
 * The screening. The poster rises out of the dark; YouTube is not loaded until the visitor
 * asks. Play dims the house lights, the iframe mounts behind the poster and the poster
 * fades away once the player has loaded, then focus moves into the player.
 * Reduced motion: an immediate swap, no dimming or flicker.
 */
export function VideoStage({
  embed,
  title,
  poster,
  tall,
}: {
  embed: string;
  title: string;
  poster: Img | null;
  /** YouTube Shorts are vertical. */
  tall: boolean;
}) {
  const t = useTranslations("project");
  const reduced = useUI((s) => s.reducedMotion);
  const [state, setState] = useState<"poster" | "loading" | "playing">("poster");
  const frame = useRef<HTMLIFrameElement>(null);

  // A player that never reports load (blocked, offline) still replaces the poster.
  useEffect(() => {
    if (state !== "loading") return;
    const id = window.setTimeout(() => setState("playing"), 2600);
    return () => window.clearTimeout(id);
  }, [state]);

  useEffect(() => {
    if (state === "playing") frame.current?.focus({ preventScroll: true });
  }, [state]);

  const src = `${embed}&autoplay=1&playsinline=1`;

  return (
    <div className="pj-stage" data-tall={tall ? "true" : "false"} data-state={state} data-reduced={reduced ? "true" : "false"}>
      <div className="pj-screen">
        {state !== "poster" && (
          <iframe
            ref={frame}
            className="pj-iframe"
            src={src}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onLoad={() => setState("playing")}
          />
        )}

        <button
          type="button"
          className="pj-poster"
          onClick={() => setState(reduced ? "playing" : "loading")}
          disabled={state !== "poster"}
          aria-label={t("playLabel", { title })}
        >
          {poster && <img className="pj-poster-img" {...poster} alt="" fetchPriority="high" decoding="async" draggable={false} />}
          <span className="pj-poster-flicker" aria-hidden="true" />
          <span className="pj-play" aria-hidden="true">
            <svg className="pj-play-ring" viewBox="0 0 64 64" width="64" height="64">
              <circle className="pj-ring-rest" cx="32" cy="32" r="30.5" />
              <circle className="pj-ring-lit" cx="32" cy="32" r="30.5" pathLength="1" />
              <path className="pj-play-tri" d="M26 21.5 44 32 26 42.5Z" />
            </svg>
            <span className="pj-play-label">{state === "poster" ? t("play") : t("loadingVideo")}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
