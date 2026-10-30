/**
 * The scoring standard's Pattern and Logic games, second half (docs/scoring-standard.md, "Pattern and Logic (second
 * half) decisions"): Blackout, Box Six, Hanoi, Polypotions, Safe Cracker, Bomb Defusal, Mosaic, Colour Flood, Tents
 * and Trees, Shikaku and Lamplighter, each on `depthRev` one above its live stamp. Server only.
 *
 * Every game: a finish is 150 + speed + bonus (logicRules.ts); unfinished is up to 120 by the game's share, plus up to
 * 10 for how early its parts were done (10 ÷ N a part), less today's points off for wrong items left on the board.
 * The parts are the same items the share counts, judged by the server on each draft of the timeline.
 */
import type { PuzzleData, PuzzleType } from "../types";
import { decodePresses, decodeSudoku, lightsOnCount, replayLights } from "../logic";
import { gradeSudokuGrid } from "../logic.server";
import { decodeTowerMoves, replayTower } from "../tower";
import { decodeTubeLog, decodeTubeMoves, replayTubeLog, replayTubes, sortedTubeCount } from "../tubes";
import { tubesPourLimit, tubesSendsUndo, floodMoveLimit } from "../moveLimits";
import { decodeSafePending, decodeSafeTries, dialsCorrect, safeOpenedOn } from "../safe";
import { checkBombPlan, decodeBombActions, decodeBombConstraints } from "../bomb";
import { decodeNonoCells, nonoSizeOf, replayNonogram } from "../nonogram";
import { decodeFloodMoves, replayFlood } from "../flood";
import { decodeTents, tentsHeightOf } from "../tents";
import { acceptedRects, decodeShikaku, shikakuHeightOf, type ShikakuRect } from "../shikaku";
import { decodeBulbs } from "../lightUp";
import { lightUpBulbCounts, shikakuAreas } from "../progressFigures";
import { tryEfficiency, PUZZLE_EFFICIENCY_POINTS } from "../puzzleScoreRev";
import { cleanPoints, parPoints, speedPoints } from "./shape";
import type { StandardContext, StandardGame, StandardInput, StandardResult } from "./grade.server";
import { LOGIC_EARLY_POINTS, LOGIC_SHARE_POINTS, LOGIC_STANDARD, type LogicStandardType, floodSpareMoves } from "./logicRules";

type Of<T extends PuzzleData["type"]> = Extract<PuzzleData, { type: T }>;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** Speed points on the game's own numbers (`efficiency` scales them where today's mistakes cut speed). */
function speedOf(type: LogicStandardType, input: StandardInput, efficiency = 1): number {
  const r = LOGIC_STANDARD[type];
  return speedPoints(r.speed, input.msLeft, input.limitMs, r.fullByS * 1000) * clamp01(efficiency);
}

/** Unfinished: up to 120 by `done ÷ total`, plus up to 10 for how early (10 ÷ total a part), less `off`. */
function shareCredit(ctx: StandardContext, done: number, total: number, off = 0): number {
  if (!(total > 0)) return 0;
  const parts = Math.max(0, Math.min(total, Math.floor(done)));
  return (LOGIC_SHARE_POINTS * Math.max(0, done)) / total + ctx.early(LOGIC_EARLY_POINTS / total, parts) - off;
}

/** Moves past par shrink an unfinished credit evenly, from all of it at par to none at `zeroAt` (random play stays near 0). */
function moveWaste(used: number, par: number, zeroAt: number): number {
  if (!(par > 0) || used <= par) return 1;
  return zeroAt > par ? clamp01((zeroAt - used) / (zeroAt - par)) : 0;
}

/** A par finish. */
function parFinish(type: LogicStandardType, input: StandardInput, used: number, par: number, zeroAt?: number, facts: Record<string, unknown> = {}): StandardResult {
  const r = LOGIC_STANDARD[type];
  const bonus = parPoints(r.bonus, used, par, zeroAt);
  return { finished: true, speed: speedOf(type, input), bonus, measure: "par", facts: { ...facts, used, par } };
}

/** A clean finish: the bonus less `per` a mistake; no timeline (history unknown) earns no clean bonus. */
function cleanFinish(type: LogicStandardType, input: StandardInput, mistakes: number | null, efficiency = 1, facts: Record<string, unknown> = {}): StandardResult {
  const r = LOGIC_STANDARD[type];
  const bonus = mistakes === null ? 0 : cleanPoints(r.bonus, r.per ?? 0, mistakes);
  return { finished: true, speed: speedOf(type, input, efficiency), bonus, measure: "clean", facts: { ...facts, mistakes } };
}

