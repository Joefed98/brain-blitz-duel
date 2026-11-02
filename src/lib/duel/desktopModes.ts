import type { PuzzleType } from "./types";

/**
 * How each game is presented on a wide screen (31 Oct 2026, the computer layout; docs/desktop-layout.md).
 * Presentation only: every game's world, rules and simulation are the same on every device, and the sim
 * receives exactly the inputs a phone would give it, so a run replays identically (desktop-fairness-check).
 *
 * - `wide`: puzzles and card / board games (no physics world). The board or layout gets a wider, taller
 *   column and re-flows into it (puzzles' boards size from their column; canvas card games keep their
 *   world and scale up in it).
 * - `rotate`: Cue Ball only (Joe, 31 Oct 2026). The identical table is drawn turned 90° clockwise into
 *   landscape; pointer and mouse positions go back through the inverse turn, so the sim gets identical
 *   inputs. Only the table and balls turn: its HUD chips are drawn upright on their own strip
 *   (ArcadeCanvasStage `hud`), ball numbers and effect pop-ups counter-turned, the power meter and spin
 *   button sit outside the turned table. No text is ever drawn rotated.
 * - `tall`: every other arcade game (side-on, behind-camera and the other top-down ones). The world scales to the full height of the play
 *   column and the game's own scenery runs out beyond it to both sides, fading at the edges.
 *
 * Only the desktop breakpoint (1024 px wide and up, src/lib/layoutMode.ts) applies these; tablets and
 * phones keep the portrait column. Every registered game must be listed (the Record type enforces it;
 * desktop-layout-check reports the table).
 */
export type DesktopMode = "wide" | "rotate" | "tall";

/**
 * Which of a rotated game's keys are directions on the screen (and so turn with the world):
 * "arrows" the four arrow keys, "all" the arrows and WASD; omitted when its keys are not directions
 * (an aim turned left or right turns the same way on screen, so it needs no change).
 */
export type RotatedKeys = "arrows" | "all";

export interface DesktopModeInfo {
  mode: DesktopMode;
  /**
   * A cap on the world's width on the desktop layout, CSS px (presentation only; Apex, 1 Nov 2026): the arena slot
   * is no wider, so the world (and the scenery round it) is drawn at most this size. Never applies to a phone.
   */
  maxWorldWidth?: number;
  keys?: RotatedKeys;
  /** One line for the report: why this mode. */
  why: string;
}

const WIDE_PUZZLE: DesktopModeInfo = {
  mode: "wide",
  why: "puzzle board: re-flows into the wider column",
};
const CARDS: DesktopModeInfo = {
  mode: "wide",
  why: "card / board layout, no physics world: scaled up in a wide column",
};
const SIDE: DesktopModeInfo = {
  mode: "tall",
  why: "side-on world: full height, scenery out to both sides",
};
const BEHIND: DesktopModeInfo = {
  mode: "tall",
  why: "behind-camera view: full height, scenery out to both sides",
};
const PORTRAIT: DesktopModeInfo = {
  mode: "tall",
  why: "portrait play with controls at the bottom (paddle, flippers, launcher): kept upright",
};

/**
 * Apex's world on the desktop layout at most 340 px wide (340×634), centred in its column with its static backdrop
 * round it (1 Nov 2026, Joe's fallback after optimising): the largest size at which it held 60 fps in headless
 * Chromium's CPU raster (arcade-play-check --desktop: 538×1003 drew at ~21 ms a frame, 430×802 at 18–19.4 ms,
 * 380×709 at 17.7–18.3 ms, 340×634 at 17.3 ms over three runs).
 */
export const APEX_DESKTOP_WORLD_W = 340;

