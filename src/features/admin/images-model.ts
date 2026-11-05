/**
 * Pure helpers behind the Images section: how a "slot" (one replaceable picture) is read from and
 * written to site_settings, the built-in pictures it falls back to, and which files a change frees.
 * No React, no I/O.
 */
import { REEL_STILL, WALL_ORDER, FRAMING, ARCHIVE_STILL } from "@/shared/content/wall";
import { TELLER_BY_ID, tellerPortrait } from "@/shared/content/characters";
import { stillCard, stillPlate } from "@/shared/content/stills";
import { isSupabaseStorageUrl, type Bucket } from "@/shared/data/storage";
import { PLATE_CHAPTERS, type ChapterPlates, type SettingKey, type Settings, type TellerLook, type WallImage } from "@/shared/data/settingsSchema";
import type { TellerId } from "@/shared/content/types";

export type PlateChapter = (typeof PLATE_CHAPTERS)[number];
export type Focus = [number, number];

/** "voice:<id>:portrait" | "voice:<id>:reel" | "voice:<id>:plate:<chapter>" | "archive:pinned" | "seo:og" | "team:<memberId>" */
export type SlotId = string;

export interface SlotValue {
  /** Custom picture, "" when the built-in one is used. */
  src: string;
  focus: Focus | null;
  alt: string;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function readSlot(s: Settings, id: SlotId): SlotValue {
  const p = id.split(":");
  if (p[0] === "voice") {
    const look: TellerLook = s.tellers[p[1]] ?? {};
    if (p[2] === "portrait") return { src: look.portrait ?? "", focus: look.focus ?? null, alt: "" };
    if (p[2] === "reel") return { src: look.reel ?? "", focus: null, alt: "" };
    if (p[2] === "plate") return { src: look.plates?.[p[3] as PlateChapter] ?? "", focus: null, alt: "" };
  }
  if (id === "archive:pinned") return { src: s.archive.pinnedImage, focus: s.archive.pinnedFocus ?? null, alt: s.archive.pinnedAlt ?? "" };
  if (id === "seo:og") return { src: s.seo.ogImage, focus: null, alt: "" };
  if (p[0] === "team") return { src: "", focus: s.teamFocus[p.slice(1).join(":")] ?? null, alt: "" };
  return { src: "", focus: null, alt: "" };
}

/** The settings row to save to apply `patch` to the slot. */
export function writeSlot(s: Settings, id: SlotId, patch: Partial<SlotValue>): { key: SettingKey; value: Settings[SettingKey] } | null {
  const p = id.split(":");
  if (p[0] === "voice" && p[1]) {
    const tellers = structuredClone(s.tellers);
    const look: TellerLook = { ...(tellers[p[1]] ?? {}) };
    if (p[2] === "portrait") {
      if (patch.src !== undefined) {
        if (patch.src) look.portrait = patch.src;
        else delete look.portrait;
      }
      if (patch.focus !== undefined) {
        if (patch.focus) look.focus = patch.focus;
        else delete look.focus;
      }
    } else if (p[2] === "reel") {
      if (patch.src) look.reel = patch.src;
      else delete look.reel;
    } else if (p[2] === "plate") {
      const plates: ChapterPlates = { ...(look.plates ?? {}) };
      if (patch.src) plates[p[3] as PlateChapter] = patch.src;
      else delete plates[p[3] as PlateChapter];
      if (Object.keys(plates).length) look.plates = plates;
      else delete look.plates;
    } else return null;
    if (Object.keys(look).length) tellers[p[1]] = look;
    else delete tellers[p[1]];
    return { key: "tellers", value: tellers };
  }
  if (id === "archive:pinned") {
    const a = { ...s.archive };
    if (patch.src !== undefined) {
      a.pinnedImage = patch.src;
      if (!patch.src) {
        delete a.pinnedFocus;
        delete a.pinnedAlt;
      }
    }
    if (patch.focus !== undefined) {
      if (patch.focus) a.pinnedFocus = patch.focus;
      else delete a.pinnedFocus;
    }
    if (patch.alt !== undefined) {
      if (patch.alt) a.pinnedAlt = patch.alt;
      else delete a.pinnedAlt;
    }
    return { key: "archive", value: a };
  }
  if (id === "seo:og") return { key: "seo", value: { ...s.seo, ogImage: patch.src ?? s.seo.ogImage } };
  if (p[0] === "team") {
    const memberId = p.slice(1).join(":");
    const tf = { ...s.teamFocus };
    if (patch.focus) tf[memberId] = patch.focus;
    else delete tf[memberId];
    return { key: "teamFocus", value: tf };
  }
  return null;
}

/** The built-in picture a slot shows when nothing is customised (null: nothing is built in). */
export function builtInOf(id: SlotId): string | null {
  const p = id.split(":");
  if (p[0] === "voice") {
    const tid = p[1] as TellerId;
    if (p[2] === "portrait") return tellerPortrait(tid);
    if (p[2] === "reel") return stillCard(REEL_STILL[tid], 640);
    if (p[2] === "plate") {
      const still = TELLER_BY_ID[tid]?.plates[p[3] as PlateChapter];
      return still ? stillPlate(still as Parameters<typeof stillPlate>[0]) : null;
    }
  }
  if (id === "archive:pinned") return stillCard(ARCHIVE_STILL, 640);
  return null;
}

/** The built-in wall as an editable list (same pictures, same framing as the code). */
export const WALL_SEED: WallImage[] = WALL_ORDER.map((id) => {
  const f = FRAMING[id];
  const w: WallImage = { src: stillPlate(id), focus: [round((f?.x ?? 0.5) * 100), round((f?.y ?? 0.5) * 100)] };
  if (f?.zoom) w.zoom = f.zoom;
  return w;
});

/** Storage URLs inside any settings value (for "is this file free now?"). */
export function storageUrls(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (isSupabaseStorageUrl(value)) out.add(value);
  } else if (Array.isArray(value)) value.forEach((v) => storageUrls(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => storageUrls(v, out));
  return out;
}

export function bucketOf(url: string): Bucket | null {
  if (url.includes("/object/public/projects/")) return "projects";
  if (url.includes("/object/public/hero/")) return "hero";
  return null;
}

/** File name of a media URL, without the upload id prefix, for default titles. */
export function fileTitle(url: string): string {
  const last = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
  const noExt = last.replace(/\.[a-z0-9]+$/i, "");
  const clean = noExt.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "").replace(/[_-]+/g, " ").trim();
  return (clean || "Film").slice(0, 120);
}

export const SAME = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
