"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group } from "three";
import { TELLER_BY_ID, TELLER_IDS, castFor } from "@/shared/content/characters";
import { MOODS } from "@/shared/content/moods";
import type { CastSpot, TellerId } from "@/shared/content/types";
import { oklchToLinear } from "@/shared/lib/color";
import { TAU, clamp, damp, smootherstep } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { attachFloorClip, dimMaterials, type FloorClip } from "@/shared/puppets/kit/presence";
import { makeRigInputs, usePuppetRig } from "@/shared/puppets/rig/usePuppetRig";
import { useTellerPuppet } from "@/shared/puppets/rig/useTellerPuppet";
import type { RigInputs } from "@/shared/puppets/types";
import { useSeries, useUI } from "@/shared/state/store";

/**
 * The other tellers, standing upstage in the fog on the marks from `castFor(teller, chapter)`.
 * One puppet per OTHER teller. Only the first teller is built up front; the side characters are
 * procedural (no heavy assets) and warm up once the hero is on stage and the browser is idle, so they
 * stand in the background from chapter 01 on. Their plates/portraits stay lazy (requested on THE OTHERS).
 * They are built at "low" quality (they are small, dim, and far away), glide (damped) to new
 * marks with a walking gait instead of popping, look at the hero, and react a little to THE DAY.
 * Hidden in "look" and "maker".
 */

const WRAP = (a: number) => a - TAU * Math.round(a / TAU);
const DIM = 0.62;

export function Cast() {
  const teller = useSeries((s) => s.teller);
  const chapter = useSeries((s) => s.chapter);
  const requested = useSeries((s) => s.requested);
  const quality = useUI((s) => s.quality);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  // Warm up one side character per idle slot, not all at once: each build is synchronous
  // geometry, canvas painting and shader compiles, and five in a row is a visible hitch.
  const sceneReady = useSeries((s) => s.sceneReady);
  const [warm, setWarm] = useState(0);
  useEffect(() => {
    if (!sceneReady || warm >= TELLER_IDS.length) return;
    const next = () => setWarm((n) => n + 1);
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(next, { timeout: warm === 0 ? 2500 : 1500 });
      return () => w.cancelIdleCallback!(id);
    }
    const t = window.setTimeout(next, warm === 0 ? 1500 : 700);
    return () => window.clearTimeout(t);
  }, [sceneReady, warm]);

  const ids = useMemo(() => {
    const others = TELLER_IDS.filter((id) => id !== teller).filter((id, i) => i < warm || requested[id]);
    return quality === "low" ? others.slice(0, 3) : others;
  }, [teller, requested, quality, warm]);

  const hiddenChapter = chapter === "look" || chapter === "maker";
  const spots = useMemo(() => castFor(TELLER_BY_ID[teller], chapter), [teller, chapter]);

  return (
    <group name="cast">
      {ids.map((id) => (
        <CastMember key={id} id={id} spot={hiddenChapter ? null : (spots.find((s) => s.id === id) ?? null)} />
      ))}
    </group>
  );
}

interface Motion {
  x: number;
  z: number;
  rotY: number;
  scale: number;
  vis: number;
  stride: number;
  walk: number;
  placed: boolean;
}

function CastMember({ id, spot }: { id: TellerId; spot: CastSpot | null }) {
  const puppet = useTellerPuppet(id, { quality: "low" });
  const group = useRef<Group>(null);
  const clip = useRef<FloorClip | null>(null);
  const spotRef = useRef<CastSpot | null>(spot);
  spotRef.current = spot;
  const lastSpot = useRef<CastSpot | null>(spot);
  if (spot) lastSpot.current = spot;

  const m = useRef<Motion>({ x: 0, z: -6, rotY: 0, scale: 1, vis: 0, stride: 0, walk: 0, placed: false }).current;
  const mood = MOODS[TELLER_BY_ID[id].mood];
  const accent = useMemo(() => oklchToLinear(TELLER_BY_ID[id].accent), [id]);
  const inputs = useMemo<RigInputs>(() => {
    const i = makeRigInputs();
    i.hero = false;
    i.quality = "low";
    i.mood = mood;
    i.accent = accent;
    i.lookAt = runtime.hero.head; // shared vector, updated by Hero each frame
    return i;
  }, [mood, accent]);

  useEffect(() => {
    if (!puppet) return;
    dimMaterials(puppet.object, DIM);
    const c = attachFloorClip(puppet.object);
    clip.current = c;
    return () => {
      c.dispose();
      clip.current = null;
    };
  }, [puppet]);

  usePuppetRig(puppet, () => {
    const f = runtime.frame;
    const ui = useUI.getState();
    const s = spotRef.current ?? lastSpot.current;
    const dt = f.dt;
    const i = inputs;
    if (s) {
      const tx = s.pos[0];
      const tz = s.pos[1];
      if (!m.placed) {
        m.x = tx;
        m.z = tz;
        m.rotY = s.rotY ?? Math.atan2(f.hero.x - tx, f.hero.z - tz);
        m.scale = s.scale ?? 1;
        m.placed = true;
      }
      const px = m.x;
      const pz = m.z;
      m.x = damp(m.x, tx, 2.4, dt);
      m.z = damp(m.z, tz, 2.4, dt);
      const moved = Math.hypot(m.x - px, m.z - pz);
      const speed = dt > 0 ? moved / dt : 0;
      m.walk = damp(m.walk, clamp(speed / 0.45, 0, 1), 6, dt);
      m.stride += moved;
      const toHero = Math.atan2(f.hero.x - m.x, f.hero.z - m.z);
      let want = s.rotY ?? toHero;
      if (m.walk > 0.35 && moved > 1e-5) want = Math.atan2(m.x - px, m.z - pz); // face where you're going
      m.rotY += WRAP(want - m.rotY) * (1 - Math.exp(-5 * dt));
      m.scale = damp(m.scale, s.scale ?? 1, 3, dt);
    }
    i.x = 0;
    i.z = 0;
    i.rotY = m.rotY;
    i.walk = m.walk;
    i.stride = m.stride;
    // look at the hero; pupils lead the head
    const rel = WRAP(Math.atan2(f.hero.x - m.x, f.hero.z - m.z) - m.rotY);
    i.pupils.x = clamp(rel * 1.4, -1, 1);
    i.pupils.y = 0;
    i.anger = f.fx.day * 0.35;
    i.surprise = 0;
    i.talking = 0;
    i.wave = 0;
    i.frozen = ui.paused;
    return i;
  }, () => group.current?.visible === true);

  // Mark placement, rise / sink, visibility.
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const rdt = Math.min(delta, 1 / 20);
    m.vis = damp(m.vis, spot && puppet ? 1 : 0, 4.5, rdt);
    if (m.vis < 0.003) m.vis = 0;
    const visible = !!puppet && m.vis > 0.004;
    g.visible = visible;
    if (!visible || !puppet) return;
    const e = smootherstep(m.vis);
    const s = m.scale * (0.92 + 0.08 * e);
    g.scale.setScalar(s);
    g.position.set(m.x, -(1 - e) * puppet.height * 0.65 * m.scale, m.z);
    clip.current?.set(m.vis);
  }, -40);

  return <group ref={group}>{puppet ? <primitive object={puppet.object} /> : null}</group>;
}