export const DESKTOP_MODES: Record<PuzzleType, DesktopModeInfo> = {
  // Word
  wordsmith: WIDE_PUZZLE,
  tilegrid: WIDE_PUZZLE,
  wordslide: WIDE_PUZZLE,
  wordhunt: WIDE_PUZZLE,
  wordsearch: WIDE_PUZZLE,
  letterwheel: WIDE_PUZZLE,
  strikeout: WIDE_PUZZLE,
  codeword: WIDE_PUZZLE,
  swapword: WIDE_PUZZLE,
  wordfall: { mode: "tall", why: "falling-letter engine game (practice only): kept upright" },
  // Number
  balance: WIDE_PUZZLE,
  target: WIDE_PUZZLE,
  equation: WIDE_PUZZLE,
  numpyramid: WIDE_PUZZLE,
  measure: WIDE_PUZZLE,
  checkout: WIDE_PUZZLE,
  numline: WIDE_PUZZLE,
  tendrop: {
    mode: "tall",
    why: "falling-number engine game: things fall down the screen, kept upright",
  },
  // Speed
  reaction: WIDE_PUZZLE,
  numhunt: WIDE_PUZZLE,
  stopwatch: WIDE_PUZZLE,
  chain: WIDE_PUZZLE,
  whack: { mode: "tall", why: "Bonk's meadow is a side-on scene: full height" },
  clayshoot: { mode: "tall", why: "side-on sky: full height, scenery out to both sides" },
  // Attention
  stroop: { mode: "tall", why: "lanes falling down the screen: kept upright" },
  symscan: WIDE_PUZZLE,
  spotdiff: WIDE_PUZZLE,
  countup: WIDE_PUZZLE,
  maze: WIDE_PUZZLE,
  pairmatch: WIDE_PUZZLE,
  // Pattern
  unblock: WIDE_PUZZLE,
  blockparty: WIDE_PUZZLE,
  pipes: WIDE_PUZZLE,
  flow: WIDE_PUZZLE,
  iceslide: WIDE_PUZZLE,
  push: WIDE_PUZZLE,
  laser: WIDE_PUZZLE,
  gravity: WIDE_PUZZLE,
  tiles: WIDE_PUZZLE,
  rings: WIDE_PUZZLE,
  // Logic
  lightsout: WIDE_PUZZLE,
  sudoku: WIDE_PUZZLE,
  tower: WIDE_PUZZLE,
  tubes: WIDE_PUZZLE,
  safe: WIDE_PUZZLE,
  bomb: WIDE_PUZZLE,
  nonogram: WIDE_PUZZLE,
  flood: WIDE_PUZZLE,
  tents: WIDE_PUZZLE,
  shikaku: WIDE_PUZZLE,
  fences: WIDE_PUZZLE,
  fillomino: WIDE_PUZZLE,
  bridges: WIDE_PUZZLE,
  kakuro: WIDE_PUZZLE,
  lightup: WIDE_PUZZLE,
  trail: WIDE_PUZZLE,
  dig: WIDE_PUZZLE,
  // Arcade: Cards & Board, and Gemstone's board
  minesweeper: CARDS,
  mahjong: CARDS,
  freecell: CARDS,
  tripeaks: CARDS,
  pokersquares: CARDS,
  fivehands: CARDS,
  matchup: { mode: "wide", why: "match-three board, no physics world: scaled up in a wide column" },
  // Arcade: Cue Ball alone is turned into landscape (Joe, 31 Oct 2026); its HUD stays upright beside the table.
  pool: { mode: "rotate", why: "top-down table: turned to landscape, only the table and balls (HUD, power meter and spin upright)" },
  // Top-down worlds that stay upright (Joe, 31 Oct 2026: only Cue Ball rotates).
  minigolf: { mode: "tall", why: "top-down course, kept upright at full height" },
  orbit: { mode: "tall", why: "top-down space flight, kept upright at full height" },
  snake: { mode: "tall", why: "top-down grid, kept upright at full height" },
  tilt: { mode: "tall", why: "top-down maze, kept upright at full height" },
  cross: { mode: "tall", why: "top-down road, kept upright at full height" },
  curling: { mode: "tall", why: "top-down sheet, kept upright at full height" },
  blockfall: { mode: "tall", why: "a tall well of falling pieces: kept upright at full height, the cabinet glow carried to the sides" },
  // Arcade: side-on and behind-camera worlds, kept upright at full height
  racing: { ...BEHIND, maxWorldWidth: APEX_DESKTOP_WORLD_W, why: "behind-camera view; on desktop its world capped at 340×634, centred, with its static backdrop beside it, for 60 fps" },
  homerun: BEHIND,
  alleyroll: { ...BEHIND, why: "the lane seen from the player's end: kept upright at full height, the alley carried to the sides" },
  freekick: BEHIND,
  bullseye: BEHIND,
  bintoss: SIDE,
  hover: SIDE,
  skyline: SIDE,
  flip: SIDE,
  inkbridge: SIDE,
  swing: SIDE,
  slice: SIDE,
  bubble: { mode: "tall", why: "shooter aiming up from the bottom: kept upright" },
  beat: { mode: "tall", why: "notes fall down lanes to the bottom: kept upright" },
  breaker: PORTRAIT,
  rally: PORTRAIT,
  pinball: PORTRAIT,
  wavefront: PORTRAIT,
  burst: PORTRAIT,
  balltrack: { mode: "tall", why: "cups and marbles read top to bottom: kept upright" },
  // Retired to practice
  swerve: { mode: "tall", why: "practice only, a lane runner: kept upright" },
  steady: { mode: "tall", why: "practice only: kept upright" },
  dual: { mode: "tall", why: "practice only: kept upright" },
  ricochet: { mode: "tall", why: "a two-wall climb up a tall tower: upright at full height, the temple wall and night sky carried on beside it" },
  bastion: { mode: "tall", why: "first person from behind the wall: upright at full height, the dusk carried out to the sides" },
  rooftop: SIDE,
  junction: { mode: "tall", why: "practice only: kept upright" },
  snip: { mode: "tall", why: "practice only, hanging fruit falls down: kept upright" },
  hotfloor: { mode: "tall", why: "practice only: kept upright" },
};

export function desktopModeOf(type: PuzzleType | undefined): DesktopModeInfo | null {
  return type ? (DESKTOP_MODES[type] ?? null) : null;
}