/** Distinct items of the drafts' history that a key function marks as mistakes (null without a timeline). */
function everWrong<T>(input: StandardInput, items: (draft: string) => readonly T[], key: (item: T) => string | null): number | null {
  if (!input.drafts) return null;
  const seen = new Set<string>();
  for (const d of input.drafts) for (const item of items(d.draft)) {
    const k = key(item);
    if (k !== null) seen.add(k);
  }
  return seen.size;
}

/* ------------------------------------------------------------------ Blackout */

function lightsParts(p: Of<"lightsout">, answer: string): number {
  return Math.max(0, lightsOnCount(p.lights) - lightsOnCount(replayLights(p.lights, decodePresses(answer))));
}

const lightsout: StandardGame = {
  parts: (p, a) => lightsParts(p as Of<"lightsout">, a),
  grade(input, ctx) {
    const p = input.puzzle as Of<"lightsout">;
    const actions = decodePresses(input.answer);
    if (input.graded.isCorrect) {
      // Every press counts towards par, undone ones too (as the board's Presses line and the depth revision count).
      const presses = actions.filter((c) => c >= 0).length;
      return parFinish("lightsout", input, presses, p.par ?? p.minPresses ?? 0);
    }
    const start = lightsOnCount(p.lights);
    const off = lightsParts(p, input.answer);
    const par = p.par ?? p.minPresses ?? 0;
    const waste = moveWaste(actions.filter((c) => c >= 0).length, par, 2 * par);
    return { finished: false, credit: shareCredit(ctx, off, start) * waste, facts: { lightsOff: off, lightsAtStart: start, waste } };
  },
};

/* ------------------------------------------------------------------ Box Six */

const sudoku: StandardGame = {
  parts: (p, a) => gradeSudokuGrid((p as Of<"sudoku">).givens, (p as Of<"sudoku">).solution ?? [], a).correct,
  grade(input, ctx) {
    const p = input.puzzle as Of<"sudoku">;
    const solution = p.solution ?? [];
    if (input.graded.isCorrect) {
      // Each distinct wrong digit ever entered in a blank (cell and digit), from the draft timeline.
      const wrong = everWrong(input, (d) => decodeSudoku(d).map((digit, cell) => [cell, digit] as const), ([cell, digit]) =>
        !p.givens[cell] && digit && digit !== solution[cell] ? `${cell}:${digit}` : null,
      );
      return cleanFinish("sudoku", input, wrong);
    }
    const v = gradeSudokuGrid(p.givens, solution, input.answer);
    return { finished: false, credit: shareCredit(ctx, v.correct, v.total, LOGIC_STANDARD.sudoku.wrongOff * v.wrong), facts: { correct: v.correct, wrong: v.wrong } };
  },
};

/* ------------------------------------------------------------------ Hanoi */

function towerHome(p: Of<"tower">, answer: string): { home: number; atStart: number; moves: number } {
  const replay = replayTower(p.start ?? [], p.targetPeg, p.discs, decodeTowerMoves(answer));
  const atStart = replayTower(p.start ?? [], p.targetPeg, p.discs, []).correctFromBottom;
  return { home: replay.correctFromBottom, atStart, moves: replay.moves };
}

const tower: StandardGame = {
  parts: (p, a) => {
    const t = towerHome(p as Of<"tower">, a);
    return Math.max(0, t.home - t.atStart);
  },
  grade(input, ctx) {
    const p = input.puzzle as Of<"tower">;
    const t = towerHome(p, input.answer);
    if (input.graded.isCorrect) return parFinish("tower", input, t.moves, p.minMoves);
    return { finished: false, credit: shareCredit(ctx, t.home - t.atStart, p.discs - t.atStart), facts: { home: t.home, homeAtStart: t.atStart } };
  },
};

/* ------------------------------------------------------------------ Polypotions */

function tubesReplay(p: Of<"tubes">, answer: string) {
  return tubesSendsUndo(p) ? replayTubeLog(p.tubes, decodeTubeLog(answer), tubesPourLimit(p)) : replayTubes(p.tubes, decodeTubeMoves(answer));
}

function tubesShare(p: Of<"tubes">, answer: string): { corked: number; total: number } {
  const atStart = sortedTubeCount(p.tubes);
  const colours = new Set(p.tubes.flat()).size;
  return { corked: Math.max(0, tubesReplay(p, answer).sorted - atStart), total: colours - atStart };
}

const tubes: StandardGame = {
  parts: (p, a) => tubesShare(p as Of<"tubes">, a).corked,
  grade(input, ctx) {
    const p = input.puzzle as Of<"tubes">;
    if (input.graded.isCorrect) return parFinish("tubes", input, tubesReplay(p, input.answer).moves, p.par ?? p.minMoves ?? 0);
    const s = tubesShare(p, input.answer);
    const par = p.par ?? p.minMoves ?? 0;
    const waste = moveWaste(tubesReplay(p, input.answer).moves, par, tubesPourLimit(p) ?? 2 * par);
    return { finished: false, credit: shareCredit(ctx, s.corked, s.total) * waste, facts: { corked: s.corked, waste } };
  },
};

