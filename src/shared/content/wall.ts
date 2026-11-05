import type { StillId, TellerId } from "./types";

/**
 * The built-in picture sets that /admin can override (Images section): the home lantern wall and the
 * reel frame of each voice. Code defaults only; the admin's own choices live in site_settings.
 */

/** Ordered for variety (neighbouring plates are different tellers) and for first impressions. */
export const WALL_ORDER: StillId[] = [
  "s09", "s04", "s16", "s12", "s08", "s02", "s15", "s13", "s25",
  "s18", "s06", "s19", "s27", "s01", "s17", "s24", "s07", "s21",
];

/**
 * Where the character stands in each wide still, so the tall crop holds the figure and not
 * the landscape around it. x, y: centre of the figure (fractions of width/height from the
 * top-left). zoom > 1 tightens the crop on figures that sit small in the frame. The crop
 * pans only a little around x.
 */
export interface Framing {
  x: number;
  y?: number;
  zoom?: number;
}
export const FRAMING: Partial<Record<StillId, Framing>> = {
  s01: { x: 0.52 },
  s02: { x: 0.5 },
  s04: { x: 0.78 },
  s06: { x: 0.62 },
  s07: { x: 0.5, y: 0.68, zoom: 1.4 },
  s08: { x: 0.69 },
  s09: { x: 0.5 },
  s12: { x: 0.5 },
  s13: { x: 0.5 },
  s15: { x: 0.45 },
  s16: { x: 0.71 },
  s17: { x: 0.48 },
  s18: { x: 0.53 },
  s19: { x: 0.52 },
  s21: { x: 0.5, y: 0.66, zoom: 1.35 },
  s24: { x: 0.5 },
  s25: { x: 0.55 },
};

/** Films (and any still without an entry) keep the centred crop. */
export const CENTRED: Framing = { x: 0.5 };

/** One frame per teller voice (the still that opens that voice) on the home reel. */
export const REEL_STILL: Record<TellerId, StillId> = {
  child: "s09",
  elder: "s08",
  "snake-king": "s04",
  "silver-one": "s15",
  "masked-lady": "s12",
  creature: "s23",
};

/** The still the archive pins for the series. */
export const ARCHIVE_STILL: StillId = "s20";
