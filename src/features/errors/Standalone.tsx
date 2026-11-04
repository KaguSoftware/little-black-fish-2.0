"use client";

import { useEffect, useSyncExternalStore } from "react";
import "@fontsource/redaction/400.css";
import "@fontsource/redaction-35/400.css";
import "@fontsource/redaction-100/400.css";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource-variable/vazirmatn/wght.css";
import { FilmSlip } from "./FilmSlip";

type Lang = "en" | "fa";
interface Props {
  /** missing: unmatched URL outside the locale layout. down: the root layout itself failed. */
  kind: "missing" | "down";
  error?: unknown;
  retry?: () => void;
}

/**
 * Copy lives here, not in messages/: these pages render where the locale layout and next-intl
 * are gone (global-error, global-not-found). They are not editable from the admin.
 */
const COPY = {
  en: {
    studio: "Little Black Fish",
    home: "Back to the home page",
    missing: {
      eyebrow: "Error 404",
      title: "This frame is missing.",
      body: "The film slipped out of the gate. Whatever was here was cut, moved, or never shot. The rest of the reel is fine.",
    },
    down: {
      eyebrow: "Something went wrong",
      title: "The house lights are up.",
      body: "The whole reel stopped, and that is on our side. Give it a moment, then try again.",
      announce: "Something went wrong. You can try again.",
      retry: "Try again",
      reference: (id: string) => `Reference ${id}`,
    },
  },
  fa: {
    studio: "ماهی سیاه کوچولو",
    home: "بازگشت به صفحهٔ اصلی",
    missing: {
      eyebrow: "خطای ۴۰۴",
      title: "این فریم گم شده است.",
      body: "نوار فیلم از دریچه سر خورد. هر چه اینجا بود یا بریده شده، یا جابه‌جا شده، یا هرگز فیلم‌برداری نشده. بقیهٔ حلقه سالم است.",
    },
    down: {
      eyebrow: "مشکلی پیش آمد",
      title: "چراغ‌های سالن روشن شد.",
      body: "کل حلقه از کار افتاد و تقصیر از سمت ماست. کمی صبر کنید و دوباره امتحان کنید.",
      announce: "مشکلی پیش آمد. می‌توانید دوباره تلاش کنید.",
      retry: "تلاش دوباره",
      reference: (id: string) => `کد پیگیری ${id}`,
    },
  },
} as const;

/** Same tokens as globals.css, inline, so these pages stand alone. */
export const STANDALONE_CSS = `
:root{--hue:215;--stage:oklch(0.12 0.014 215);--stage-deep:oklch(0.08 0.01 215);--ink:oklch(0.93 0.012 80);
--ink-dim:oklch(0.74 0.012 80);--hairline:oklch(0.93 0.012 80 / 0.16);--teller-child:oklch(0.7 0.1 210);
--teller-masked-lady:oklch(0.8 0.13 80);--teller-creature:oklch(0.62 0.18 28);
--ease-out-quint:cubic-bezier(0.22,1,0.36,1);
--font-display:"Redaction","Vazirmatn Variable","Times New Roman",serif;
--font-display-35:"Redaction 35",var(--font-display);
--font-display-100:"Redaction 100",var(--font-display);
--font-sans:"Schibsted Grotesk","Vazirmatn Variable",ui-sans-serif,system-ui,sans-serif;
--step--1:clamp(0.8125rem,0.78rem + 0.15vw,0.9375rem);--step-0:clamp(1rem,0.96rem + 0.2vw,1.125rem);
--step-1:clamp(1.25rem,1.15rem + 0.5vw,1.6rem);--step-3:clamp(2.4rem,1.6rem + 4vw,5.5rem);color-scheme:dark}
html{background:var(--stage-deep)}
body{margin:0;background:var(--stage);color:var(--ink);font-family:var(--font-sans);font-size:var(--step-0);line-height:1.55;-webkit-font-smoothing:antialiased}
body:lang(fa){line-height:1.8}
:lang(fa){letter-spacing:0 !important}
h1:lang(fa){line-height:1.25 !important}
:focus-visible{outline:2px solid var(--teller-creature);outline-offset:3px;border-radius:2px}
`;

const subscribeNever = () => () => {};
function readLang(): Lang {
  const seg = window.location.pathname.split("/")[1];
  return seg === "fa" || (seg !== "en" && navigator.language?.toLowerCase().startsWith("fa")) ? "fa" : "en";
}

/** The film page for places with no locale layout. Language: the URL's first segment, else the browser's. */
export function Standalone({ kind, error, retry }: Props) {
  const lang = useSyncExternalStore(subscribeNever, readLang, () => "en" as Lang);
  const c = COPY[lang];

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "fa" ? "rtl" : "ltr";
    document.title = COPY[lang][kind].title;
  }, [lang, kind]);

  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  const homeHref = `/${lang}`;

  if (kind === "missing") {
    return (
      <FilmSlip
        variant="missing"
        code="404"
        eyebrow={c.missing.eyebrow}
        title={c.missing.title}
        grain
        masthead={<span>{c.studio}</span>}
        actions={
          <a href={homeHref} data-primary>
            {c.home}
          </a>
        }
      >
        <p>{c.missing.body}</p>
      </FilmSlip>
    );
  }

  return (
    <FilmSlip
      variant="down"
      code="500"
      eyebrow={c.down.eyebrow}
      title={c.down.title}
      announce={c.down.announce}
      focusTitle
      grain
      masthead={<span>{c.studio}</span>}
      actions={
        <>
          <button type="button" data-primary onClick={() => retry?.()}>
            {c.down.retry}
          </button>
          {/* A plain anchor on purpose: no router is guaranteed here, and a full load clears the failure. */}
          <a href={homeHref} data-secondary>
            {c.home}
          </a>
        </>
      }
      note={digest ? c.down.reference(digest) : undefined}
    >
      <p>{c.down.body}</p>
    </FilmSlip>
  );
}
