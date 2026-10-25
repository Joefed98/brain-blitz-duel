/**
 * Colour distance under normal and simulated colour-blind vision (the player-looks-check method: Machado-style
 * protan / deutan / tritan matrices on linear sRGB, then CIEDE2000), for Jumbled's gradient.
 */
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const VISION: Record<string, number[][]> = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
function lab(linear: number[]): [number, number, number] {
  const [r, g, b] = linear.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
export function deltaE2000([L1, a1, b1]: number[], [L2, a2, b2]: number[]): number {
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
export const seen = (hex: string, m: number[][]) => {
  const l = rgb(hex).map(lin);
  return lab(m.map((row) => row[0]! * l[0]! + row[1]! * l[1]! + row[2]! * l[2]!));
};

/** The smallest ΔE2000 between grid neighbours (and between any two tiles) of a 5 × 5 palette, per vision. */
export function paletteSpread(palette: readonly string[], n = 5): Record<string, { neighbour: number; any: number }> {
  const out: Record<string, { neighbour: number; any: number }> = {};
  for (const [vision, m] of Object.entries(VISION)) {
    const labs = palette.map((h) => seen(h, m));
    let neighbour = Infinity, any = Infinity;
    for (let i = 0; i < labs.length; i++)
      for (let j = i + 1; j < labs.length; j++) {
        const d = deltaE2000(labs[i]!, labs[j]!);
        any = Math.min(any, d);
        const [ri, ci, rj, cj] = [Math.floor(i / n), i % n, Math.floor(j / n), j % n];
        if (Math.abs(ri - rj) + Math.abs(ci - cj) === 1) neighbour = Math.min(neighbour, d);
      }
    out[vision] = { neighbour: Math.round(neighbour * 10) / 10, any: Math.round(any * 10) / 10 };
  }
  return out;
}
