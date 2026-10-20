const L = (w) => ({
    droop: 0,
    jitter: 0,
    wave: 0,
    hop: 0,
    settle: 0,
    flinch: 0,
    ...w,
});
export const MOODS = {
    /** Elder. Particles sag and drift, slow sway, letters droop. */
    bored: {
        ringPetals: 0, ringPetalAmp: 0, ringSharpness: 0, ringJitter: 0.01, ringSag: 0.22, ringHop: 0,
        orbitSpeed: 0.35, twist: 1.2, cursorFlee: 0.6,
        sway: 0.05, swayHz: 0.18, hop: 0, squash: 0, float: 0, spin: 0, twitch: 0, slump: 0.18, gait: 0.6,
        shake: 0, gridChop: 0.1, gridSpeed: 0.4, drift: 0.4, fog: 1.2,
        letters: L({ droop: 1 }), redaction: 35,
    },
    /** Snake King. Jagged rings, screen shake, jaw snaps, letters jitter. */
    angry: {
        ringPetals: 7, ringPetalAmp: 0.22, ringSharpness: 1, ringJitter: 0.035, ringSag: 0, ringHop: 0,
        orbitSpeed: 1.8, twist: 3.2, cursorFlee: 1.4,
        sway: 0.02, swayHz: 1.4, hop: 0, squash: 0.04, float: 0, spin: 0, twitch: 0.35, slump: -0.06, gait: 1.25,
        shake: 0.55, gridChop: 1, gridSpeed: 1.6, drift: 1.4, fog: 0.9,
        letters: L({ jitter: 1 }), redaction: 70,
    },
    /** Silver One. Slow tides, floating and spinning, letters float in waves, grid ripples outward. */
    dreamy: {
        ringPetals: 3, ringPetalAmp: 0.12, ringSharpness: 0, ringJitter: 0, ringSag: 0, ringHop: 0,
        orbitSpeed: 0.55, twist: 2.4, cursorFlee: 0.8,
        sway: 0.06, swayHz: 0.12, hop: 0, squash: 0, float: 0.12, spin: 0.08, twitch: 0, slump: -0.04, gait: 0.7,
        shake: 0, gridChop: 0, gridSpeed: 0.7, drift: 0.7, fog: 1.4,
        letters: L({ wave: 1 }), redaction: 10,
    },
    /** Child. Particles hop, the character bounces and squashes, letters hop. */
    bouncy: {
        ringPetals: 5, ringPetalAmp: 0.08, ringSharpness: 0.2, ringJitter: 0.005, ringSag: 0, ringHop: 0.12,
        orbitSpeed: 1.2, twist: 2.0, cursorFlee: 1.0,
        sway: 0.04, swayHz: 0.9, hop: 0.07, squash: 0.18, float: 0, spin: 0, twitch: 0.05, slump: -0.02, gait: 1.15,
        shake: 0, gridChop: 0.35, gridSpeed: 1.1, drift: 1, fog: 1,
        letters: L({ hop: 1 }), redaction: 10,
    },
    /** Masked Lady. Rosette 8-petal rings, measured rotation, letters settle with ceremonial stagger. */
    ceremonial: {
        ringPetals: 8, ringPetalAmp: 0.1, ringSharpness: 0.45, ringJitter: 0, ringSag: 0, ringHop: 0,
        orbitSpeed: 0.5, twist: 1.6, cursorFlee: 0.5,
        sway: 0.015, swayHz: 0.25, hop: 0, squash: 0, float: 0, spin: 0, twitch: 0, slump: 0, gait: 0.8,
        shake: 0, gridChop: 0.05, gridSpeed: 0.5, drift: 0.5, fog: 1.1,
        letters: L({ settle: 1 }), redaction: 0,
    },
    /** Creature. Dots flee the cursor hard, head twitches, letters flinch. */
    skittish: {
        ringPetals: 2, ringPetalAmp: 0.06, ringSharpness: 0.1, ringJitter: 0.02, ringSag: 0.04, ringHop: 0.03,
        orbitSpeed: 0.9, twist: 1.8, cursorFlee: 2.6,
        sway: 0.03, swayHz: 0.6, hop: 0, squash: 0.05, float: 0, spin: 0, twitch: 0.8, slump: 0.05, gait: 0.95,
        shake: 0.08, gridChop: 0.5, gridSpeed: 0.9, drift: 0.9, fog: 1,
        letters: L({ flinch: 1 }), redaction: 10,
    },
};
const NUMERIC_KEYS = Object.keys(MOODS.bored).filter((k) => k !== "letters");
const LETTER_KEYS = Object.keys(MOODS.bored.letters);
/** Weighted blend of mood vectors. Weights need not sum to 1 (they are normalised). */
export function blendMoods(entries) {
    let total = 0;
    for (const e of entries)
        total += e.w;
    if (total <= 0)
        return { ...entries[0].mood, letters: { ...entries[0].mood.letters } };
    const out = { letters: L({}) };
    for (const k of NUMERIC_KEYS)
        out[k] = 0;
    for (const e of entries) {
        const w = e.w / total;
        for (const k of NUMERIC_KEYS)
            out[k] += e.mood[k] * w;
        for (const k of LETTER_KEYS)
            out.letters[k] += e.mood.letters[k] * w;
    }
    return out;
}
