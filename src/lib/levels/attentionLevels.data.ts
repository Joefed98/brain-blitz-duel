/**
 * The Attention games' levels (the Attention overhaul, stage 3, 15 Nov 2026; docs/design/attention-overhaul.md
 * "Levels"): every lever each game's generator, stage and grader read at each level, as plain data. The level registry
 * (gameLevels.ts) takes its `settings` from here, and the games read the same rows through attentionLevels.ts, so the
 * numbers live in one place. Normal's row is today's game (the registry lists only the other three).
 *
 * A dealt puzzle carries its level (`level`, absent at Normal) and its own clock (`timeLimitMs`); everything else a
 * level changes is in the dealt board itself (sizes, counts, cards). The grading numbers below are part of a level's
 * rules: changing one later needs a new stamp, as every rule change does, so stored rounds grade as they were dealt.
 *
 * D3 (22 Nov 2026, docs/polish-plan-final/difficulty-spec.md "Speed and Attention"): every level is redesigned on one
 * visible lever per game. Level deals from D3 on carry `levelRev: 2` (d3Attention.ts) and read the tables exported
 * under the plain names below; a level deal without the stamp (dealt from 15 to 22 Nov 2026) reads the frozen `*_REV1`
 * table it was dealt on, so it grades exactly as it did. Normal's row is the same in both tables (today's game).
 */

/** Matchmaker (pairmatch). */
export interface PairLevel {
  /** Pairs on the board (cards = 2 × pairs). */
  pairs: number;
  /** Columns the board is laid out in (it grows downwards). */
  cols: number;
  /** How long a miss stays face up before it turns back (a third card skips the wait). */
  flipBackMs: number;
  timeLimitMs: number;
  /** Shapes the pairs are drawn from (fewer shapes: more cards share a shape and differ only in colour). */
  shapes: number;
  /** Speed is full when finished by this many seconds. */
  fullByS: number;
  /** Mismatched tries that cost nothing on an unfinished board. */
  freeMisses: number;
  /**
   * A finish's extras (speed, streak, gold) in full up to this many misses, falling evenly to none at `extrasZeroAt`
   * (null: in full whatever the misses, today's rule). Memory is the skill: a harder level asks for fewer misses.
   */
  extrasFullAt: number | null;
  extrasZeroAt: number | null;
  /**
   * levelRev 2: the extras count memory misses only (a mismatched try whose first card's partner had been seen face up
   * before and was still on the board), never a first look. Absent: every mismatched try counts (levelRev 1).
   */
  memoryMisses?: boolean;
  /** levelRev 2: the gold pair pays when matched by this many ms (absent: the standard's 30 s). */
  goldWindowMs?: number;
  /** levelRev 2: the streak's points count the matches in a row beyond this many (absent: the standard's 3). */
  streakFrom?: number;
}

