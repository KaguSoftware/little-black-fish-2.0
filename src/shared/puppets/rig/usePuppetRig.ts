"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Object3D, Vector3 } from "three";
import { useUI } from "../../state/store";
import { TAU, clamp, hash1, noise1, smoothstep } from "../../lib/math";
import { MOODS } from "../../content/moods";
import type { Puppet, PuppetFrameContext, RigInputs } from "../types";

/**
 * The ONE controller that animates every puppet (procedural builds and GLBs alike).
 * Call inside a component under <Canvas>. `getInputs` runs every frame (inside useFrame,
 * priority 0) and must not allocate. The controller itself allocates nothing per frame.
 *
 * Rig handles are written as REST + offset, so builders keep whatever rest pose they like.
 * Offsets given in metres are converted into each handle's parent-local units
 * (matters for GLBs whose nodes live under a scaled hierarchy).
 *
 * Design: weighty and slightly stylised, like a puppet theatre. Everything that moves has
 * a spring or critically-damped follower behind it, hands and head lag the body, and
 * every channel (blink, twitch, saccade, snap, chatter) runs on its own irregular timer.
 */

// ── tiny dynamics helpers (no allocation) ──────────────────────────────────

/** Critically damped follower (exact). `omega` ~ 1/seconds. */
class Damper {
  x = 0;
  v = 0;
  step(target: number, omega: number, dt: number): number {
    if (dt <= 0) return this.x;
    const d = this.x - target;
    const e = Math.exp(-omega * dt);
    const tmp = (this.v + omega * d) * dt;
    this.v = (this.v - omega * tmp) * e;
    this.x = target + (d + tmp) * e;
    return this.x;
  }
  snap(x: number): void {
    this.x = x;
    this.v = 0;
  }
}

