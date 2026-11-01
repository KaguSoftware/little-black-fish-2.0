import type { CastSpot, ChapterId, Teller, TellerId } from "./types";
import { CHAPTER_BY_ID } from "./chapters";

/**
 * The six tellers. Everything per-character lives here.
 * Narration: each teller's monologue from the studio, one sentence (or two) per chapter
 * from HELLO to THE OTHERS. Persian names, roles and lines live in messages/fa/series.json
 * (names, roles, lines); English here is the source. [CHARACTER 6] is still a PLACEHOLDER.
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
    name: "Siyamak",
    role: "son of Kiumars",
    mood: "bouncy",
    accent: [0.7, 0.1, 210],
    stageHue: { default: 215, day: 230 },
    eyes: "bored",
    // Low, looking up: the world looms over a small person.
    eyeline: { height: -0.55, distance: 0.95, roll: 0, fov: 1.08, orbit: 0.12, aim: 0.62 },
    narration: {
      look: "",
      hello: "I am Siyamak, son of Kiumars, a noble-born youth, swift of claw and bold of heart, nurtured by divine glory and raised in the shadow of kingship.",
      world: "The blood of champions courses through my veins, and the fire of battle burns within my soul. The roar of the battlefield does not frighten my heart, nor does the sight of a demon turn my gaze away.",
      day: "Strength dwells in my arms, and fearlessness in my heart; my head reaches toward the heavens, while my feet stand firm upon the soil of battle.",
      did: "I do not seek renown through silver and gold, nor do I desire lofty fortune without toil; for fame demands the price of life, and true valor is proven on the field of combat.",
      others: "I am Siyamak, the tall cypress of the royal lineage, a youth whose glory lies in courage and whose name is worthy of the chronicles of heroes.",
      maker: MAKER,
    },
    plates: { world: "s10", day: "s13", did: "s07", others: "s09" },
    portrait: { still: "s09", focus: [50, 30] },
    model: modelUrl("siyamak"),
  },
  {
    id: "elder",
    name: "Kiumars",
    role: "the first king",
    mood: "bored",
    accent: [0.72, 0.09, 350],
    stageHue: { default: 345 },
    eyes: "bored",
    // High, looking down on everyone. Seen it all.
    eyeline: { height: 0.9, distance: 1.12, roll: 0, fov: 0.92, orbit: -0.18, aim: 0.5 },
    narration: {
      look: "",
      hello: "I am Kiumars, the first sovereign of the world, the bearer of divine glory and the crown, with the royal throne beneath my feet and the lofty heavens stretched above me.",
      world: "The mountains are my palace, and the plains and meadows are the vast expanse of my dominion. Wild beasts and cattle find peace beneath my sheltering shade, and my renown spreads throughout the world.",
      day: "The glory of kings is mine, as is the majesty of my forebears; yet my soul remains closer to the dust than to the heavens.",
      did: "Neither crown nor diadem can free me from the turning wheel of fate, nor can mace or army reveal to me the secrets of destiny.",
      others: "I am Kiumars, the first of kings, renowned throughout the world, yet humble before the boundless vault of heaven.",
      maker: MAKER,
    },
    plates: { world: "s14", day: "s06", did: "s07", others: "s08" },
    portrait: { still: "s08", focus: [93, 35] },
    model: modelUrl("keyumars"),
  },
  {
    id: "snake-king",
    name: "Zahhak",
    role: "the dragon-shouldered king",
    mood: "angry",
    accent: [0.7, 0.14, 140],
    stageHue: { default: 135, day: 20 },
    eyes: "angry",
    // Low and heroic with a dutch tilt. Everything is a throne room.
    eyeline: { height: -0.35, distance: 0.9, roll: 0.07, fov: 1.0, orbit: 0.22, aim: 0.7 },
    narration: {
      look: "",
      hello: "I am Zahhak, a mighty sovereign, lord of throne and crown, whose name sends fear through the limbs of champions and whose command casts its shadow across the world.",
      world: "Within me dwells the ambition of kings and the nature of dragons. My heart finds no contentment in little, and my gaze never tires of beholding treasure and splendor.",
      day: "Two black serpents have taken their place upon my shoulders, as though the mark of the demon has struck roots within my flesh and the infernal realm has made its dwelling in the depths of my soul.",
      did: "The splendor I display before the world is enough to dazzle the eye, yet deep within my spirit rages a turmoil that no treasure can still and no fortune can tame.",
      others: "I am Zahhak, the dragon-shouldered king, exalted upon my throne yet stained with infamy; my dread may engulf the world, but my hunger knows no bounds.",
      maker: MAKER,
    },
    plates: { world: "s03", day: "s20", did: "s19", others: "s24" },
    portrait: { still: "s05", focus: [0, 40] },
    model: modelUrl("zahhak"),
  },
  {
    id: "silver-one",
    name: "Ahriman",
    role: "foe of glory and justice",
    mood: "dreamy",
    accent: [0.64, 0.16, 268],
    stageHue: { default: 265 },
    eyes: "bored",
    // Dead centre, perfectly symmetric, slightly far. A mirror sees straight on.
    eyeline: { height: 0.05, distance: 1.2, roll: 0, fov: 0.85, orbit: 0, aim: 0.55 },
    framing: { world: { orbit: 0 }, day: { orbit: 0 }, did: { orbit: 0 } },
    narration: {
      look: "",
      hello: "I am Ahriman, foe of divine glory and justice, ancient in malice and corrupt in nature, the hidden shadow that makes its dwelling in the deepest chambers of mortal hearts.",
      world: "I bear neither mace nor banner, summon no army, and raise no battle cry. My weapon is gentle speech, and my battlefield is the heart of those who hunger for power.",
      day: "Into the ears of sovereigns I whisper; before the eyes of champions I make the crooked path appear straight, and in the hearts of the unwise I sow the seeds of greed.",
      did: "I have no face by which mortals may know me. At times I appear as a friend; at others, clothed in the guise of a sage, until corruption reveals itself beneath the name of virtue.",
      others: "I am Ahriman, without crown or throne, yet ever beside kings; the dark force that, with a single whisper, can surrender divine glory to greed and justice to tyranny.",
      maker: MAKER,
    },
    plates: { world: "s17", day: "s16", did: "s21", others: "s15" },
    portrait: { still: "s22", focus: [0, 30] },
    model: modelUrl("eblis"),
  },
  {
    id: "masked-lady",
    name: "Arnavaz",
    role: "daughter of Jamshid",
    mood: "ceremonial",
    accent: [0.8, 0.13, 80],
    stageHue: { default: 70 },
    eyes: "bored",
    // Frontal, slightly high, composed like a portrait sitting.
    eyeline: { height: 0.3, distance: 1.0, roll: 0, fov: 0.9, orbit: -0.05, aim: 0.6 },
    narration: {
      look: "",
      hello: "I am Arnavaz, daughter of the glorious Jamshid, raised amid grace and splendor, born of royal blood and kin to the renowned.",
      world: "The lofty fortune of my forebears is mine, as is the noble essence of the freeborn. My worth cannot be measured by jewels, nor can my dignity be weighed against crown and throne.",
      day: "Wisdom shines upon my countenance, and the grace of the great resides in my speech. My silence is no sign of weakness, nor is my composure proof that I can be subdued.",
      did: "I am not among those women whose names the fierce winds of time can sweep from the memory of the world. Within me, the glory of lineage and the pride of the soul are woven together.",
      others: "I am Arnavaz, noble lady of an ancient court, free in spirit and proud in bearing; neither the turning heavens nor the ill-wishers of the world can diminish or erase my worth.",
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
