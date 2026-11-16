/**
 * The Attention overhaul's palettes (phase 2 step 4, 15 Nov 2026; docs/design/attention-overhaul.md): the enamel
 * colours the Blender pieces are rendered in, and the legibility rule every dealt colour difference meets on the new
 * stamps. Each colour is chosen in CIE L*a*b* so that colours that may be told apart in play also differ clearly in
 * brightness (a colour-blind player reads them by lightness, never hue alone). Shared by phone, server and checks.
 */

/** The smallest CIE L* gap between two colours a player must tell apart (a swap, a near miss, two cards). */
export const MIN_LIGHTNESS_GAP = 12;
/** The smallest turn a turn difference may be (Eagle Eye's look-alikes are exactly 45°). */
export const MIN_TURN_DEG = 30;
/** The smallest size difference, as a share of the larger. */
export const MIN_SIZE_GAP = 0.15;

/** Double Take's seven enamels (the stored ids are unchanged; only how they are drawn). */
export const SPOT_ENAMEL = {
  BROWN: "#7A4B28",
  PURPLE: "#774BBA",
  RED: "#DF3530",
  BLUE: "#1E8EF1",
  ORANGE: "#F88926",
  PINK: "#F3A9CA",
  GREEN: "#C8DF58",
} as const;

/** Tally's tokens: Double Take's enamels with the stored BROWN drawn and named white, as before. */
export const TALLY_ENAMEL = {
  RED: "#DF3530",
  BLUE: "#1E8EF1",
  GREEN: "#C8DF58",
  PURPLE: "#774BBA",
  PINK: "#F3A9CA",
  ORANGE: "#F88926",
  BROWN: "#F1EEE8",
} as const;

/** Matchmaker pairRev 4: five colours a full step of lightness apart (no red / orange or pink / purple). */
export const PAIR_ENAMEL = {
  BLUE: "#0056BF",
  RED: "#E5342F",
  GREEN: "#40B04F",
  PINK: "#F5A7CE",
  YELLOW: "#FFE238",
} as const;

/** CIE L* (D65) of an sRGB hex colour. */
export function lightness(hex: string): number {
  const h = hex.replace("#", "");
  const lin = [0, 2, 4].map((i) => {
    const c = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const y = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
}

/** True when two colours differ enough in brightness to be told apart without hue. */
export function lightnessApart(a: string, b: string): boolean {
  return Math.abs(lightness(a) - lightness(b)) >= MIN_LIGHTNESS_GAP;
}
