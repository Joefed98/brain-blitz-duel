/**
 * The scoring standard's grader, server only (docs/scoring-standard.md). gradeAnswer (generate.server.ts) sends every
 * puzzle on its game's standard stamp here, after the game's own grade: the game's module (word.server.ts,
 * number.server.ts, attention.server.ts, logic.server.ts) turns that grade's facts into the standard shape. Every older
 * puzzle never reaches it.
 */
import type { Graded } from "../grade";
import { latestTapMs } from "../grade";
import { puzzleTimeLimitMs } from "../registry";
import type { PuzzleData, PuzzleType } from "../types";
import { STANDARD_UNFINISHED_CAP, earlyPoints, standardFinish, standardUnfinished, type StandardFinish, type StandardScore } from "./shape";
import { STANDARD_GAMES } from "./games.server";
import { decodeTimeline, partTimes, type TimedDraft } from "./timeline";

export interface StandardInput {
  puzzle: PuzzleData;
  /** The plain answer (the timeline split off). */
  answer: string;
  /** The game's own grade of `answer` (grade.ts), with its facts in `extra`. */
  graded: Graded;
  /** Today's grade before the standard (the depth grade, or rev 3's), for games that read its facts. */
  today: () => Graded;
  /** The round's clock. */
  limitMs: number;
  /** Time left at the finish (the grade's trusted figure). */
  msLeft: number;
  /** The last round-clock ms a logged tap or claimed time may carry (latestTapMs: the round's end, or a room answer's receipt). */
  latestMs: number;
  /** The drafts the timeline describes (null without one). */
  drafts: TimedDraft[] | null;
}

/** What a game's module reports: a finish or unfinished credit, with the facts the reveal and the checks show. */
export type StandardResult =
  | ({ finished: true; facts?: Record<string, unknown> } & StandardFinish)
  | { finished: false; credit: number; facts?: Record<string, unknown> };

export interface StandardGame {
  grade(input: StandardInput, ctx: StandardContext): StandardResult;
  /** How many parts a draft holds (the "how early" extras): the game's own count, from the server's own judgement. */
  parts?(puzzle: PuzzleData, draft: string): number;
}

/** Helpers each game's grade gets. */
export interface StandardContext {
  /** When each of the first `count` parts counted (round-clock ms; null when unknown), from the timeline. */
  partTimes(count: number): (number | null)[];
  /** "Up to `perPart` each for how early" over the first `count` parts. */
  early(perPart: number, count: number): number;
}

export function standardGame(type: PuzzleType): StandardGame | undefined {
  return STANDARD_GAMES[type];
}

/** The standard grade of a puzzle on its standard stamp. */
export function gradeStandard(args: {
  puzzle: PuzzleData;
  answer: string;
  timeline: string | null;
  graded: Graded;
  today: () => Graded;
  receivedMsRemaining?: number | undefined;
}): Graded | null {
  const game = STANDARD_GAMES[args.puzzle.type];
  if (!game) return null;
  const limitMs = puzzleTimeLimitMs(args.puzzle);
  const latestMs = latestTapMs(limitMs, args.receivedMsRemaining);
  const drafts = decodeTimeline(args.timeline, args.answer, latestMs);
  const input: StandardInput = {
    puzzle: args.puzzle,
    answer: args.answer,
    graded: args.graded,
    today: args.today,
    limitMs,
    msLeft: Math.max(0, Math.min(limitMs, args.graded.storedMs)),
    latestMs,
    drafts,
  };
  let counts: { t: number; parts: number }[] | null = null;
  const ctx: StandardContext = {
    partTimes: (count) => {
      if (!drafts || !game.parts || count <= 0) return Array.from({ length: Math.max(0, count) }, () => null);
      counts ??= drafts.map((d) => ({ t: d.t, parts: safeParts(game, args.puzzle, d.draft) }));
      return partTimes(counts, count);
    },
    early: (perPart, count) => earlyPoints(perPart, ctx.partTimes(count), limitMs),
  };
  const r = game.grade(input, ctx);
  const s: StandardScore = r.finished ? standardFinish(r) : standardUnfinished(Math.min(STANDARD_UNFINISHED_CAP, r.credit));
  const extra = { ...(args.graded.extra ?? {}), ...(r.facts ?? {}), parts: s.parts, standard: 1, ...(drafts ? { timeline: drafts.length } : {}) };
  return { ...args.graded, isCorrect: r.finished, score: s.score, extra };
}

function safeParts(game: StandardGame, puzzle: PuzzleData, draft: string): number {
  try {
    const n = game.parts!(puzzle, draft);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
