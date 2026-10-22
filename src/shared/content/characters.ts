import type { CastSpot, ChapterId, Teller, TellerId } from "./types";
import { CHAPTER_BY_ID } from "./chapters";

/**
 * The six tellers. Everything per-character lives here.
 * Narration lines are PLACEHOLDER drafts in each character's voice; replace with
 * the studio's real lines. Keep "Oh. Hi. I'm [NAME]." shape for HELLO.
 * House style: no em dashes in copy.
 */

/** Shared line templates. When a teller still uses them, the UI shows the localized version (series.json "narration"). */
export const HELLO = (name: string) => `Oh. Hi. I'm ${name}.`;
export const MAKER = "Little Black Fish made me. Here's what else they made.";

/**
 * Bump when public/models/*.glb are regenerated: loaded scenes are cached by URL (in memory and
 * by the browser), so a new query string is what makes open tabs and returning visitors refetch.
 */
const MODELS_REV = "2";
const modelUrl = (name: string) => `/models/${name}.glb?v=${MODELS_REV}`;

export const TELLERS: readonly Teller[] = [
  {
    id: "child",
    name: "[CHARACTER 1]",
    role: "the Child",
    mood: "bouncy",
    accent: [0.7, 0.1, 210],
    stageHue: { default: 215, day: 230 },
    eyes: "bored",
    // Low, looking up: the world looms over a small person.
    eyeline: { height: -0.55, distance: 0.95, roll: 0, fov: 1.08, orbit: 0.12, aim: 0.62 },
    narration: {
      look: "",
      hello: HELLO("[CHARACTER 1]"),
      world: "Up here the mountains hum if you stand still long enough. Nobody stands still long enough.", // PLACEHOLDER
      day: "Then the fog came down the wrong way, and the old one stopped smiling.", // PLACEHOLDER
      did: "So I painted every road I knew onto my skin and started walking.", // PLACEHOLDER
      others: "I'm not the only one with a side of this. Go on, ask them.", // PLACEHOLDER
      maker: MAKER,
    },
    plates: { world: "s10", day: "s13", did: "s07", others: "s09" },
    portrait: { still: "s09", focus: [50, 30] },
    model: modelUrl("siyamak"),
  },
  {
    id: "elder",
    name: "[CHARACTER 2]",
    role: "the Elder",
    mood: "bored",
    accent: [0.72, 0.09, 350],
    stageHue: { default: 345 },
    eyes: "bored",
    // High, looking down on everyone. Seen it all.
    eyeline: { height: 0.9, distance: 1.12, roll: 0, fov: 0.92, orbit: -0.18, aim: 0.5 },
    narration: {
      look: "",
      hello: HELLO("[CHARACTER 2]"),
      world: "Mountains. Fog. More mountains. I have watched this view for three hundred winters.", // PLACEHOLDER
      day: "The child asked a question. I should have pretended to be asleep.", // PLACEHOLDER
      did: "I walked them to the edge. Slowly. Someone had to be slow.", // PLACEHOLDER
      others: "I'm not the only one with a side of this. Mine is the accurate one.", // PLACEHOLDER
      maker: MAKER,
    },
    plates: { world: "s14", day: "s06", did: "s07", others: "s08" },
    portrait: { still: "s08", focus: [93, 35] },
    model: modelUrl("keyumars"),
  },
  {
    id: "snake-king",
    name: "[CHARACTER 3]",
    role: "the Snake King",
    mood: "angry",
    accent: [0.7, 0.14, 140],
    stageHue: { default: 135, day: 20 },
    eyes: "angry",
    // Low and heroic with a dutch tilt. Everything is a throne room.
    eyeline: { height: -0.35, distance: 0.9, roll: 0.07, fov: 1.0, orbit: 0.22, aim: 0.7 },
    narration: {
      look: "",
      hello: HELLO("[CHARACTER 3]"),
      world: "Every stone in this hall answers to me. Every stone, every snake, every echo.", // PLACEHOLDER
      day: "A barefoot child walked into my court and did not kneel.", // PLACEHOLDER
      did: "I let the snakes loose on the mountain. I would do it again.", // PLACEHOLDER
      others: "I'm not the only one with a side of this. They will tell it wrong.", // PLACEHOLDER
      maker: MAKER,
    },
    plates: { world: "s03", day: "s20", did: "s19", others: "s24" },
    portrait: { still: "s05", focus: [0, 40] },
    model: modelUrl("zahhak"),
  },
  {
    id: "silver-one",
    name: "[CHARACTER 4]",
    role: "the Silver One",
    mood: "dreamy",
    accent: [0.64, 0.16, 268],
    stageHue: { default: 265 },
    eyes: "bored",
    // Dead centre, perfectly symmetric, slightly far. A mirror sees straight on.
    eyeline: { height: 0.05, distance: 1.2, roll: 0, fov: 0.85, orbit: 0, aim: 0.55 },
    framing: { world: { orbit: 0 }, day: { orbit: 0 }, did: { orbit: 0 } },
    narration: {
      look: "",
      hello: HELLO("[CHARACTER 4]"),
      world: "I hold the world up like a mirror. Mostly it looks back at itself.", // PLACEHOLDER
      day: "That day my face showed something that was not there yet.", // PLACEHOLDER
      did: "I followed the reflection down into the quarry, where light goes to sleep.", // PLACEHOLDER
      others: "I'm not the only one with a side of this. Each one is a little bit true.", // PLACEHOLDER
      maker: MAKER,
    },
    plates: { world: "s17", day: "s16", did: "s21", others: "s15" },
    portrait: { still: "s22", focus: [0, 30] },
    model: modelUrl("eblis"),
  },
  {
    id: "masked-lady",
    name: "[CHARACTER 5]",
    role: "the Masked Lady",
    mood: "ceremonial",
    accent: [0.8, 0.13, 80],
    stageHue: { default: 70 },
    eyes: "bored",
    // Frontal, slightly high, composed like a portrait sitting.
    eyeline: { height: 0.3, distance: 1.0, roll: 0, fov: 0.9, orbit: -0.05, aim: 0.6 },
    narration: {
      look: "",
      hello: HELLO("[CHARACTER 5]"),
      world: "In the old city everything is stitched by hand, and nothing is said out loud.", // PLACEHOLDER
      day: "The bells rang out of order. In two hundred years they never had.", // PLACEHOLDER
      did: "I unpicked the oldest pattern and read what it had been hiding.", // PLACEHOLDER
      others: "I'm not the only one with a side of this. Mine is one thread. Pull another.", // PLACEHOLDER
      maker: MAKER,
    },
    plates: { world: "s12", day: "s27", did: "s17", others: "s12" },
    portrait: { still: "s26", focus: [0, 35] },
    model: modelUrl("arnavaz"),
  },
  {
    id: "creature",
    name: "[CHARACTER 6]",
    role: "the Creature",
    mood: "skittish",
    accent: [0.62, 0.18, 28],
    stageHue: { default: 25 },
    eyes: "bored",
    // Ground level, wide, peeking.
    eyeline: { height: -0.75, distance: 1.15, roll: -0.03, fov: 1.12, orbit: -0.25, aim: 0.45 },
    narration: {
      look: "",
      hello: HELLO("[CHARACTER 6]"),
      world: "Sand. Warm sand. Quiet sand. I like quiet sand.", // PLACEHOLDER
      day: "Then everything got loud, and I hid under my own blanket.", // PLACEHOLDER
      did: "I carried them across. I did not want to. I did it anyway.", // PLACEHOLDER
      others: "I'm not the only one with a side of this. Ask them. Quietly, please.", // PLACEHOLDER
      maker: MAKER,
    },
    plates: { world: "s12", day: "s20", did: "s07", others: "s23" },
    portrait: { still: "s23", focus: [3, 50] },
    model: modelUrl("horse"),
  },
];

