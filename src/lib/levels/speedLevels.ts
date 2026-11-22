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
  /** D3 (22 Nov 2026): when the first gold comes, fewest and most ms (absent: 4–7 s). */
  firstGold?: readonly [number, number];
  /** D3: the gap from one gold to the next, ms (absent: 5–8 s). */
  goldGap?: readonly [number, number];
  /** D3: the last trap's lead before its gold, ms (absent: 0.8–2 s). */
  lead?: readonly [number, number];
  /** D3: the gap between traps, ms (absent: 0.9–1.6 s). */
  trapGap?: readonly [number, number];
  /** D3: how long a trap stays up, ms (absent: 600). Stamped as `trapMs` when it differs. */
  trapMs?: number;
  /** D3: no trap before the first gold. */
  firstClear?: boolean;
  /** D3: the level's own per-flash curve ([ms, points] knots, falling), stamped as `flashCurve` (tapRev 8). */
  curve?: readonly (readonly [number, number])[];
  /** D3: false starts the level forgives (no cost, the steady hand kept), stamped as `flashFree` (tapRev 8). */
  free?: number;
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
  /** D3 (22 Nov 2026): links per board, a new board every cycle (absent: 5). Stamped in `chainLevel`. */
  block?: number;
  /** D3: the finish's full-speed time, s (absent: the stamp's, 30 or 33). Stamped in `chainLevel`. */
  fullByS?: number;
  /** D3: wrong taps forgiven (Easy's spare link; absent: none). Stamped in `chainLevel`. */
  spare?: number;
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
  /** D3 (22 Nov 2026): burrows across and down (absent: 4). Stamped in `bonkLevel`. */
  cols?: number;
  /** D3: the share of the targets, %, that counts as hitting them all (absent: 100). Stamped in `bonkLevel`. */
  hitsFullPct?: number;
}

/** Tenfall (tendrop). All levels keep the 90 s run. */
export interface TenfallLevel {
  targets: number;
  /** The biggest target. */
  maxTarget: number;
  /**
   * Which operator tiles are dealt: "plusMinus" (Easy), "more" (÷3 doubled), "times" (×2 on three tiles in ten),
   * "all" (every operator evenly).
   */
  ops: "plusMinus" | "more" | "all" | "times";
  /** The tiles' fall speed, in per cent of Normal's. */
  speedPct: number;
  /** D3 (22 Nov 2026): the first target, the targets climbing evenly to `maxTarget` (absent: the overhaul's ramp). */
  minTarget?: number;
  /** D3: the run's full-speed time, s (tenRev 7: each stage's `parTicks`; absent: Normal's 70 s). */
  fullByS?: number;
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
  /** D3 (22 Nov 2026): where the quick credit counts in full, % of a run's most (clayRev 11; absent: Normal's 85). */
  quickFullPct?: number;
}

/**
 * D3 (22 Nov 2026; docs/polish-plan-final/difficulty-spec.md "Flash"): the lever is the traps before each gold. Each
 * level scores on its own per-flash curve (tapRev 8, stamped as `flashCurve`) and Hard and Expert forgive a few false
 * starts (`flashFree`), so the best player at the human limits still reaches 200 on a fifth of Expert runs while an
 * average player is fooled far more often (scripts/d3-ladder.ts reaction).
 */
export const FLASH_LEVELS = {
  // Easy: five golds, the first within 1.5–3 s with no trap before it, at most one plain trap before the others, a
  // gentler curve (200 by 0.28 s).
  easy: { flashes: [5, 5], decoys: [0, 1], goldLike: 0, flashMs: 1_500, firstGold: [1_500, 3_000], firstClear: true, curve: [[280, 200], [310, 188], [380, 150], [500, 80], [650, 20], [850, 0]] },
  // Hard: eight golds, 3–4 traps before each (about 28 a round against Normal's 13), each 0.45 s, 0.6–1 s apart, three
  // in four gold look-alikes, the gold up 0.9 s; one false start forgiven, 200 by 0.25 s.
  hard: {
    flashes: [8, 8], decoys: [3, 4], goldLike: 0.75, flashMs: 900, trapMs: 450, lead: [600, 1_000], trapGap: [600, 1_000], firstGold: [3_000, 5_000], goldGap: [5_000, 6_500], free: 1,
    curve: [[250, 200], [270, 188], [330, 150], [450, 80], [600, 20], [800, 0]],
  },
  // Expert: nine golds, 6–8 traps before each (about 63 a round), each 0.35 s, 0.5–0.65 s apart (under two a second),
  // nine in ten gold look-alikes, the gold up 0.6 s; three false starts forgiven, 200 by 0.28 s.
  expert: {
    flashes: [9, 9], decoys: [6, 8], goldLike: 0.9, flashMs: 600, trapMs: 350, lead: [500, 650], trapGap: [500, 650], firstGold: [4_000, 5_000], goldGap: [5_500, 6_000], free: 3,
    curve: [[280, 200], [300, 188], [360, 150], [460, 80], [600, 20], [800, 0]],
  },
} as const satisfies Record<string, FlashLevel>;

