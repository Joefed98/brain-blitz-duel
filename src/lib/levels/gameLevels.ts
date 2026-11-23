/**
 * The level registry (phase 2 step 4, 15 Nov 2026; docs/design/difficulty/README.md): which levels each game offers
 * and its settings per level. Shared and light (the phone reads it to draw the level selector; the server to deal),
 * so keep each entry to plain data: no imports of game code.
 *
 * A game with no entry offers Normal only, and Normal is exactly today's game. A family session adds a game's levels
 * by adding ONE entry here:
 *
 *   tents: {
 *     levels: {
 *       easy: { settings: { colours: 3, reef: 75, every: 10, trail: 2, banksFull: 8, coreFull: 50, speedFullLeft: 1800 } },
 *       hard: { settings: { colours: 5, reef: 110, every: 5, trail: 1, banksFull: 20, coreFull: 110, speedFullLeft: 1800 } },
 *     },
 *   },
 *
 * then reading the level in its generator (GenerateContext `level`, or `gameLevelSettings(type, level)`), stamping
 * anything its grader or stage must know on the dealt puzzle (the deal adds `level` itself), and grading from the
 * stored puzzle (`puzzleLevel(puzzle)`), so older stamps grade exactly as before. A level's clock is the puzzle's own
 * `timeLimitMs` when the generator sets one; difficulty-check fails on any clock over 120 s at any level.
 *
 * `oneSolution` is required for every puzzle (non-arcade) game's non-Normal level: the check that proves the level's
 * boards have exactly one solution (a script that exists and runs in CI), or `{ open: "<why>" }` for a game whose
 * answers are open by design (word finds, reaction games). difficulty-check enforces it.
 */
import { checkOverride } from "@/lib/checkOverride";
import type { PuzzleType } from "@/lib/duel/types";
import { LOGIC_GAME_LEVELS } from "@/lib/duel/logicOverhaul2Levels";

import { LEVELS, NORMAL, type Level } from "./levels";
import { PATTERN_LEVELS } from "./pattern";

/** The Logic overhaul's level proof (session 1): every level board of its seven games. */
const LOGIC1_PROOF = "scripts/logic-1-levels-check.tsx";
import { WORD_LEVELS } from "./word";
import { BOMB_LEVELS, MAZE_LEVELS, PAIR_LEVELS, SCAN_LEVELS, SPOT_LEVELS, TALLY_LEVELS } from "./attentionLevels.data";

/** The check proving every Attention level (one answer, legibility, clocks, the human-like Expert solver). */
const ATTENTION_PROOF = "scripts/attention-levels-check.ts";
import { ASCEND_LEVELS, BONK_LEVELS, CHAIN_LEVELS, FLASH_LEVELS, PULL_LEVELS, TENFALL_LEVELS } from "./speedLevels";
import { BEAT_LEVELS, BLOCKFALL_LEVELS, BREAKER_LEVELS, BURST_LEVELS, CROSS_LEVELS, HOVER_LEVELS, PINBALL_LEVELS, RALLY_LEVELS, SNAKE_LEVELS, WAVEFRONT_LEVELS } from "@/lib/arcade/retroLevels";

/** How a level's boards are proven to have exactly one solution. */
export type OneSolutionProof = { proof: string } | { open: string };

export interface LevelEntry<S = Record<string, unknown>> {
  /** The game's own settings for this level (sizes, counts, speeds…), read by its generator. */
  settings: S;
  /** Required for puzzle games (difficulty-check); arcade games may leave it out. */
  oneSolution?: OneSolutionProof;
}

export interface GameLevels<S = Record<string, unknown>> {
  /** The levels beyond Normal. Normal is always offered and is today's game (no entry). */
  levels: Partial<Record<Exclude<Level, "normal">, LevelEntry<S>>>;
}

/**
 * Every game's levels beyond Normal. A game with no entry offers Normal only. The Word games' entries (the Word
 * overhaul, stage 3, 15 Nov 2026) live one file a game in ./word.
 */
