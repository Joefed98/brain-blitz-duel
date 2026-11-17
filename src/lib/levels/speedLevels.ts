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
  /** The finish earns its full speed points by this many seconds (Normal: 40). */
  fullByS: number;
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
  // Expert: 3–5 decoys, ¾ gold-like (the brief's 2–4 of all kinds stepped too little from Hard; Joe, 16 Nov 2026).
  expert: { flashes: [8, 8], decoys: [3, 5], goldLike: 0.75, flashMs: 1_000 },
} as const satisfies Record<string, FlashLevel>;

export const ASCEND_LEVELS = {
  easy: { count: 16, min: 1, max: 30, moveMs: 0, timeLimitMs: 60_000, descending: false, fullByS: 40 },
  // Hard and Expert: the brief's 75 s and 90 s clocks let a strong player finish 30 numbers in about half the time for
  // full points, so no step up (Joe, 16 Nov 2026: a clear step up matters most): a shorter clock and an earlier
  // full-speed time.
  hard: { count: 30, min: 10, max: 99, moveMs: 10_000, timeLimitMs: 50_000, descending: false, fullByS: 25 },
  expert: { count: 30, min: 10, max: 99, moveMs: 8_000, timeLimitMs: 45_000, descending: true, fullByS: 20 },
} as const satisfies Record<string, AscendLevel>;

/** Normal (today): 40 links, windows 3 / 2.5 / 2 s (to links 13, 26, 40), links 21–25 reversed, five charms, 45 s. */
export const CHAIN_LEVELS = {
  easy: { links: 30, bands: [{ upTo: 10, ms: 3_500 }, { upTo: 20, ms: 3_000 }, { upTo: 30, ms: 2_500 }], reverse: [], cycle: 5, timeLimitMs: 45_000 },
  hard: { links: 40, bands: [{ upTo: 13, ms: 2_500 }, { upTo: 26, ms: 2_000 }, { upTo: 40, ms: 1_600 }], reverse: [[21, 25], [31, 35]], cycle: 5, timeLimitMs: 45_000 },
  // Expert as the brief, the last window 1.4 s (1.3 s: only 28 % of runs under human limits finished): about 119 on
  // average, a clear step below Hard, its best runs about 180 (Joe, 16 Nov 2026: humanly possible to score well on).
  expert: { links: 50, bands: [{ upTo: 16, ms: 2_000 }, { upTo: 33, ms: 1_600 }, { upTo: 50, ms: 1_400 }], reverse: [[21, 25], [36, 40]], cycle: 6, timeLimitMs: 60_000 },
} as const satisfies Record<string, ChainLevel>;

/** Normal (today): up 0.9 → 0.6 s (54 → 36 ticks), 3 up at once, 3–5 flips, 10 % hedgehogs. */
export const BONK_LEVELS = {
  easy: { lifeStart: 66, lifeEnd: 48, maxUp: 2, flips: [2, 2], hedgehogPct: 5, gapPct: 115 },
  // Hard and Expert shorter and busier than the brief's (0.85 → 0.6 s and 0.8 → 0.55 s): a 0.25 s player still reached
  // those in time, so neither stepped down from Normal (Joe, 16 Nov 2026: a clear step up matters most).
  hard: { lifeStart: 43, lifeEnd: 30, maxUp: 3, flips: [5, 7], hedgehogPct: 15, gapPct: 50 },
  expert: { lifeStart: 40, lifeEnd: 27, maxUp: 4, flips: [7, 9], hedgehogPct: 20, gapPct: 50 },
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
  // Hard and Expert faster and with more birds than the brief's (+10 % / +15 %, 20 / 26 birds: Hard scored as Normal
  // under human limits): +45 % with 24 birds and +60 % with 32 step down clearly (speed-levels-tune.ts).
  hard: { clays: 28, pairs: 10, triples: 0, birds: 24, speedPct: 145 },
  expert: { clays: 30, pairs: 12, triples: 3, birds: 32, speedPct: 160 },
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
    expert: "Expert: 8 flashes, 3 to 5 decoys before each, and the gold shows for 1 second only.",
  },
  numhunt: {
    easy: "Easy: 16 numbers from 1 to 30, and the discs never move.",
    hard: "Hard: 30 numbers in 50 seconds, and the discs move every 10 seconds.",
    expert: "Expert: 30 numbers from highest to lowest in 45 seconds, and the discs move every 8 seconds.",
  },
  chain: {
    easy: "Easy: 30 links with longer windows, and no reversed run.",
    hard: "Hard: 40 links with shorter windows, reversed at links 21 to 25 and 31 to 35.",
    expert: "Expert: 50 links in 60 seconds, six charms to a cycle and two reversed runs.",
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
    hard: "Hard: 28 faster clays, 10 doubles and 24 birds, some flying together.",
    expert: "Expert: 30 of the fastest clays, doubles and triples, and 32 birds.",
  },
};

/** A Speed game's line for a level (null at Normal, or for any other game). */
export function speedLevelLine(type: string, level: string): string | null {
  if (level !== "easy" && level !== "hard" && level !== "expert") return null;
  return SPEED_LEVEL_LINES[type]?.[level] ?? null;
}