export const PAIR_LEVELS_REV1 = {
  easy: { pairs: 8, cols: 4, flipBackMs: 900, timeLimitMs: 90_000, shapes: 6, fullByS: 35, freeMisses: 7, extrasFullAt: null, extrasZeroAt: null },
  normal: { pairs: 15, cols: 5, flipBackMs: 600, timeLimitMs: 90_000, shapes: 6, fullByS: 60, freeMisses: 14, extrasFullAt: null, extrasZeroAt: null },
  hard: { pairs: 18, cols: 6, flipBackMs: 500, timeLimitMs: 90_000, shapes: 4, fullByS: 60, freeMisses: 17, extrasFullAt: 6, extrasZeroAt: 14 },
  expert: { pairs: 21, cols: 6, flipBackMs: 400, timeLimitMs: 120_000, shapes: 5, fullByS: 75, freeMisses: 20, extrasFullAt: 6, extrasZeroAt: 14 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", PairLevel>;

/** D3: the board grows 16 → 30 → 42 → 56 cards (the phone's ceiling at 7 × 8); memory misses cost the extras. */
export const PAIR_LEVELS = {
  easy: { pairs: 8, cols: 4, flipBackMs: 900, timeLimitMs: 90_000, shapes: 6, fullByS: 35, freeMisses: 7, extrasFullAt: null, extrasZeroAt: null, streakFrom: -1 },
  normal: PAIR_LEVELS_REV1.normal,
  hard: { pairs: 21, cols: 6, flipBackMs: 500, timeLimitMs: 90_000, shapes: 5, fullByS: 40, freeMisses: 20, extrasFullAt: 3, extrasZeroAt: 9, memoryMisses: true, goldWindowMs: 35_000 },
  expert: { pairs: 28, cols: 7, flipBackMs: 400, timeLimitMs: 90_000, shapes: 6, fullByS: 50, freeMisses: 27, extrasFullAt: 4, extrasZeroAt: 10, memoryMisses: true, goldWindowMs: 45_000 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", PairLevel>;

/** Labyrinth (maze): a perfect maze (one route between any two cells) kept only when it meets every lever. */
export interface MazeLevel {
  cols: number;
  rows: number;
  /** The route's cells, start and exit included. */
  routeMin: number;
  routeMax: number;
  /** False trails at least 5 cells long, and the long ones (at least 11). */
  deadEnds: number;
  longDeadEnds: number;
  turns: number;
  junctions: number;
  /** The carving's share of random branch picks (lower: longer, straighter routes; today's 0.15). */
  branchPick: number;
  /** Expert: the exit is somewhere on the far edges and drawn only once the trail is within `exitRevealCells`. */
  exitHidden: boolean;
  exitRevealCells: number;
  timeLimitMs: number;
  /** Speed full when finished by this many seconds (the par-strict stamp's 32 s at Normal). */
  fullByS: number;
  /** Par points fall to nothing at this many times par (the par-strict stamp's 1.5 at Normal). */
  parZeroAt: number;
  /**
   * levelRev 2: gold keys at the tips of dead ends, every one fetched (in any order) before the exit opens; the par is
   * the shortest walk from the start through every key to the exit, kept between `tourMin` and `tourMax` steps.
   * Absent or 0: no keys.
   */
  keys?: number;
  tourMin?: number;
  tourMax?: number;
  /** levelRev 2 with keys: one key in each quarter of the maze (Expert). */
  keysByQuarter?: boolean;
}

export const MAZE_LEVELS_REV1 = {
  easy: { cols: 13, rows: 15, routeMin: 40, routeMax: 70, deadEnds: 4, longDeadEnds: 1, turns: 38, junctions: 8, branchPick: 0.15, exitHidden: false, exitRevealCells: 0, timeLimitMs: 60_000, fullByS: 20, parZeroAt: 1.5 },
  normal: { cols: 19, rows: 23, routeMin: 70, routeMax: 147, deadEnds: 8, longDeadEnds: 3, turns: 72, junctions: 14, branchPick: 0.15, exitHidden: false, exitRevealCells: 0, timeLimitMs: 60_000, fullByS: 32, parZeroAt: 1.5 },
  hard: { cols: 21, rows: 27, routeMin: 120, routeMax: 180, deadEnds: 12, longDeadEnds: 5, turns: 96, junctions: 20, branchPick: 0.08, exitHidden: false, exitRevealCells: 0, timeLimitMs: 75_000, fullByS: 15, parZeroAt: 1.03 },
  expert: { cols: 21, rows: 27, routeMin: 150, routeMax: 240, deadEnds: 14, longDeadEnds: 6, turns: 104, junctions: 20, branchPick: 0.07, exitHidden: true, exitRevealCells: 4, timeLimitMs: 90_000, fullByS: 20, parZeroAt: 1.03 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", MazeLevel>;

/** D3: the walk lengthens 40–70 → 70–147 → 170–210 → 260–310 steps; Hard and Expert by gold keys to fetch. */
export const MAZE_LEVELS = {
  easy: { cols: 13, rows: 15, routeMin: 40, routeMax: 70, deadEnds: 4, longDeadEnds: 1, turns: 38, junctions: 8, branchPick: 0.15, exitHidden: false, exitRevealCells: 0, timeLimitMs: 60_000, fullByS: 20, parZeroAt: 1.5 },
  normal: MAZE_LEVELS_REV1.normal,
  hard: { cols: 21, rows: 27, routeMin: 90, routeMax: 160, deadEnds: 12, longDeadEnds: 5, turns: 80, junctions: 18, branchPick: 0.08, exitHidden: false, exitRevealCells: 0, timeLimitMs: 90_000, fullByS: 60, parZeroAt: 1.5, keys: 2, tourMin: 170, tourMax: 210 },
  expert: { cols: 21, rows: 27, routeMin: 90, routeMax: 200, deadEnds: 14, longDeadEnds: 6, turns: 80, junctions: 18, branchPick: 0.07, exitHidden: false, exitRevealCells: 0, timeLimitMs: 105_000, fullByS: 86, parZeroAt: 1.5, keys: 4, tourMin: 260, tourMax: 310, keysByQuarter: true },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", MazeLevel>;

/** Double Take (spotdiff): two pictures, each a pair of panels. */
export interface SpotLevel {
  cols: number;
  rows: number;
  /** Differences in each picture (the "n of N" count). */
  differences: number;
  /** The kinds a difference is drawn from; a kind listed twice comes up twice as often. */
  kinds: readonly ("colour" | "kind" | "turn")[];
  /** The hidden seventh (a shape drawn smaller in one panel) in one of the pictures. */
  hidden: boolean;
  /** Hard: a colour change takes the legible colour nearest in lightness (never under the 12 L* minimum). */
  subtleColours: boolean;
  timeLimitMs: number;
  /** Speed full when finished by this many seconds (the standard's 40 s at Normal). */
  fullByS: number;
  /** levelRev 2: wrong taps a picture may hold and still finish (absent: today's 5). */
  missLimit?: number;
  /** levelRev 2: the lower panel of each picture is drawn as the upper one's mirror image (left to right). */
  mirror?: boolean;
}

export const SPOT_LEVELS_REV1 = {
  easy: { cols: 6, rows: 5, differences: 5, kinds: ["colour", "kind"], hidden: false, subtleColours: false, timeLimitMs: 60_000, fullByS: 30 },
  normal: { cols: 8, rows: 6, differences: 6, kinds: ["colour", "kind", "turn"], hidden: true, subtleColours: false, timeLimitMs: 60_000, fullByS: 40 },
  hard: { cols: 8, rows: 6, differences: 7, kinds: ["colour", "kind", "turn"], hidden: true, subtleColours: true, timeLimitMs: 60_000, fullByS: 10 },
  expert: { cols: 8, rows: 8, differences: 8, kinds: ["colour", "kind", "turn", "turn"], hidden: true, subtleColours: true, timeLimitMs: 75_000, fullByS: 12 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", SpotLevel>;

/** D3: the picture grows 20 → 48 → 56 shapes (8 × 7, the phone's ceiling); Expert mirrors the lower panel. */
export const SPOT_LEVELS = {
  easy: { cols: 5, rows: 4, differences: 4, kinds: ["colour", "kind"], hidden: false, subtleColours: false, timeLimitMs: 60_000, fullByS: 25, missLimit: 8 },
  normal: SPOT_LEVELS_REV1.normal,
  hard: { cols: 8, rows: 7, differences: 8, kinds: ["colour", "kind", "turn"], hidden: true, subtleColours: true, timeLimitMs: 75_000, fullByS: 60, missLimit: 3 },
  expert: { cols: 8, rows: 7, differences: 9, kinds: ["colour", "kind", "turn"], hidden: true, subtleColours: true, timeLimitMs: 90_000, fullByS: 80, missLimit: 2, mirror: true },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", SpotLevel>;

/**
 * Eagle Eye (symscan): three grids. Every level, Normal included, plays on scanRev 5's 60 s clock (the brief's new
 * clock, scored to it); Normal's grids are today's.
 */
export interface ScanLevel {
  /** Each grid's columns (square grids; a bigger grid grows downwards). */
  grids: readonly number[];
  /** Eagles facing the target on a one-kind grid. */
  targets: readonly [number, number];
  /** The first grid with two target facings (3: none); from there each facing has `twoEach` eagles. */
  twoFrom: number;
  twoEach: readonly [number, number];
  /** The share of the other eagles turned only 45° from a target (the look-alikes). */
  lookalikes: number;
  /** Speed full when finished by this many seconds. */
  fullByS: number;
}

export const SCAN_MINUTE_MS = 60_000;

export const SCAN_LEVELS_REV1 = {
  easy: { grids: [4, 5, 6], targets: [4, 7], twoFrom: 3, twoEach: [3, 4], lookalikes: 0.3, fullByS: 12 },
  normal: { grids: [5, 6, 7], targets: [5, 9], twoFrom: 2, twoEach: [4, 6], lookalikes: 0.6, fullByS: 15 },
  hard: { grids: [6, 7, 8], targets: [6, 10], twoFrom: 1, twoEach: [3, 5], lookalikes: 0.75, fullByS: 8 },
  expert: { grids: [7, 7, 7], targets: [6, 10], twoFrom: 0, twoEach: [4, 6], lookalikes: 0.8, fullByS: 8 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", ScanLevel>;

/** D3: the first grid holds 16 → 25 → 36 → 64 eagles (8 × 8: the square grid at the phone's 45 px ceiling). */
export const SCAN_LEVELS = {
  easy: { grids: [4, 4, 5], targets: [3, 5], twoFrom: 3, twoEach: [3, 4], lookalikes: 0, fullByS: 20 },
  normal: SCAN_LEVELS_REV1.normal,
  hard: { grids: [6, 7, 8], targets: [6, 9], twoFrom: 1, twoEach: [3, 5], lookalikes: 0.35, fullByS: 36 },
  expert: { grids: [8, 8, 8], targets: [8, 12], twoFrom: 0, twoEach: [4, 6], lookalikes: 0.28, fullByS: 40 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", ScanLevel>;

/** Tally (countup): trays of shapes, each with a question; the last tray of four compares two colours. */
export interface TallyLevel {
  /** Shapes on each tray (the last of four is the comparison tray; no tray above 110). */
  trays: readonly number[];
  /** Each counting tray's answer range. */
  counts: readonly (readonly [number, number])[];
  /** Near-miss groups on each counting tray (another shape in the colour, the shape in another colour, …). */
  nearGroups: number;
  /** The comparison tray (four trays only): the smaller colour's count and the gap (the answer). */
  compareLess: readonly [number, number];
  compareGap: readonly [number, number];
  /** Expert: each counting tray asks for its shape in either of two colours ("How many red or blue squares?"). */
  twoColours: boolean;
  /** Tap a shape to mark it as counted (off on Expert). */
  marks: boolean;
  timeLimitMs: number;
  /** Speed full when finished by this many seconds (the standard's 30 s at Normal). */
  fullByS: number;
  /** levelRev 2 (Easy): each counting tray asks for one shape alone or one colour alone (countRev 6's ask trays). */
  asks?: boolean;
}

export const TALLY_LEVELS_REV1 = {
  easy: { trays: [25, 40, 55], counts: [[3, 10], [4, 12], [5, 14]], nearGroups: 1, compareLess: [3, 6], compareGap: [1, 13], twoColours: false, marks: true, timeLimitMs: 60_000, fullByS: 25 },
  normal: { trays: [50, 80, 110, 50], counts: [[3, 15], [5, 17], [7, 19]], nearGroups: 2, compareLess: [3, 6], compareGap: [1, 13], twoColours: false, marks: true, timeLimitMs: 60_000, fullByS: 30 },
  hard: { trays: [50, 80, 110, 50], counts: [[3, 15], [5, 17], [7, 19]], nearGroups: 3, compareLess: [7, 11], compareGap: [1, 5], twoColours: false, marks: true, timeLimitMs: 60_000, fullByS: 5 },
  expert: { trays: [60, 90, 110, 60], counts: [[5, 17], [7, 19], [9, 21]], nearGroups: 3, compareLess: [7, 11], compareGap: [1, 5], twoColours: true, marks: false, timeLimitMs: 75_000, fullByS: 35 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", TallyLevel>;

/** D3: the first tray holds 15 → 50 → 80 → 110 shapes and the counts climb with it. */
export const TALLY_LEVELS = {
  easy: { trays: [15, 25, 35], counts: [[3, 9], [3, 9], [3, 9]], nearGroups: 1, compareLess: [3, 6], compareGap: [1, 13], twoColours: false, marks: true, timeLimitMs: 60_000, fullByS: 20, asks: true },
  normal: TALLY_LEVELS_REV1.normal,
  hard: { trays: [80, 95, 110, 80], counts: [[8, 22], [9, 23], [10, 24]], nearGroups: 3, compareLess: [7, 11], compareGap: [1, 5], twoColours: false, marks: true, timeLimitMs: 60_000, fullByS: 33 },
  expert: { trays: [110, 110, 110, 110], counts: [[12, 24], [13, 25], [14, 26]], nearGroups: 3, compareLess: [7, 11], compareGap: [1, 5], twoColours: true, marks: false, timeLimitMs: 75_000, fullByS: 48 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", TallyLevel>;

/** Bomb Defusal (bomb): a panel of wires and two buttons, and a card of plain clues with exactly one answer. */
export interface BombLevel {
  wires: number;
  /** Actions the one answer takes. */
  steps: number;
  /** The card's size: every clue on it needed. */
  clues: readonly [number, number];
  /** Expert: the first wrong step sets the bomb off at once (a live server check; no Reset). */
  instant: boolean;
  timeLimitMs: number;
  /** Panels in the level's bank (scripts/bomb-levels-bank.ts). */
  bank: number;
  /** Speed full when defused by this many seconds (the standard's 30 s at Normal). */
  fullByS: number;
  /**
   * levelRev 2 (Hard and Expert): the bank's cards come from the proved 8-wire, 8-step cards, split by how many "Step N"
   * clues give a step away: Hard's at least `stepCluesMin`, Expert's at most `stepCluesMax`; every card worked out by a
   * person-like solver within `ordersMax` orders tried (scripts/bomb-levels-bank.ts).
   */
  stepCluesMin?: number;
  stepCluesMax?: number;
  ordersMax?: number;
}

export const BOMB_LEVELS_REV1 = {
  easy: { wires: 5, steps: 4, clues: [4, 4], instant: false, timeLimitMs: 90_000, bank: 300, fullByS: 25 },
  normal: { wires: 7, steps: 6, clues: [6, 9], instant: false, timeLimitMs: 90_000, bank: 300, fullByS: 30 },
  hard: { wires: 7, steps: 7, clues: [7, 8], instant: false, timeLimitMs: 90_000, bank: 200, fullByS: 15 },
  expert: { wires: 8, steps: 8, clues: [8, 9], instant: true, timeLimitMs: 120_000, bank: 120, fullByS: 40 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", BombLevel>;

/** D3: the card grows 4 → 6–9 → 8–9 clues (eight wires, eight steps); Expert takes Reset and the give-away clues away. */
export const BOMB_LEVELS = {
  easy: { wires: 5, steps: 4, clues: [4, 4], instant: false, timeLimitMs: 90_000, bank: 300, fullByS: 25 },
  normal: BOMB_LEVELS_REV1.normal,
  hard: { wires: 8, steps: 8, clues: [8, 9], instant: false, timeLimitMs: 105_000, bank: 68, fullByS: 66, stepCluesMin: 3, ordersMax: 40 },
  expert: { wires: 8, steps: 8, clues: [8, 9], instant: true, timeLimitMs: 120_000, bank: 44, fullByS: 66, stepCluesMax: 2, ordersMax: 40 },
} as const satisfies Record<"easy" | "normal" | "hard" | "expert", BombLevel>;