export const GAME_LEVELS: Partial<Record<PuzzleType, GameLevels>> = {
  /*
   * The Logic overhaul, session 1 (15 Nov 2026; docs/design/game-reviews/logic.md, the levels Joe agreed). Every
   * level's boards are proven by scripts/logic-1-levels-check.ts (exactly one solution, or for the move games the
   * exact minimum by search); the levers are listed beside each game's settings. Every clock is at most 120 s.
   */
  // Box Six. Levers: givens (fewer = harder), the deduction a board needs (`steps`: "singles" = naked and hidden
  // singles only; "advanced" = needs a pair, pointing or box-line step, at least `minAdvanced` times), clashes shown live or on Check,
  // used-up digits hidden from the keypad (Easy), the clock.
  sudoku: {
    levels: {
      easy: { settings: { givens: [19, 21], steps: "singles", clashes: "live", hideUsed: true, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { givens: [10, 12], steps: "advanced", minAdvanced: 1, clashes: "live", hideUsed: false, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { givens: [9, 10], steps: "advanced", minAdvanced: 2, clashes: "check", hideUsed: false, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Polypotions. Levers: flasks, colours, layers a flask holds, empty flasks, the exact minimum's band, hidden layers
  // (only the top colour of each flask shows until it is uncovered), the clock; the pour allowance stays min + 6.
  tubes: {
    levels: {
      easy: { settings: { flasks: 6, colours: 4, capacity: 4, minMoves: [8, 12], hidden: false, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { flasks: 10, colours: 8, capacity: 7, minMoves: [26, 34], hidden: false, timeMs: 120_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { flasks: 12, colours: 10, capacity: 6, minMoves: [28, 38], hidden: true, timeMs: 120_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Hanoi. Levers: posts (fixed per level), rings, the exact minimum's band, the clock.
  tower: {
    levels: {
      easy: { settings: { pegs: 4, discs: 7, minMoves: [10, 18], timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { pegs: 3, discs: 9, minMoves: [34, 45], timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { pegs: 3, discs: 10, minMoves: [45, 60], timeMs: 105_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Safe Cracker. Levers: dials, the dial range, clues on the card, the clue kinds and their weights, tries, the clock.
  safe: {
    levels: {
      easy: { settings: { dials: 3, max: 9, clues: 5, kinds: "simple", tries: 3, timeMs: 75_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { dials: 4, max: 15, clues: 6, kinds: "number", tries: 3, timeMs: 75_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { dials: 5, max: 20, clues: 7, kinds: "number", tries: 2, timeMs: 105_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Mosaic. Levers: columns × rows (grown downwards, so squares stay tappable at 375 px), how full the picture is,
  // the reasoning a board needs ("line" = each line solvable from its own clue and what is already known; "two" =
  // needs two lines together at least once), lines locking once right (Easy), the clock.
  nonogram: {
    levels: {
      easy: { settings: { cols: 6, rows: 6, fill: [0.5, 0.7], logic: "line", lockLines: true, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { cols: 9, rows: 11, fill: [0.5, 0.65], logic: "line", lockLines: false, timeMs: 120_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { cols: 9, rows: 14, fill: [0.5, 0.6], logic: "two", lockLines: false, timeMs: 120_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Colour Flood. Levers: blob smoothing, columns × rows (grown downwards past 14 wide), colours, the exact minimum (par) band,
  // blocked squares (never flooded, never counted), the clock; the move allowance stays par + 6.
  flood: {
    levels: {
      easy: { settings: { smooth: 2, cols: 10, rows: 10, colours: 4, par: [6, 8], blocked: 0, spare: 8, timeMs: 60_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { smooth: 1, cols: 12, rows: 17, colours: 6, par: [14, 18], blocked: 0, spare: 4, timeMs: 60_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { smooth: 2, cols: 14, rows: 24, colours: 6, par: [18, 22], blocked: 14, spare: 3, timeMs: 75_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Minefield (an arcade-run Logic game). Levers: columns × rows (grown downwards past 10 wide), mines, the opening's
  // size band, the solver steps a board needs (never a guess), the run's length. Hard is today's game exactly
  // (minesRev 2: 20 mines); Normal is the gentler minesRev 3 (Joe, 15 Nov 2026, "too-hard games: today's becomes Hard").
  minesweeper: {
    levels: {
      easy: { settings: { cols: 8, rows: 12, mines: 9, opening: [25, 40], seconds: 90 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { cols: 10, rows: 16, mines: 20, opening: [20, 60], seconds: 90 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { cols: 12, rows: 18, mines: 34, opening: [8, 16], seconds: 120 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Logic overhaul 2 (15–16 Nov 2026): Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions, Island Link.
  ...(LOGIC_GAME_LEVELS as unknown as Partial<Record<PuzzleType, GameLevels>>),
  // Operator (operatorGaps.server.ts generateOperatorLevel): four equations per level, any true fill counts; every
  // line has a true fill the person-like search finds (scripts/number-levels-equation-pyramid-check.ts). Normal is today's.
  // Hard and Expert have shorter clocks (Joe, 16 Nov 2026): 85 s and 78 s, full speed points within 40 s.
  equation: {
    levels: {
      easy: {
        settings: {
          tries: 3,
          lines: [
            { count: 3, lo: 2, hi: 9, numberGaps: 0, signGaps: 1, decoys: 0, signs: "+-×", maxAnswers: 1 },
            { count: 3, lo: 2, hi: 9, numberGaps: 1, signGaps: 0, decoys: 2, signs: "+-×", maxAnswers: 2 },
            { count: 4, lo: 2, hi: 9, numberGaps: 1, signGaps: 1, decoys: 2, signs: "+-×", distinct: 2, maxAnswers: 3 },
            { count: 4, lo: 2, hi: 9, numberGaps: 1, signGaps: 1, decoys: 2, signs: "+-×", need: "×", distinct: 2, maxAnswers: 3 },
          ],
        },
        oneSolution: { open: "any true fill counts; every equation is proved to have one by scripts/number-levels-equation-pyramid-check.ts" },
      },
      hard: {
        settings: {
          tries: 3,
          clockS: 85,
          fullByS: 40,
          lines: [
            { count: 4, lo: 2, hi: 25, numberGaps: 0, signGaps: 3, decoys: 0, signs: "+-×", distinct: 2, maxAnswers: 1 },
            { count: 4, lo: 2, hi: 25, numberGaps: 4, signGaps: 0, decoys: 2, signs: "+-×", distinct: 2, maxAnswers: 3 },
            { count: 5, lo: 2, hi: 25, numberGaps: 3, signGaps: 2, decoys: 2, signs: "+-×÷", distinct: 2, maxAnswers: 3 },
            { count: 5, lo: 2, hi: 25, numberGaps: 2, signGaps: 4, decoys: 2, signs: "+-×÷", need: "×÷", distinct: 3, maxAnswers: 3 },
          ],
        },
        oneSolution: { open: "any true fill counts; every equation is proved to have one by scripts/number-levels-equation-pyramid-check.ts" },
      },
      expert: {
        settings: {
          tries: 2,
          clockS: 78,
          fullByS: 40,
          lines: [
            { count: 4, lo: 2, hi: 30, numberGaps: 1, signGaps: 2, decoys: 2, signs: "+-×÷", distinct: 2, maxAnswers: 2 },
            { count: 5, lo: 2, hi: 30, numberGaps: 2, signGaps: 2, decoys: 2, signs: "+-×÷", distinct: 2, maxAnswers: 3 },
            { count: 5, lo: 2, hi: 30, numberGaps: 2, signGaps: 3, decoys: 2, signs: "+-×÷", need: "÷", distinct: 3, maxAnswers: 3 },
            { count: 5, lo: 2, hi: 30, numberGaps: 3, signGaps: 3, decoys: 2, signs: "+-×÷", need: "×÷", distinct: 3, maxAnswers: 3 },
          ],
        },
        oneSolution: { open: "any true fill counts; every equation is proved to have one by scripts/number-levels-equation-pyramid-check.ts" },
      },
    },
  },
  // Integer Pyramid (numberPyramidLevels.ts): each level's four rising boards from its own bank, every board proved to
  // have exactly one tray assignment (decoys included) and completed by the person-like solver. Normal is today's bank.
  numpyramid: {
    levels: {
      easy: {
        settings: {
          stages: [
            { rows: 4, minEmpty: 4, maxEmpty: 4, bottomLo: 1, bottomHi: 9 },
            { rows: 4, minEmpty: 4, maxEmpty: 5, bottomLo: 1, bottomHi: 9 },
            { rows: 4, minEmpty: 5, maxEmpty: 6, bottomLo: 1, bottomHi: 9 },
            { rows: 4, minEmpty: 6, maxEmpty: 6, bottomLo: 1, bottomHi: 9 },
          ],
          decoys: 1,
        },
        oneSolution: { proof: "scripts/number-levels-equation-pyramid-check.ts" },
      },
      hard: {
        settings: {
          stages: [
            { rows: 5, minEmpty: 11, maxEmpty: 12, bottomLo: 4, bottomHi: 20 },
            { rows: 5, minEmpty: 12, maxEmpty: 12, bottomLo: 4, bottomHi: 20 },
            { rows: 5, minEmpty: 12, maxEmpty: 13, bottomLo: 4, bottomHi: 20 },
            { rows: 5, minEmpty: 13, maxEmpty: 13, bottomLo: 4, bottomHi: 20 },
          ],
          decoys: 3,
        },
        oneSolution: { proof: "scripts/number-levels-equation-pyramid-check.ts" },
      },
      expert: {
        settings: {
          stages: [
            { rows: 6, minEmpty: 12, maxEmpty: 13, bottomLo: 4, bottomHi: 25 },
            { rows: 6, minEmpty: 13, maxEmpty: 13, bottomLo: 4, bottomHi: 25 },
            { rows: 6, minEmpty: 13, maxEmpty: 13, bottomLo: 4, bottomHi: 25 },
            { rows: 6, minEmpty: 13, maxEmpty: 14, bottomLo: 4, bottomHi: 25 },
          ],
          decoys: 3,
        },
        oneSolution: { proof: "scripts/number-levels-equation-pyramid-check.ts" },
      },
    },
  },
  // Counterweight (balanceLevels.ts): Joe's decision of 15 Nov 2026, today's game is Hard; Normal (balanceRev 5,
  // BALANCE_NORMAL there) is gentler, Easy gentler still, Expert harder with the balance readout hidden.
  balance: {
    levels: {
      easy: {
        settings: {
          scales: [
            { loose: 2, fixed: 1, pegs: 6, unique: true, maxW: 6 },
            { loose: 2, fixed: 1, pegs: 6, unique: true },
            { loose: 3, fixed: 2, pegs: 6, unique: true },
          ],
          spare: [8, 8, 10],
        },
        oneSolution: { open: "any balanced arrangement counts; every board is proved solvable by scripts/number-levels-balance-target-check.ts" },
      },
      hard: {
        settings: { today: true },
        oneSolution: { open: "any balanced arrangement counts; today's game, proved solvable by its generator" },
      },
      expert: {
        settings: {
          scales: [
            { loose: 3, fixed: 1, pegs: 10, unique: true },
            { loose: 4, fixed: 2, pegs: 10, unique: false },
            { loose: 5, fixed: 2, pegs: 10, unique: false },
            { loose: 6, fixed: 2, pegs: 10, unique: false },
          ],
          spare: [5, 6, 6, 7],
          hide: true,
        },
        oneSolution: { open: "any balanced arrangement counts; every board is proved solvable, and solved by a person-like solver, by scripts/number-levels-balance-target-check.ts" },
      },
    },
  },
  // Exact (targetLevels.server.ts): any route counts; each level's target is proved by exhaustive search.
  target: {
    levels: {
      easy: {
        settings: { large: [1, 2], target: [101, 300], tiles: [3, 4] },
        oneSolution: { open: "any route counts; every target is proved reachable with 3 or 4 numbers by scripts/number-levels-balance-target-check.ts" },
      },
      hard: {
        settings: { large: [1, 1], target: [300, 999], tiles: [6, 6] },
        oneSolution: { open: "any route counts; every target is proved to need all six numbers by scripts/number-levels-balance-target-check.ts" },
      },
      expert: {
        settings: { large: [0, 0], target: [500, 999], tiles: [6, 6], person: true },
        oneSolution: { open: "any route counts; every target is proved to need all six numbers by scripts/number-levels-balance-target-check.ts" },
      },
    },
  },
  // Brimful (measureLevels.ts): Joe's decision of 15 Nov 2026, today's game is Hard; Normal (measureRev 5,
  // MEASURE_NORMAL there) is gentler, Easy gentler still, Expert harder. Each board's minimum is proven by BFS.
  measure: {
    levels: {
      easy: {
        settings: {
          boards: [
            { goal: "amount", jugs: 2, tap: true, band: [2, 4] },
            { goal: "amount", jugs: 2, tap: true, band: [3, 4] },
            { goal: "amount", jugs: 2, tap: true, band: [4, 6] },
          ],
          limitFactor: 5,
        },
        oneSolution: { open: "any sequence reaching the target counts; the minimum is proven by BFS" },
      },
      hard: {
        settings: { today: true },
        oneSolution: { open: "any sequence reaching the target counts; the minimum is proven by BFS" },
      },
      expert: {
        settings: {
          boards: [
            { goal: "amount", jugs: 2, tap: true, band: [14, 16] },
            { goal: "amount", jugs: 3, tap: true, band: [12, 15] },
            { goal: "amount", jugs: 3, tap: false, band: [11, 15] },
            { goal: "split", jugs: 3, tap: false, band: [13, 16] },
          ],
          limitFactor: 1.5,
        },
        oneSolution: { open: "any sequence reaching the target counts; the minimum is proven by BFS" },
      },
    },
  },
  // Checkout (numberLevels.ts): Joe's decision of 15 Nov 2026, today's game is Hard; Normal (checkoutRev 4,
  // CHECKOUT_NORMAL there) is three standard boards and two shuffled, Easy three standard boards checking out on any
  // dart, Expert five strange boards with exact dart counts. Every board is proved by the exhaustive search (a route in
  // an order that never busts); Easy and Expert boards are also found by the person-like solver.
  checkout: {
    levels: {
      easy: {
        settings: {
          boards: [
            { wedges: "standard", finish: 2, anyRing: true, maxDarts: 3, target: [30, 70], minRoutes: 50 },
            { wedges: "standard", finish: 2, anyRing: true, maxDarts: 3, target: [50, 100], minRoutes: 50 },
            { wedges: "standard", finish: 2, anyRing: true, maxDarts: 3, target: [100, 150], minRoutes: 50 },
          ],
          person: true,
        },
        oneSolution: { open: "any dart sequence reaching the target on the finishing ring counts; every level board is proved to have a checkout by scripts/number-levels-checkout-kakuro-check.ts" },
      },
      hard: {
        settings: { today: true },
        oneSolution: { open: "any dart sequence reaching the target on the finishing ring counts; every level board is proved to have a checkout by scripts/number-levels-checkout-kakuro-check.ts" },
      },
      expert: {
        settings: {
          boards: [
            { wedges: "uneven", finish: 2, maxDarts: 3, exact: true, target: [80, 170], notGreedy: true },
            { wedges: "uneven", finish: 3, quad: true, maxDarts: 3, exact: true, target: [150, 320], notGreedy: true },
            { wedges: "shuffled", negatives: true, finish: 2, maxDarts: 4, exact: true, target: [80, 170], notGreedy: true },
            { wedges: "uneven", negatives: true, quad: true, finish: 2, maxDarts: 4, exact: true, target: [120, 280], notGreedy: true },
            { wedges: "uneven", negatives: true, quad: true, finish: 3, maxDarts: 3, exact: true, target: [150, 320], notGreedy: true },
          ],
          person: true,
        },
        oneSolution: { open: "any dart sequence reaching the target on the finishing ring counts; every level board is proved to have a checkout by scripts/number-levels-checkout-kakuro-check.ts" },
      },
    },
  },
  // Kakuro (numberLevels.ts): Joe's decision of 15 Nov 2026, today's 6 × 6 game is Hard; Normal (kakuroRev 3,
  // KAKURO_NORMAL there) is 6 × 6 with 16–19 white squares, grade 0–4, Easy 5 × 5, Expert 7 × 7. Every board has
  // exactly one solution (the solver's search) and, at every new level, the person-like solver completes it.
  kakuro: {
    levels: {
      easy: {
        settings: { size: 5, whiteMin: 12, whiteMax: 14, gradeMin: 0, gradeMax: 0, maxBlocks: 9, person: true },
        oneSolution: { proof: "scripts/number-levels-checkout-kakuro-check.ts" },
      },
      hard: {
        settings: { today: true },
        oneSolution: { proof: "scripts/number-levels-checkout-kakuro-check.ts" },
      },
      expert: {
        settings: { size: 7, whiteMin: 26, whiteMax: 28, gradeMin: 4, gradeMax: 12, maxBlocks: 12, person: true },
        oneSolution: { proof: "scripts/number-levels-checkout-kakuro-check.ts" },
      },
    },
  },
  // Ballpark (numlineLevels.server.ts): Normal is today's game; three lines of five numbers at every level.
  numline: {
    levels: {
      easy: {
        settings: { lines: ["easy-10", "easy-100", "easy-1"] },
        oneSolution: { open: "estimation: every placement scores by distance" },
      },
      hard: {
        settings: { lines: ["hard-1", "hard-sym-100", "hard-1000"] },
        oneSolution: { open: "estimation: every placement scores by distance" },
      },
      expert: {
        settings: { lines: ["today-100", "today-third", "expert-10000"], hideEnd: true },
        oneSolution: { open: "estimation: every placement scores by distance" },
      },
    },
  },
  // The Pattern overhaul (15 Nov 2026): one data file per game in ./pattern/.
  ...PATTERN_LEVELS,
  // The Word overhaul (15 Nov 2026, stage 3): one data file a game in ./word.
  ...WORD_LEVELS,
  // The Attention overhaul (stage 3, 15 Nov 2026): every lever per level in attentionLevels.data.ts, proved by
  // attention-levels-check (each level's boards: one answer, legibility, the clock, a human-like solver finishing Expert).
  // Matchmaker: pairs, columns (the board grows downwards), the miss's flip-back, the clock, the shapes drawn from
  // (fewer shapes: more cards share a shape), speed's full-by and the free misses.
  pairmatch: {
    levels: {
      easy: { settings: { ...PAIR_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...PAIR_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...PAIR_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Eagle Eye: each grid's size (a bigger grid grows downwards), the eagles facing the target, the first grid with two
  // facings and how many of each, the share of look-alikes (always exactly 45° off a target) and speed's full-by.
  // Every level, Normal included, plays scanRev 5's 60 s clock.
  symscan: {
    levels: {
      easy: { settings: { ...SCAN_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...SCAN_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...SCAN_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Double Take: each picture's grid (Expert's 8 × 8 grows downwards), its differences, their kinds (Easy colour and
  // shape only; Expert's turns weighted up), the hidden seventh, Hard's subtler (still legible) colours, the clock and
  // speed's full-by. Each picture is kept only when its panels differ in exactly the dealt ways.
  spotdiff: {
    levels: {
      easy: { settings: { ...SPOT_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...SPOT_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...SPOT_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Tally: the trays' shapes (none above 110; Easy three trays), each tray's answer range, the near-miss groups, the
  // comparison tray's closeness (Hard and Expert: bigger counts, smaller gaps), Expert's two-colour questions and no
  // marks, the clock and speed's full-by. Every answer is counted from the dealt tray itself, so there is one.
  countup: {
    levels: {
      easy: { settings: { ...TALLY_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...TALLY_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...TALLY_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Bomb Defusal: the wires on the panel, the steps of the one answer, the card's clues (every one needed), Expert's
  // instant explosion on the first wrong step (checked live on the server, no Reset), the clock, the bank's size and
  // speed's full-by. Every banked card is proved by search to have exactly one answer.
  bomb: {
    levels: {
      easy: { settings: { ...BOMB_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...BOMB_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...BOMB_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Labyrinth: the board's columns and rows (a bigger maze grows downwards), the route's length, the false trails (and
  // the long ones), turns and junctions on the route, the carving's branch share, Expert's hidden exit, the clock and
  // speed's full-by. Every carved maze is perfect: exactly one route joins the start and the exit.
  maze: {
    levels: {
      easy: { settings: { ...MAZE_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...MAZE_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...MAZE_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // The Speed overhaul (stage 3, 15 Nov 2026; speedLevels.ts has each lever). Answers are timed taps, not a board with
  // one solution, so each level's uniqueness rule is open by design.
  // Flash: flashes, decoys a flash, the gold-like share of decoys, how long the gold stays up (Expert 1 s); 60 s.
  reaction: {
    levels: {
      easy: { settings: { ...FLASH_LEVELS.easy }, oneSolution: { open: "a reaction game: every tap is timed, nothing to solve" } },
      hard: { settings: { ...FLASH_LEVELS.hard }, oneSolution: { open: "a reaction game: every tap is timed, nothing to solve" } },
      expert: { settings: { ...FLASH_LEVELS.expert }, oneSolution: { open: "a reaction game: every tap is timed, nothing to solve" } },
    },
  },
  // Ascend: how many numbers and their range, the reshuffle interval, the clock and the order (Expert highest first).
  numhunt: {
    levels: {
      easy: { settings: { ...ASCEND_LEVELS.easy }, oneSolution: { open: "a speed game: the order is fixed, only taps are timed" } },
      hard: { settings: { ...ASCEND_LEVELS.hard }, oneSolution: { open: "a speed game: the order is fixed, only taps are timed" } },
      expert: { settings: { ...ASCEND_LEVELS.expert }, oneSolution: { open: "a speed game: the order is fixed, only taps are timed" } },
    },
  },
  // Don't Break the Chain: the chain's length, the tap windows, the reversed runs, the cycle's length and the clock.
  chain: {
    levels: {
      easy: { settings: { ...CHAIN_LEVELS.easy }, oneSolution: { open: "a speed game: each link's charm is fixed, only taps are timed" } },
      hard: { settings: { ...CHAIN_LEVELS.hard }, oneSolution: { open: "a speed game: each link's charm is fixed, only taps are timed" } },
      expert: { settings: { ...CHAIN_LEVELS.expert }, oneSolution: { open: "a speed game: each link's charm is fixed, only taps are timed" } },
    },
  },
  // Bonk: how long a target stays up (start and end of the run), the most up at once, the rule flips, the hedgehogs.
  whack: {
    levels: {
      easy: { settings: { ...BONK_LEVELS.easy }, oneSolution: { open: "a reaction game: every pop is timed, nothing to solve" } },
      hard: { settings: { ...BONK_LEVELS.hard }, oneSolution: { open: "a reaction game: every pop is timed, nothing to solve" } },
      expert: { settings: { ...BONK_LEVELS.expert }, oneSolution: { open: "a reaction game: every pop is timed, nothing to solve" } },
    },
  },
  // Tenfall: how many targets and the biggest, the operators dealt and the tiles' speed.
  tendrop: {
    levels: {
      easy: { settings: { ...TENFALL_LEVELS.easy }, oneSolution: { open: "a speed game: any taps that reach each target count" } },
      hard: { settings: { ...TENFALL_LEVELS.hard }, oneSolution: { open: "a speed game: any taps that reach each target count" } },
      expert: { settings: { ...TENFALL_LEVELS.expert }, oneSolution: { open: "a speed game: any taps that reach each target count" } },
    },
  },
  // Pull!: how many clays, how many fly as pairs (and triples), how many birds and the clays' speed.
  clayshoot: {
    levels: {
      easy: { settings: { ...PULL_LEVELS.easy }, oneSolution: { open: "a shooting game: every shot is timed, nothing to solve" } },
      hard: { settings: { ...PULL_LEVELS.hard }, oneSolution: { open: "a shooting game: every shot is timed, nothing to solve" } },
      expert: { settings: { ...PULL_LEVELS.expert }, oneSolution: { open: "a shooting game: every shot is timed, nothing to solve" } },
    },
  },
  // The Retro overhaul, stage 3 (16 Nov 2026): the Retro games' levels, plain data from retroLevels.ts.
  breaker: retroGameLevels(BREAKER_LEVELS),
  hover: retroGameLevels(HOVER_LEVELS),
  pinball: retroGameLevels(PINBALL_LEVELS),
  wavefront: retroGameLevels(WAVEFRONT_LEVELS),
  cross: retroGameLevels(CROSS_LEVELS),
  snake: retroGameLevels(SNAKE_LEVELS),
  blockfall: retroGameLevels(BLOCKFALL_LEVELS),
  beat: retroGameLevels(BEAT_LEVELS),
  burst: retroGameLevels(BURST_LEVELS),
  rally: retroGameLevels(RALLY_LEVELS),
  // Roofbound (D5, 23 Nov 2026, docs/arcade-standard/flip.md "Levels (D5, 23 Nov 2026)"): flipRev 14's running-speed
  // ladder, the sim's FLIP_V14_LEVEL_RULES, mirrored (flip-ladder-check); speeds in 1/256 px a tick, moversFrom in ticks
  // (null = none), crashCost and coreFull in half seconds, then each part's full line.
  flip: {
    levels: {
      easy: { settings: { speedStart: 768, speedStep: 90, stepTicks: 240, speedCap: 1792, moversFrom: null, sweetTicks: 10, sweetSpots: 8, crashCost: 10, sweetsFull: 3, coreFull: 110, doublesFull: 8, streakFull: 50 } },
      hard: { settings: { speedStart: 1408, speedStep: 90, stepTicks: 180, speedCap: 3072, moversFrom: 240, sweetTicks: 1, sweetSpots: 8, crashCost: 40, sweetsFull: 5, coreFull: 110, doublesFull: 8, streakFull: 50 } },
      expert: { settings: { speedStart: 1600, speedStep: 90, stepTicks: 150, speedCap: 3328, moversFrom: 120, sweetTicks: 1, sweetSpots: 10, crashCost: 50, sweetsFull: 5, coreFull: 110, doublesFull: 8, streakFull: 50 } },
    },
  },
  // High Rise (D5, 23 Nov 2026, docs/arcade-standard/skyline.md "Levels (D5, 23 Nov 2026)"): skylineRev 12's block-width
  // ladder, the sim's SKYLINE_V12_LEVEL_RULES, mirrored (skyline-ladder-check); startW in 1/256 px (260, 110 and 50 px),
  // windFrom null = no wind, lines = each part's full line (floors, perfect drops, perfect streak, gold blocks).
  skyline: {
    levels: {
      easy: { settings: { startW: 66560, speedStart: 320, speedStep: 10, speedMax: 640, tol: 1280, windFrom: null, trimRun: 3, lives: 3, lines: { floors: 40, perfects: 40, streak: 20, gold: 3 } } },
      hard: { settings: { startW: 28160, speedStart: 768, speedStep: 26, speedMax: 1536, tol: 768, windFrom: 8, trimRun: 5, lives: 3, lines: { floors: 38, perfects: 24, streak: 6, gold: 2 } } },
      expert: { settings: { startW: 12800, speedStart: 768, speedStep: 26, speedMax: 1536, tol: 768, windFrom: 0, trimRun: 5, lives: 3, lines: { floors: 38, perfects: 24, streak: 5, gold: 2 } } },
    },
  },
  // Iron Wall (15 Nov 2026, docs/arcade-standard/bastion.md "bastionRev 4: levels"; Joe's approved exception: today's game
  // became Expert, and Normal, Easy and Hard are bastionRev 4's gentler game, its numbers per level BT4_LEVELS in the sim).
  bastion: { levels: { easy: { settings: { bastionRev: 4 } }, hard: { settings: { bastionRev: 4 } }, expert: { settings: { bastionRev: 3 } } } },
  // Grappler (the Action overhaul, 15 Nov 2026; docs/arcade-standard/swing.md "Levels"): each level deals a course from
  // its own proved deal (swingLevelDeal.server.ts) and the sim reads the stored level (swing.ts SWING_LEVELS, the values
  // its courses are built, proved and played with); these are the same, for display. vineSwing (16 Nov 2026, Joe: levers
  // that test human timing): the held vine's gravity, per cent, so Hard and Expert swing faster.
  swing: {
    levels: {
      easy: { settings: { reachPx: 250, slidingVines: 5, stallTicks: 200, pterodactyl: false, darkRuns: 0, vineSwing: 100 } },
      hard: { settings: { reachPx: 220, slidingVines: 26, stallTicks: 55, pterodactyl: true, darkRuns: 6, vineSwing: 125 } },
      expert: { settings: { reachPx: 205, slidingVines: 30, stallTicks: 50, pterodactyl: true, darkRuns: 7, vineSwing: 145 } },
    },
  },
  // Moon Climb (the Action overhaul, 15 Nov 2026; docs/arcade-standard/ricochet.md "Levels"): the sim reads the stored
  // level (ricochetNinja.ts MOON_LEVELS, the values its towers are built and proved with); these are the same, for display.
  ricochet: {
    levels: {
      easy: { settings: { blades: 0.5, knockM: 2, lanterns: 6, fullM: 200 } },
      hard: { settings: { blades: 1.3, knockM: 3, lanterns: 6, fullM: 245 } },
      expert: { settings: { blades: 1.6, knockM: 4, lanterns: 4, fullM: 260 } },
    },
  },
  // Orbit (docs/arcade-standard/orbit.md "Levels"): each level deals from its own proved bank
  // (scripts/orbit-fuel-bank.ts --level=…, built from these course settings); the sim reads tank and checkpoints from
  // the stored level (ORBIT_LEVEL_RULES in orbitRev3.ts, which orbit-levels-check holds equal to these).
  orbit: {
    levels: {
      easy: { settings: { tank: 240, checkpoints: "auto", latMin: 30, latMax: 150, liftMin: 130, liftSpan: 70, window: 4, holesFrom: 25, beltsFrom: 25 } },
      hard: { settings: { tank: 140, checkpoints: "one", latMin: 110, latMax: 270, liftMin: 170, liftSpan: 80, window: 3, holesFrom: 15, beltsFrom: 25 } },
      expert: { settings: { tank: 120, checkpoints: "none", latMin: 140, latMax: 300, liftMin: 190, liftSpan: 80, window: 2, holesFrom: 11, beltsFrom: 21 } },
    },
  },
  // The Cards & Board overhaul, stage 3 (15 Nov 2026; docs/arcade-standard/<game>.md "Levels"). Each game's sim holds the
  // authoritative rules per level (FC_LEVEL_RULES, MAHJONG_LEVEL_RULES, TP_LEVEL_RULES, FH_LEVEL_RULES, PY_LEVEL_RULES);
  // these settings mirror them for the phone's selectors and the docs (cards-levels-check proves they match). Every
  // level's deals are proved clearable by cards-levels-check (banks re-solved, built deals proved by their witnesses).
  freecell: {
    levels: {
      easy: { settings: { cards: 32, cells: 5, undo: "free", hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { cards: 52, cells: 4, undo: "a move", hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { cards: 52, cells: 3, undo: "3", hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  mahjong: {
    levels: {
      easy: { settings: { tiles: 56, layers: 3, quads: 2, shuffleCost: 2, hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { tiles: 72, layers: 4, quads: 10, shuffleCost: 8, hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { tiles: 88, layers: 5, quads: 12, shuffleCost: 10, hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  tripeaks: {
    levels: {
      easy: { settings: { glow: true, wrap: true, undos: 3, speedFullS: 25, hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { glow: false, wrap: false, undos: 0, speedFullS: 20, hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { glow: false, wrap: false, undos: 0, speedFullS: 16, hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  fivehands: {
    levels: {
      easy: { settings: { multiplier: 1.6, seconds: 75, preview: 2, columnValues: true, hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { multiplier: 1.4, seconds: 50, preview: 0, columnValues: false, pair: 10, twoPair: 20, hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { multiplier: 1.3, seconds: 45, preview: 0, columnValues: false, pair: 10, twoPair: 15, hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  pyramid: {
    levels: {
      easy: { settings: { passes: 3, glow: true, kings: "3–4", deals: "any proved", hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { passes: 1, glow: false, kings: "2–3", deals: "harder", hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { passes: 1, glow: false, kings: "3", deals: "hardest", hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  // Coral Pop (the Strategy overhaul, stage 3): colours, reef bubbles (chests included), shots between descents and
  // the aim trail's reach (2 two bounces, 1 one bounce, 0 short). Played on bubbleRev 12; the sim keeps the same
  // numbers frozen with the stamp (BUB_LEVELS in src/lib/arcade/bubble.ts; bubble-levels-check proves they agree).
  bubble: {
    levels: {
      easy: { settings: { colours: 3, reef: 75, every: 10, trail: 2, banksFull: 8, coreFull: 50, speedFullLeft: 1800 } },
      hard: { settings: { colours: 5, reef: 110, every: 5, trail: 1, banksFull: 20, coreFull: 110, speedFullLeft: 1800 } },
      expert: { settings: { colours: 6, reef: 110, every: 7, trail: 0, banksFull: 10, coreFull: 110, speedFullLeft: 1800 } },
    },
  },
  // Ball Tracker (Strategy overhaul stage 3, 15 Nov 2026; docs/arcade-standard/balltrack.md "Levels"): Normal is
  // btRev 8 today (36 marbles every 84 ticks, 1.4 s; the cups move twice: a re-lay and a colour shuffle; 6 gold, 3
  // boosters). Each level deals a course from its own proved list (src/lib/duel/ballTrackDeal<Level>.server.ts, built
  // by scripts/balltrack-level-deal.ts from these settings): marbles, release ticks, cup moves, gold marbles, boosters;
  // Easy also fills the combos part at 10 combo landings (`comboFull`, stored on its courses as `combo`; 16 Nov 2026).
  balltrack: {
    levels: {
      easy: { settings: { balls: 16, dropTicks: 190, moves: 0, golds: 7, boosts: 4, comboFull: 10 } },
      hard: { settings: { balls: 42, dropTicks: 72, moves: 8, golds: 7, boosts: 3 } },
      expert: { settings: { balls: 42, dropTicks: 66, moves: 12, golds: 7, boosts: 2 } },
    },
  },
  // Gemstone, matchupRev 13 (the Strategy overhaul stage 3): a copy of the sim's MATCHUP_V13_LEVELS (arcade/matchup.ts,
  // which the sim reads; gemstone-levels-check proves the two agree). Normal: 6 colours, 10 ice cells, the hint at 5 s.
  matchup: {
    levels: {
      easy: { settings: { colours: 5, goals: [12, 18, 24, 30, 36], ice: 5, hintS: 3 } },
      hard: { settings: { colours: 6, goals: [28, 38, 48, 58, 68, 78], ice: 14, hintS: 8 } },
      expert: { settings: { colours: 7, goals: [30, 40, 50, 60, 70, 80, 90], ice: 18, hintS: 0 } },
    },
  },
  // Tilt (the Strategy overhaul, stage 3; docs/arcade-standard/tilt.md "Levels (stage 3)"): a mirror of TILT_LEVELS in
  // src/lib/arcade/tilt.ts, which the sim reads (tilt-levels-check proves the two the same).
  tilt: {
    levels: {
      easy: { settings: { mazes: 3, sizes: [11, 13, 13], routes: [28, 34, 30], pits: [0, 1, 1], ice: [0, 0, 0], icePassages: 0, twoOf: [3], twoCount: [1, 1], parScale: 240, speedFullS: 60 } },
      hard: { settings: { mazes: 4, sizes: [15, 15, 17, 19], routes: [54, 56, 52, 58], pits: [3, 4, 4, 4], ice: [3, 3, 4, 4], icePassages: 2, twoOf: [2, 3, 4], twoCount: [2, 2], parScale: 135, speedFullS: 58 } },
      expert: { settings: { mazes: 4, sizes: [15, 17, 19, 19], routes: [56, 62, 58, 60], pits: [4, 4, 4, 4], ice: [5, 5, 5, 5], icePassages: 2, twoOf: [2, 3, 4], twoCount: [2, 3], parScale: 115, speedFullS: 70 } },
    },
  },
  // Rainbow Bridge (the Strategy overhaul's stage 3, 15 Nov 2026; docs/arcade-standard/inkbridge.md "Levels (stage 3)"):
  // inkRev 15 at each level, the sim's INK_LEVEL_SETS (ink percent of inkRev 10's, birds kept percent and added per
  // level, the first live level 0-based, the ink par margin, the levels whose birds sway); Normal is 125 %, today's
  // birds, live from 8 (level 9), 10 %. Each level deals from its own proved deal (ink-levels-check).
  inkbridge: {
    levels: {
      easy: { settings: { inkPct: 150, birdsPct: 25, extraBirds: [], liveFrom: 10, parMarginPct: 25, swayLevels: [], swayBirds: 0, stillPot: true, potW: 110, speedFullLeftS: 10, cloverOnRoute: 60, tricksFullAt: 2, cloversFullAt: 1 } },
      hard: { settings: { inkPct: 110, birdsPct: 100, extraBirds: [0, 2, 2, 2, 2, 2, 2, 2, 2, 2], liveFrom: 7, parMarginPct: 10, swayLevels: [], swayBirds: 0, potW: 48, speedFullLeftS: 70 } },
      expert: { settings: { inkPct: 100, birdsPct: 100, extraBirds: [0, 2, 3, 3, 3, 3, 3, 3, 3, 3], liveFrom: 6, parMarginPct: 0, swayLevels: [4, 5], swayBirds: 3, potW: 42, speedFullLeftS: 85 } },
    },
  },
  // Crazy Golf (golfRev 3, the Crazy Golf overhaul; docs/arcade-standard/minigolf.md "Levels"): each level's rules live
  // in the sim (MG_LEVELS: par, the stroke limit, the sails, the extra hazards, the slopes, the Speed time) and every
  // level's pars are proven on the hole bank; the deal reads `context.level` (sports.server.ts generateMinigolf).
  minigolf: { levels: { easy: { settings: {} }, hard: { settings: {} }, expert: { settings: {} } } },
  // Home Run (homerunRev 5, the Home Run and Top Bins overhaul, 15 Nov 2026): the innings' pitch speeds, balls in the
  // first 24 pitches, the Contact / Power windows, the PERFECT window, the curveball's bend and the fielders' reach.
  // A mirror of HR_LEVEL_SETTINGS in src/lib/arcade/homerunInnings.ts (the sim reads its own; homerun-innings-check
  // proves the two match). Each level deals from its own proved deal (homerunDealV5.server.ts).
  homerun: {
    levels: {
      easy: { settings: { flight: { 0: [42, 47], 1: [54, 60], 3: [66, 74] }, balls: 6, winContact: 7, winPower: 5, perfect: 2, bend: 450, reach: 800, ballOff: [14, 34] } },
      hard: { settings: { flight: { 0: [28, 31], 1: [40, 44], 3: [54, 59] }, balls: 8, winContact: 4, winPower: 3, perfect: 0, bend: 1300, reach: 1100, ballOff: [8, 24] } },
      expert: { settings: { flight: { 0: [27, 29], 1: [37, 40], 3: [51, 55] }, balls: 9, winContact: 4, winPower: 2, perfect: 0, bend: 1600, reach: 1200, ballOff: [5, 17] } },
    },
  },
  // Top Bins (freekickRev 6 since 16 Nov 2026; rev 5 kept its own table): the power bar's gold zone, the keeper's reaction and speed, the wall, the wind, the corner
  // hoop's last size and the jumping-wall kicks. A mirror of FK_LEVEL_SETTINGS_V6 in src/lib/arcade/freekick.ts
  // (freekick-layered-check proves the two match). Each level deals from its own proved deal (freekickDealV5.server.ts).
  freekick: {
    levels: {
      easy: { settings: { zoneLo: 680, zoneHi: 820, react: 14, speed: 850, wall: [3, 3], wind: 1, hoopLast: 850, jumps: 3 } },
      hard: { settings: { zoneLo: 735, zoneHi: 790, react: 6, speed: 1300, wall: [4, 5], wind: 6, hoopLast: 600, jumps: 5 } },
      expert: { settings: { zoneLo: 745, zoneHi: 780, react: 5, speed: 1400, wall: [5, 5], wind: 7, hoopLast: 500, jumps: 6 } },
    },
  },
  // Cue Ball (the Sports overhaul's stage 3, 15 Nov 2026; docs/arcade-standard/pool.md "Levels"): the same layouts and
  // physics at every level (poolRev 4's proved bank proves 200 at each); a level changes what the aim preview shows and a
  // foul's cost; Easy also opens the black with 2 of the player's 7 still up (blackAt, POOL_LEVEL_BLACK_AT; Joe, 16 Nov
  // 2026). The sim reads POOL_LEVEL_FOUL and POOL_LEVEL_BLACK_AT (src/lib/arcade/pool.ts), mirrored here;
  // pool-levels-check proves they agree.
  pool: {
    levels: {
      easy: { settings: { preview: "long", foul: 5, blackAt: 2 } },
      hard: { settings: { preview: "short", foul: 10 } },
      expert: { settings: { preview: "ghost", foul: 15 } },
    },
  },
  // Apex (stage 3, 16 Nov 2026; docs/arcade-standard/racing.md "Levels"): racingRev 4's settings per level, stamped on
  // the deal as `racingLevel` (sports.server.ts) so the sim plays the stored copy (src/lib/arcade/racing.ts
  // RacingLevelSettings). keep: the gravel's % of speed kept; road / kerb / wall: lateral units (Normal 65536 / 73728 /
  // 131072); tight: added to every hairpin's peak (tightBy per circuit: Expert keeps Ridge Loop's own, Joe 16 Nov 2026); aids: 2 signs, boards and braking points, 1 signs and boards, 0 signs
  // only; pace: the full pace per circuit (tenths of a km/h), the oracle's on Expert's tighter hairpins.
  racing: {
    levels: {
      easy: { settings: { keep: 80, road: 75366, kerb: 83558, wall: 140902, tight: 0, aids: 2, pace: [1920, 2055, 1750] } },
      hard: { settings: { keep: 60, road: 65536, kerb: 73728, wall: 108134, tight: 0, aids: 1, spread: 320 } },
      expert: { settings: { keep: 50, road: 65536, kerb: 73728, wall: 108134, tight: 2, tightBy: [2, 2, 0], aids: 0, pace: [2175, 2352, 1964], spread: 250 } },
    },
  },
  // Curl Champ (stage 3, 16 Nov 2026; docs/arcade-standard/curling.md "Levels"): the reds each end starts with and the aids. Plain data mirroring the
  // sim's CURL_LEVEL_REDS and CURL_LEVEL_AIDS (curling-levels-check proves they agree); each level deals from its own
  // proved bank (curlingLevelBanks.server.ts), every seed at 200.
  curling: {
    levels: {
      easy: { settings: { reds: 2, minCm: 60, maxCm: 130, houseZone: true, aimLine: "full", coreFull: 60 } },
      hard: { settings: { reds: 4, minCm: 30, maxCm: 90, houseZone: true, aimLine: "third" } },
      expert: { settings: { reds: 5, minCm: 20, maxCm: 70, houseZone: false, aimLine: "none" } },
    },
  },
};

/** A Retro game's entry: its table's three levels as settings (arcade games give no one-solution proof). */
function retroGameLevels<S extends object>(table: Readonly<Record<"easy" | "hard" | "expert", S>>): GameLevels {
  const plain = (s: S): Record<string, unknown> => ({ ...(s as Record<string, unknown>) });
  return { levels: { easy: { settings: plain(table.easy) }, hard: { settings: plain(table.hard) }, expert: { settings: plain(table.expert) } } };
}

/** The registry a caller reads (a check may stand in its own through `withGameLevels`). */
let registry: Partial<Record<string, GameLevels>> = GAME_LEVELS;

/** Checks only: run `fn` with another registry, restoring the real one after. */
export function withGameLevels<T>(stand: Partial<Record<string, GameLevels>>, fn: () => T): T {
  const before = registry;
  registry = stand;
  try {
    return fn();
  } finally {
    registry = before;
  }
}

/**
 * The registry in force: a check's own (withGameLevels, or the check-only `__DUELZ_GAME_LEVELS__` a browser check or
 * screenshot sets; a production build never reads it), else GAME_LEVELS.
 */
function current(): Partial<Record<string, GameLevels>> {
  if (registry !== GAME_LEVELS) return registry;
  return checkOverride<Partial<Record<string, GameLevels>>>("__DUELZ_GAME_LEVELS__") ?? registry;
}

/** The levels a game offers, in LEVELS order (always including Normal). */
export function levelsOf(type: string): Level[] {
  const own = current()[type]?.levels ?? {};
  return LEVELS.filter((level) => level === NORMAL || own[level as Exclude<Level, "normal">] !== undefined);
}

export function offersLevel(type: string, level: Level): boolean {
  return levelsOf(type).includes(level);
}

/** Whether a game has any level beyond Normal. */
export function hasLevels(type: string): boolean {
  return levelsOf(type).length > 1;
}

/** The level a game is actually played at when `requested` is asked for: Normal when it doesn't offer it. */
export function resolveLevel(type: string, requested: Level | null | undefined): Level {
  return requested && offersLevel(type, requested) ? requested : NORMAL;
}

/** A game's settings for a level, or null at Normal and for a level it doesn't offer. */
export function gameLevelSettings<S = Record<string, unknown>>(type: string, level: Level): S | null {
  if (level === NORMAL) return null;
  const entry = current()[type]?.levels[level as Exclude<Level, "normal">];
  return entry ? (entry.settings as S) : null;
}

/** A level's uniqueness proof, or null (Normal, an arcade game that gave none, or a level not offered). */
export function levelProof(type: string, level: Level): OneSolutionProof | null {
  if (level === NORMAL) return null;
  return current()[type]?.levels[level as Exclude<Level, "normal">]?.oneSolution ?? null;
}

/** Every game that offers a level beyond Normal (the tuning script and the checks walk them). */
export function gamesWithLevels(): string[] {
  return Object.keys(current()).filter((t) => hasLevels(t));
}
