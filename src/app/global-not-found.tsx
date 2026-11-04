import type { Metadata } from "next";
import { Standalone, STANDALONE_CSS } from "@/features/errors/Standalone";

export const metadata: Metadata = {
  title: "Frame missing",
  robots: { index: false, follow: false },
};

/**
 * A 404 for URLs that match no route at all (for example files the proxy never sees). Bypasses
 * the locale layout, so it brings its own document, tokens and fonts.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <head>
        <meta name="color-scheme" content="dark" />
        <style>{STANDALONE_CSS}</style>
      </head>
      <body>
        <Standalone kind="missing" />
      </body>
    </html>
  );
}
