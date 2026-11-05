"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "./icons-ux";

export type PaletteGroup = "recent" | "do" | "go" | "page" | "setting" | "project" | "person" | "voice" | "text";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  title: string;
  /** Second line: where it is, or a snippet. */
  hint?: string;
  /** Extra words that should find it (not shown). */
  keywords?: string;
  icon: IconName;
  run: () => void;
}

const ORDER: PaletteGroup[] = ["recent", "do", "go", "page", "setting", "project", "person", "voice", "text"];
const RECENT_KEY = "lbf-admin-recent";
const CAP: Partial<Record<PaletteGroup, number>> = { text: 8, project: 5, person: 5, voice: 6, setting: 6, page: 6, go: 12, do: 6 };

function readRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function score(q: string[], it: PaletteItem): number {
  const title = it.title.toLowerCase();
  const hay = `${title} ${(it.hint ?? "").toLowerCase()} ${(it.keywords ?? "").toLowerCase()}`;
  let total = 0;
  // A title that is exactly what was typed beats everything else.
  if (title === q.join(" ")) total += 10;
  for (const tok of q) {
    if (!hay.includes(tok)) return 0;
    if (title.startsWith(tok)) total += 4;
    else if (title.includes(` ${tok}`)) total += 3;
    else if (title.includes(tok)) total += 2;
    else total += 1;
  }
  return total;
}

/**
 * Quick find (Ctrl/Cmd+K). A combobox over a listbox: type to filter sections, pages, settings,
 * people and texts; arrows move, Enter opens, Esc closes. Recently used items lead when it is empty.
 * No open/close animation: it is a keyboard tool used all day.
 */
export function CommandPalette({
  items,
  textItems,
  onClose,
}: {
  items: PaletteItem[];
  /** Builds text matches for a query (kept out of `items`, which would be thousands long). */
  textItems: (q: string[]) => PaletteItem[];
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const uid = useId();
  const down = useRef(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [active, setActive] = useState(0);
  const [recent] = useState<string[]>(() => (typeof window === "undefined" ? [] : readRecent()));

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    input.current?.focus();
    return () => {
      try {
        if (d.open) d.close();
      } catch {}
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let pool: PaletteItem[];
    if (q.length === 0) {
      const byId = new Map(items.map((i) => [i.id, i]));
      const rec = recent.map((id) => byId.get(id)).filter((x): x is PaletteItem => !!x).map((x) => ({ ...x, group: "recent" as const }));
      pool = [...rec, ...items.filter((i) => i.group === "do" || i.group === "go")];
    } else {
      const scored = items
        .map((it, idx) => ({ it, s: score(q, it), idx }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || a.idx - b.idx)
        .map((x) => x.it);
      pool = [...scored, ...(q.join("").length >= 2 ? textItems(q) : [])];
    }
    const groups: { group: PaletteGroup; items: PaletteItem[]; best: number }[] = [];
    for (const g of ORDER) {
      const inGroup = pool.filter((i) => i.group === g).slice(0, CAP[g] ?? 6);
      if (!inGroup.length) continue;
      // While searching, the group holding the best title match leads (typing "support" opens the Support page first,
      // not the settings card that merely lists it as a keyword); ties keep the fixed order.
      const best = q.length === 0 ? 0 : g === "text" ? 1 : Math.max(...inGroup.map((i) => score(q, i)));
      groups.push({ group: g, items: inGroup, best });
    }
    if (q.length) groups.sort((a, b) => b.best - a.best);
    return groups;
  }, [deferred, items, textItems, recent]);

  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);
  const clamped = Math.min(active, Math.max(0, flat.length - 1));

  // Keep the active option in view.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-idx="${clamped}"]`)?.scrollIntoView({ block: "nearest" });
  }, [clamped, results]);

  const choose = (it: PaletteItem) => {
    if (it.group !== "text") pushRecent(it.id.replace(/^recent:/, ""));
    onClose();
    // After the dialog is gone, so focus lands in the new place, not back on the opener.
    window.setTimeout(it.run, 0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (flat.length ? (Math.min(i, flat.length - 1) + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length ? (Math.min(i, flat.length - 1) - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Home" && e.ctrlKey) {
      setActive(0);
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const it = flat[clamped];
      if (it) choose(it);
    }
  };

  const listId = `${uid}-list`;
  let idx = -1;
  return (
    <dialog
      ref={dialog}
      className="ux-pal"
      aria-label={t("palette.title")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        down.current = e.target === dialog.current;
      }}
      onClick={(e) => {
        if (e.target === dialog.current && down.current) onClose();
        down.current = false;
      }}
    >
      <div className="ux-pal-box">
        <div className="ux-pal-field">
          <Icon name="search" className="ux-pal-ico" />
          <input
            ref={input}
            className="ux-pal-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? `${uid}-opt-${clamped}` : undefined}
            aria-label={t("palette.label")}
            placeholder={t("palette.placeholder")}
            value={query}
            dir="auto"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <button type="button" className="ux-pal-esc" onClick={onClose} aria-label={t("close")}>
            <kbd className="ux-kbd">Esc</kbd>
          </button>
          <button type="button" className="ux-pal-close" onClick={onClose}>
            {t("close")}
          </button>
        </div>
        <div className="ux-pal-list" ref={list} id={listId} role="listbox" aria-label={t("palette.results")}>
          {flat.length === 0 ? (
            <p className="ux-pal-none" role="status">
              {t("palette.none", { query: deferred.trim() })}
              <span>{t("palette.noneTip")}</span>
            </p>
          ) : (
            results.map((g) => (
              <div key={g.group} role="group" aria-label={t(`palette.groups.${g.group}`)} className="ux-pal-group">
                <p className="ux-pal-gh" aria-hidden="true">
                  {t(`palette.groups.${g.group}`)}
                </p>
                {g.items.map((it) => {
                  idx += 1;
                  const i = idx;
                  return (
                    <div
                      key={`${g.group}:${it.id}`}
                      id={`${uid}-opt-${i}`}
                      role="option"
                      aria-selected={i === clamped}
                      data-idx={i}
                      className="ux-pal-opt"
                      data-active={i === clamped ? "true" : "false"}
                      onPointerMove={() => i !== clamped && setActive(i)}
                      onClick={() => choose(it)}
                    >
                      <span className="ux-pal-oico" aria-hidden="true">
                        <Icon name={it.icon} />
                      </span>
                      <span className="ux-pal-otext">
                        <span className="ux-pal-otitle" dir="auto">
                          {it.title}
                        </span>
                        {it.hint && (
                          <span className="ux-pal-ohint" dir="auto">
                            {it.hint}
                          </span>
                        )}
                      </span>
                      <Icon name="chevron" className="ux-pal-go" />
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <p className="ux-pal-foot" aria-hidden="true">
          <span>
            <kbd className="ux-kbd">↑</kbd> <kbd className="ux-kbd">↓</kbd> {t("palette.move")}
          </span>
          <span>
            <kbd className="ux-kbd">↵</kbd> {t("palette.open")}
          </span>
          <span>
            <kbd className="ux-kbd">Esc</kbd> {t("palette.closeHint")}
          </span>
        </p>
      </div>
    </dialog>
  );
}
