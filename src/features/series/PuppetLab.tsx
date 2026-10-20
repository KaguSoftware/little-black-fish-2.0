"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { ACESFilmicToneMapping, Color, Mesh, MeshBasicMaterial, SphereGeometry, SRGBColorSpace, Vector3 } from "three";
import { TELLERS, TELLER_BY_ID } from "@/shared/content/characters";
import { MOODS } from "@/shared/content/moods";
import { STILLS, stillCard } from "@/shared/content/stills";
import type { MoodId, TellerId } from "@/shared/content/types";
import { oklchCss, oklchToLinear } from "@/shared/lib/color";
import { TAU, clamp } from "@/shared/lib/math";
import { StageEnvironment } from "@/shared/puppets/kit/environment";
import { useGlbPuppet } from "@/shared/puppets/rig/glbAdapter";
import { makeRigInputs, usePuppetRig } from "@/shared/puppets/rig/usePuppetRig";
import { useTellerPuppet } from "@/shared/puppets/rig/useTellerPuppet";
import type { Puppet, RigInputs } from "@/shared/puppets/types";
import { useUI } from "@/shared/state/store";

/**
 * /dev/puppets: a review bench for the puppet builders. A turntable under the stage lighting
 * with the real rig controller attached, mood and expression toggles, the pointer driving
 * look-at and pupils, draw-call stats, and the reference stills beside it.
 */

type LabId = TellerId | "glb";
const GLB_URL = "/models/standin.glb";
const MOOD_IDS = Object.keys(MOODS) as MoodId[];
const GLB_ACCENT = [0.7, 0.1, 210] as const;

interface LabState {
  id: LabId;
  mood: MoodId | "auto";
  turntable: boolean;
  walk: boolean;
  wave: boolean;
  talking: boolean;
  anger: boolean;
  surprise: boolean;
  frozen: boolean;
  anchors: boolean;
}

const DEFAULTS: LabState = {
  id: "child",
  mood: "auto",
  turntable: false,
  walk: false,
  wave: false,
  talking: false,
  anger: false,
  surprise: false,
  frozen: false,
  anchors: false,
};

const subscribeNone = () => () => {};

function stateFromSearch(search: string): Partial<LabState> {
  const q = new URLSearchParams(search);
  const flag = (k: string) => q.get(k) === "1";
  const out: Partial<LabState> = {};
  const p = q.get("p");
  if (p === "glb" || TELLERS.some((t) => t.id === p)) out.id = p as LabId;
  const m = q.get("mood");
  if (m && (MOOD_IDS as string[]).includes(m)) out.mood = m as MoodId;
  for (const [param, key] of [
    ["turntable", "turntable"],
    ["walk", "walk"],
    ["wave", "wave"],
    ["talking", "talking"],
    ["anger", "anger"],
    ["surprise", "surprise"],
    ["freeze", "frozen"],
    ["anchors", "anchors"],
  ] as const) {
    if (flag(param)) out[key] = true;
  }
  return out;
}

