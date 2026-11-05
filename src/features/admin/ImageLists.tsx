/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isVideoUrl } from "@/shared/data/storage";
import { SETTING_DEFAULTS, type HeroVideo, type WallImage } from "@/shared/data/settingsSchema";
import { ImageField } from "./ImageField";
import { ImageListField } from "./ImageListField";
import { MediaStyles } from "./MediaStyles";
import { SAME, WALL_SEED, fileTitle } from "./images-model";

/** Thumbnails to choose which item of a list to fine-tune. */
function Strip({ urls, current, onSelect, label }: { urls: string[]; current: number; onSelect: (i: number) => void; label: string }) {
  return (
    <ul className="si-strip" aria-label={label}>
      {urls.map((u, i) => (
        <li key={`${u}#${i}`}>
          <button type="button" className="si-strip-btn" aria-pressed={i === current} aria-label={`${i + 1} / ${urls.length}`} onClick={() => onSelect(i)}>
            {isVideoUrl(u) ? <video src={`${u}#t=0.1`} muted playsInline preload="metadata" /> : <img src={u} alt="" loading="lazy" decoding="async" />}
            <span aria-hidden="true">{i + 1}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The home lantern wall. No custom list = the built-in stills; the first edit turns the built-in
 * list into the person's own list (same pictures, same framing), so every change starts from what
 * the site shows today.
 */
export function WallEditor({ wall, onChange }: { wall: WallImage[]; onChange: (next: WallImage[]) => void }) {
  const t = useTranslations("adminMedia");
  const customised = wall.length > 0;
  const items = customised ? wall : WALL_SEED;
  const [sel, setSel] = useState(0);
  const at = Math.min(sel, Math.max(0, items.length - 1));
  const cur = items[at];

  const apply = (urls: string[]) => {
    const pool = [...items];
    onChange(urls.map((u) => {
      const i = pool.findIndex((p) => p.src === u);
      return i >= 0 ? pool.splice(i, 1)[0] : { src: u };
    }));
  };
  const patch = (p: Partial<WallImage>) => {
    const next = items.map((it, i) => (i === at ? { ...it, ...p } : it)).map((it) => {
      const out = { ...it };
      if (!out.focus) delete out.focus;
      if (!out.zoom || out.zoom === 1) delete out.zoom;
      if (!out.alt) delete out.alt;
      return out;
    });
    onChange(next);
  };

  return (
    <div className="si-list">
      <MediaStyles />
      <ImageListField
        label={t("images.wall.label")}
        description={customised ? t("images.wall.custom", { count: items.length }) : t("images.wall.builtin")}
        value={items.map((i) => i.src)}
        onChange={apply}
        bucket="projects"
        hints={{ recommended: { width: 1600, height: 1000 }, minWidth: 900 }}
      />
      <div className="si-list-acts">
        <button type="button" className="adm-btn adm-btn-quiet" disabled={!customised} onClick={() => onChange([])}>
          {t("images.wall.restore")}
        </button>
      </div>
      {cur && (
        <details className="si-fine">
          <summary>{t("images.wall.fine")}</summary>
          <p className="lbf-hint">{t("images.wall.fineHint")}</p>
          <Strip urls={items.map((i) => i.src)} current={at} onSelect={setSel} label={t("images.wall.pickOne")} />
          <ImageField
            key={`${at}:${cur.src}`}
            label={t("images.wall.itemLabel", { n: at + 1 })}
            value={cur.src}
            onChange={(url) => (url ? patch({ src: url }) : onChange(items.filter((_, i) => i !== at)))}
            bucket="projects"
            aspect="31/50"
            focus={cur.focus ?? null}
            onFocusChange={(f) => patch({ focus: f ?? undefined })}
            alt={cur.alt ?? ""}
            onAltChange={(alt) => patch({ alt })}
          />
          <div className="si-zoom">
            <label htmlFor="si-zoom">{t("images.wall.zoom")}</label>
            <input id="si-zoom" type="range" min={1} max={3} step={0.05} value={cur.zoom ?? 1} onChange={(e) => patch({ zoom: Number(e.target.value) })} />
            <output htmlFor="si-zoom">{(cur.zoom ?? 1).toFixed(2)}×</output>
          </div>
        </details>
      )}
    </div>
  );
}

/** The hero films: replace, remove, reorder, and a poster still per film. */
export function FilmsEditor({ films, onChange }: { films: HeroVideo[]; onChange: (next: HeroVideo[]) => void }) {
  const t = useTranslations("adminMedia");
  const [sel, setSel] = useState(0);
  const at = Math.min(sel, Math.max(0, films.length - 1));
  const cur = films[at];
  const customised = !SAME(films, SETTING_DEFAULTS.heroVideos);

  const apply = (urls: string[]) => {
    const pool = [...films];
    onChange(urls.map((u) => {
      const i = pool.findIndex((p) => p.src === u);
      return i >= 0 ? pool.splice(i, 1)[0] : { src: u, title: fileTitle(u), project: "" };
    }));
  };
  const setPoster = (poster: string) =>
    onChange(films.map((f, i) => {
      if (i !== at) return f;
      const { poster: _old, ...rest } = f;
      void _old;
      return poster ? { ...rest, poster } : rest;
    }));

  return (
    <div className="si-list">
      <MediaStyles />
      <ImageListField
        label={t("images.films.label")}
        description={t("images.films.hint")}
        value={films.map((f) => f.src)}
        onChange={apply}
        bucket="hero"
        imagesOnly={false}
        max={12}
        hints={{ recommended: { width: 1280, height: 720 } }}
      />
      {films.length > 2 && <p className="lbf-hint">{t("images.films.extra", { count: films.length - 2 })}</p>}
      <div className="si-list-acts">
        <button type="button" className="adm-btn adm-btn-quiet" disabled={!customised} onClick={() => onChange(SETTING_DEFAULTS.heroVideos.map((v) => ({ ...v })))}>
          {t("images.films.restore")}
        </button>
      </div>
      {cur && (
        <details className="si-fine">
          <summary>{t("images.films.poster")}</summary>
          <p className="lbf-hint">{t("images.films.posterHint")}</p>
          <Strip urls={films.map((f) => f.src)} current={at} onSelect={setSel} label={t("images.films.pickOne")} />
          <ImageField
            key={`${at}:${cur.src}`}
            label={t("images.films.posterLabel", { n: at + 1 })}
            value={cur.poster ?? ""}
            onChange={setPoster}
            bucket="projects"
            imagesOnly
            builtIn
            aspect="31/50"
          />
        </details>
      )}
    </div>
  );
}
