/**
 * Material swatches cropped from the character sheets by `scripts/crop-swatches.mjs`.
 * WebP in `public/textures/<teller>/`: 512x512 for crops of 300px or more, 256x256 for the rest.
 * Small crops are soft either way: use them for colour and pattern, not close-up detail.
 * None are seamless; set `RepeatWrapping` with a mirrored repeat (MirroredRepeatWrapping) to hide seams.
 */
export const TEXTURES = {
  "snake-king": {
    /** Black crushed velvet with a swirl fold. Mirror-tiles acceptably; the swirl repeats visibly if tiled more than 2x. */
    velvet: "/textures/snake-king/velvet.webp",
    /** Green-gold serpent embroidery on black. Single motif, not tileable; use once as a decal (sleeve, hem). */
    embroidery: "/textures/snake-king/embroidery.webp",
    /** Cracked bronze-and-oxblood mask surface with an eye slit at top. Not tileable; use as mask map or bake into UVs. */
    mask: "/textures/snake-king/mask.webp",
    /** Gold crown spikes over a bead band. Not tileable; a reference for the crown, not a surface map. */
    "crown-metal": "/textures/snake-king/crown-metal.webp",
    /** Frontal mask with crown base and hair at the bottom edge, square and centred. Use as the face map. */
    "mask-face": "/textures/snake-king/mask-face.webp",
  },
  "silver-one": {
    /** Silver lame cloak fabric with a swirl fold. Mirror-tiles well; high contrast highlights. */
    lame: "/textures/silver-one/lame.webp",
    /** Beige linen with a few diagonal creases. Mirror-tiles well; a faint gray edge at the top-left corner. */
    linen: "/textures/silver-one/linen.webp",
    /** Lapis beads strung with gold, a little white fur at the bottom edge. Roughly tileable vertically. */
    beads: "/textures/silver-one/beads.webp",
    /** White-lavender long fur. Tiles well; best used as an alpha-less colour map for fur shells. */
    fur: "/textures/silver-one/fur.webp",
    /** Close-up of the chrome oval mask inside dark auburn hair. Not tileable; not needed for the chrome material (use a reflection env), only as a colour/shape reference. */
    chrome: "/textures/silver-one/chrome.webp",
  },
  "masked-lady": {
    /** Ivory filigree mask with gold relief and blue accent, frontal, with earrings and collar. Not tileable; use as the face map. */
    "mask-face": "/textures/masked-lady/mask-face.webp",
    /** Slate-blue wool with gold floral embroidery. Not tileable (motifs), but the wool grain tiles fine at low frequency. */
    "vest-embroidery": "/textures/masked-lady/vest-embroidery.webp",
    /** Ivory linen drape with soft folds. Mirror-tiles well; folds are baked in, so keep repeat low. */
    linen: "/textures/masked-lady/linen.webp",
    /** Engraved silver cuff with charms, skin at left and gray backdrop at left/top edges. Not tileable; crop UVs to the metal. */
    cuff: "/textures/masked-lady/cuff.webp",
    /** Engraved bronze belt medallion on black cloth (from the tweed costume sheet, so the belt is round, not the flat silver band). Not tileable. */
    belt: "/textures/masked-lady/belt.webp",
    /** Dark charcoal tweed with gold flecks and folds. Mirror-tiles well; the best tiling swatch of the set. */
    tweed: "/textures/masked-lady/tweed.webp",
    /** Ivory bib with maroon rosettes and a border. Single motif with a border: use as a decal on the bib. Not tileable. */
    bib: "/textures/masked-lady/bib.webp",
    /** Cream yarn tassel on dark hair, a sliver of beading at the bottom right. Not tileable; use as a single-tassel map. */
    tassel: "/textures/masked-lady/tassel.webp",
  },
  creature: {
    /** Pale blue-white shaggy fur with a leathery fold at the top right. Tiles acceptably if the top-right corner is avoided. */
    fur: "/textures/creature/fur.webp",
    /** Pale leathery wrinkled beak skin with fur at the bottom edge. Not tileable. */
    skin: "/textures/creature/skin.webp",
    /** Crimson velvet with worn gold embroidery and a frayed patch. Not tileable; use once on the saddle cloth. */
    saddle: "/textures/creature/saddle.webp",
  },
  elder: {
    /** Pink, green and charcoal bouclé knit with a vertical dark fold at the right. Tiles well at repeat 3-4; the best knit swatch available. */
    knit: "/textures/elder/knit.webp",
    /** Blue-grey long shaggy hair strands, light backdrop at the top-right corner. Tiles acceptably; use mirrored. */
    hair: "/textures/elder/hair.webp",
    /** Pale grey porous stone with an eye-hole, taken from a roughly 70px source so it is very soft; the sky shows at the right edge. Use for tone only. */
    stone: "/textures/elder/stone.webp",
  },
  child: {
    /** Painted torso with teal, green and red glyph marks and sticker patches. Not tileable (skin with a nipple area); use once as the body map. */
    "skin-marks": "/textures/child/skin-marks.webp",
    /** Worn teal cotton cloth with a knot and paint stains. Roughly tileable when mirrored; the folded corner at top-right is visible. */
    cloth: "/textures/child/cloth.webp",
    /** Cream paper mask with painted red lips, nose and green marks, hair at both sides. Not tileable; use as the mask face map. */
    "paper-mask": "/textures/child/paper-mask.webp",
  },
} as const;

export type TextureKey<T extends keyof typeof TEXTURES> = keyof (typeof TEXTURES)[T];