export function PuppetLab() {
  const search = useSyncExternalStore(subscribeNone, () => window.location.search, () => "");
  const [edits, setEdits] = useState<Partial<LabState>>({});
  const s = useMemo<LabState>(() => ({ ...DEFAULTS, ...stateFromSearch(search), ...edits }), [search, edits]);
  const ref = useRef(s);
  ref.current = s;
  const quality = useUI((u) => u.quality);
  const setQuality = useUI((u) => u.setQuality);
  const reduced = useUI((u) => u.reducedMotion);
  const setReduced = useUI((u) => u.setReducedMotion);
  const [glbError, setGlbError] = useState(false);
  const stats = useRef<HTMLPreElement>(null);

  // Deep links for reviews and screenshots: ?p=elder&mood=angry&walk=1&wave=1&talking=1&anger=1&surprise=1
  // &turntable=1&freeze=1&anchors=1&low=1&reduced=1&cam=x,y,z[,tx,ty,tz]
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("low") === "1") useUI.getState().setQuality("low");
    if (q.get("reduced") === "1") useUI.getState().setReducedMotion(true);
  }, []);

  const set = <K extends keyof LabState>(k: K, v: LabState[K]) => setEdits((p) => ({ ...p, [k]: v }));
  const teller = s.id === "glb" ? null : TELLER_BY_ID[s.id];
  const accentLinear = useMemo(() => oklchToLinear(teller ? teller.accent : [0.7, 0.1, 210]), [teller]);
  const refs = STILLS.filter((st) => s.id !== "glb" && st.tellers.includes(s.id as TellerId));

  return (
    <div className="fixed inset-0 bg-[#0a0a0d] text-[13px] text-[#ece6da]">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.35, 4.6], fov: 34, near: 0.05, far: 80 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
          gl.localClippingEnabled = true;
        }}
      >
        <color attach="background" args={["#0a0a0d"]} />
        <fog attach="fog" args={["#0a0a0d", 10, 26]} />
        <StageEnvironment />
        <Lights accent={accentLinear} />
        <Floor />
        <Suspense fallback={null}>
          {s.id === "glb" ? (
            <Boundary key="glb" onError={() => setGlbError(true)}>
              <GlbLab lab={ref} />
            </Boundary>
          ) : (
            <TellerLab key={s.id} id={s.id} lab={ref} />
          )}
        </Suspense>
        <OrbitControls
          makeDefault
          target={[0, 0.95, 0]}
          enablePan={false}
          minDistance={1.2}
          maxDistance={10}
          maxPolarAngle={Math.PI * 0.52}
          autoRotate={s.turntable}
          autoRotateSpeed={1.1}
        />
        <CameraFromUrl />
        <StatsProbe out={stats} />
      </Canvas>

      <aside className="absolute bottom-0 left-0 top-0 w-72 space-y-5 overflow-y-auto border-r border-white/10 bg-black/55 p-4 backdrop-blur-md">
        <header>
          <h1 className="text-[15px] font-semibold tracking-tight">Puppet lab</h1>
          <p className="mt-1 text-[#a59f93]">Review bench for the six builds and the GLB adapter. Drag to orbit, wheel to zoom. The pointer drives look-at and pupils.</p>
        </header>

        <Group title="Puppet">
          <div className="grid gap-1">
            {TELLERS.map((t) => (
              <button
                key={t.id}
                onClick={() => set("id", t.id)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${s.id === t.id ? "bg-white/15" : "hover:bg-white/8"}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: oklchCss(t.accent) }} />
                <span>{t.role}</span>
                <span className="ml-auto text-[#a59f93]">{t.mood}</span>
              </button>
            ))}
            <button
              onClick={() => set("id", "glb")}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${s.id === "glb" ? "bg-white/15" : "hover:bg-white/8"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#9aa]" />
              <span>Cartoon GLB (adapter)</span>
            </button>
          </div>
          {glbError && s.id === "glb" ? <p className="mt-2 text-[#e8a089]">Could not load {GLB_URL}.</p> : null}
        </Group>

        <Group title="Mood">
          <select
            value={s.mood}
            onChange={(e) => set("mood", e.target.value as LabState["mood"])}
            className="w-full rounded bg-white/10 px-2 py-1.5 outline-none"
          >
            <option value="auto">auto ({teller ? teller.mood : "bouncy"})</option>
            {MOOD_IDS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Group>

        <Group title="Drive">
          <Toggle label="Turntable (orbit)" v={s.turntable} on={(v) => set("turntable", v)} />
          <Toggle label="Walk (circle)" v={s.walk} on={(v) => set("walk", v)} />
          <Toggle label="Wave" v={s.wave} on={(v) => set("wave", v)} />
          <Toggle label="Talking" v={s.talking} on={(v) => set("talking", v)} />
          <Toggle label="Anger (snaps)" v={s.anger} on={(v) => set("anger", v)} />
          <Toggle label="Surprise" v={s.surprise} on={(v) => set("surprise", v)} />
          <Toggle label="Freeze" v={s.frozen} on={(v) => set("frozen", v)} />
          <Toggle label="Show eye anchors" v={s.anchors} on={(v) => set("anchors", v)} />
        </Group>

        <Group title="Settings">
          <Toggle label="Low quality tier" v={quality === "low"} on={(v) => setQuality(v ? "low" : "high")} />
          <Toggle label="Reduced motion" v={reduced} on={setReduced} />
        </Group>

        <Group title="Renderer">
          <pre ref={stats} className="whitespace-pre-wrap font-mono text-[11px] text-[#a59f93]">…</pre>
        </Group>

        <Group title="Compare">
          {refs.length === 0 ? (
            <p className="text-[#a59f93]">{s.id === "glb" ? "No reference art for the stand-in." : "No stills list this teller."}</p>
          ) : (
            <div className="grid gap-3">
              {refs.map((st) => (
                <figure key={st.id} className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stillCard(st.id, 640)} alt={st.alt} loading="lazy" className="w-full rounded-sm bg-white/5" />
                  <figcaption className="mt-1 text-[11px] text-[#a59f93]">
                    {st.id} · {st.kind}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </Group>
      </aside>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#a59f93]">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1">
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="h-3.5 w-3.5 accent-[#9ad]" />
      <span>{label}</span>
    </label>
  );
}

// ── scene ───────────────────────────────────────────────────────────────────

function Lights({ accent }: { accent: readonly [number, number, number] }) {
  const rim = useMemo(() => new Color(accent[0], accent[1], accent[2]), [accent]);
  return (
    <>
      <hemisphereLight args={["#2a2a38", "#0a0a0d", 0.35]} />
      <spotLight position={[2.4, 5.6, 3.6]} angle={0.5} penumbra={0.9} intensity={110} decay={1.7} color="#fff1e0" />
      <spotLight position={[-3.2, 3.4, -3.6]} angle={0.7} penumbra={0.8} intensity={85} decay={1.6} color={rim} />
      <pointLight position={[3.5, 1.2, 3]} intensity={6} decay={2} color="#7d8fb0" />
    </>
  );
}

function Floor() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
        <circleGeometry args={[7, 64]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.82} metalness={0.15} />
      </mesh>
      {[0.5, 1.1].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position-y={0.001}>
          <ringGeometry args={[r - 0.004, r + 0.004, 96]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.07} />
        </mesh>
      ))}
    </group>
  );
}

