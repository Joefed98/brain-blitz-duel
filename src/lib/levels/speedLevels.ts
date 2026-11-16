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
  /** The gap between pops, in per cent of Normal's (smaller = busier). */
  gapPct: number;
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
  // Expert eased from the brief's 50 links at 2 / 1.6 / 1.3 s (the human-limits player averaged 108; at 45 links and
  // 2.3 / 1.9 / 1.6 s it averages about 140, speed-levels-tune.ts).
  expert: { links: 45, bands: [{ upTo: 15, ms: 2_300 }, { upTo: 30, ms: 1_900 }, { upTo: 45, ms: 1_600 }], reverse: [[21, 25], [36, 40]], cycle: 6, timeLimitMs: 60_000 },
} as const satisfies Record<string, ChainLevel>;

/** Normal (today): up 0.9 → 0.6 s (54 → 36 ticks), 3 up at once, 3–5 flips, 10 % hedgehogs. */
export const BONK_LEVELS = {
  easy: { lifeStart: 66, lifeEnd: 48, maxUp: 2, flips: [2, 2], hedgehogPct: 5, gapPct: 115 },
  hard: { lifeStart: 51, lifeEnd: 36, maxUp: 3, flips: [5, 7], hedgehogPct: 15, gapPct: 80 },
  expert: { lifeStart: 48, lifeEnd: 33, maxUp: 4, flips: [7, 9], hedgehogPct: 20, gapPct: 65 },
} as const satisfies Record<string, BonkLevel>;

/** Normal (today): ten targets up to 140, today's operator mix and speeds. Easy is 80 % speed with no operator needed. */
export const TENFALL_LEVELS = {
  easy: { targets: 8, maxTarget: 60, ops: "plusMinus", speedPct: 80 },
  hard: { targets: 10, maxTarget: 200, ops: "more", speedPct: 115 },
  // Expert eased from the brief's 12 targets up to 300 at +25 % (the human-limits player never finished, about 113):
  // 11 up to 240 at +15 % averages about 144 (speed-levels-tune.ts).
  expert: { targets: 11, maxTarget: 240, ops: "all", speedPct: 115 },
} as const satisfies Record<string, TenfallLevel>;

/**
 * Normal (today): 25 clays, 11 alone then 7 pairs, 3 gold, 14–16 birds, today's speeds. A level's groups fly after its
 * singles (2 = a pair, 3 = a triple); golds scale with the clays (3 for 25).
 */
export const PULL_LEVELS = {
  easy: { clays: 20, pairs: 3, triples: 0, birds: 6, speedPct: 80 },
  // Hard and Expert faster than the brief's +10 % / +15 % (the human-limits player averaged about 170 and 163 there):
  // +25 % and +40 % average about 167 and 157 (speed-levels-tune.ts); a precise shooter barely feels the clays' speed.
  hard: { clays: 28, pairs: 10, triples: 0, birds: 20, speedPct: 125 },
  expert: { clays: 30, pairs: 12, triples: 3, birds: 26, speedPct: 140 },
} as const satisfies Record<string, PullLevel>;

/** A Pull! level's clays as the sim stores them (clayShoot.ts ClayLevel): the groups in order, triples spread through. */
export function pullLevelClays(level: PullLevel): { clays: number; singles: number; groups: number[]; golds: number; birds: number; speedPct: number; overlap: boolean } {
  const groups: number[] = [];
  for (let g = 0; g < level.pairs; g++) groups.push(2);
  // Triples spread evenly through the groups, the first after the opening pairs.
  for (let t = 0; t < level.triples; t++) groups[Math.min(groups.length - 1, Math.floor(((t + 1) * groups.length) / (level.triples + 1)))] = 3;
  const grouped = groups.reduce((a, b) => a + b, 0);
  return {
    clays: level.clays,
    singles: Math.max(0, level.clays - grouped),
    groups,
    golds: Math.max(2, Math.round((3 * level.clays) / 25)),
    birds: level.birds,
    speedPct: level.speedPct,
    overlap: level.birds >= 20,
  };
}

/**
 * Each Speed level in one plain line (the round intro's level line and a game page's, under the level switch). Normal
 * is today's game and needs none. Kept beside the settings above, so a retune changes both together.
 */
export const SPEED_LEVEL_LINES: Readonly<Record<string, Readonly<Partial<Record<"easy" | "hard" | "expert", string>>>>> = {
  reaction: {
    easy: "Easy: 5 flashes, at most one decoy before each, and no gold-like decoys.",
    hard: "Hard: 6 to 8 flashes, 2 or 3 decoys before each, most of them gold-like.",
    expert: "Expert: 8 flashes, up to 4 decoys before each, and the gold shows for 1 second only.",
  },
  numhunt: {
    easy: "Easy: 16 numbers from 1 to 30, and the discs never move.",
    hard: "Hard: 30 numbers in 75 seconds, and the discs move every 10 seconds.",
    expert: "Expert: 30 numbers from highest to lowest in 90 seconds, and the discs move every 8 seconds.",
  },
  chain: {
    easy: "Easy: 30 links with longer windows, and no reversed run.",
    hard: "Hard: 40 links with shorter windows, reversed at links 21 to 25 and 31 to 35.",
    expert: "Expert: 45 links in 60 seconds, six charms to a cycle and two reversed runs.",
  },
  whack: {
    easy: "Easy: two up at once, they stay up longer, two rule flips and fewer hedgehogs.",
    hard: "Hard: more pops, shorter up times, 5 to 7 rule flips and more hedgehogs.",
    expert: "Expert: four up at once, the shortest up times, 7 to 9 rule flips and a hedgehog in five.",
  },
  tendrop: {
    easy: "Easy: 8 targets up to 60, plus and minus tiles only, falling slowly.",
    hard: "Hard: 10 targets up to 200, more divide-by-3 tiles, falling faster.",
    expert: "Expert: 11 targets up to 240, every operator, falling faster still.",
  },
  clayshoot: {
    easy: "Easy: 20 slower clays, 3 doubles and 6 birds.",
    hard: "Hard: 28 faster clays, 10 doubles and 20 birds, some flying together.",
    expert: "Expert: 30 of the fastest clays, doubles and triples, and 26 birds.",
  },
};

/** A Speed game's line for a level (null at Normal, or for any other game). */
export function speedLevelLine(type: string, level: string): string | null {
  if (level !== "easy" && level !== "hard" && level !== "expert") return null;
  return SPEED_LEVEL_LINES[type]?.[level] ?? null;
}
