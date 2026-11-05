/**
 * Copy-override helpers (isomorphic, no server-only). A content key is
 * `<namespace>.<dotted.path>`; array items use numeric segments (about.sections.1.paragraphs.0).
 * The namespace never contains a dot, so a key splits at its first dot.
 */

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Tree = { [k: string]: unknown } | unknown[];

/** Namespaces never offered for editing (admin UI chrome must not be breakable from the admin). */
export const NON_EDITABLE_NAMESPACES: readonly string[] = ["admin", "adminMedia"];

/** series.json sections owned by the series_chapters / series_characters tables. */
export const TABLE_OWNED_PREFIXES: readonly string[] = [
  "series.chapters.",
  "series.roles.",
  "series.names.",
  "series.lines.",
  "series.moods.",
];

const UNSAFE_SEGMENTS: readonly string[] = ["__proto__", "constructor", "prototype"];

export const isEditableKey = (key: string) => {
  const parts = key.split(".");
  // Own-property only: a key like "__proto__.x" or "constructor.name" must never address inherited members.
  if (parts.some((seg) => UNSAFE_SEGMENTS.includes(seg))) return false;
  return !NON_EDITABLE_NAMESPACES.includes(parts[0]) && !TABLE_OWNED_PREFIXES.some((p) => key.startsWith(p));
};

/** Flattens a message tree to { "a.b.0.c": "text" }. Only string leaves are editable copy. */
export function flattenMessages(tree: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof tree === "string") {
    out[prefix] = tree;
  } else if (Array.isArray(tree)) {
    tree.forEach((v, i) => flattenMessages(v, prefix ? `${prefix}.${i}` : String(i), out));
  } else if (tree && typeof tree === "object") {
    for (const [k, v] of Object.entries(tree)) flattenMessages(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

/**
 * Sets overrides on a message tree IN PLACE. Only replaces existing string leaves: a stale or
 * garbage key (path no longer in the JSON) is ignored instead of inventing structure.
 */
export function applyOverridesInPlace(messages: Record<string, unknown>, overrides: Record<string, string>): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value !== "string") continue;
    const parts = key.split(".");
    let node: unknown = messages;
    for (let i = 0; i < parts.length - 1 && node != null; i++) {
      node = typeof node === "object" && Object.hasOwn(node, parts[i]) ? (node as Tree)[parts[i] as never] : null;
    }
    const last = parts[parts.length - 1];
    if (node && typeof node === "object" && Object.hasOwn(node, last) && typeof (node as Tree)[last as never] === "string") {
      (node as Record<string, unknown>)[last] = value;
    }
  }
}
