"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Vector3 } from "three";
import { TELLER_IDS } from "@/shared/content/characters";
import type { TellerId } from "@/shared/content/types";
import { bell, clamp, damp, smootherstep, smoothstep } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { attachFloorClip, type FloorClip } from "@/shared/puppets/kit/presence";
import { makeRigInputs, usePuppetRig } from "@/shared/puppets/rig/usePuppetRig";
import { preloadTeller, useTellerPuppet } from "@/shared/puppets/rig/useTellerPuppet";
import type { RigInputs } from "@/shared/puppets/types";
import { useSeries, useUI } from "@/shared/state/store";

/**
 * The hero: the current teller's puppet, standing on the hero mark from `runtime.frame.hero`.
 *
 * Teller switches are a 0.9 s presence crossfade ON THE SAME MARK: the outgoing puppet sinks
 * into the stage floor (clipped at y = 0) and shrinks to 0.92 while the incoming one rises.
 * If the incoming puppet is still loading, the outgoing one stays until it is built.
 *
 * Per frame (all allocation-free) this component derives RigInputs from runtime.frame and the
 * pointer, drives usePuppetRig for every visible puppet, and publishes the hero's eye / head /
 * waist world positions plus the eyes' NDC position to `runtime.hero`.
 */

const BLEND_K = 5.1; // matches the director's teller blend (~0.9 s)
const PLANE_Z = 1.5;

interface Shared {
  look: Vector3;
  wander: Vector3;
  pointerPt: Vector3;
  pointerMix: number;
  pupils: { x: number; y: number };
  surprise: number;
  anger: number;
  talking: number;
  wave: number;
}

interface Ctl {
  presence: Record<TellerId, number>;
  built: Partial<Record<TellerId, boolean>>;
  primary: TellerId | null;
  lastReady: TellerId | null;
  mask: number;
  sceneReadySent: boolean;
}

const zeroPresence = () => Object.fromEntries(TELLER_IDS.map((id) => [id, 0])) as Record<TellerId, number>;

const _ray = new Vector3();
const _a = new Vector3();
const _b = new Vector3();

export function Hero() {
  const teller = useSeries((s) => s.teller);
  const requested = useSeries((s) => s.requested);
  const gl = useThree((s) => s.gl);
  const [, setTick] = useState(0);

  const ctl = useRef<Ctl>({
    presence: zeroPresence(),
    built: {},
    primary: null,
    lastReady: null,
    mask: 0,
    sceneReadySent: false,
  }).current;
  const shared = useMemo<Shared>(
    () => ({
      look: new Vector3(0, 1.4, 3),
      wander: new Vector3(),
      pointerPt: new Vector3(),
      pointerMix: 0,
      pupils: { x: 0, y: 0 },
      surprise: 0,
      anger: 0,
      talking: 0,
      wave: 0,
    }),
    [],
  );

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  // Warm code-split builders for everything that has been requested.
  useEffect(() => {
    for (const id of TELLER_IDS) if (requested[id]) preloadTeller(id);
  }, [requested]);

  // Presence crossfade + shared inputs. Priority -50: after the director (-100), before every controller (0).
  useFrame((state, delta) => {
    const f = runtime.frame;
    const series = useSeries.getState();
    const rdt = Math.min(delta, 1 / 20);
    const target = series.teller;

    // who is "on the mark"? the target once built, otherwise whoever was last on it
    if (ctl.built[target]) ctl.lastReady = target;
    const primary = ctl.built[target] ? target : ctl.lastReady;
    if (primary !== ctl.primary) {
      // first puppet ever (or nothing else visible): appear instantly
      let others = 0;
      for (const id of TELLER_IDS) if (id !== primary) others += ctl.presence[id];
      if (primary && others < 0.02) ctl.presence[primary] = 1;
      ctl.primary = primary;
    }
    let mask = 0;
    for (let i = 0; i < TELLER_IDS.length; i++) {
      const id = TELLER_IDS[i];
      ctl.presence[id] = damp(ctl.presence[id], id === primary ? 1 : 0, BLEND_K, rdt);
      if (ctl.presence[id] < 0.002) ctl.presence[id] = 0;
      if (ctl.presence[id] > 0.004 || id === target) mask |= 1 << i;
    }
    if (mask !== ctl.mask) {
      ctl.mask = mask;
      setTick((n) => n + 1);
    }

    // ── shared rig inputs ───────────────────────────────────────────────────
    const cam = state.camera;
    const ptr = runtime.pointer;
    const eyes = runtime.hero.eyesNdc;
    const r = f.r;
    const tw = f.time;
    shared.pointerMix = damp(shared.pointerMix, ptr.active ? 1 : 0, 2.5, rdt);

    // a slow wander so an idle hero is still watchable
    shared.wander.set(
      f.hero.x + Math.sin(tw * 0.37) * 1.1 + Math.sin(tw * 0.91 + 1.3) * 0.3,
      1.45 + Math.sin(tw * 0.53 + 1) * 0.35,
      PLANE_Z,
    );
    // pointer ray -> plane z = PLANE_Z (in front of the hero)
    _ray.set(ptr.x, ptr.y, 0.5).unproject(cam).sub(cam.position).normalize();
    if (Math.abs(_ray.z) > 1e-4 && (PLANE_Z - cam.position.z) / _ray.z > 0) {
      shared.pointerPt.copy(cam.position).addScaledVector(_ray, (PLANE_Z - cam.position.z) / _ray.z);
    } else {
      shared.pointerPt.set(f.hero.x, 1.5, PLANE_Z);
    }
    if (r.chapter === "look" || r.chapter === "hello") {
      // the hero looks at us
      shared.look.copy(cam.position);
    } else {
      shared.look.lerpVectors(shared.wander, shared.pointerPt, shared.pointerMix);
    }

    // pupils follow the cursor relative to the eyes on screen; wander when idle
    const pdx = clamp((ptr.x - eyes.x) * 1.8, -1, 1);
    const pdy = clamp((ptr.y - eyes.y) * 1.8, -1, 1);
    const wx = Math.sin(tw * 0.7) * 0.6;
    const wy = Math.sin(tw * 0.5 + 2) * 0.4;
    shared.pupils.x = wx + (pdx - wx) * shared.pointerMix;
    shared.pupils.y = wy + (pdy - wy) * shared.pointerMix;

    // LOOK CLOSER: the eyes widen as the cursor nears them
    let surprise = 0;
    if (r.chapter === "look" && f.fx.closeUp > 0.5 && ptr.active) {
      const d = Math.hypot(ptr.x - eyes.x, ptr.y - eyes.y);
      const outer = Math.max(0.18, eyes.radius * 1.3);
      surprise = 1 - smoothstep(outer * 0.35, outer, d);
    }
    // arriving on a teller switch: a quick startled blink of the eyes
    const since = performance.now() - series.switchedAt;
    if (series.switchedAt > 0 && since < 700) surprise = Math.max(surprise, 0.7 * (1 - smoothstep(0, 700, since)));
    shared.surprise = surprise;
    shared.anger = f.fx.day;
    shared.talking = f.fx.talking;
    shared.wave =
      r.segment.kind === "hold" && r.chapter === "hello" ? bell(r.holdT, 0.4) : 0;
  }, -50);

  const ids = TELLER_IDS.filter((id) => id === teller || ctl.presence[id] > 0.004);
  return (
    <group name="hero">
      {ids.map((id) => (
        <HeroPuppet key={id} id={id} shared={shared} ctl={ctl} />
      ))}
    </group>
  );
}