/**
 * D3 (22 Nov 2026; difficulty-spec.md "Ascend"): the lever is the numbers on the board, 16 / 24 / 32 / 40 (40 is the
 * phone's ceiling at today's 42 px discs). The search grows with the board, so each level's clock and full-speed time
 * are set from the best player at the human limits (Hard about 34 s, Expert about 52 s; scripts/d3-ladder.ts numhunt).
 */
export const ASCEND_LEVELS = {
  // Easy: sixteen discs, 1 to 16 with no gaps, that never move; full speed by 15 s.
  easy: { count: 16, min: 1, max: 16, moveMs: 0, timeLimitMs: 60_000, descending: false, fullByS: 15 },
  // Hard: thirty-two discs from 10 to 99, moving every 10 s, a 42 s clock, full speed by 34 s.
  hard: { count: 32, min: 10, max: 99, moveMs: 10_000, timeLimitMs: 42_000, descending: false, fullByS: 34 },
  // Expert: forty discs, highest first, moving every 8 s, a 55 s clock, full speed by 52 s.
  expert: { count: 40, min: 10, max: 99, moveMs: 8_000, timeLimitMs: 55_000, descending: true, fullByS: 52 },
} as const satisfies Record<string, AscendLevel>;

/**
 * Normal (today): 40 links, windows 3 / 2.5 / 2 s (to links 13, 26, 40), links 21–25 reversed, five charms, a board every
 * five links, 45 s (chainDepthRev 4: speed full by 33 s).
 *
 * D3 (22 Nov 2026; difficulty-spec.md "Don't Break the Chain"): the lever is the charms in the cycle, 4 / 5 / 6 / 7, with
 * a new board every cycle (`block`); a seven-charm cycle uses one shape three times (three shapes can't each appear at
 * most twice in seven). Easy forgives one wrong tap (`spare`). Each level's full-speed time is set from the best player
 * at the human limits (scripts/d3-ladder.ts chain).
 */
export const CHAIN_LEVELS = {
  easy: { links: 24, bands: [{ upTo: 8, ms: 6_000 }, { upTo: 16, ms: 5_500 }, { upTo: 24, ms: 5_000 }], reverse: [], cycle: 4, block: 4, spare: 1, timeLimitMs: 60_000, fullByS: 30 },
  hard: { links: 48, bands: [{ upTo: 16, ms: 2_500 }, { upTo: 32, ms: 2_000 }, { upTo: 48, ms: 1_600 }], reverse: [[19, 24], [37, 42]], cycle: 6, block: 6, timeLimitMs: 60_000, fullByS: 40 },
  expert: { links: 56, bands: [{ upTo: 19, ms: 2_000 }, { upTo: 38, ms: 1_600 }, { upTo: 56, ms: 1_400 }], reverse: [[15, 21], [29, 35], [43, 49]], cycle: 7, block: 7, timeLimitMs: 70_000, fullByS: 50 },
} as const satisfies Record<string, ChainLevel>;

/**
 * Normal (today): a 4 × 4 lawn, up 0.9 → 0.6 s (54 → 36 ticks), 3 up at once, 3–5 flips, 10 % hedgehogs (whackRev 5: the
 * combo's quick window full to 0.4 s).
 *
 * D3 (22 Nov 2026; difficulty-spec.md "Bonk"): the lever is the burrows on the lawn, 3 × 3 / 4 × 4 / 5 × 5 / 6 × 6
 * (`cols`, stamped in `bonkLevel`). PROVISIONAL (for Joe): Expert's best player at the human limits reaches 200 on
 * under a fifth of runs while Normal's share stays at 23 % (scripts/d3-ladder.ts whack).
 */
