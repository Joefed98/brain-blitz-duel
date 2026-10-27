/**
 * Gradient's colour schemes (tilesRev 4, 27 Oct 2026, Joe's phone notes; jumbled.ts). Every round draws its own
 * 5 × 5 gradient on the server and stores it on the puzzle (`palette`), so a room's players see the same board and
 * nobody can learn tile positions from one fixed palette: the player reads where each colour sits by how the board
 * gets lighter or darker and shifts in hue.
 *
 * A scheme is four corner colours in OKLCH, one corner dark and the opposite one light, their hues drawn from the
 * families below (yellows, oranges, browns, reds, pinks, purples, blues, teals, greens and so on), blended across
 * the board in OKLab and then turned or mirrored one of eight ways. A scheme is kept only when every pair of
 * neighbours is at least GRADIENT_MIN_NEIGHBOUR ΔE2000 apart with normal vision and GRADIENT_MIN_NEIGHBOUR_CVD with
 * simulated protan, deutan and tritan vision, and any two tiles at least GRADIENT_MIN_ANY apart, so the gradient
 * reads without numbers (the number toggle on the board stays for anyone who wants them).
 *
 * Shared code (no server secrets): the generator takes its randomness as an argument.
 */

export const GRADIENT_N = 5;
export const GRADIENT_MIN_NEIGHBOUR = 6;
export const GRADIENT_MIN_NEIGHBOUR_CVD = 3.5;
export const GRADIENT_MIN_ANY = 3;

/** Hue families: OKLCH hue (degrees) and the chroma that suits it. Brown is a dark, low-chroma orange. */
export const GRADIENT_FAMILIES: readonly { name: string; hue: number; chroma: number; dark?: number; light?: number }[] = [
  { name: "yellow", hue: 100, chroma: 0.17, dark: 0.5 },
  { name: "orange", hue: 55, chroma: 0.17 },
  { name: "brown", hue: 60, chroma: 0.08, dark: 0.3, light: 0.78 },
  { name: "red", hue: 25, chroma: 0.18 },
  { name: "pink", hue: 355, chroma: 0.16 },
  { name: "purple", hue: 305, chroma: 0.15 },
  { name: "blue", hue: 255, chroma: 0.15 },
  { name: "teal", hue: 195, chroma: 0.11 },
  { name: "green", hue: 145, chroma: 0.16 },
  { name: "lime", hue: 125, chroma: 0.17, dark: 0.45 },
];

type Lab = [number, number, number];

function oklchToOklab(l: number, c: number, h: number): Lab {
  const r = (h * Math.PI) / 180;
  return [l, c * Math.cos(r), c * Math.sin(r)];
}