function HeroPuppet({ id, shared, ctl }: { id: TellerId; shared: Shared; ctl: Ctl }) {
  const puppet = useTellerPuppet(id, { markReady: true });
  const group = useRef<Group>(null);
  const clip = useRef<FloorClip | null>(null);
  const inputs = useMemo<RigInputs>(() => {
    const i = makeRigInputs();
    i.lookAt = shared.look;
    i.hero = true;
    return i;
  }, [shared]);
  const frames = useRef(0);

  useEffect(() => {
    if (!puppet) return;
    ctl.built[id] = true;
    const c = attachFloorClip(puppet.object);
    clip.current = c;
    frames.current = 0;
    return () => {
      ctl.built[id] = false;
      c.dispose();
      clip.current = null;
    };
  }, [puppet, ctl, id]);

  usePuppetRig(puppet, () => {
    const f = runtime.frame;
    const ui = useUI.getState();
    const i = inputs;
    i.x = f.hero.x;
    i.z = f.hero.z;
    i.rotY = f.hero.rotY;
    i.walk = f.hero.walk;
    i.stride = f.hero.stride;
    i.pupils.x = shared.pupils.x;
    i.pupils.y = shared.pupils.y;
    i.surprise = shared.surprise;
    i.anger = shared.anger;
    i.talking = shared.talking;
    i.wave = shared.wave;
    i.mood = f.mood;
    i.frozen = ui.paused;
    i.quality = ui.quality;
    i.accent = f.accent;
    return i;
  });

  // Sink / rise on the mark (priority -40: after the presence update, before the controller).
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = ctl.presence[id];
    const visible = !!puppet && p > 0.004;
    g.visible = visible;
    if (!visible || !puppet) return;
    const e = smootherstep(p);
    const s = 0.92 + 0.08 * e;
    const f = runtime.frame.hero;
    g.scale.setScalar(s);
    g.position.set(f.x * (1 - s), -(1 - e) * puppet.height * 0.65, f.z * (1 - s));
    clip.current?.set(p);
  }, -40);

  // Publish anchors (only the puppet that is on the mark right now). Runs right after the controller.
  useFrame((state) => {
    if (!puppet || ctl.primary !== id) return;
    const rig = puppet.rig;
    const hero = runtime.hero;
    rig.eyeAnchorL.getWorldPosition(hero.eyeL);
    rig.eyeAnchorR.getWorldPosition(hero.eyeR);
    rig.head.getWorldPosition(hero.head);
    const root = rig.root;
    hero.waist.set(
      root.position.x,
      root.position.y + puppet.waistY * root.scale.y + (group.current?.position.y ?? 0),
      root.position.z,
    );
    const cam = state.camera;
    _a.copy(hero.eyeL).project(cam);
    _b.copy(hero.eyeR).project(cam);
    hero.eyesNdc.x = (_a.x + _b.x) * 0.5;
    hero.eyesNdc.y = (_a.y + _b.y) * 0.5;
    hero.eyesNdc.radius = Math.max(0.05, Math.hypot(_a.x - _b.x, _a.y - _b.y) * 1.2 + 0.04);
    frames.current++;
    if (frames.current === 3 && !ctl.sceneReadySent) {
      ctl.sceneReadySent = true;
      useSeries.getState().setSceneReady(true);
    }
  });

  return <group ref={group}>{puppet ? <primitive object={puppet.object} /> : null}</group>;
}
