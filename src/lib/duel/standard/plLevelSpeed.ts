/**
 * The Pattern and Logic levels' own speed lines (D4, the difficulty build, 22 Nov 2026): each level deal of the
 * twenty-two Pattern and Logic games carries its level's "full speed by" time on the puzzle as `levelFullByS`, set from
 * the elite player's measured finish times under the human limits (scripts/pattern-logic-human-tune.ts), so the best
 * player reaches 200 less often each level up. The grader reads the stored number, never the registry, so a later
 * retune never moves a stored round. Shared and pure (the graders, the deal and the help texts read it).
 *
 * Normal deals never carry it, so every Normal round grades exactly as before. A level round dealt before this stamp
 * (no `levelFullByS`) keeps the time its level had then: `PRE_D4_LEVEL_FULL_BY_S` holds those numbers, frozen, for the
 * games whose graders read a level's time from the registry (the Pattern games); the Logic games' levels used the
 * game's own time then, and still do without the stamp.
 */
import { puzzleLevel, type Level } from "@/lib/levels/levels";

/**
 * The level's own full-speed time stamped on a D4 level deal, in seconds; null on every other puzzle. The stored level
 * decides: a puzzle without one is Normal, whatever else it carries.
 */
export function storedLevelFullByS(puzzle: unknown): number | null {
  if (puzzleLevel(puzzle) === "normal") return null;
  const v = (puzzle as { levelFullByS?: unknown } | null)?.levelFullByS;
  return typeof v === "number" && v > 0 ? v : null;
}

/**
 * Each Pattern game's level full-speed times before the D4 stamp (frozen, 22 Nov 2026: the values the registry held
 * when the level rounds without `levelFullByS` were dealt). Never edit: a retune goes in the registry and rides on new
 * deals as `levelFullByS`.
 */
export const PRE_D4_LEVEL_FULL_BY_S: Readonly<Record<string, Readonly<Partial<Record<Exclude<Level, "normal">, number>>>>> = {
  unblock: { easy: 40, hard: 28, expert: 30 },
  blockparty: { easy: 40, hard: 32, expert: 36 },
  pipes: { expert: 90 },
  flow: { easy: 15, hard: 35, expert: 45 },
  iceslide: { easy: 20, hard: 40, expert: 45 },
  push: { easy: 30, hard: 45, expert: 45 },
  laser: { easy: 20, hard: 35, expert: 30 },
  gravity: { easy: 20, hard: 30, expert: 30 },
};

/**
 * The full-speed time of a Pattern level round: its stamp, else the time its level had before the stamp, else null
 * (a Normal round, or a level that never set its own: the game's own line applies).
 */
export function patternLevelFullByS(type: string, puzzle: unknown): number | null {
  const own = storedLevelFullByS(puzzle);
  if (own !== null) return own;
  const level = puzzleLevel(puzzle);
  if (level === "normal") return null;
  return PRE_D4_LEVEL_FULL_BY_S[type]?.[level] ?? null;
}

/** A level's full-speed time as the deal stamps it: the settings' `fullByS` or `speedFullByS`, when it has one. */
export function settingsFullByS(settings: unknown): number | null {
  const s = settings as { fullByS?: unknown; speedFullByS?: unknown } | null;
  const v = typeof s?.fullByS === "number" ? s.fullByS : typeof s?.speedFullByS === "number" ? s.speedFullByS : null;
  return v !== null && v > 0 ? v : null;
}

/** The twenty-two games whose level deals carry their level's own speed line (D4). */
export const PL_LEVEL_SPEED_GAMES: readonly string[] = [
  "unblock", "blockparty", "pipes", "flow", "iceslide", "push", "laser", "gravity",
  "sudoku", "tower", "tubes", "safe", "nonogram", "flood", "tents", "shikaku", "lightup", "trail", "fences", "fillomino", "bridges",
];