/** Underdamped spring for follow-through. */
class Spring {
  x = 0;
  v = 0;
  step(target: number, k: number, c: number, dt: number): number {
    if (dt <= 0) return this.x;
    // sub-step so stiff springs stay stable at low frame rates
    const n = dt > 1 / 60 ? 2 : 1;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (k * (target - this.x) - c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

interface Rest {
  o: Object3D;
  px: number;
  py: number;
  pz: number;
  rx: number;
  ry: number;
  rz: number;
  sx: number;
  sy: number;
  sz: number;
  /** metres -> parent-local units */
  k: number;
}

const _v = new Vector3();
const _w = new Vector3();

function capture(o: Object3D | undefined, rootScale: number): Rest | null {
  if (!o) return null;
  let k = 1;
  if (o.parent) {
    o.parent.getWorldScale(_v);
    const ps = _v.y;
    if (ps > 1e-6) k = rootScale / ps;
  }
  return {
    o,
    px: o.position.x,
    py: o.position.y,
    pz: o.position.z,
    rx: o.rotation.x,
    ry: o.rotation.y,
    rz: o.rotation.z,
    sx: o.scale.x,
    sy: o.scale.y,
    sz: o.scale.z,
    k,
  };
}

function put(r: Rest | null, dx: number, dy: number, dz: number, rx: number, ry: number, rz: number): void {
  if (!r) return;
  r.o.position.set(r.px + dx * r.k, r.py + dy * r.k, r.pz + dz * r.k);
  r.o.rotation.set(r.rx + rx, r.ry + ry, r.rz + rz);
}

const wrapPi = (a: number) => a - TAU * Math.round(a / TAU);
const r01 = (n: number) => hash1(n) * 0.5 + 0.5;

class RigState {
  puppet: Puppet;
  seed = Math.random() * 100;
  init = true;
  t = 0;

  root: Rest | null;
  body: Rest | null;
  head: Rest | null;
  jaw: Rest | null;
  handL: Rest | null;
  handR: Rest | null;
  footL: Rest | null;
  footR: Rest | null;
  pupilL: Rest | null;
  pupilR: Rest | null;
  lidL: Rest | null;
  lidR: Rest | null;

  // envelopes
  walk = new Damper();
  anger = new Damper();
  surprise = new Damper();
  talk = new Damper();
  wave = new Damper();
  // head
  yaw = new Damper();
  pitch = new Damper();
  twYaw = new Damper();
  twPitch = new Damper();
  headLag = new Spring();
  bodyLag = new Spring();
  // eyes
  pupX = new Damper();
  pupY = new Damper();
  lid = new Damper();
  // jaw
  jawD = new Damper();
  // hands (x, y, z follow-through)
  hLx = new Spring();
  hLy = new Spring();
  hLz = new Spring();
  hRx = new Spring();
  hRy = new Spring();
  hRz = new Spring();
  // phases
  hopPhase = 0;
  hopPause = 0;
  hopsLeft = 3;
  spinPhase = 0;
  sylPhase = 0;
  // blink
  nextBlink = 1.5;
  blinkT = -1;
  blinkIdx = 0;
  doubleBlink = false;
  // twitch
  nextTwitch = 2;
  twEnd = 0;
  twIdx = 0;
  twSecond = false;
  twTargetYaw = 0;
  twTargetPitch = 0;
  // saccade
  nextSacc = 1;
  sacX = 0;
  sacY = 0;
  sacIdx = 0;
  // snap
  nextBurst = 0.4;
  burstLeft = 0;
  snapT = -1;
  snapEnv = 0;
  // metres the right hand must rise to wave at head height
  waveLift = 0.5;
  // squash impulse
  jolt = 0;
  prevY = 0;
  frames = 0;

  ctx: PuppetFrameContext;

  constructor(p: Puppet) {
    this.puppet = p;
    p.object.updateWorldMatrix(true, true);
    p.rig.root.getWorldScale(_w);
    const rs = Math.max(_w.y, 1e-6);
    const r = p.rig;
    this.root = capture(r.root, 1);
    this.body = capture(r.body, rs);
    this.head = capture(r.head, rs);
    this.jaw = capture(r.jaw, rs);
    this.handL = capture(r.handL, rs);
    this.handR = capture(r.handR, rs);
    this.footL = capture(r.footL, rs);
    this.footR = capture(r.footR, rs);
    this.pupilL = capture(r.pupilL, rs);
    this.pupilR = capture(r.pupilR, rs);
    this.lidL = capture(r.lidL, rs);
    this.lidR = capture(r.lidR, rs);
    // Euler order: yaw first, then pitch, then roll, so head/body turns are intuitive.
    for (const rest of [this.root, this.body, this.head]) {
      if (rest && Math.abs(rest.rx) + Math.abs(rest.ry) + Math.abs(rest.rz) < 1e-5) rest.o.rotation.order = "YXZ";
    }
    if (p.rig.handR) {
      p.rig.handR.getWorldPosition(_v);
      const baseY = p.object.getWorldPosition(_w).y;
      this.waveLift = Math.max(0.15 * p.height, 0.88 * p.height - (_v.y - baseY));
    }
    this.ctx = {
      time: 0,
      dt: 0,
      mood: undefined as unknown as PuppetFrameContext["mood"],
      walk: 0,
      gaitPhase: 0,
      anger: 0,
      surprise: 0,
      talking: 0,
      lookYaw: 0,
      lookPitch: 0,
      quality: "high",
      hero: true,
      accent: [1, 1, 1],
    };
  }
}

/** Smooth hold-and-release envelope for a blink, u in 0..1. */
function blinkEnv(u: number): number {
  if (u < 0.3) return smoothstep(0, 0.3, u);
  if (u < 0.42) return 1;
  return 1 - smoothstep(0.42, 1, u);
}

function drive(S: RigState, I: RigInputs, delta: number): void {
  const P = S.puppet;
  const L = P.limits;
  const mood = I.mood;
  const ui = useUI.getState();
  const reduced = ui.reducedMotion;
  const rm = reduced ? 0.4 : 1;
  const frozen = I.frozen;
  const dt = frozen ? 0 : Math.min(delta, 1 / 20);
  const h = P.height / 1.8; // proportions relative to a 1.8 m figure
  S.t += dt;
  const t = S.t;
  const first = S.init;
  if (first) {
    S.init = false;
    S.walk.snap(I.walk);
    S.anger.snap(I.anger);
    S.surprise.snap(I.surprise);
    S.talk.snap(I.talking);
    S.wave.snap(I.wave);
    S.nextBlink = 1 + r01(S.seed) * 3;
    S.nextTwitch = 1.5 + r01(S.seed + 3) * 2;
    S.nextSacc = 0.5 + r01(S.seed + 5);
    S.nextBurst = 0.3;
    S.hopPhase = r01(S.seed + 9) * 0.3;
  }

  // ── envelopes ────────────────────────────────────────────────────────────
  const walk = frozen ? I.walk : S.walk.step(I.walk, 7, dt);
  const anger = S.anger.step(I.anger, 6, dt);
  const surprise = S.surprise.step(I.surprise, 16, dt);
  const talk = S.talk.step(I.talking, 10, dt);
  const wave = S.wave.step(I.wave, 6, dt);

  // gait phase: one step = PI. Mood cadence scales the phase rate.
  const phase = (I.stride / Math.max(L.stride, 0.05)) * Math.PI * mood.gait;
  const quad = L.gait === "quadruped";

  // ── jolt: short impulse used for squash on snaps / twitches ──────────────
  S.jolt = Math.max(0, S.jolt - dt * 7);

  // ── root: hop, float, bob, spin, squash ──────────────────────────────────
  let hopY = 0;
  let scY = 1;
  if (!reduced && mood.hop > 0.001) {
    // hops come in little runs of 2-4 with a breather between, so the hero is lively but never frantic
    if (S.hopPause > 0) {
      S.hopPause -= dt;
      if (S.hopPause <= 0) S.hopsLeft = 2 + Math.floor(r01(S.t * 3.1 + S.seed) * 3);
    } else if (dt > 0) {
      const before = S.hopPhase % 1;
      S.hopPhase += dt * (1.1 + mood.swayHz * 0.55);
      if (S.hopPhase % 1 < before) {
        S.hopsLeft -= 1;
        if (S.hopsLeft <= 0) {
          S.hopPause = 0.8 + r01(S.t * 1.7 + S.seed) * 1.9;
          S.hopPhase = 0;
        }
      }
    }
    const u = S.hopPhase % 1;
    const air = 0.66;
    if (u < air) {
      const v = u / air;
      hopY = mood.hop * 4 * v * (1 - v) * (1 - 0.85 * walk);
      scY += mood.squash * 0.55 * Math.abs(1 - 2 * v) * Math.sqrt(Math.sin(Math.PI * v));
    } else {
      const w = (u - air) / (1 - air);
      scY -= mood.squash * Math.sin(Math.PI * w) * (1 - 0.6 * walk);
    }
  }
  if (!reduced && mood.squash > 0.001 && mood.hop <= 0.001) scY -= mood.squash * 0.5 * S.jolt;
  const floatY = mood.float > 0.001 ? mood.float * (0.85 + 0.15 * Math.sin(t * 0.9 + S.seed)) * (reduced ? 0.5 : 1) : 0;
  const bobAmp = (quad ? 0.02 : 0.024) * h;
  const bob = walk * bobAmp * Math.sin(phase) * Math.sin(phase);
  const rootY = hopY + floatY + bob;
  let spinYaw = 0;
  if (!reduced && mood.spin > 0.001) {
    S.spinPhase += dt * mood.spin * 4.4;
    spinYaw = Math.sin(S.spinPhase) * Math.min(0.75, mood.spin * 5.5);
  }
  const shiver = anger > 0.05 ? noise1(t * 26 + S.seed) * 0.012 * anger * rm : 0;
  const scXZ = 1 / Math.sqrt(Math.max(scY, 0.5));
  const rootYaw = I.rotY + spinYaw + shiver;
  if (S.root) {
    S.root.o.position.set(S.root.px + I.x, S.root.py + rootY, S.root.pz + I.z);
    S.root.o.rotation.set(S.root.rx, S.root.ry + rootYaw, S.root.rz);
    S.root.o.scale.set(S.root.sx * scXZ, S.root.sy * scY, S.root.sz * scXZ);
  }
  const vy = dt > 0 ? (rootY - S.prevY) / dt : 0;
  S.prevY = rootY;

  // ── head look-at ─────────────────────────────────────────────────────────
  let wantYaw = 0;
  let wantPitch = 0;
  if (I.lookAt && !frozen) {
    P.rig.head.getWorldPosition(_w);
    const dx = I.lookAt.x - _w.x;
    const dy = I.lookAt.y - _w.y;
    const dz = I.lookAt.z - _w.z;
    const rel = wrapPi(Math.atan2(dx, dz) - rootYaw);
    const behind = 1 - smoothstep(1.9, 2.7, Math.abs(rel));
    wantYaw = clamp(rel * 0.9, -L.headYaw, L.headYaw) * behind;
    wantPitch = clamp(Math.atan2(-dy, Math.hypot(dx, dz)) * 0.8, -L.headPitch, L.headPitch) * behind;
  }
  const lookW = 1 - walk * 0.65;
  wantYaw *= lookW;
  wantPitch *= lookW;
  // idle wander so a still head never looks pasted on
  const idleAmt = (I.lookAt ? 0.35 : 1) * rm;
  wantYaw += noise1(t * 0.23 + S.seed) * 0.07 * idleAmt;
  wantPitch += noise1(t * 0.31 + S.seed + 9) * 0.035 * idleAmt;

  // twitch: quick small jerks (skittish creature, angry king)
  const tw = reduced ? 0 : mood.twitch + anger * 0.25 + surprise * 0.2;
  if (tw > 0.01 && !frozen) {
    if (t >= S.nextTwitch) {
      const i = S.twIdx++;
      const a = hash1(i * 3.17 + S.seed);
      const b = hash1(i * 5.31 + S.seed + 2);
      S.twTargetYaw = a * 0.24 * Math.min(1, tw + 0.2);
      S.twTargetPitch = b * 0.13 * Math.min(1, tw + 0.2);
      S.twEnd = t + 0.1 + r01(i + S.seed) * 0.12;
      S.nextTwitch = t + (0.6 + r01(i * 2.1 + S.seed) * 2.6) / (0.25 + tw * 1.6);
      if (!S.twSecond && r01(i * 7.7 + S.seed) < 0.35) {
        S.twSecond = true;
        S.nextTwitch = S.twEnd + 0.1;
      } else {
        S.twSecond = false;
      }
      S.jolt = Math.max(S.jolt, 0.45);
      if (r01(i * 1.9 + S.seed) < 0.4) S.nextBlink = Math.min(S.nextBlink, t + 0.04);
    }
    if (t > S.twEnd) {
      S.twTargetYaw = 0;
      S.twTargetPitch = 0;
    }
  } else {
    S.twTargetYaw = 0;
    S.twTargetPitch = 0;
  }
  const twYaw = S.twYaw.step(S.twTargetYaw, 30, dt);
  const twPitch = S.twPitch.step(S.twTargetPitch, 30, dt);

  const headYaw = S.yaw.step(wantYaw, 8, dt);
  const headPitchLook = S.pitch.step(wantPitch, 8, dt);

  // ── jaw: chatter + anger snaps ───────────────────────────────────────────
  let snapOpen = 0;
  if (!frozen) {
    if (anger > 0.3) {
      if (S.snapT < 0 && S.burstLeft <= 0 && t >= S.nextBurst) {
        S.burstLeft = 2 + Math.floor(r01(t * 13.1 + S.seed) * 3);
        S.snapT = 0;
      }
      if (S.burstLeft > 0 && S.snapT < 0) S.snapT = 0;
    }
    if (S.snapT >= 0) {
      S.snapT += dt;
      const u = S.snapT;
      let env = 0;
      if (u < 0.06) env = u / 0.06;
      else if (u < 0.13) env = 1 - (u - 0.06) / 0.07;
      const justClosed = S.snapEnv > 0.5 && env <= 0.5;
      S.snapEnv = env;
      if (justClosed) S.jolt = Math.max(S.jolt, 0.75);
      if (u >= 0.2) {
        S.snapT = -1;
        S.burstLeft -= 1;
        if (S.burstLeft <= 0) {
          S.burstLeft = 0;
          S.nextBurst = t + (0.7 + r01(t * 3.7 + S.seed) * 1.3) / (0.4 + anger);
        } else {
          S.snapT = 0;
        }
        S.snapEnv = 0;
      }
    } else {
      S.snapEnv = 0;
    }
    if (anger <= 0.3) {
      S.snapT = -1;
      S.burstLeft = 0;
      S.snapEnv = 0;
    }
  }
  snapOpen = S.snapEnv * clamp((anger - 0.2) * 2.5, 0, 1);

  S.sylPhase += dt * TAU * (6 + 3 * (noise1(t * 0.8 + S.seed) * 0.5 + 0.5));
  const syl = Math.max(0, Math.sin(S.sylPhase));
  const gate = smoothstep(-0.55, 0.15, noise1(t * 2.3 + S.seed + 4));
  const amp = (0.38 + 0.25 * (noise1(t * 1.7 + S.seed + 11) * 0.5 + 0.5)) * (reduced ? 0.6 : 1);
  const chatter = talk * gate * syl * amp;
  const jawTarget = clamp(chatter + snapOpen * 0.95, 0, 1) * L.jawOpen;
  const jawOpen = S.jawD.step(jawTarget, S.snapT >= 0 ? 95 : 60, dt);

  // ── lids ─────────────────────────────────────────────────────────────────
  if (!frozen) {
    if (S.blinkT < 0 && t >= S.nextBlink) {
      S.blinkT = 0;
    }
    if (S.blinkT >= 0) {
      S.blinkT += dt / 0.15;
      if (S.blinkT >= 1) {
        S.blinkT = -1;
        S.blinkIdx++;
        if (!S.doubleBlink && r01(S.blinkIdx * 4.7 + S.seed) < 0.15) {
          S.doubleBlink = true;
          S.nextBlink = t + 0.16;
        } else {
          S.doubleBlink = false;
          S.nextBlink = t + 2.5 + r01(S.blinkIdx * 2.9 + S.seed) * 3.5;
        }
      }
    }
  }
  const blink = S.blinkT >= 0 ? blinkEnv(S.blinkT) * (1 - surprise * 0.9) : 0;
  const droop = Math.max(0, mood.slump) * L.lidClosed * 0.9;
  let lidBase = L.lidNeutral + droop;
  lidBase += (L.lidOpen - lidBase) * surprise;
  lidBase += (0.35 * L.lidClosed - lidBase) * anger * (1 - surprise);
  const lidS = S.lid.step(lidBase, 26, dt);
  const lidFinal = lidS + (L.lidClosed - lidS) * blink;

  // ── pupils ───────────────────────────────────────────────────────────────
  if (!frozen && t >= S.nextSacc) {
    const i = S.sacIdx++;
    S.sacX = hash1(i * 2.3 + S.seed) * 0.18;
    S.sacY = hash1(i * 3.9 + S.seed + 5) * 0.12;
    S.nextSacc = t + 0.5 + r01(i * 1.7 + S.seed) * 1.8;
  }
  const px = S.pupX.step(clamp(I.pupils.x, -1, 1) + S.sacX * rm, 14, dt);
  const py = S.pupY.step(clamp(I.pupils.y, -1, 1) + S.sacY * rm, 14, dt);

  // ── body ─────────────────────────────────────────────────────────────────
  const swayHz = mood.swayHz;
  const swayRoll =
    (Math.sin(t * TAU * swayHz + S.seed) * mood.sway + Math.sin(t * TAU * swayHz * 0.37 + S.seed * 2 + 1.7) * mood.sway * 0.5) * rm;
  const weightShift = walk * 0.045 * Math.cos(phase) * (quad ? 0.5 : 1);
  const tremor = anger > 0.05 ? noise1(t * 31 + S.seed + 3) * 0.008 * anger * rm : 0;
  const hopLagT = clamp(-vy * 0.35, -0.12, 0.12);
  const lag = S.bodyLag.step(hopLagT, 60, 9, dt);
  const talkNod = talk * Math.sin(S.sylPhase * 0.5) * 0.012;
  const bodyPitch =
    mood.slump * 0.4 + anger * 0.1 - surprise * 0.09 + walk * 0.035 + snapOpen * 0.09 + talkNod + lag * 0.5 +
    (quad ? Math.sin(phase * 2) * 0.02 * walk : 0);
  const bodyRoll = swayRoll + weightShift + tremor;
  const bodyYaw = headYaw * 0.22;
  const breathRate = 1.9 + anger * 0.9 + walk * 0.8;
  const breath = Math.sin(t * breathRate + S.seed) * (0.011 + anger * 0.008 + walk * 0.006);
  if (S.body) {
    put(S.body, 0, breath * 0.25 * h, 0, bodyPitch, bodyYaw, bodyRoll);
    S.body.o.scale.set(S.body.sx * (1 - breath * 0.35), S.body.sy * (1 + breath), S.body.sz * (1 - breath * 0.35));
  }

  // ── head ─────────────────────────────────────────────────────────────────
  const headLagP = S.headLag.step(hopLagT * 1.2, 80, 10, dt);
  const headPitch =
    headPitchLook + twPitch + mood.slump + anger * 0.08 - surprise * 0.1 + snapOpen * 0.12 + headLagP + talkNod * 1.5 +
    (quad ? Math.sin(phase * 2 + 0.6) * 0.05 * walk : 0);
  const headYawTot = headYaw - bodyYaw + twYaw;
  const headRoll = headYaw * 0.12 + swayRoll * 0.3 + (wave > 0.01 ? wave * 0.1 : 0) - bodyRoll * 0.4;
  put(S.head, 0, 0, 0, headPitch, headYawTot, headRoll);
  S.ctx.lookYaw = headYaw;
  S.ctx.lookPitch = headPitchLook;

  // ── eyes, jaw ────────────────────────────────────────────────────────────
  if (S.pupilL) S.pupilL.o.position.set(S.pupilL.px + px * L.pupil.x, S.pupilL.py + py * L.pupil.y, S.pupilL.pz);
  if (S.pupilR) S.pupilR.o.position.set(S.pupilR.px + px * L.pupil.x, S.pupilR.py + py * L.pupil.y, S.pupilR.pz);
  if (S.lidL) {
    S.lidL.o.rotation.set(S.lidL.rx + lidFinal, S.lidL.ry, S.lidL.rz);
  }
  if (S.lidR) {
    S.lidR.o.rotation.set(S.lidR.rx + lidFinal, S.lidR.ry, S.lidR.rz);
  }
  if (S.jaw) S.jaw.o.rotation.set(S.jaw.rx + jawOpen, S.jaw.ry, S.jaw.rz);

  // ── hands and feet ───────────────────────────────────────────────────────
  const stride = L.stride;
  const lift = (quad ? 0.07 : 0.085) * h;
  // feet (biped: L at phase, R opposite; quadruped trot: hindR with frontL)
  const phL = phase;
  const phR = phase + Math.PI;
  const swingZ = stride * 0.5 * walk;
  // idle weight shift so standing feet are not dead
  const idleShift = (1 - walk) * Math.sin(t * 0.5 + S.seed) * 0.008 * h * rm;
  if (S.footL) {
    const sl = Math.sin(quad ? phR : phL);
    const cl = Math.cos(quad ? phR : phL);
    put(S.footL, idleShift, Math.max(0, sl) * lift * walk, -cl * swingZ, -Math.max(0, sl) * 0.3 * walk, 0, 0);
  }
  if (S.footR) {
    const sr = Math.sin(quad ? phL : phR);
    const cr = Math.cos(quad ? phL : phR);
    put(S.footR, -idleShift, Math.max(0, sr) * lift * walk, -cr * swingZ, -Math.max(0, sr) * 0.3 * walk, 0, 0);
  }

  // hands: counter-swing + talk gestures + wave + reactions, fed through springs for follow-through
  const gesture = talk * (reduced ? 0.5 : 1);
  for (let side = 0; side < 2; side++) {
    const rest = side === 0 ? S.handL : S.handR;
    if (!rest) continue;
    const sgn = side === 0 ? 1 : -1;
    const ph = quad ? (side === 0 ? phL : phR) : side === 0 ? phR : phL; // biped hands oppose same-side foot
    const swing = Math.cos(ph) * (quad ? stride * 0.5 : stride * 0.32) * walk;
    const liftH = quad ? Math.max(0, Math.sin(ph)) * lift * walk : Math.abs(Math.sin(ph)) * 0.012 * h * walk;
    const idle = Math.sin(t * 1.7 + (side ? 1.9 : 0) + S.seed) * 0.011 * h + breath * 0.5 * h;
    const gx = gesture * (noise1(t * 2.1 + side * 7 + S.seed) * 0.5 + 0.35) * 0.03 * h;
    const gy = gesture * (noise1(t * 1.6 + side * 3 + S.seed + 2) * 0.5 + 0.5) * 0.06 * h;
    const gz = gesture * noise1(t * 1.9 + side * 5 + S.seed + 6) * 0.04 * h;
    const trem = anger * noise1(t * 38 + side * 11 + S.seed) * 0.007 * h * rm;
    let tx = sgn * (anger * 0.05 * h + surprise * 0.06 * h) + gx * sgn - bodyRoll * 0.25 * h + trem;
    let ty = idle + liftH + gy + anger * 0.07 * h + surprise * 0.09 * h - vy * 0.045 * h;
    let tz = -swing + gz + anger * 0.04 * h;
    let rz = 0;
    if (side === 1 && wave > 0.001) {
      // right hand up and waving (quadruped: lift the front leg a little)
      const osc = Math.sin(t * TAU * 2.4);
      ty += wave * (quad ? 0.22 * h : S.waveLift);
      tx += wave * (sgn * 0.05 * h + osc * 0.065 * h);
      tz += wave * 0.04 * h;
      rz = wave * osc * 0.55;
    }
    const sx = side === 0 ? S.hLx : S.hRx;
    const sy = side === 0 ? S.hLy : S.hRy;
    const sz = side === 0 ? S.hLz : S.hRz;
    const kk = wave > 0.05 && side === 1 ? 120 : 52;
    const cc = wave > 0.05 && side === 1 ? 14 : 7.5;
    const ox = sx.step(tx, kk, cc, dt);
    const oy = sy.step(ty, kk, cc, dt);
    const oz = sz.step(tz, kk, cc, dt);
    put(rest, ox, oy, oz, 0, 0, rz);
  }

  // ── frame context for secondary motion ───────────────────────────────────
  const c = S.ctx;
  c.time = t;
  c.dt = dt;
  c.mood = mood;
  c.walk = walk;
  c.gaitPhase = phase;
  c.anger = anger;
  c.surprise = surprise;
  c.talking = talk;
  c.quality = I.quality;
  c.hero = I.hero;
  c.accent = I.accent;
  P.update(c);

  S.frames++;
}

/**
 * Attach the shared controller to a puppet. `puppet` may be null while loading.
 * `getInputs` is called once per frame and must return a stable, mutated-in-place object.
 * `isActive`, when given, is checked first each frame: while it returns false the puppet is
 * not driven at all (no rig, no secondary motion, no buffer uploads). Use it for puppets that
 * are built but hidden; it runs after any negative-priority visibility frame callbacks.
 */
export function usePuppetRig(puppet: Puppet | null, getInputs: () => RigInputs, isActive?: () => boolean): void {
  const state = useRef<RigState | null>(null);
  useFrame((_, delta) => {
    if (!puppet) {
      state.current = null;
      return;
    }
    if (isActive && !isActive()) return;
    let S = state.current;
    if (!S || S.puppet !== puppet) {
      S = new RigState(puppet);
      state.current = S;
    }
    drive(S, getInputs(), delta);
  });
}

/** A fresh, neutral RigInputs object to mutate in place every frame (callers keep it in a ref). */
export function makeRigInputs(): RigInputs {
  return {
    x: 0,
    z: 0,
    rotY: 0,
    walk: 0,
    stride: 0,
    lookAt: null,
    pupils: { x: 0, y: 0 },
    surprise: 0,
    anger: 0,
    talking: 0,
    wave: 0,
    mood: MOODS.bouncy,
    hero: true,
    frozen: false,
    quality: "high",
    accent: [1, 1, 1],
  };
}
