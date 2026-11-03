/**
 * The answer reveal's own screen (3 Nov 2026): a gradient in the game's own colours, taken from its tile
 * (public/tiles/<type>.webp, the game's own art) by `bun scripts/reveal-palette.ts`, which writes
 * revealPalette.data.ts. Each stop is darkened until white text on it reads at least REVEAL_MIN_CONTRAST:1
 * (WCAG), so every reveal line stays legible. Presentation only.
 */
import { REVEAL_PALETTE } from "./revealPalette.data";

/** White text on the gradient's lightest stop reads at least this (WCAG contrast ratio). */
export const REVEAL_MIN_CONTRAST = 7;

/** The gradient a game without a tile falls back to: the app's own dark violet to black. */
export const REVEAL_FALLBACK: readonly [string, string, string] = ["#1D1830", "#110E1D", "#07070A"];

/** A game's reveal gradient: [top, middle, bottom] hex colours. */
export function revealPaletteFor(type: string | undefined): readonly [string, string, string] {
  return (type && REVEAL_PALETTE[type]) || REVEAL_FALLBACK;
}

/** The CSS variables PhoneShell sets on a reveal screen. */
export function revealPaletteStyle(type: string | undefined): Record<string, string> {
  const [top, mid, bottom] = revealPaletteFor(type);
  return { "--reveal-top": top, "--reveal-mid": mid, "--reveal-bottom": bottom };
}

/* ------------------------------------------------------------------ colour maths (shared with the script) */

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: readonly number[]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v!))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** WCAG relative luminance of an sRGB colour. */
export function luminance([r, g, b]: readonly number[]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}

/** Contrast of white text on a colour. */
export function whiteContrast(rgb: readonly number[]): number {
  return 1.05 / (luminance(rgb) + 0.05);
}
