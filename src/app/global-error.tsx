"use client";

import { Standalone, STANDALONE_CSS } from "@/features/errors/Standalone";

type Props = { error: unknown; retry?: () => void; reset?: () => void };

/**
 * Root failure (the layout itself threw). Replaces the whole document, so it brings its own
 * html/body, tokens and fonts; copy is bilingual (see Standalone) and no provider is needed.
 */
export default function GlobalError({ error, retry, reset }: Props) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <title>The house lights are up.</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <style>{STANDALONE_CSS}</style>
      </head>
      <body>
        <Standalone kind="down" error={error} retry={retry ?? reset} />
      </body>
    </html>
  );
}
