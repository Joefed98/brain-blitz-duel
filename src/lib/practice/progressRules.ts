/**
 * Practice progress rules (wave 2 train C, C1a, 11 Nov 2026; docs/practice-progress.md): the numbers the server
 * counts progress by (supabase/migrations/20261111101500_practice_progress.sql holds the same) and the screens show.
 * Shared and pure: no storage, no network. Never imported by grading, scoring or replay code.
 *
 * Stars (the master plan's rule): one star per game per level for a score of 175 or more on Easy, Classic or Hard; a
 * crown for 175+ on Expert comes in wave 3.5 (never a star). Every run today is Classic, so 92 stars at most until then;
 * the total is out of 276 (92 games × 3 levels). Bests are the best graded score per game and level.
 */

export const PRACTICE_LEVELS = ["easy", "classic", "hard", "expert"] as const;
export type PracticeLevel = (typeof PRACTICE_LEVELS)[number];

/** The level every run is played on until wave 3.5 adds the others. A run with no level is Classic. */
export const DEALT_LEVEL: PracticeLevel = "classic";

/** The levels a star can be earned on (Expert's 175+ is a crown, wave 3.5). */
export const STAR_LEVELS: readonly PracticeLevel[] = ["easy", "classic", "hard"];

/** The score a star needs. */
export const STAR_SCORE = 175;

/** Stars there are: 92 active games × 3 levels. */
export const STARS_PER_GAME = STAR_LEVELS.length;
export const STAR_TOTAL_MAX = 276;

/** A stored or sent level read safely: anything that isn't a level (null included) is Classic. */
export function levelOf(raw: unknown): PracticeLevel {
  return typeof raw === "string" && (PRACTICE_LEVELS as readonly string[]).includes(raw) ? (raw as PracticeLevel) : "classic";
}

/** Whether a score on a level earns that level's star. */
export function earnsStar(score: number, level: PracticeLevel = DEALT_LEVEL): boolean {
  return Number.isFinite(score) && score >= STAR_SCORE && STAR_LEVELS.includes(level);
}

/** The gem colours and the star total each unlocks at (the master plan's thresholds), in order. */
export const GEM_THRESHOLDS = [
  { gem: "amber", name: "Amber", stars: 10 },
  { gem: "rose-quartz", name: "Rose Quartz", stars: 20 },
  { gem: "ruby", name: "Ruby", stars: 30 },
  { gem: "jade", name: "Jade", stars: 50 },
  { gem: "amethyst", name: "Amethyst", stars: 75 },
  { gem: "aquamarine", name: "Aquamarine", stars: 100 },
  { gem: "sapphire", name: "Sapphire", stars: 125 },
  { gem: "pearl", name: "Pearl", stars: 150 },
  { gem: "obsidian", name: "Obsidian", stars: 200 },
  { gem: "diamond", name: "Diamond", stars: 250 },
] as const;
export type GemThreshold = (typeof GEM_THRESHOLDS)[number];

/** The star total a gem needs, or null for an unknown gem. */
export function gemStars(gem: string): number | null {
  return GEM_THRESHOLDS.find((g) => g.gem === gem)?.stars ?? null;
}

/** The gems a star total has reached. */
export function gemsFor(stars: number): string[] {
  return GEM_THRESHOLDS.filter((g) => stars >= g.stars).map((g) => g.gem);
}

/** The next gem to unlock after a star total, or null once every gem is reached. */
export function nextGem(stars: number): GemThreshold | null {
  return GEM_THRESHOLDS.find((g) => stars < g.stars) ?? null;
}

/** A locked gem's line in the picker. */
export function gemUnlockLine(gem: string): string {
  const n = gemStars(gem);
  return n === null ? "Locked" : `Unlocks at ${n} stars`;
}

/** Practice's one-time note after the fresh start (Joe's decision, 10 Nov 2026). */
export const PRACTICE_REFRESH_NOTE = "Stars and challenges have had a refresh. Everything you earn now is saved to your account.";