export const BONK_LEVELS = {
  easy: { cols: 3, lifeStart: 90, lifeEnd: 66, maxUp: 2, flips: [2, 2], hedgehogPct: 5, gapPct: 140 },
  hard: { cols: 5, lifeStart: 54, lifeEnd: 36, maxUp: 3, flips: [5, 7], hedgehogPct: 15, gapPct: 100 },
  expert: { cols: 6, lifeStart: 54, lifeEnd: 36, maxUp: 3, flips: [7, 9], hedgehogPct: 20, gapPct: 90 },
} as const satisfies Record<string, BonkLevel>;

/**
 * Normal (today): ten targets up to 140, today's operator mix and speeds (tenRev 7: speed full by 70 s, gold in full at
 * three gold tens).
 *
 * D3 (22 Nov 2026; difficulty-spec.md "Tenfall"): the lever is the size of the targets from the first one: Easy 10, Normal
 * about 22, Hard 40 climbing to 250 with ×2 on three tiles in ten, Expert 150 climbing to 400 with every operator. The
 * full-speed time is set from the best player at the human limits (scripts/d3-ladder.ts tendrop); Expert's eight targets
 * leave that player's gold line (two gold tens of eight) within reach.
 */
export const TENFALL_LEVELS = {
  easy: { targets: 8, maxTarget: 60, ops: "plusMinus", speedPct: 80 },
  hard: { targets: 10, minTarget: 40, maxTarget: 250, ops: "times", speedPct: 115, fullByS: 79 },
  expert: { targets: 8, minTarget: 150, maxTarget: 400, ops: "all", speedPct: 115, fullByS: 75 },
} as const satisfies Record<string, TenfallLevel>;

/**
 * Normal (today): 25 clays, 11 alone then 7 pairs, 3 gold, 14–16 birds, today's speeds. A level's groups fly after its
 * singles (2 = a pair, 3 = a triple); golds scale with the clays (3 for 25).
 */
export const PULL_LEVELS = {
  easy: { clays: 20, pairs: 3, triples: 0, birds: 6, speedPct: 80 },
  // D3 (22 Nov 2026; difficulty-spec.md "Pull!"): the lever is the clays in the air together. Hard flies all thirty in
  // doubles from the first pull, Expert all thirty-six in triples; each level's quick credit counts in full at its own
  // line (clayRev 11, `quickFullPct`), set from the best player at the human limits (scripts/d3-ladder.ts clayshoot).
  hard: { clays: 30, pairs: 15, triples: 0, birds: 24, speedPct: 145, quickFullPct: 80 },
  expert: { clays: 36, pairs: 12, triples: 12, birds: 32, speedPct: 160, quickFullPct: 66 },
} as const satisfies Record<string, PullLevel>;

/** A Pull! level's clays as the sim stores them (clayShoot.ts ClayLevel): the groups in order, triples spread through. */
export function pullLevelClays(level: PullLevel): { clays: number; singles: number; groups: number[]; golds: number; birds: number; speedPct: number; overlap: boolean; quickFullPct?: number } {
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
    ...(level.quickFullPct !== undefined ? { quickFullPct: level.quickFullPct } : {}),
  };
}

/**
 * Each Speed level in one plain line (the round intro's level line and a game page's, under the level switch). Normal
 * is today's game and needs none. Kept beside the settings above, so a retune changes both together.
 */