function CameraFromUrl() {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls) as { target: Vector3; update(): void } | null;
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("cam");
    if (!c) return;
    const v = c.split(",").map(Number);
    if (v.length < 3 || v.some((n) => Number.isNaN(n))) return;
    camera.position.set(v[0], v[1], v[2]);
    if (controls && v.length >= 6) controls.target.set(v[3], v[4], v[5]);
    controls?.update();
  }, [camera, controls]);
  return null;
}

function StatsProbe({ out }: { out: RefObject<HTMLPreElement | null> }) {
  const { gl } = useThree();
  const n = useRef(0);
  useFrame(() => {
    if (++n.current % 20 !== 0 || !out.current) return;
    const i = gl.info;
    out.current.textContent = `draw calls ${i.render.calls}\ntriangles ${i.render.triangles.toLocaleString()}\ngeometries ${i.memory.geometries}\ntextures ${i.memory.textures}\nprograms ${i.programs?.length ?? 0}`;
  });
  useEffect(() => {
    gl.info.autoReset = true;
  }, [gl]);
  return null;
}

class Boundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[PuppetLab]", err);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type LabRef = { current: LabState };

function TellerLab({ id, lab }: { id: TellerId; lab: LabRef }) {
  const puppet = useTellerPuppet(id);
  return <LabRig puppet={puppet} lab={lab} fallbackMood={TELLER_BY_ID[id].mood} accent={TELLER_BY_ID[id].accent} />;
}

function GlbLab({ lab }: { lab: LabRef }) {
  const puppet = useGlbPuppet(GLB_URL);
  return <LabRig puppet={puppet} lab={lab} fallbackMood="bouncy" accent={GLB_ACCENT} />;
}

const _head = new Vector3();
const _ray = new Vector3();