/* ------------------------------------------------------------------ Safe Cracker */

/** One dial right is what a guess gives: the share counts the dials right beyond it (today's free dial). */
const SAFE_FREE_DIAL = 1;

function safeDials(p: Of<"safe">, answer: string): number {
  const combination = p.combination ?? [];
  const tries = decodeSafeTries(answer);
  const pending = tries.length >= 3 ? [] : [decodeSafePending(answer) ?? []];
  return Math.max(0, ...[...tries, ...pending].map((t) => dialsCorrect(t, combination)));
}

const safe: StandardGame = {
  parts: (p, a) => Math.max(0, safeDials(p as Of<"safe">, a) - SAFE_FREE_DIAL),
  grade(input, ctx) {
    const p = input.puzzle as Of<"safe">;
    const combination = p.combination ?? [];
    if (input.graded.isCorrect) {
      const openedOn = safeOpenedOn(decodeSafeTries(input.answer), combination);
      // Today's finish cuts the speed points by the try (1st all, 2nd about half, 3rd none); each wrong try also costs
      // the clean crack 2.5.
      return cleanFinish("safe", input, Math.max(0, openedOn - 1), tryEfficiency(openedOn) / PUZZLE_EFFICIENCY_POINTS, { openedOn });
    }
    const right = safeDials(p, input.answer);
    return { finished: false, credit: shareCredit(ctx, right - SAFE_FREE_DIAL, combination.length - SAFE_FREE_DIAL), facts: { dialsRight: right } };
  },
};

/* ------------------------------------------------------------------ Bomb Defusal */

function bombPrefix(p: Of<"bomb">, answer: string): { prefix: number; steps: number } {
  const required = decodeBombActions(p.required ?? p.sequence ?? "");
  const replay = checkBombPlan(required, decodeBombConstraints(p.constraints ?? ""), decodeBombActions(answer));
  return { prefix: Math.min(replay.correctPrefix, required.length), steps: required.length };
}

const bomb: StandardGame = {
  parts: (p, a) => bombPrefix(p as Of<"bomb">, a).prefix,
  grade(input, ctx) {
    const p = input.puzzle as Of<"bomb">;
    if (input.graded.isCorrect) return { finished: true, speed: speedOf("bomb", input), bonus: 0, measure: "bonus" };
    const b = bombPrefix(p, input.answer);
    return { finished: false, credit: shareCredit(ctx, b.prefix, b.steps), facts: { correctPrefix: b.prefix } };
  },
};

/* ------------------------------------------------------------------ Mosaic */

function nonoReplay(p: Of<"nonogram">, answer: string) {
  return replayNonogram(p.pattern ?? [], decodeNonoCells(answer, nonoSizeOf(p)));
}

const nonogram: StandardGame = {
  parts: (p, a) => nonoReplay(p as Of<"nonogram">, a).correct,
  grade(input, ctx) {
    const p = input.puzzle as Of<"nonogram">;
    const pattern = p.pattern ?? [];
    if (input.graded.isCorrect) {
      // Each distinct cell ever filled that is not in the picture.
      const wrong = everWrong(input, (d) => decodeNonoCells(d, nonoSizeOf(p)), (cell) => (pattern[cell] ? null : String(cell)));
      return cleanFinish("nonogram", input, wrong);
    }
    const r = nonoReplay(p, input.answer);
    return { finished: false, credit: shareCredit(ctx, r.correct, r.total, LOGIC_STANDARD.nonogram.wrongOff * r.wrong), facts: { correct: r.correct, wrong: r.wrong } };
  },
};

/* ------------------------------------------------------------------ Colour Flood */

function floodState(p: Of<"flood">, answer: string) {
  const replay = replayFlood(p.grid, decodeFloodMoves(answer), undefined, floodMoveLimit(p));
  const start = replayFlood(p.grid, []).region;
  return { replay, start, flooded: Math.max(0, replay.region - start), total: Math.max(1, p.grid.length - start) };
}

/** The standard's move limit (the stored one: par + 6 on depthRev 4, par + 10 on depthRev 3). */
function floodLimit(p: Of<"flood">): number {
  return floodMoveLimit(p) ?? Math.max(1, p.par) + floodSpareMoves(p);
}

