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
 *       easy: { settings: { size: 6 }, oneSolution: { proof: "scripts/tents-levels-check.ts" } },
 *       hard: { settings: { size: 9 }, oneSolution: { proof: "scripts/tents-levels-check.ts" } },
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

import { LEVELS, NORMAL, type Level } from "./levels";
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
 * Every game's levels beyond Normal. Empty until the family sessions add theirs (15 Nov 2026): every game offers
 * Normal only.
 */
export const GAME_LEVELS: Partial<Record<PuzzleType, GameLevels>> = {
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
  // Roofbound (15 Nov 2026, docs/arcade-standard/flip.md "Levels"): the sim's FLIP_LEVEL_RULES, mirrored (flip-levels-check).
  flip: {
    levels: {
      easy: { settings: { speedStart: 1024, speedStep: 90, stepTicks: 240, speedCap: 2048, moversFrom: null, sweetTicks: 6, sweetSpots: 8, crashCost: 10, sweetsFull: 5 } },
      hard: { settings: { speedStart: 1280, speedStep: 90, stepTicks: 180, speedCap: 3072, moversFrom: 480, sweetTicks: 1, sweetSpots: 8, crashCost: 40, sweetsFull: 7 } },
      expert: { settings: { speedStart: 1408, speedStep: 90, stepTicks: 150, speedCap: 3328, moversFrom: 300, sweetTicks: 1, sweetSpots: 10, crashCost: 50, sweetsFull: 9 } },
    },
  },
  // High Rise (15 Nov 2026, docs/arcade-standard/skyline.md "Levels"): the sim's SKYLINE_LEVEL_RULES, mirrored (skyline-levels-check).
  skyline: {
    levels: {
      easy: { settings: { speedStart: 448, speedStep: 12, speedMax: 896, tol: 1280, windFrom: 30, lives: 3 } },
      hard: { settings: { speedStart: 896, speedStep: 30, speedMax: 1792, tol: 768, windFrom: 15, lives: 3 } },
      expert: { settings: { speedStart: 960, speedStep: 32, speedMax: 1920, tol: 512, windFrom: 10, lives: 3 } },
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
