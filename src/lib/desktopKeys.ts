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
  inkbridge: [["Mouse", "draw"], ["Enter", "release"], ["Z", "undo"], ["R", "reset"], ["D", "drop again"]],
  matchup: [["← → ↑ ↓", "move"], ["Space", "pick"], ["Arrow", "swap picked gem"]],
  orbit: [["Space", "release"], ["C", "checkpoint"]],
  pinball: [["← / Z", "left flipper"], ["→ / M", "right flipper"]],
  rally: [["← →", "paddle"]],
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
  tiles: [["← → ↑ ↓", "slide"], ["Z", "undo"], ["R", "reset"]],
  unblock: [["Z", "undo"], ["R", "reset"]],
};
