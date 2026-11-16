/**
 * The Speed games' levels (the Speed overhaul, stage 3, 15 Nov 2026; docs/design/speed-art/README.md "Levels"): each
 * level's settings for Flash, Ascend, Don't Break the Chain, Bonk, Tenfall and Pull!, as plain data. GAME_LEVELS
 * (gameLevels.ts) lists them; each game's generator reads them at the level it is dealt and stamps what its grader and
 * stage need on the dealt puzzle, so a later change to a level here never changes how a stored round grades.
 *
 * Normal is today's game for all six: it has no entry and its deal carries no level field.
 * Shared and pure: no imports, so the phone's level selector can load it with the registry.
 */

/** Flash (reaction). All levels keep the 60 s clock. */
export interface FlashLevel {
  /** Gold flashes, fewest and most (inclusive). */
  flashes: readonly [number, number];
  /** Decoys before each flash, fewest and most (inclusive). */
  decoys: readonly [number, number];
  /** Share (0–1) of the decoys after the first that are gold-like (amber, border, word, half); 0 = plain only. */
  goldLike: number;
  /** How long each gold flash stays up, in ms (Normal 1,500). Stamped as `flashMs` when it differs. */
  flashMs: number;
}

/** Ascend (numhunt). */
export interface AscendLevel {
  count: number;
  /** The numbers' range (inclusive). */
  min: number;
  max: number;
  /** The board reshuffles every this many ms; 0 = never. */
  moveMs: number;
  timeLimitMs: number;
  descending: boolean;
}

/** Don't Break the Chain (chain). */
export interface ChainLevel {
  links: number;
  /** The tap windows: up to each link (1-based, inclusive), the window in ms to make it after the one before. */
  bands: readonly { readonly upTo: number; readonly ms: number }[];
  /** The links (1-based, inclusive) played in reverse. */
  reverse: readonly (readonly [number, number])[];
  /** The cycle's length in charms. */
  cycle: number;
  timeLimitMs: number;
}

/** Bonk (whack). All levels keep the 60 s run. */
export interface BonkLevel {
  /** How long a target stays up at the start and at the end, in ticks (60 a second); it narrows evenly between. */
  lifeStart: number;
  lifeEnd: number;
  /** The most targets up at once. */
  maxUp: number;
  /** Rule flips, fewest and most (inclusive). */
  flips: readonly [number, number];
  /** Hedgehogs as a share of the targets, in per cent. */
  hedgehogPct: number;
}

/** Tenfall (tendrop). All levels keep the 90 s run. */
export interface TenfallLevel {
  targets: number;
  /** The biggest target. */
  maxTarget: number;
  /** Which operator tiles are dealt: "plusMinus" (Easy), "more" (× and ÷ more often), "all" (every operator evenly). */
  ops: "plusMinus" | "more" | "all";
  /** The tiles' fall speed, in per cent of Normal's. */
  speedPct: number;
}

/** Pull! (clayshoot). All levels keep the 60 s run. */
export interface PullLevel {
  clays: number;
  pairs: number;
  /** Of the pairs, how many are triples. */
  triples: number;
  birds: number;
  /** Clay speed, in per cent of Normal's. */
  speedPct: number;
}

export const FLASH_LEVELS = {
  easy: { flashes: [5, 5], decoys: [0, 1], goldLike: 0, flashMs: 1_500 },
  hard: { flashes: [6, 8], decoys: [2, 3], goldLike: 0.75, flashMs: 1_500 },
  expert: { flashes: [8, 8], decoys: [2, 4], goldLike: 0.5, flashMs: 1_000 },
} as const satisfies Record<string, FlashLevel>;

export const ASCEND_LEVELS = {
  easy: { count: 16, min: 1, max: 30, moveMs: 0, timeLimitMs: 60_000, descending: false },
  hard: { count: 30, min: 10, max: 99, moveMs: 10_000, timeLimitMs: 75_000, descending: false },
  expert: { count: 30, min: 10, max: 99, moveMs: 8_000, timeLimitMs: 90_000, descending: true },
} as const satisfies Record<string, AscendLevel>;

/** Normal (today): 40 links, windows 3 / 2.5 / 2 s (to links 13, 26, 40), links 21–25 reversed, five charms, 45 s. */
export const CHAIN_LEVELS = {
  easy: { links: 30, bands: [{ upTo: 10, ms: 3_500 }, { upTo: 20, ms: 3_000 }, { upTo: 30, ms: 2_500 }], reverse: [], cycle: 5, timeLimitMs: 45_000 },
  hard: { links: 40, bands: [{ upTo: 13, ms: 2_500 }, { upTo: 26, ms: 2_000 }, { upTo: 40, ms: 1_600 }], reverse: [[21, 25], [31, 35]], cycle: 5, timeLimitMs: 45_000 },
  expert: { links: 50, bands: [{ upTo: 16, ms: 2_000 }, { upTo: 33, ms: 1_600 }, { upTo: 50, ms: 1_300 }], reverse: [[21, 25], [36, 40]], cycle: 6, timeLimitMs: 60_000 },
} as const satisfies Record<string, ChainLevel>;
