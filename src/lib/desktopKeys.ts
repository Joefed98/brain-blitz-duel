import { DESKTOP_MODES } from "@/lib/duel/desktopModes";
import type { PuzzleType } from "@/lib/duel/types";

/**
 * Each game's keyboard controls, as the round intro shows them on desktop (DesktopKeys in
 * RoundIntro; never on a phone) and docs/desktop-support.md lists them. Each entry is a key
 * label and what it does; a game missing here plays by mouse alone (its taps and drags work
 * as clicks and mouse drags). Presentation only: the controls themselves live in each stage.
 */
export const DESKTOP_KEYS: Partial<Record<PuzzleType, readonly (readonly [string, string])[]>> = {
  // Arcade
  balltrack: [["← → ↑ ↓", "move"], ["Space", "turn tile"]],
  bintoss: [["← → ↑ ↓", "aim"], ["Space", "throw"]],
  breaker: [["← →", "paddle"], ["Space", "power-up"]],
  bubble: [["← → ↑ ↓", "aim"], ["Space", "shoot"]],
  bullseye: [["← → ↑ ↓", "aim"], ["Space", "shoot"]],
  burst: [["← →", "move"], ["Space", "fire"]],
  cross: [["← → ↑ ↓", "step"]],
  flip: [["Space", "flip"]],
  hover: [["Space", "flap"]],
  homerun: [["Mouse drag", "swing"], ["C / P", "Contact / Power"]],
  inkbridge: [["Mouse", "draw"], ["Enter", "release"], ["Z", "undo"], ["R", "reset"], ["D", "drop again"]],
  matchup: [["← → ↑ ↓", "move"], ["Space", "pick"], ["Arrow", "swap picked gem"]],
  orbit: [["Space", "release"], ["C", "checkpoint"]],
  pinball: [["← / Z", "left flipper"], ["→ / M", "right flipper"]],
  minesweeper: [["Click", "reveal (or flag)"], ["F", "Reveal / Flag switch"]],
  mahjong: [["Click", "pick a tile"], ["S", "shuffle"], ["Z", "undo"], ["R", "reset"]],
  // Cards & Board: the mouse plays them (a click is a tap, a drag a drag).
  freecell: [["Click", "move a card"], ["Drag", "to a pile"], ["↶ / ⟲", "undo / reset"]],
  tripeaks: [["Click", "play a card"], ["Space / S", "turn the stock"]],
  pokersquares: [["Click", "place the card"]],
  fivehands: [["Click", "place your card in a row"]],
  rally: [["← →", "paddle"]],
  racing: [["← → / A D", "steer"], ["↑ / W", "accelerate"], ["↓ / S", "brake"]],
  skyline: [["Space", "drop"]],
  snake: [["← → ↑ ↓", "turn"]],
  swing: [["Space (hold)", "grapple"], ["↑ ↓", "reel"]],
  tilt: [["← →", "tilt"]],
  wavefront: [["← →", "move"]],
  // Arcade, practice only
  bastion: [["← →", "rotate"]],
  dual: [["← / F", "left jump"], ["→ / J", "right jump"]],
  hotfloor: [["Mouse", "tiles"], ["Enter", "go"], ["Z", "undo"], ["C", "clear"]],
  junction: [["← → ↑ ↓ / 1–8", "lights"]],
  ricochet: [["Space", "leap"]],
  rooftop: [["← → ↑ ↓", "swipe"]],
  steady: [["← → (hold)", "steer"]],
  swerve: [["← →", "change lane"]],
  // Engine games on the arcade stage
  stroop: [["← →", "move"], ["↓", "drop"]],
  wordfall: [["Mouse", "tiles"], ["Enter", "enter word"]],
  // Word
  codeword: [["A–Z", "letter"], ["Backspace", "clear"], ["Enter", "next empty"]],
  letterwheel: [["A–Z", "letter"], ["Backspace", "back"], ["Enter", "check word"], ["Space", "shuffle"]],
  strikeout: [["A–Z", "letter"], ["Backspace", "delete"], ["Enter", "solve"]],
  wordhunt: [["A–Z", "letter"], ["Backspace", "back"], ["Enter", "submit"]],
  wordsmith: [["A–Z", "letter"], ["Backspace", "back"], ["Enter", "enter"], ["Esc", "clear"]],
  tilegrid: [["A–Z", "pick tile"], ["Enter", "done"]],
  wordslide: [["Z", "undo"], ["R", "reset"]],
  // Attention
  countup: [["0–9", "count"], ["Backspace", "delete"], ["Enter", "enter"]],
  maze: [["← → ↑ ↓", "move"]],
  spotdiff: [["Enter / N", "next picture"]],
  symscan: [["Enter", "submit"]],
  // Number
  checkout: [["Enter", "throw"], ["Z", "undo"]],
  equation: [["+ − × ÷", "operator"], ["Backspace", "clear"], ["Enter", "next"]],
  measure: [["1–9", "jug"], ["F / E", "fill / empty"], ["R", "reset"]],
  numline: [["← →", "marker"], ["Enter", "place"]],
  numpyramid: [["Enter", "skip"]],
  target: [["1–6", "tile"], ["+ − × ÷", "operator"], ["Enter", "lock"], ["Z", "undo"], ["R", "reset"]],
  trail: [["Z", "undo"], ["R", "reset"]],
  // Logic
  bomb: [["1–9", "wire"], ["A / B", "button"], ["Enter", "defuse"], ["R", "reset"]],
  flood: [["1–5", "colour"]],
  lightsout: [["Z", "undo"], ["R", "reset"]],
  safe: [["← →", "drum"], ["↑ ↓", "turn"], ["Enter", "try"]],
  sudoku: [["← → ↑ ↓", "cell"], ["1–6", "digit"], ["Backspace", "clear"], ["P", "pencil"]],
  tower: [["1–3", "peg"], ["Z", "undo"], ["R", "reset"]],
  tubes: [["1–9, 0", "flask"], ["Z", "undo"], ["R", "reset"]],
  // Pattern
  gravity: [["← → ↑ ↓", "tilt"], ["Z", "undo"], ["R", "reset"]],
  iceslide: [["← → ↑ ↓", "slide"], ["Z", "undo"], ["R", "reset"]],
  laser: [["M / S", "mirror / splitter"], ["Space", "fire"], ["Z", "undo"], ["R", "reset"]],
  push: [["← → ↑ ↓", "move"], ["Z", "undo"], ["R", "reset"]],
  rings: [["↑ ↓", "ring"], ["← →", "turn"]],
  tiles: [["Mouse", "swap two tiles"], ["Esc", "let go"]],
  unblock: [["Z", "undo"], ["R", "reset"]],
};

/**
 * The keys as they work on this game's desktop screen (31 Oct 2026): a rotated game (desktop mode
 * `rotate` with direction keys) names its arrows as they move on the turned screen (the world's left is
 * up there, its right down, its up right); every other game as listed. `desktop` false: as listed.
 */
export function screenKeys(type: PuzzleType, desktop: boolean): readonly (readonly [string, string])[] | undefined {
  const listed = DESKTOP_KEYS[type];
  const info = DESKTOP_MODES[type];
  if (!listed || !desktop || info?.mode !== "rotate" || !info.keys) return listed;
  const screenArrow: Record<string, string> = { "←": "↑", "→": "↓", "↑": "→", "↓": "←" };
  return listed.map(([key, action]) => [key.replace(/[←→↑↓]/g, (a) => screenArrow[a] ?? a), action] as const);
}

/** How the mouse plays each kind of game, for the desktop controls hint (DesktopControlsHint). */
export function mouseLine(type: PuzzleType): string {
  return DESKTOP_KEYS[type]?.some(([k]) => /click|drag/i.test(k)) ? "" : "Mouse: click to tap, drag to swipe or aim";
}