function LabRig({
  puppet,
  lab,
  fallbackMood,
  accent,
}: {
  puppet: Puppet | null;
  lab: LabRef;
  fallbackMood: MoodId;
  accent: readonly [number, number, number];
}) {
  const accentLin = useMemo(() => oklchToLinear(accent), [accent]);
  const inputs = useMemo<RigInputs>(() => {
    const i = makeRigInputs();
    i.lookAt = new Vector3(0, 1.4, 3);
    i.accent = accentLin;
    return i;
  }, [accentLin]);
  const walkState = useRef({ angle: 0, stride: 0, amount: 0, rotY: 0, last: 0 }).current;
  const { camera, pointer } = useThree();
  const hover = useRef(false);

  useEffect(() => {
    const on = () => (hover.current = true);
    window.addEventListener("pointermove", on, { once: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);

  usePuppetRig(puppet, () => {
    const L = lab.current;
    const ui = useUI.getState();
    const i = inputs;
    const now = performance.now();
    const dt = walkState.last ? Math.min((now - walkState.last) / 1000, 1 / 20) : 0;
    walkState.last = now;
    const R = 1.1;
    const speed = 0.7;
    const k = 1 - Math.exp(-4 * dt);
    walkState.amount += ((L.walk ? 1 : 0) - walkState.amount) * k;
    if (L.walk && !L.frozen) {
      walkState.angle += (speed / R) * dt;
      walkState.stride += speed * dt;
    }
    const a = walkState.angle;
    const w = walkState.amount;
    // walk a circle; leaving it, drift back to the centre and turn to face the camera by the short way
    i.x = Math.sin(a) * R * w;
    i.z = Math.cos(a) * R * w;
    const wantYaw = L.walk ? a + Math.PI / 2 : TAU * Math.round(walkState.rotY / TAU);
    walkState.rotY += (wantYaw - walkState.rotY) * (L.walk ? 1 : 1 - Math.exp(-3 * dt));
    i.rotY = walkState.rotY;
    i.walk = w > 0.02 ? w : 0;
    i.stride = walkState.stride;
    i.mood = MOODS[L.mood === "auto" ? fallbackMood : L.mood];
    i.anger = L.anger ? 1 : 0;
    i.surprise = L.surprise ? 1 : 0;
    i.talking = L.talking ? 1 : 0;
    i.wave = L.wave ? 1 : 0;
    i.frozen = L.frozen;
    i.quality = ui.quality;

    // pointer -> a world point in front of the puppet along the camera ray
    const look = i.lookAt!;
    if (puppet) puppet.rig.head.getWorldPosition(_head);
    else _head.set(0, 1.5, 0);
    const dist = camera.position.distanceTo(_head) * 0.85;
    if (hover.current) {
      _ray.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize();
      look.copy(camera.position).addScaledVector(_ray, dist);
    } else {
      look.copy(camera.position);
    }
    const dx = look.x - _head.x;
    const dy = look.y - _head.y;
    const dz = look.z - _head.z;
    const rel = Math.atan2(dx, dz) - i.rotY;
    const relW = rel - TAU * Math.round(rel / TAU);
    i.pupils.x = clamp(relW * 1.4, -1, 1);
    i.pupils.y = clamp(-Math.atan2(dy, Math.hypot(dx, dz)) * 1.6, -1, 1);
    return i;
  });

  // optional debug dots at the eye anchors
  const showAnchors = lab.current.anchors;
  const dots = useMemo(() => {
    const g = new SphereGeometry(0.006, 8, 6);
    const mL = new MeshBasicMaterial({ color: "#ff4d4d", depthTest: false });
    const mR = new MeshBasicMaterial({ color: "#4dff88", depthTest: false });
    return { g, mL, mR, l: new Mesh(g, mL), r: new Mesh(g, mR) };
  }, []);
  useEffect(() => {
    if (!puppet || !showAnchors) return;
    dots.l.renderOrder = dots.r.renderOrder = 999;
    puppet.rig.eyeAnchorL.add(dots.l);
    puppet.rig.eyeAnchorR.add(dots.r);
    return () => {
      dots.l.removeFromParent();
      dots.r.removeFromParent();
    };
  }, [puppet, showAnchors, dots]);
  useEffect(
    () => () => {
      dots.g.dispose();
      dots.mL.dispose();
      dots.mR.dispose();
    },
    [dots],
  );

  return puppet ? <primitive object={puppet.object} /> : null;
}
