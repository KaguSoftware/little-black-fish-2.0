"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Field } from "./EditorShell";
import { DownIcon, UpIcon } from "./parts";

/** A page-level panel: heading, sub line, optional actions, focusable root for focus management. */
export function PanelFrame({
  id,
  labelledBy,
  hidden,
  title,
  sub,
  actions,
  children,
}: {
  id: string;
  labelledBy: string;
  hidden: boolean;
  title: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="adm-panel" id={`adm-panel-${id}`} aria-labelledby={labelledBy} hidden={hidden} tabIndex={-1}>
      <div className="adm-panel-head">
        <div>
          <h2 className="adm-h2">{title}</h2>
          {sub && <p className="adm-sub">{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Single-line or multi-line labelled text control. dir="rtl" also sets lang="fa". */
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  dir,
  required,
  multiline,
  rows,
  placeholder,
  type,
  autoComplete,
  list,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  dir?: "ltr" | "rtl";
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  type?: "text" | "url" | "email" | "password";
  autoComplete?: string;
  list?: string;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => {
        const common = {
          id,
          className: "lbf-input",
          dir,
          lang: dir === "rtl" ? "fa" : undefined,
          value,
          placeholder,
          maxLength,
          "aria-invalid": invalid,
          "aria-describedby": describedBy,
          "aria-required": required || undefined,
        };
        return multiline ? (
          <textarea {...common} rows={rows ?? 4} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input
            {...common}
            type={type ?? "text"}
            autoComplete={autoComplete}
            list={list}
            inputMode={type === "url" ? "url" : type === "email" ? "email" : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      }}
    </Field>
  );
}

const rowKeys = new WeakMap<object, number>();
const rowSeq = { n: 0 };
/** Identity-based row key (see ListEditor). */
function rowKey(item: unknown): number {
  if (typeof item !== "object" || item === null) return rowSeq.n++;
  let k = rowKeys.get(item);
  if (k === undefined) {
    k = rowSeq.n++;
    rowKeys.set(item, k);
  }
  return k;
}

/** A reorderable list of small records (socials, payments, hero videos): up/down, remove, add. */
export function ListEditor<T>({
  items,
  onChange,
  max,
  makeEmpty,
  addLabel,
  emptyText,
  itemTitle,
  errorIndex,
  renderItem,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  max: number;
  makeEmpty: () => T;
  addLabel: string;
  emptyText: string;
  itemTitle: (i: number) => string;
  errorIndex?: number | null;
  renderItem: (item: T, index: number, patch: (p: Partial<T>) => void) => ReactNode;
}) {
  const t = useTranslations("admin");
  // Stable per-item keys, carried by object identity: move/remove keep them, an edit (patch)
  // hands the key to the new object, and a replaced list (discard, defaults) gets fresh ones,
  // so per-row state such as an Upload preview never leaks to another row.
  const keyOf = rowKey;
  const patchItem = (i: number, p: Partial<T>) =>
    onChange(
      items.map((x, j) => {
        if (j !== i) return x;
        const next = { ...x, ...p };
        if (typeof x === "object" && x !== null) rowKeys.set(next, rowKey(x));
        return next;
      }),
    );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  return (
    <div className="adm-listed">
      {items.length === 0 ? (
        <p className="adm-hint-line">{emptyText}</p>
      ) : (
        <ol className="adm-listed-items">
          {items.map((item, i) => (
            <li key={keyOf(item)} className="adm-listed-item" data-bad={errorIndex === i + 1 ? "true" : "false"}>
              <div className="adm-listed-head">
                <span className="adm-listed-title">{itemTitle(i + 1)}</span>
                <span className="adm-move">
                  <button
                    type="button"
                    className="adm-icon"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    aria-label={t("moveUp", { title: itemTitle(i + 1) })}
                  >
                    <UpIcon />
                  </button>
                  <button
                    type="button"
                    className="adm-icon"
                    onClick={() => move(i, i + 1)}
                    disabled={i === items.length - 1}
                    aria-label={t("moveDown", { title: itemTitle(i + 1) })}
                  >
                    <DownIcon />
                  </button>
                  <button
                    type="button"
                    className="lbf-textbtn adm-danger"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  >
                    {t("remove")}
                    <span className="sr-only">: {itemTitle(i + 1)}</span>
                  </button>
                </span>
              </div>
              <div className="adm-listed-body">
                {renderItem(item, i, (p) => patchItem(i, p))}
              </div>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="lbf-textbtn adm-add"
        onClick={() => onChange([...items, makeEmpty()])}
        disabled={items.length >= max}
      >
        {addLabel}
      </button>
      {items.length >= max && <p className="adm-hint-line">{t("listMax", { max })}</p>}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "accent" | "mute" | "warn" }) {
  return (
    <span className="adm-badge" data-tone={tone ?? "mute"}>
      {children}
    </span>
  );
}
