/**
 * Practice progress as the phone sees it (wave 2 train C, C1a; docs/practice-progress.md): the shapes the server
 * answers (progress.functions.ts and the practice grade's `progress`) and the lookups the screens make. Every figure
 * here comes from the server's graded runs; nothing is worked out or stored on the device (useProgress.ts holds the
 * last answer in memory only). Presentation only: never imported by grading, scoring or replay code.
 */
import { DEALT_LEVEL, STAR_TOTAL_MAX, type PracticeLevel } from "./progressRules";

/** One game on one level: its best graded score and whether its star is earned. */
export interface GameLevelProgress {
  best: number;
  star: boolean;
  /** The score that earned the star (175+), or null. */
  starScore: number | null;
}

/** A player's whole practice progress. */
export interface PracticeProgressView {
  /** Bests and stars by game, then level. */
  games: Record<string, Partial<Record<PracticeLevel, GameLevelProgress>>>;
  /** The star total (out of STAR_TOTAL_MAX). */
  stars: number;
  /** Gem colours unlocked (accounts only; a guest's unlock when they sign up). */
  gems: string[];
  /** Whether Practice's one-time refresh note has been seen. */
  noteSeen: boolean;
  /** The fresh start's moment (ISO), or null on a database without it. */
  freshStartAt: string | null;
}

/** What one graded practice run did to progress (the grade's `progress`; null when it couldn't be counted yet). */
export interface PracticeRunProgress {
  counted: boolean;
  level: PracticeLevel;
  /** The best on this game and level after the run, and before it (null on the first counted run). */
  best: number | null;
  previousBest: number | null;
  /** An earlier best was beaten (never true on a first run). */
  improved: boolean;
  /** The game has its star on this level, and whether this run earned it. */
  star: boolean;
  starEarned: boolean;
  starTotal: number;
  gemsUnlocked: string[];
}

export const EMPTY_PROGRESS: PracticeProgressView = { games: {}, stars: 0, gems: [], noteSeen: true, freshStartAt: null };

/** A game's best on a level (Classic unless named), or null before any counted run. */
export function bestOf(view: PracticeProgressView | null | undefined, type: string, level: PracticeLevel = DEALT_LEVEL): number | null {
  return view?.games[type]?.[level]?.best ?? null;
}

/** Whether a game has its star on a level (Classic unless named). */
export function starOf(view: PracticeProgressView | null | undefined, type: string, level: PracticeLevel = DEALT_LEVEL): boolean {
  return view?.games[type]?.[level]?.star === true;
}

/** A game's stars by level, for the row's three stars (Easy, Classic, Hard). */
export function levelStarsOf(view: PracticeProgressView | null | undefined, type: string): { easy: boolean; classic: boolean; hard: boolean } {
  return { easy: starOf(view, type, "easy"), classic: starOf(view, type, "classic"), hard: starOf(view, type, "hard") };
}

/** How many of a game's three stars are earned. */
export function starCountOf(view: PracticeProgressView | null | undefined, type: string): number {
  const s = levelStarsOf(view, type);
  return Number(s.easy) + Number(s.classic) + Number(s.hard);
}

/**
 * What a graded run means for the screen: the best to show (the server's, or the one already shown when the run
 * couldn't be counted yet) and whether it beat an earlier best (never on a first run).
 */
export function practiceRunRecord(run: PracticeRunProgress | null | undefined, shownBest: number | null): { best: number | null; improved: boolean } {
  if (!run || !run.counted) return { best: shownBest, improved: false };
  return { best: run.best, improved: run.improved };
}

/** "21 / 276 stars". */
export function starTotalLine(view: PracticeProgressView | null | undefined): string {
  return `${view?.stars ?? 0} / ${STAR_TOTAL_MAX} stars`;
}

/** The view with one counted run laid over it (so screens update at once, before the next read). */
export function withRun(view: PracticeProgressView, type: string, run: PracticeRunProgress): PracticeProgressView {
  if (!run.counted || run.best === null) return view;
  const prev = view.games[type]?.[run.level];
  const next: GameLevelProgress = {
    best: Math.max(run.best, prev?.best ?? 0),
    star: run.star || prev?.star === true,
    starScore: prev?.starScore ?? null,
  };
  const gems = [...new Set([...view.gems, ...run.gemsUnlocked])];
  return {
    ...view,
    games: { ...view.games, [type]: { ...view.games[type], [run.level]: next } },
    stars: Math.max(view.stars, run.starTotal),
    gems,
  };
}

/** The star line under the new-best moment, or null when the run earned no star. */
export function runStarLine(run: PracticeRunProgress | null | undefined): string | null {
  return run?.counted && run.starEarned ? "Star earned" : null;
}
