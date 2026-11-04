/**
 * ICU MessageFormat checks for admin-edited copy (isomorphic). next-intl parses every message at
 * render time, so a bad edit (unbalanced braces, stray tag) or one that drops/renames an argument
 * the component passes ({name}, <b>…</b>) would break the page. Validate before saving.
 */
import {
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";

export interface IcuShape {
  /** Argument names: {name}, {n, plural, …}, {d, date}, … */
  args: Set<string>;
  /** Rich-text tag names: <b>…</b> */
  tags: Set<string>;
}

function collect(els: MessageFormatElement[], shape: IcuShape): void {
  for (const el of els) {
    if (isTagElement(el)) {
      shape.tags.add(el.value);
      collect(el.children, shape);
    } else if (isSelectElement(el) || isPluralElement(el)) {
      shape.args.add(el.value);
      for (const opt of Object.values(el.options)) collect(opt.value, shape);
    } else if (isArgumentElement(el) || isNumberElement(el) || isDateElement(el) || isTimeElement(el)) {
      shape.args.add(el.value);
    }
  }
}

/** Parses a message; returns its argument/tag names, or the syntax error text. */
export function icuShape(message: string): { ok: true; shape: IcuShape } | { ok: false; error: string } {
  try {
    const shape: IcuShape = { args: new Set(), tags: new Set() };
    collect(parse(message), shape);
    return { ok: true, shape };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.replace(/\s+/g, " ").trim() || "invalid message syntax" };
  }
}

const list = (names: string[], open: string, close: string) => names.map((n) => `${open}${n}${close}`).join(", ");

/**
 * Null when `value` is a valid message with the same argument names and rich tags as `reference`
 * (the built-in default); otherwise a short reason. A reference that does not itself parse is
 * not enforced (nothing sane to compare with) but `value` must still be valid.
 */
export function icuProblem(value: string, reference: string): string | null {
  const v = icuShape(value);
  if (!v.ok) return `invalid message syntax (${v.error})`;
  const r = icuShape(reference);
  if (!r.ok) return null;
  const problems: string[] = [];
  const diff = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));
  const missingArgs = diff(r.shape.args, v.shape.args);
  const extraArgs = diff(v.shape.args, r.shape.args);
  const missingTags = diff(r.shape.tags, v.shape.tags);
  const extraTags = diff(v.shape.tags, r.shape.tags);
  if (missingArgs.length) problems.push(`missing ${list(missingArgs, "{", "}")}`);
  if (extraArgs.length) problems.push(`unknown ${list(extraArgs, "{", "}")}`);
  if (missingTags.length) problems.push(`missing ${list(missingTags, "<", ">")}`);
  if (extraTags.length) problems.push(`unknown ${list(extraTags, "<", ">")}`);
  return problems.length ? problems.join("; ") : null;
}
