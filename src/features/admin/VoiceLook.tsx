"use client";

import { useId, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import type { Oklch } from "@/shared/content/types";
import { DEFAULT_FOCUS, CUSTOM_FOCUS } from "@/shared/content/roster";
import { Upload } from "./Upload";

/** Editable look of one voice (site_settings "tellers"). null = built-in default. */
export interface LookState {
  portrait: string;
  focus: [number, number] | null;
  accent: Oklch | null;
  stageHue: number | null;
}

const css = `
.vl{display:grid;gap:1.4rem}
.vl-row{display:grid;gap:1rem 1.5rem}
@media (min-width:40rem){.vl-row{grid-template-columns:minmax(0,15rem) minmax(0,1fr)}}
.vl-pick{position:relative;display:block;width:100%;max-width:12rem;aspect-ratio:3/4;overflow:hidden;cursor:crosshair;border:1px solid var(--hairline);background:var(--stage-deep,#000);touch-action:none}
.vl-pick img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;user-select:none}
.vl-dot{position:absolute;width:1.1rem;height:1.1rem;margin:-.55rem 0 0 -.55rem;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #000,0 0 0 3px rgba(0,0,0,.35);pointer-events:none}
.vl-crops{display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-end}
.vl-crop{display:grid;gap:.3rem;justify-items:center;font-size:var(--step--1);color:var(--ink-dim)}
.vl-crop img{display:block;object-fit:cover;background:var(--stage-deep,#000)}
.vl-ranges{display:grid;gap:.6rem}
.vl-range{display:grid;grid-template-columns:7rem 1fr 3.4rem;gap:.7rem;align-items:center;font-size:var(--step--1);color:var(--ink-dim)}
.vl-range input[type=range]{width:100%;accent-color:var(--accent)}
.vl-range output{font-variant-numeric:tabular-nums;text-align:end;color:var(--ink)}
.vl-swatch{width:3rem;height:3rem;border-radius:50%;border:1px solid var(--hairline);flex:none}
.vl-head{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
.vl-tag{font-size:var(--step--1);color:var(--ink-mute)}
`;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const oklch = (c: readonly number[]) => `oklch(${c[0]} ${c[1]} ${c[2]})`;
const pct = (n: number) => Math.round(n * 10) / 10;
const HUES = [0, 60, 120, 180, 240, 300, 360];

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  track,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  track?: string;
}) {
  const id = useId();
  return (
    <div className="vl-range">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        style={track ? { background: track, height: "0.7rem", borderRadius: "0.4rem", appearance: "none" } : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id}>{format ? format(value) : value}</output>
    </div>
  );
}