export const SPEED_LEVEL_LINES: Readonly<Record<string, Readonly<Partial<Record<"easy" | "hard" | "expert", string>>>>> = {
  reaction: {
    easy: "Easy: 5 golds, the first within 3 seconds with no trap before it, and only plain traps.",
    hard: "Hard: 8 golds, 3 or 4 quick traps before each, most of them gold-like.",
    expert: "Expert: 9 golds, 6 to 8 fast traps before each, and the gold shows for 0.6 seconds.",
  },
  numhunt: {
    easy: "Easy: 16 numbers from 1 to 16, and the discs never move.",
    hard: "Hard: 32 numbers in 42 seconds, and the discs move every 10 seconds.",
    expert: "Expert: 40 numbers from highest to lowest in 55 seconds, moving every 8 seconds.",
  },
  chain: {
    easy: "Easy: 4 charms to a cycle, 24 links with long windows, and one wrong tap forgiven.",
    hard: "Hard: 6 charms to a cycle, 48 links, shorter windows and two reversed boards.",
    expert: "Expert: 7 charms to a cycle, 56 links in 70 seconds and three reversed boards.",
  },
  whack: {
    easy: "Easy: a 3 by 3 lawn, two up at once, and they stay up longer.",
    hard: "Hard: a 5 by 5 lawn, 5 to 7 rule flips and more hedgehogs.",
    expert: "Expert: a 6 by 6 lawn, 7 to 9 rule flips and a hedgehog in five.",
  },
  tendrop: {
    easy: "Easy: 8 targets up to 60, plus and minus tiles only, falling slowly.",
    hard: "Hard: 10 targets from 40 up to 250, falling faster, with lots of ×2 tiles.",
    expert: "Expert: 8 targets from 150 up to 400, every operator, falling faster.",
  },
  clayshoot: {
    easy: "Easy: 20 slower clays, 3 doubles and 6 birds.",
    hard: "Hard: 30 fast clays, every one in a double, and 24 birds.",
    expert: "Expert: 36 of the fastest clays, every one in a triple, and 32 birds.",
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
    hard: { how: { "Wait for gold;": { detail: "it comes 8 times and stays for 0.9 seconds." }, "Only a full gold screen": { detail: "counts: 3 or 4 traps come before each." } } },
    expert: { how: { "Wait for gold;": { detail: "it comes 9 times and stays for 0.6 seconds." }, "Only a full gold screen": { detail: "counts: 6 to 8 traps come before each." } } },
  },
  numhunt: {
    easy: { goal: "Tap all 16 numbers from smallest to largest.", how: { "All the numbers": null, "The timer above the board": null } },
    hard: { goal: "Tap all 32 numbers from smallest to largest in 42 s.", how: { "All the numbers": { detail: "move every 10 seconds." }, "The timer above the board": { detail: "counts up to 10 s, then the numbers move and it starts again from 0." } } },
    expert: {
      goal: "Tap all 40 numbers from largest to smallest in 55 s.",
      frameGoal: "Tap the numbers highest to lowest",
      how: {
        "Find the smallest": { action: "Find the largest" },
        "All the numbers": { detail: "move every 8 seconds." },
        "The timer above the board": { detail: "counts up to 8 s, then the numbers move and it starts again from 0." },
      },
    },
  },
  chain: {
    easy: {
      goal: "Tap 24 charms, following the cycle.",
      how: {
        "Tap the five charms": { action: "Tap the four charms" },
        "After link 20,": null,
        "Reverse:": null,
        "Keep momentum": { detail: "– 6 s for links 1–8, 5.5 s for 9–16, 5 s for 17–24. The first tap is untimed; one wrong tap is forgiven." },
        "Every 5 links": { action: "Every 4 links", detail: "the board reshuffles with four new charms." },
      },
    },
    hard: {
      goal: "Tap 48 charms, following the cycle.",
      how: {
        "Tap the five charms": { action: "Tap the six charms" },
        "After link 20,": { action: "On links 19–24 and 37–42,", detail: "go backwards." },
        "Keep momentum": { detail: "– 2.5 s for links 1–16, 2 s for 17–32, 1.6 s for 33–48. The first tap is untimed." },
        "Every 5 links": { action: "Every 6 links", detail: "the board reshuffles with six new charms." },
        "Reverse:": { detail: "a banner warns before each reversed board; it runs last to first." },
      },
    },
    expert: {
      goal: "Tap 56 charms, following the cycle.",
      how: {
        "Tap the five charms": { action: "Tap the seven charms" },
        "After link 20,": { action: "On links 15–21, 29–35 and 43–49,", detail: "go backwards." },
        "Keep momentum": { detail: "– 2 s for links 1–19, 1.6 s for 20–38, 1.4 s for 39–56. The first tap is untimed." },
        "Every 5 links": { action: "Every 7 links", detail: "the board reshuffles with seven new charms." },
        "Reverse:": { detail: "a banner warns before each reversed board; it runs last to first." },
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
    hard: { goal: "Shoot all 30 clays without hitting a bird.", how: { "Don’t shoot": { detail: "the 24 white birds." }, "Later on, two fly at once": { action: "From the first pull, two fly at once" } } },
    expert: { goal: "Shoot all 36 clays without hitting a bird.", how: { "Don’t shoot": { detail: "the 32 white birds." }, "Later on, two fly at once": { action: "From the first pull, three fly at once" } } },
  },
};
