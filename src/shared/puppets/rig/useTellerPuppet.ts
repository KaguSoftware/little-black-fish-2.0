"use client";

import { useEffect, useState } from "react";
import type { Texture, TextureLoader } from "three";
import { TELLER_BY_ID } from "../../content/characters";
import { oklchToLinear } from "../../lib/color";
import { useSeries, useUI } from "../../state/store";
import { PUPPET_LOADERS } from "../registry";
import type { BuildOptions, Puppet } from "../types";
import type { TellerId } from "../../content/types";

/**
 * Loads (code-split) and builds the puppet for a teller. Builds ONE instance per call
 * site (the hero, each side character and the giant face are separate instances).
 * Returns null until built; disposes on unmount / id / quality change.
 *
 * Textures are cached app-wide and shared by every instance: builders must not dispose them.
 *
 * three.js itself is imported lazily (it arrives with the builder anyway), so a page that only
 * uses this hook, like the home page's eyes, doesn't put three in its first-load bundle.
 */

let three: typeof import("three") | null = null;
let loader: TextureLoader | null = null;
const texCache = new Map<string, Texture>();

async function loadThree() {
  if (!three) {
    three = await import("three");
    loader = new three.TextureLoader();
  }
}

/**
 * Cached texture loader for `BuildOptions.texture`. Colour maps are sRGB by default.
 * Only valid during a build (three is loaded by then).
 */
export function loadTexture(url: string, opts?: { srgb?: boolean; repeat?: [number, number] }): Texture {
  if (!three || !loader) throw new Error("loadTexture called before three.js was loaded");
  const { SRGBColorSpace, RepeatWrapping } = three;
  const srgb = opts?.srgb !== false;
  const key = `${url}|${srgb ? 1 : 0}|${opts?.repeat ? opts.repeat.join(",") : ""}`;
  let t = texCache.get(key);
  if (!t) {
    t = loader.load(url);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    if (opts?.repeat) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    texCache.set(key, t);
  }
  return t;
}

export function buildOptionsFor(id: TellerId, quality: "high" | "low"): BuildOptions {
  return { quality, texture: loadTexture, accent: oklchToLinear(TELLER_BY_ID[id].accent) };
}

/** Warm the code-split import (and the model, if the teller has one) before it's needed. */
export function preloadTeller(id: TellerId): void {
  const model = TELLER_BY_ID[id].model;
  if (model) {
    void import("./modelPuppet").catch(() => {});
    void import("./glbAdapter").then((m) => m.preloadGlb(model)).catch(() => {});
  } else {
    void PUPPET_LOADERS[id]().catch(() => {});
  }
}

async function buildTeller(id: TellerId, quality: "high" | "low"): Promise<Puppet> {
  const teller = TELLER_BY_ID[id];
  await loadThree();
  if (teller.model) {
    const [g, m] = await Promise.all([import("./glbAdapter"), import("./modelPuppet")]);
    const scene = await g.loadGlbScene(teller.model);
    return m.puppetFromModel(scene, id);
  }
  const mod = await PUPPET_LOADERS[id]();
  return mod.default(buildOptionsFor(id, quality));
}

export function useTellerPuppet(
  id: TellerId | null,
  opts?: { markReady?: boolean; quality?: "high" | "low" },
): Puppet | null {
  const uiQuality = useUI((s) => s.quality);
  const quality = opts?.quality ?? uiQuality;
  const markReady = !!opts?.markReady;
  const [state, setState] = useState<{ id: TellerId; quality: string; puppet: Puppet } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let built: Puppet | null = null;
    buildTeller(id, quality)
      .then((p) => {
        if (cancelled) {
          p.dispose();
          return;
        }
        built = p;
        setState({ id, quality, puppet: p });
        if (markReady) useSeries.getState().markReady(id);
      })
      .catch((err) => {
        console.error(`[puppet] failed to build ${id}`, err);
      });
    return () => {
      cancelled = true;
      if (built) {
        const b = built;
        // let React unmount the object before its resources go away
        setState((s) => (s && s.puppet === b ? null : s));
        setTimeout(() => b.dispose(), 160);
      }
    };
  }, [id, quality, markReady]);

  return state && state.id === id && state.quality === quality ? state.puppet : null;
}