export const TELLER_IDS = TELLERS.map((t) => t.id);
export const TELLER_BY_ID = Object.fromEntries(TELLERS.map((t) => [t.id, t])) as Record<TellerId, Teller>;
export const FIRST_TELLER: TellerId = "child";

/**
 * Where the other characters stand in this teller's version of a chapter.
 * Overrides in `teller.cast[chapter]` win. Positions in stage metres, hero at x = side * 1.15, z = 0.
 * Side characters are upstage (negative z), on the side opposite the hero so they stay visible.
 */
export function castFor(teller: Teller, chapter: ChapterId): CastSpot[] {
  const override = teller.cast?.[chapter];
  if (override) return override;
  if (chapter === "look" || chapter === "maker") return [];
  const others = TELLER_IDS.filter((id) => id !== teller.id);
  const side = CHAPTER_BY_ID[chapter].side || 1;
  const seed = TELLER_IDS.indexOf(teller.id);
  switch (chapter) {
    case "hello":
      // Far back, scattered, barely there: we've just met.
      return others.slice(0, 3).map((id, i) => ({
        id,
        pos: [(-1.8 + i * 1.8) + ((seed % 2) - 0.5) * 0.6, -7 - i * 0.8] as const,
        scale: 1,
      }));
    case "world":
      // Their world: the others are distant figures on the horizon line.
      return others.map((id, i) => ({
        id,
        pos: [-side * (0.4 + i * 0.9), -5.5 - ((i + seed) % 3) * 1.3] as const,
      }));
    case "day":
      // The day: everyone closer, crowded upstage, facing the hero.
      return others.map((id, i) => ({
        id,
        pos: [-side * (0.2 + (i % 3) * 1.05), -2.6 - Math.floor(i / 3) * 1.4] as const,
      }));
    case "did":
      // What I did: the others turned away (seen from behind), scattered.
      return others.map((id, i) => ({
        id,
        pos: [-side * (0.5 + i * 0.75), -3.8 - (i % 2) * 1.6] as const,
        rotY: Math.PI,
      }));
    case "others":
      // A line-up, like a curtain call.
      return others.map((id, i) => ({
        id,
        pos: [-side * (0.1 + i * 0.85), -2.4] as const,
        rotY: 0,
      }));
    default:
      return [];
  }
}

/** Clean 600×800 (3:4) face crop per teller, baked by scripts/optimize-images.mjs. Prefer this over portrait.still + focus. */
export const tellerPortrait = (id: TellerId) => `/portraits/${id}.webp`;
