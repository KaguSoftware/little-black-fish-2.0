import type { StillId, TellerId } from "./types";

/**
 * The 27 production stills supplied by the studio. Source JPGs live in
 * `assets-src/stills/{n}.jpg`; `scripts/optimize-images.mjs` writes:
 *   public/stills/{id}-640.webp | -1200.webp | -1200.avif   (cards, portraits)
 *   public/plates/{id}.webp                                   (2048w, scene textures)
 *
 * `kind`: "scene" = cinematic frame, "sheet" = character/costume sheet with swatches.
 * `tellers`: who is visible, first = most prominent.
 */
export interface Still {
  id: StillId;
  src: number;
  kind: "scene" | "sheet";
  tellers: TellerId[];
  alt: string;
  /** width / height of the source. */
  aspect: number;
}

const W = 1376 / 768;

export const STILLS: readonly Still[] = [
  { id: "s01", src: 1, kind: "scene", tellers: ["snake-king"], aspect: W, alt: "The Snake King in profile, framed by a dark doorway, staff in hand, stone stairs beyond." },
  { id: "s02", src: 2, kind: "scene", tellers: ["snake-king"], aspect: W, alt: "The Snake King enthroned beneath stone arches, cobras coiled over a velvet robe." },
  { id: "s03", src: 3, kind: "scene", tellers: ["snake-king"], aspect: W, alt: "Wide view of the Snake King's throne hall, pale stone pillars and arched niches." },
  { id: "s04", src: 4, kind: "scene", tellers: ["snake-king"], aspect: W, alt: "The Snake King seen from behind on a ridge, crown of spikes against misty blue mountains." },
  { id: "s05", src: 5, kind: "sheet", tellers: ["snake-king"], aspect: W, alt: "Costume sheet for the Snake King: cracked bronze mask, spiked crown, velvet robe, embroidery." },
  { id: "s06", src: 6, kind: "scene", tellers: ["elder", "child"], aspect: W, alt: "The Elder sits on a boulder facing the painted Child on a mountain pass." },
  { id: "s07", src: 7, kind: "scene", tellers: ["child", "elder"], aspect: W, alt: "The Child and the Elder walk away together across a high plateau." },
  { id: "s08", src: 8, kind: "scene", tellers: ["elder", "child"], aspect: W, alt: "The Elder's stone mask in profile, the Child small and distant among peaks." },
  { id: "s09", src: 9, kind: "scene", tellers: ["child"], aspect: W, alt: "The Child faces us in a paper mask, body covered in painted marks, fog behind." },
  { id: "s10", src: 10, kind: "scene", tellers: ["child"], aspect: W, alt: "The Child, tiny on a scree slope, beneath dark jagged mountains." },
  { id: "s11", src: 11, kind: "sheet", tellers: ["masked-lady"], aspect: 1536 / 1024, alt: "Costume sheet for the Masked Lady in dark tweed with an embroidered ivory bib." },
  { id: "s12", src: 12, kind: "scene", tellers: ["masked-lady"], aspect: W, alt: "The Masked Lady stands in desert ruins under a deep blue sky." },
  { id: "s13", src: 13, kind: "scene", tellers: ["child"], aspect: W, alt: "The Child seen from behind on a ridge above a sea of cloud." },
  { id: "s14", src: 14, kind: "scene", tellers: ["elder", "child"], aspect: W, alt: "Over the Elder's shoulder: the Child stands at the end of a rocky spur." },
  { id: "s15", src: 15, kind: "scene", tellers: ["silver-one"], aspect: W, alt: "The Silver One turns in a ruined courtyard, mirror mask, long auburn hair." },
  { id: "s16", src: 16, kind: "scene", tellers: ["silver-one"], aspect: W, alt: "The Silver One in a vaulted stone hall lit by red candles and embers." },
  { id: "s17", src: 17, kind: "scene", tellers: ["silver-one"], aspect: W, alt: "The Silver One beside a window opening onto bare mountains." },
  { id: "s18", src: 18, kind: "scene", tellers: ["silver-one"], aspect: W, alt: "Close profile of the Silver One's chrome mask behind a curtain of hair." },
  { id: "s19", src: 19, kind: "scene", tellers: ["snake-king"], aspect: W, alt: "Low angle: the Snake King at the top of marble stairs in a misty quarry." },
  { id: "s20", src: 20, kind: "scene", tellers: ["snake-king"], aspect: W, alt: "A tiny crowned figure before a black pool and a pale monolith in a vast dark chamber." },
  { id: "s21", src: 21, kind: "scene", tellers: ["silver-one"], aspect: W, alt: "The Silver One stands between huge stone blocks in a quarry tunnel." },
  { id: "s22", src: 22, kind: "sheet", tellers: ["silver-one"], aspect: W, alt: "Costume sheet for the Silver One: chrome mask, silver lame cloak, lapis beads, white fur." },
  { id: "s23", src: 23, kind: "sheet", tellers: ["creature"], aspect: W, alt: "Character sheet for the Creature, a pale furry beast with a beaked head and red saddle cloth." },
  { id: "s24", src: 24, kind: "scene", tellers: ["snake-king"], aspect: W, alt: "The Snake King on a stone ledge looking out over a stormy green valley." },
  { id: "s25", src: 25, kind: "scene", tellers: ["snake-king"], aspect: W, alt: "The Snake King through an archway, golden snakes embroidered on the sleeve." },
  { id: "s26", src: 26, kind: "sheet", tellers: ["masked-lady"], aspect: W, alt: "Costume sheet for the Masked Lady in ivory linen and an embroidered blue vest." },
  { id: "s27", src: 27, kind: "scene", tellers: ["masked-lady"], aspect: 939 / 1672, alt: "Full-length portrait of the Masked Lady in balloon trousers and silver boots." },
] as const;

export const STILL_BY_ID: Record<string, Still> = Object.fromEntries(STILLS.map((s) => [s.id, s]));

export const stillCard = (id: StillId, w: 640 | 1200 = 1200, fmt: "webp" | "avif" = "webp") =>
  `/stills/${id}-${w}.${fmt}`;

export const stillPlate = (id: StillId) => `/plates/${id}.webp`;