interface HowLine {
  action: string;
  detail: string;
  helpOnly?: boolean;
}

/**
 * A Speed level's goal and how-to lines: Normal's (the game's instructions) with the lines a level changes rewritten in
 * the same words (counts, order, flips, birds…). Normal, and every other game, gets `base` back unchanged.
 */
export function speedLevelInstructions<T extends { goal: string; how: readonly HowLine[] }>(type: string, level: string, base: T): T {
  if (level !== "easy" && level !== "hard" && level !== "expert") return base;
  const edit = SPEED_LEVEL_EDITS[type]?.[level];
  if (!edit) return base;
  const how: HowLine[] = [];
  for (const line of base.how) {
    const swap = edit.how?.[line.action];
    if (swap === null) continue;
    how.push(swap ? { ...line, ...swap } : line);
  }
  return { ...base, goal: edit.goal ?? base.goal, how };
}

/** A Speed level's goal for the game screen's goal line (null: the game's own). */
export function speedLevelGoal(type: string, level: string): string | null {
  if (level !== "easy" && level !== "hard" && level !== "expert") return null;
  return SPEED_LEVEL_EDITS[type]?.[level]?.frameGoal ?? null;
}

type LevelEdit = { goal?: string; frameGoal?: string; how?: Record<string, Partial<HowLine> | null> };

/** Keyed by Normal's how-line action; null drops the line (a rule the level doesn't have). */
const SPEED_LEVEL_EDITS: Record<string, Partial<Record<"easy" | "hard" | "expert", LevelEdit>>> = {
  reaction: {
    easy: { how: { "Wait for gold;": { detail: "it comes 5 times." }, "Only a full gold screen": { detail: "counts: the other colours are traps." } } },
    hard: { how: { "Wait for gold;": { detail: "it comes 6 to 8 times." } } },
    expert: { how: { "Wait for gold;": { detail: "it comes 8 times and stays for 1 second." }, "Only a full gold screen": { detail: "counts: 3 to 5 traps come before each." } } },
  },
  numhunt: {
    easy: { goal: "Tap all 16 numbers from smallest to largest.", how: { "All the numbers": null, "The timer above the board": null } },
    hard: { goal: "Tap all 30 numbers from smallest to largest in 50 s.", how: { "All the numbers": { detail: "move every 10 seconds." }, "The timer above the board": { detail: "counts up to 10 s, then the numbers move and it starts again from 0." } } },
    expert: {
      goal: "Tap all 30 numbers from largest to smallest in 45 s.",
      frameGoal: "Tap the numbers highest to lowest",
      how: {
        "Find the smallest": { action: "Find the largest" },
        "All the numbers": { detail: "move every 8 seconds." },
        "The timer above the board": { detail: "counts up to 8 s, then the numbers move and it starts again from 0." },
      },
    },
  },
  chain: {
    easy: { goal: "Tap 30 charms, following the cycle.", how: { "After link 20,": null, "Reverse:": null, "Keep momentum": { detail: "– 3.5 s for links 1–10, 3 s for 11–20, 2.5 s for 21–30. The first tap is untimed." } } },
    hard: {
      how: {
        "After link 20,": { action: "After links 20 and 30,", detail: "go backwards for 5 links." },
        "Keep momentum": { detail: "– 2.5 s for links 1–13, 2 s for 14–26, 1.6 s for 27–40. The first tap is untimed." },
        "Reverse:": { detail: "a banner warns before each; links 21–25 and 31–35 run last to first." },
      },
    },
    expert: {
      goal: "Tap 50 charms, following the cycle.",
      how: {
        "Tap the five charms": { action: "Tap the six charms" },
        "After link 20,": { action: "After links 20 and 35,", detail: "go backwards for 5 links." },
        "Keep momentum": { detail: "– 2 s for links 1–16, 1.6 s for 17–33, 1.4 s for 34–50. The first tap is untimed." },
        "Every 5 links": { detail: "the board reshuffles with six new charms." },
        "Reverse:": { detail: "a banner warns before each; links 21–25 and 36–40 run last to first." },
      },
    },
  },
  whack: {
    easy: { how: { "The rule flips": { detail: "twice: watch the banner." } } },
    hard: { how: { "The rule flips": { detail: "5–7 times: watch the banner." } } },
    expert: { how: { "The rule flips": { detail: "7–9 times: watch the banner." } } },
  },
  tendrop: {
    easy: { how: { "×2, ÷2, ÷3 and −N": { action: "−N", detail: "takes away from the total." }, "A ÷ that doesn’t divide exactly": null } },
  },
  clayshoot: {
    easy: { goal: "Shoot all 20 clays without hitting a bird.", how: { "Don’t shoot": { detail: "the 6 white birds." } } },
    hard: { goal: "Shoot all 28 clays without hitting a bird.", how: { "Don’t shoot": { detail: "the 24 white birds." } } },
    expert: { goal: "Shoot all 30 clays without hitting a bird.", how: { "Don’t shoot": { detail: "the 32 white birds." }, "Later on, two fly at once": { action: "Later on, two or three fly at once" } } },
  },
};