const flood: StandardGame = {
  parts: (p, a) => floodState(p as Of<"flood">, a).flooded,
  grade(input, ctx) {
    const p = input.puzzle as Of<"flood">;
    const f = floodState(p, input.answer);
    // Par moves 40, 0 at par + 6 (depthRev 4; par + 10 on depthRev 3), even steps between.
    if (input.graded.isCorrect) return parFinish("flood", input, f.replay.moves, p.par, p.par + floodSpareMoves(p));
    // Moves past par shrink the credit as they shrink the par bonus (today's waste factor, 1 at par, 0 at the limit),
    // so tapping colours at random until the limit stays near 0. A board out of moves scores 0 (with the spare moves,
    // random taps flood most of the board by then, so the top-up's out-of-moves credit is not kept).
    const waste = moveWaste(f.replay.moves, p.par, floodLimit(p));
    return { finished: false, credit: shareCredit(ctx, f.flooded, f.total) * waste, facts: { flooded: f.flooded, moves: f.replay.moves, waste } };
  },
};

/* ------------------------------------------------------------------ Tents and Trees */

function tentCells(p: Of<"tents">, answer: string): number[] {
  const trees = new Set(p.trees);
  return decodeTents(answer, p.size, tentsHeightOf(p)).filter((c) => !trees.has(c));
}

const tents: StandardGame = {
  parts: (p, a) => {
    const sol = new Set((p as Of<"tents">).solution ?? []);
    return tentCells(p as Of<"tents">, a).filter((c) => sol.has(c)).length;
  },
  grade(input, ctx) {
    const p = input.puzzle as Of<"tents">;
    const sol = new Set(p.solution ?? []);
    if (input.graded.isCorrect) {
      const wrong = everWrong(input, (d) => tentCells(p, d), (cell) => (sol.has(cell) ? null : String(cell)));
      return cleanFinish("tents", input, wrong);
    }
    const cells = tentCells(p, input.answer);
    const right = cells.filter((c) => sol.has(c)).length;
    const wrong = cells.length - right;
    return { finished: false, credit: shareCredit(ctx, right, p.trees.length, LOGIC_STANDARD.tents.wrongOff * wrong), facts: { correct: right, wrong } };
  },
};

/* ------------------------------------------------------------------ Shikaku */

const rectKey = (r: ShikakuRect) => `${r.r0},${r.c0},${r.r1},${r.c1}`;

function shikakuAccepted(p: Of<"shikaku">, answer: string): ShikakuRect[] {
  return acceptedRects(decodeShikaku(answer, p.size, shikakuHeightOf(p)), p.clues, p.size);
}

const shikaku: StandardGame = {
  parts: (p, a) => shikakuAreas((p as Of<"shikaku">).solution ?? [], shikakuAccepted(p as Of<"shikaku">, a)).right,
  grade(input, ctx) {
    const p = input.puzzle as Of<"shikaku">;
    const cells = p.size * shikakuHeightOf(p);
    if (input.graded.isCorrect) {
      // Each distinct rectangle off the solution that the board ever held and the finish no longer does (drawn and
      // removed). The finish is the unique solution, so that is every wrong rectangle ever drawn.
      const sol = new Set((p.solution ?? []).map(rectKey));
      const final = new Set(shikakuAccepted(p, input.answer).map(rectKey));
      const wrong = everWrong(input, (d) => shikakuAccepted(p, d), (r) => (sol.has(rectKey(r)) || final.has(rectKey(r)) ? null : rectKey(r)));
      return cleanFinish("shikaku", input, wrong);
    }
    const { right, wrong } = shikakuAreas(p.solution ?? [], shikakuAccepted(p, input.answer));
    // Today's unfinished credit counted the area of other accepted rectangles against it; so does the standard's.
    return { finished: false, credit: shareCredit(ctx, right, cells, (LOGIC_SHARE_POINTS * wrong) / cells), facts: { rightArea: right, wrongArea: wrong } };
  },
};

/* ------------------------------------------------------------------ Lamplighter */

const lightup: StandardGame = {
  parts: (p, a) => lightUpBulbCounts((p as Of<"lightup">).solution ?? [], decodeBulbs(a, p as Of<"lightup">)).right,
  grade(input, ctx) {
    const p = input.puzzle as Of<"lightup">;
    const sol = new Set(p.solution ?? []);
    if (input.graded.isCorrect) {
      const wrong = everWrong(input, (d) => decodeBulbs(d, p), (cell) => (sol.has(cell) ? null : String(cell)));
      return cleanFinish("lightup", input, wrong);
    }
    const { right, other } = lightUpBulbCounts(p.solution ?? [], decodeBulbs(input.answer, p));
    return { finished: false, credit: shareCredit(ctx, right, sol.size, LOGIC_STANDARD.lightup.wrongOff * other), facts: { right, other } };
  },
};

/** This category's standard games, read by the grader (games.server.ts). */
export const LOGIC_STANDARD_GAMES: Partial<Record<PuzzleType, StandardGame>> = { lightsout, sudoku, tower, tubes, safe, bomb, nonogram, flood, tents, shikaku, lightup };