function oklabToLinear([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: readonly number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** An OKLab colour as #rrggbb, its chroma pulled in (hue and lightness kept) until it fits sRGB. */
function toHex(lab: Lab): string {
  const L = lab[0];
  let [, a, b] = lab;
  for (let k = 0; k < 40 && !inGamut(oklabToLinear([L, a, b])); k++) {
    a *= 0.94;
    b *= 0.94;
  }
  return (
    "#" +
    oklabToLinear([L, a, b])
      .map((v) => Math.round(Math.min(1, Math.max(0, gamma(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

/* ------------------------------------------------------------------ distance (normal and simulated vision) */

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
/** Machado-style simulation matrices on linear sRGB (as player-looks-check and the rev-3 palette search use). */
export const GRADIENT_VISION: Record<string, number[][]> = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

function cieLab(linear: number[]): Lab {
  const [r, g, b] = linear.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

export function seenAs(hex: string, m: number[][]): Lab {
  const l = rgbOf(hex).map(lin);
  return cieLab(m.map((row) => row[0]! * l[0]! + row[1]! * l[1]! + row[2]! * l[2]!));
}

export function deltaE2000([L1, a1, b1]: readonly number[], [L2, a2, b2]: readonly number[]): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1!, b1!), C2 = Math.hypot(a2!, b2!), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1!, ap2 = (1 + G) * a2!;
  const Cp1 = Math.hypot(ap1, b1!), Cp2 = Math.hypot(ap2, b2!);
  const hue = (x: number, y: number) => ((Math.atan2(y, x) / rad) + 360) % 360;
  const hp1 = hue(ap1, b1!), hp2 = hue(ap2, b2!);
  let dh = hp2 - hp1;
  if (Cp1 * Cp2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = L2! - L1!, dC = Cp2 - Cp1, dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lb = (L1! + L2!) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hb = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
  const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

/** The smallest ΔE2000 between grid neighbours and between any two tiles, per vision. */
export function gradientSpread(palette: readonly string[], n = GRADIENT_N): Record<string, { neighbour: number; any: number }> {
  const out: Record<string, { neighbour: number; any: number }> = {};
  for (const [vision, m] of Object.entries(GRADIENT_VISION)) {
    const labs = palette.map((h) => seenAs(h, m));
    let neighbour = Infinity, any = Infinity;
    for (let i = 0; i < labs.length; i++)
      for (let j = i + 1; j < labs.length; j++) {
        const d = deltaE2000(labs[i]!, labs[j]!);
        any = Math.min(any, d);
        if (Math.abs(Math.floor(i / n) - Math.floor(j / n)) + Math.abs((i % n) - (j % n)) === 1) neighbour = Math.min(neighbour, d);
      }
    out[vision] = { neighbour, any };
  }
  return out;
}

/** True when a palette meets the readability rules above. */
export function gradientReadable(palette: readonly string[]): boolean {
  if (palette.length !== GRADIENT_N * GRADIENT_N || new Set(palette).size !== palette.length) return false;
  const spread = gradientSpread(palette);
  if (spread["normal"]!.neighbour < GRADIENT_MIN_NEIGHBOUR || spread["normal"]!.any < GRADIENT_MIN_ANY) return false;
  return ["protanopia", "deuteranopia", "tritanopia"].every((v) => spread[v]!.neighbour >= GRADIENT_MIN_NEIGHBOUR_CVD);
}

/* ------------------------------------------------------------------ the generator */

/** A draw in [0, 1). */
export type GradientRandom = () => number;

const pick = <T,>(rand: GradientRandom, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]!;
const between = (rand: GradientRandom, lo: number, hi: number) => lo + (hi - lo) * rand();

/** One candidate scheme (not yet checked): corners dark (top left) to light (bottom right) before the turn. */
function candidate(rand: GradientRandom): string[] {
  const a = pick(rand, GRADIENT_FAMILIES);
  let b = pick(rand, GRADIENT_FAMILIES);
  for (let k = 0; k < 6 && b.name === a.name; k++) b = pick(rand, GRADIENT_FAMILIES);
  const dark = Math.max(a.dark ?? 0.32, between(rand, 0.28, 0.4));
  const light = Math.min(b.light ?? 0.93, between(rand, 0.86, 0.94));
  // The other two corners: a third hue on one side, a mix on the other, at middle lightness (a little apart).
  const c = pick(rand, GRADIENT_FAMILIES);
  const midA = dark + (light - dark) * between(rand, 0.4, 0.5);
  const midB = dark + (light - dark) * between(rand, 0.55, 0.65);
  const hueMix = (h1: number, h2: number) => {
    const d = ((h2 - h1 + 540) % 360) - 180;
    return h1 + d / 2;
  };
  const tl = oklchToOklab(dark, a.chroma, a.hue);
  const br = oklchToOklab(light, b.chroma * 0.75, b.hue);
  const tr = oklchToOklab(midA, c.chroma, c.hue);
  const bl = oklchToOklab(midB, (a.chroma + b.chroma) / 2, hueMix(a.hue, b.hue));
  const cells: string[] = [];
  for (let r = 0; r < GRADIENT_N; r++)
    for (let col = 0; col < GRADIENT_N; col++) {
      const y = r / (GRADIENT_N - 1);
      const x = col / (GRADIENT_N - 1);
      const mix = (k: 0 | 1 | 2) => (1 - x) * (1 - y) * tl[k] + x * (1 - y) * tr[k] + (1 - x) * y * bl[k] + x * y * br[k];
      cells.push(toHex([mix(0), mix(1), mix(2)]));
    }
  return orient(cells, Math.floor(rand() * 8));
}

/** One of the eight turns and mirrors of a 5 × 5 board. */
function orient(cells: readonly string[], k: number): string[] {
  const n = GRADIENT_N;
  return Array.from({ length: n * n }, (_, i) => {
    let r = Math.floor(i / n);
    let c = i % n;
    if (k & 4) [r, c] = [c, r];
    if (k & 1) c = n - 1 - c;
    if (k & 2) r = n - 1 - r;
    return cells[r * n + c]!;
  });
}

/** A readable gradient for one round (cell by cell, reading order). */
export function generateGradientPalette(rand: GradientRandom, maxTries = 400): string[] {
  let best: { palette: string[]; worst: number } | null = null;
  for (let tries = 0; tries < maxTries; tries++) {
    const palette = candidate(rand);
    if (gradientReadable(palette)) return palette;
    const spread = gradientSpread(palette);
    const worst = Math.min(spread["normal"]!.neighbour / GRADIENT_MIN_NEIGHBOUR, ...["protanopia", "deuteranopia", "tritanopia"].map((v) => spread[v]!.neighbour / GRADIENT_MIN_NEIGHBOUR_CVD));
    if (new Set(palette).size === palette.length && (!best || worst > best.worst)) best = { palette, worst };
  }
  if (best) return best.palette;
  throw new Error("Gradient: no palette found");
}