export function VoiceLookEditor({
  value,
  onChange,
  defaults,
  portraitDefault,
}: {
  value: LookState;
  onChange: (next: LookState) => void;
  defaults: { accent: Oklch; stageHue: number };
  portraitDefault: string;
}) {
  const t = useTranslations("admin");
  const src = value.portrait || portraitDefault;
  const focus = value.focus ?? (value.portrait ? CUSTOM_FOCUS : DEFAULT_FOCUS);
  const pos = `${focus[0]}% ${focus[1]}%`;
  const set = (p: Partial<LookState>) => onChange({ ...value, ...p });
  const setFocus = (x: number, y: number) => set({ focus: [pct(clamp(x, 0, 100)), pct(clamp(y, 0, 100))] });
  const onPick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    setFocus(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  };
  const acc = value.accent ?? defaults.accent;
  const setAcc = (i: 0 | 1 | 2, v: number) => {
    const n: [number, number, number] = [acc[0], acc[1], acc[2]];
    n[i] = Math.round(v * 1000) / 1000;
    set({ accent: n });
  };
  const hue = value.stageHue ?? defaults.stageHue;

  return (
    <div className="vl">
      <style>{css}</style>
      <div>
        <p className="adm-group-title">{t("series.look.title")}</p>
        <p className="adm-hint-line">{t("series.look.hint")}</p>
      </div>

      <div className="vl-row">
        <div>
          <Upload
            bucket="projects"
            imagesOnly
            label={t("series.look.portrait")}
            hint={t("series.look.portraitHint")}
            value={value.portrait}
            onChange={(url) => set({ portrait: url.trim() })}
          />
          {!value.portrait && <p className="adm-hint-line">{t("series.look.builtInPortrait")}</p>}
        </div>
        <div className="vl-ranges">
          <p className="adm-group-title">{t("series.look.focus")}</p>
          <p className="adm-hint-line">{t("series.look.focusHint")}</p>
          <div className="vl-crops">
            <div
              className="vl-pick"
              role="img"
              aria-label={t("series.look.focusPicker")}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onPick(e);
              }}
              onPointerMove={(e) => e.buttons === 1 && onPick(e)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" draggable={false} />
              <span className="vl-dot" style={{ left: `${focus[0]}%`, top: `${focus[1]}%` }} />
            </div>
            <div className="vl-crops" aria-hidden="true">
              {[
                { k: "cropReel", w: 40, h: 53, r: 2 },
                { k: "cropChip", w: 48, h: 48, r: 24 },
                { k: "cropList", w: 52, h: 68, r: 6 },
              ].map((c) => (
                <div className="vl-crop" key={c.k}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" width={c.w} height={c.h} style={{ width: c.w, height: c.h, borderRadius: c.r, objectPosition: pos }} />
                  <span>{t(`series.look.${c.k}`)}</span>
                </div>
              ))}
            </div>
          </div>
          <Range label={t("series.look.focusX")} value={focus[0]} min={0} max={100} step={1} onChange={(v) => setFocus(v, focus[1])} format={(v) => `${v}%`} />
          <Range label={t("series.look.focusY")} value={focus[1]} min={0} max={100} step={1} onChange={(v) => setFocus(focus[0], v)} format={(v) => `${v}%`} />
        </div>
      </div>

      <div className="vl-ranges">
        <div className="vl-head">
          <span className="vl-swatch" role="img" aria-label={t("series.look.swatch")} style={{ background: oklch(acc) }} />
          <div>
            <p className="adm-group-title">{t("series.look.accent")}</p>
            <p className="adm-hint-line">{t("series.look.accentHint")}</p>
          </div>
          <span className="vl-tag">{value.accent ? t("series.look.custom") : t("series.look.usingDefault")}</span>
          <button type="button" className="lbf-textbtn" disabled={!value.accent} onClick={() => set({ accent: null })}>
            {t("series.look.reset")}
          </button>
        </div>
        <Range
          label={t("series.look.hue")}
          value={acc[2]}
          min={0}
          max={360}
          step={1}
          onChange={(v) => setAcc(2, v)}
          format={(v) => `${Math.round(v)}°`}
          track={`linear-gradient(90deg,${HUES.map((h) => `oklch(${acc[0]} ${acc[1]} ${h})`).join(",")})`}
        />
        <Range label={t("series.look.lightness")} value={acc[0]} min={0.2} max={0.95} step={0.01} onChange={(v) => setAcc(0, v)} format={(v) => v.toFixed(2)} />
        <Range label={t("series.look.chroma")} value={acc[1]} min={0} max={0.3} step={0.005} onChange={(v) => setAcc(1, v)} format={(v) => v.toFixed(3)} />
      </div>

      <div className="vl-ranges">
        <div className="vl-head">
          <span className="vl-swatch" role="img" aria-label={t("series.look.stageHue")} style={{ background: `oklch(0.22 0.05 ${hue})` }} />
          <div>
            <p className="adm-group-title">{t("series.look.stageHue")}</p>
            <p className="adm-hint-line">{t("series.look.stageHint")}</p>
          </div>
          <span className="vl-tag">{value.stageHue != null ? t("series.look.custom") : t("series.look.usingDefault")}</span>
          <button type="button" className="lbf-textbtn" disabled={value.stageHue == null} onClick={() => set({ stageHue: null })}>
            {t("series.look.reset")}
          </button>
        </div>
        <Range
          label={t("series.look.stageHue")}
          value={hue}
          min={0}
          max={360}
          step={1}
          onChange={(v) => set({ stageHue: v })}
          format={(v) => `${Math.round(v)}°`}
          track={`linear-gradient(90deg,${HUES.map((h) => `oklch(0.3 0.08 ${h})`).join(",")})`}
        />
      </div>
    </div>
  );
}
