/**
 * The answer reveal's own screen (3 Nov 2026): a gradient in one hue per game (shared screens batch, the same day: an
 * arcade game's curated hue below, a puzzle's category colour, so a category reads as a set), written to
 * revealPalette.data.ts by `bun scripts/reveal-palette.ts`. Each stop is darkened until white text on it reads at least REVEAL_MIN_CONTRAST:1
 * (WCAG), so every reveal line stays legible. Presentation only.
 */
import { REVEAL_PALETTE } from "./revealPalette.data";

/** White text on the gradient's lightest stop reads at least this (WCAG contrast ratio). */
export const REVEAL_MIN_CONTRAST = 7;

/** Each puzzle category's own colour (theme tokens --category-*, styles.css). */
export const REVEAL_CATEGORY_COLOURS: Readonly<Record<string, string>> = {
  word: "#4D8CFF",
  number: "#3DDC84",
  speed: "#FF8A3D",
  attention: "#FF6BD6",
  pattern: "#B26BFF",
  logic: "#2ED3B7",
  arcade: "#FF4D4D",
};

/**
 * One curated hue (degrees) per arcade game, from the game's own world: its sky, felt, table or lava. An arcade game not
 * listed takes the arcade colour.
 */
export const REVEAL_ARCADE_HUES: Readonly<Record<string, number>> = {
  alleyroll: 352, // the funfair's red awning
  balltrack: 28, // orange marble run
  bastion: 14, // Iron Wall's fire
  beat: 288, // Tempo's violet stage
  bintoss: 212, // Swish's evening sky
  blockfall: 258, // Blockzone's indigo well
  breaker: 352, // brick red
  bubble: 192, // Coral Pop's sea
  bullseye: 2, // dartboard red
  burst: 205, // Fission's blue reactor
  cross: 228, // Jaywalk's evening blue
  curling: 198, // ice
  fivehands: 338, // card pink
  flip: 6, // Roofbound's lava
  freecell: 214, // blue felt
  freekick: 128, // pitch green
  homerun: 224, // night ballpark
  hover: 236, // deep space
  inkbridge: 318, // rainbow magenta
  mahjong: 158, // jade
  matchup: 276, // gem violet
  minesweeper: 150, // Minefield's grass
  minigolf: 112, // course green
  orbit: 244, // black space, blue
  pinball: 285, // purple table
  pool: 148, // table felt
  pyramid: 44, // Thirteen's gold sand
  racing: 22, // Apex's sunset
  rally: 218, // blue court
  ricochet: 250, // Moon Climb's night
  skyline: 32, // High Rise's dusk
  slice: 24, // fruit orange
  snake: 168, // Meteor's retro teal
  swing: 10, // Grappler's lava cavern
  tilt: 186, // icy teal
  tripeaks: 196, // Summit's sky
  wavefront: 268, // violet space
};

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
