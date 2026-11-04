import { notFound } from "next/navigation";

/**
 * Catch-all: any unknown path under a valid locale lands here and 404s, so the response is
 * rendered by [locale]/not-found.tsx inside the locale layout (nav, grain, fonts, right language).
 */
export default function CatchAll() {
  notFound();
}
