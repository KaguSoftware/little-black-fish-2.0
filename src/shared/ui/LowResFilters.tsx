/**
 * Low-res look for Persian. Redaction's degradation cuts (10/35/70/100) have no Arabic-script
 * glyphs, so a Persian title set in a cut falls through to clean Vazirmatn and the low-res to
 * hi-res heal has nothing to heal from. These filters pixelate the glyphs instead: sample one
 * pixel per N x N cell, grow it back into a block, and keep a faint ghost of the clean glyph
 * underneath so thin strokes never drop out entirely.
 *
 * Put `.lowres` (or `.lowres-l`) on the low-res layer of a heal effect. Latin already gets its
 * look from the Redaction cut that layer is set in, so the filter only applies on :lang(fa).
 * The rule ships here, not in globals.css: the CSS pipeline drops fragment-only url(#id) values.
 * N is odd so the sample sits in the middle of its block: 3 px for text up to ~8rem, 7 px (with
 * a fainter ghost, which would otherwise smooth the steps away) for the giant display words.
 */
function Pixelate({ id, n, ghost }: { id: string; n: number; ghost: number }) {
  const r = (n - 1) / 2;
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feFlood x={r} y={r} width="1" height="1" floodColor="#000" />
      <feComposite width={n} height={n} />
      <feTile result="grid" />
      <feComposite in="SourceGraphic" in2="grid" operator="in" />
      <feMorphology operator="dilate" radius={r} result="blocks" />
      <feComponentTransfer in="SourceGraphic" result="ghost">
        <feFuncA type="linear" slope={ghost} />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="ghost" />
        <feMergeNode in="blocks" />
      </feMerge>
    </filter>
  );
}

const CSS = `.lowres:lang(fa){filter:url(#lbf-lowres)}.lowres-l:lang(fa){filter:url(#lbf-lowres-l)}`;

export function LowResFilters() {
  return (
    <>
      <style>{CSS}</style>
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <Pixelate id="lbf-lowres" n={3} ghost={0.3} />
        <Pixelate id="lbf-lowres-l" n={7} ghost={0.1} />
      </svg>
    </>
  );
}
