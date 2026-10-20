# Design

## Visual Theme

**Theatrical black.** A near-black stage tinted toward the current teller's hue. The accent colour is the light source: rim light, particles, the iris rim, the typing caret. Photographic stills appear only where light falls on them (backdrop plates, the home lantern, the archive projector), so images always emerge from darkness rather than sitting in boxes.

Scene sentence: *a programmer at a festival office, lights off, laptop open at 11pm, deciding which studio to call back.* Dark is the answer because the work itself is staged in darkness, not because "creative sites are dark".

## Colour

Colour strategy: **drenched in dark, lit by one accent.** The stage is the colour (a hue-tinted black); the accent is light.

Neutrals (OKLCH, tinted):

| Token | Value | Use |
|---|---|---|
| `--stage` | `oklch(0.12 0.01 var(--hue))` | page and scene background |
| `--stage-deep` | `oklch(0.08 0.008 var(--hue))` | vignettes, iris black |
| `--ink` | `oklch(0.93 0.012 80)` | primary text (warm bone) |
| `--ink-dim` | `oklch(0.72 0.012 80)` | secondary text |
| `--ink-faint` | `oklch(0.93 0.012 80 / 0.08)` | chapter word, hairlines |

Teller accents:

| Teller | Accent | OKLCH |
|---|---|---|
| Child | teal | `0.70 0.10 210` |
| Elder | dusty rose | `0.72 0.09 350` |
| Snake King | venom green | `0.70 0.14 140` |
| Silver One | lapis | `0.64 0.16 268` |
| Masked Lady | saffron | `0.80 0.13 80` |
| Creature | madder | `0.62 0.18 28` |

Rules: blend accents in OKLab, never sRGB. Never pure `#000` / `#fff`. Accent never carries meaning alone.

## Typography

- **Display: Redaction** (open-source, OFL). Its cuts degrade from clean (`Redaction`, `Redaction 10`) to eroded (`Redaction 35`, `70`, `100`). Degradation is a design variable: calm moments are clean, THE DAY is eroded, the home wordmark heals under the lantern.
- **Narration and UI: Schibsted Grotesk** (variable 400 to 900). Narration 400/500 at `clamp(1.6rem, 3.2vw, 3.2rem)`, line-height 1.18 (+0.08 for light on dark). UI labels 500 at 0.8125rem to 0.9375rem, sentence case.
- Scale ratio at least 1.25 between steps; display sizes fluid with `clamp()`.
- Narration max width 22ch to 28ch (it is spoken, short lines). Body max 65ch.
- No all-caps body. Caps only for the giant chapter word and the wordmark.

## Layout

- Full-bleed stage. Text sits on the side opposite the character and alternates as they walk.
- Strong asymmetry; no centered stacks except the iris CTA moment.
- Project grids are image-led with varied spans (large, small, medium), never identical cards.
- Fluid spacing via `clamp()`; tight groupings, generous separations.

## Motion

- Weighting: Jakub primary (production polish), Jhey secondary (play), Emil for high-frequency controls.
- Tokens: `--ease-out-quint: cubic-bezier(.22,1,.36,1)`, `--ease-in-quart: cubic-bezier(.5,0,.75,0)`, UI spring `{ type: "spring", bounce: 0, duration: 0.45 }`.
- Teller blend: 0.9 s, exponential approach on per-teller weights (interruptible, never jumps).
- Enter: opacity + 8px translate + 4px blur. Exit subtler (200 ms, smaller offset).
- One scroll progress value drives the series scene, smoothed with a spring.
- Reduced motion: crossfades only; no shake, dive, autoplay, letter motion or grain flicker.

## Components

- **Teller switcher**: bottom-edge row of portrait chips; pressed chip shows the name and an accent ring. Instant hover, `scale(.97)` press.
- **Iris transition**: black overlay closing/opening as a circle with a glowing accent rim.
- **Narration line**: per-letter spans animated by mood; caret in accent.
- **CTA**: Redaction text with an accent hairline that draws in on hover; no filled pill buttons.
- **Motion toggle**: small text control, bottom corner, "Pause motion" / "Play motion".
