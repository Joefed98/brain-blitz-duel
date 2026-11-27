/**
 * The scoring standard's Speed and Attention games (docs/scoring-standard.md, "Speed and Attention decisions"), server
 * only. Each game's own grade (grade.ts) has already replayed the answer; here its facts become the standard shape. The
 * numbers live in attention.ts (shared with the phone and the help texts). Mixed Signals scores in its sim (clashRev
 * 10, colourClash.ts) and needs no entry here.
 */
import { decodeChainAnswer, replayChain, chainRules } from "../chain";
import { decodeNumberTaps, replayAscend } from "../tapLog";
import { parseCount, parseSelection, splitStages } from "../stagedRounds";
import { COUNT_REV2_TRAYS, countUpStageTruth, parseSpotTaps, scanStageMatches, spotTwoResult, SPOT_REV1_SCENES } from "../attentionRev";
import { mazeColsOf, verifyMazePath } from "../maze";
import { decodeMazeTrail, mazeStarsTaken, mazeTrailRoute, mazeTrailWalk } from "../depth/labyrinth";
import { MAZE_REV1_DEAD_ZONE } from "../scoring";
import { wasteFactor } from "../puzzleScoreRev";
import { decodePairFlips, replayPairs } from "../pairmatch";
import { pairDepthReplay, splitPairGoldTime } from "../depth/matchmaker";
import { spotBonusFound } from "../depth/doubleTake";
import { scanMinute } from "../attentionOverhaul";
import { leveled, levelRev2, scanLevel, tallyLevel, tallyTrays, mazeLevel, spotLevel, spotPerPicture, pairCardsOf, pairCountsMemoryMisses, pairExtrasShare, pairGoldWindowMs, pairLevel, pairMemoryMisses, pairsOf } from "../attentionLevels";
import { PAIR_PAIRS } from "../types";
import type { CountUpPuzzleData, MazePuzzleData, SymbolScanPuzzleData, PuzzleType } from "../types";
import { earlyPoints, parPoints, speedPoints } from "./shape";
import { PAR_MOVES_STD, PAR_STRICT_FULL_BY_S, PAR_STRICT_ZERO_AT, usesParMoves, usesParStrict } from "../parMoves";
import type { StandardGame } from "./grade.server";
import { MAZE_D3_FULL_BY_S, usesMazeD3 } from "../d3Attention";
import { mazeKeysOf, mazeKeysTaken, mazeKeysWalk, mazeTourSteps } from "../mazeKeys";
import { ASCEND_STD, CHAIN_STD, chainFullByS, COUNT_STD, MAZE_STD, PAIR_STD, SCAN_STD, SPOT_STD, ascendBestRun, ascendFlowPoints, mazeStarPoints, pairGoldPoints, pairStreakPoints } from "./attention";

const speedFor = (max: number, fullByS: number, msLeft: number, limitMs: number) => speedPoints(max, msLeft, limitMs, fullByS * 1000);

/* ------------------------------------------------------------------ Ascend */

const ascend: StandardGame = {
  grade({ puzzle, answer, graded, limitMs, msLeft, latestMs }) {
    if (puzzle.type !== "numhunt") return { finished: false, credit: 0 };
    const { taps } = decodeNumberTaps(answer, latestMs, puzzle);
    const replay = replayAscend(puzzle, taps);
    const total = puzzle.spots.length;
    const reached = Math.min(total, replay.reached);
    const best = ascendBestRun(replay.outcomes);
    const flow = ascendFlowPoints(best, total);
    const facts = { bestRun: best, flowPoints: Math.round(flow), wrongTaps: replay.errors };
    if (graded.isCorrect) {
      // Today's finish: each wrong tap took 5 off the 30 speed points; the same share comes off the standard's 40.
      const efficiency = Math.max(0, 1 - (ASCEND_STD.wrongCost * replay.errors) / ASCEND_STD.wrongSpeedOf);
      // A level's own full-speed time (the Speed overhaul's levels: Hard and Expert ask for a faster finish).
      const fullByS = typeof puzzle.fullByS === "number" && puzzle.fullByS > 0 ? puzzle.fullByS : ASCEND_STD.fullByS;
      return { finished: true, speed: speedFor(ASCEND_STD.speed, fullByS, msLeft, limitMs) * efficiency, bonus: flow, measure: "flow", facts };
    }
    // Each number's own tap time (the log's), not a draft timeline.
    const times = taps.filter((_, i) => replay.outcomes[i] === "correct").map((t) => t.t);
    const credit = (ASCEND_STD.share * reached) / total + earlyPoints(ASCEND_STD.early / total, times, limitMs) - ASCEND_STD.wrongCost * replay.errors + flow;
    return { finished: false, credit, facts };
  },
};

/* ------------------------------------------------------------------ Don't Break the Chain */

const chain: StandardGame = {
  grade({ puzzle, answer, graded, limitMs, msLeft }) {
    if (puzzle.type !== "chain") return { finished: false, credit: 0 };
    const decoded = decodeChainAnswer(answer);
    const replay = replayChain(puzzle, decoded);
    const total = chainRules(puzzle).length;
    if (graded.isCorrect) return { finished: true, speed: speedFor(CHAIN_STD.speed, chainFullByS(puzzle), msLeft, limitMs), bonus: 0, measure: "bonus" };
    // The links are the first `links` taps, each timed by the tap itself.
    const times = decoded.taps.slice(0, replay.links).map((t) => t.t);
    return { finished: false, credit: (CHAIN_STD.share * replay.links) / total + earlyPoints(CHAIN_STD.early / total, times, limitMs) };
  },
};

/* ------------------------------------------------------------------ Eagle Eye */

interface ScanGrid {
  found: number;
  targets: number;
  wrong: number;
  /** Indices of the marked eagles that are not targets. */
  wrongCells: number[];
}

function scanGrids(puzzle: SymbolScanPuzzleData, answer: string): ScanGrid[] {
  const parts = splitStages(answer);
  return puzzle.stages.map((stage, i) => {
    const targets = scanStageMatches(stage);
    const selected = parseSelection(parts[i] ?? "");
    const wrongCells = selected.filter((s) => !targets.includes(s));
    return { found: targets.filter((t) => selected.includes(t)).length, targets: targets.length, wrong: wrongCells.length, wrongCells };
  });
}

/** A grid is complete when every eagle facing its target(s) is marked. */
const gridComplete = (g: ScanGrid) => g.targets > 0 && g.found === g.targets;

const eagleEye: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "symscan" ? scanGrids(puzzle, draft).filter(gridComplete).length : 0),
  grade({ puzzle, answer, limitMs, msLeft, drafts }, ctx) {
    if (puzzle.type !== "symscan") return { finished: false, credit: 0 };
    const grids = scanGrids(puzzle, answer);
    // Clean grids: no wrong eagle ever marked in the grid (the timeline's history; none without one).
    const everWrong = grids.map(() => false);
    if (drafts) for (const d of drafts) scanGrids(puzzle, d.draft).forEach((g, i) => (everWrong[i] ||= g.wrong > 0));
    const cleanGrids = drafts ? grids.filter((g, i) => !everWrong[i] && g.wrong === 0).length : 0;
    const wrong = grids.reduce((a, g) => a + g.wrong, 0);
    const complete = grids.filter(gridComplete).length;
    const facts = { gridsComplete: complete, cleanGrids, wrongTaps: wrong };
    const finished = grids.length === 3 && grids.every((g) => gridComplete(g) && g.wrong <= SCAN_STD.finishWrongPerGrid);
    if (finished) {
      // scanRev 5 (the overhaul's levels): the 60 s clock, speed full by the level's time.
      const fullBy = scanMinute(puzzle) ? scanLevel(puzzle).fullByS : SCAN_STD.fullByS;
      return { finished: true, speed: speedFor(SCAN_STD.speed, fullBy, msLeft, limitMs), bonus: (SCAN_STD.clean * cleanGrids) / 3, measure: "clean", facts };
    }
    const share = grids.reduce((a, g) => a + (SCAN_STD.perGrid * g.found) / Math.max(1, g.targets), 0);
    return { finished: false, credit: share + ctx.early(SCAN_STD.early, complete) - SCAN_STD.wrongCost * wrong, facts };
  },
};

/* ------------------------------------------------------------------ Double Take */

const doubleTake: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "spotdiff" ? spotTwoResult(puzzle, draft).found.reduce((a, b) => a + b, 0) : 0),
  grade({ puzzle, answer, graded, limitMs, msLeft }, ctx) {
    if (puzzle.type !== "spotdiff") return { finished: false, credit: 0 };
    const r = spotTwoResult(puzzle, answer);
    const found = r.found.reduce((a, b) => a + b, 0);
    const wrong = r.wrong.reduce((a, b) => a + b, 0);
    const hidden = spotBonusFound(puzzle, parseSpotTaps(answer, SPOT_REV1_SCENES)) ? SPOT_STD.hidden : 0;
    const facts = { found, wrongTaps: wrong, hiddenPoints: hidden };
    // A level's pictures (stage 3 of the Attention overhaul) share today's 120 and 9.6 over their own differences, with
    // their own speed full-by; Normal's figures are today's (10 and 0.8 a difference over twelve, full by 40 s).
    const all = 2 * spotPerPicture(puzzle);
    const perDiff = (SPOT_STD.perDiff * 12) / all;
    const early = (SPOT_STD.early * 12) / all;
    const spotFullBy = leveled(puzzle) ? spotLevel(puzzle).fullByS : SPOT_STD.fullByS;
    // Today's finish: all twelve, at most 5 wrong taps in each picture.
    if (graded.isCorrect) {
      // A level with no hidden seventh (Easy) puts its 20 into the clean-taps bonus, so a flawless run is still 200.
      const noHidden = leveled(puzzle) && !spotLevel(puzzle).hidden;
      const clean = wrong === 0 ? SPOT_STD.clean + (noHidden ? SPOT_STD.hidden : 0) : 0;
      return { finished: true, speed: speedFor(SPOT_STD.speed, spotFullBy, msLeft, limitMs), bonus: hidden + clean, measure: "bonus", facts };
    }
    return { finished: false, credit: perDiff * found + ctx.early(early, found) - SPOT_STD.wrongCost * wrong + hidden, facts };
  },
};

/* ------------------------------------------------------------------ Tally */

function tallyCounts(puzzle: CountUpPuzzleData, answer: string): { exact: number; near: number } {
  const parts = splitStages(answer, COUNT_REV2_TRAYS);
  let exact = 0;
  let near = 0;
  puzzle.stages.forEach((stage, i) => {
    const given = parseCount(parts[i] ?? "");
    if (given === null) return;
    const away = Math.abs(given - countUpStageTruth(stage));
    if (away === 0) exact += 1;
    else if (away === 1) near += 1;
  });
  return { exact, near };
}

const tally: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "countup" ? tallyCounts(puzzle, draft).exact : 0),
  grade({ puzzle, answer, graded, limitMs, msLeft }, ctx) {
    if (puzzle.type !== "countup") return { finished: false, credit: 0 };
    const { exact, near } = tallyCounts(puzzle, answer);
    const facts = { exactTrays: exact, nearTrays: near };
    // A level's trays (stage 3 of the Attention overhaul) share today's 120 and 10 over their own count, with their own
    // speed full-by; Normal's figures are today's (30 and 2.5 a tray over four, full by 30 s).
    const trays = tallyTrays(puzzle);
    const perTray = (COUNT_STD.perTray * 4) / trays;
    const countFullBy = leveled(puzzle) ? tallyLevel(puzzle).fullByS : COUNT_STD.fullByS;
    if (graded.isCorrect) return { finished: true, speed: speedFor(COUNT_STD.speed, countFullBy, msLeft, limitMs), bonus: 0, measure: "bonus", facts };
    return { finished: false, credit: perTray * (exact + COUNT_STD.near * near) + ctx.early((COUNT_STD.early * 4) / trays, exact), facts };
  },
};

/* ------------------------------------------------------------------ Labyrinth */

interface MazeRun {
  /** Route steps reached beyond the start (the furthest route cell), and the route's steps. */
  steps: number;
  routeSteps: number;
  /** Today's progress share: the dead zone and the waste factor applied (scoring.ts scoreMaze, grade.ts "maze"). */
  share: number;
  waste: number;
  stars: number;
  starCount: number;
  /** Steps walked (every legal step of the trail, backtracks included) and the route's steps: the par-moves stamp's moves and par. */
  walked: number;
}

function mazeRun(puzzle: MazePuzzleData, answer: string): MazeRun {
  const cols = mazeColsOf(puzzle);
  const keys = mazeKeysOf(puzzle);
  if (keys.length) return mazeKeysRun(puzzle, answer, cols, keys);
  const walk = mazeTrailWalk(puzzle.cells, puzzle.start, puzzle.exit, decodeMazeTrail(answer, puzzle.start, cols, puzzle.cells.length), cols);
  const route = puzzle.solution ?? [];
  const verdict = verifyMazePath(puzzle.cells, puzzle.start, puzzle.exit, route, mazeTrailRoute(walk), cols);
  const length = Math.max(2, route.length);
  const progress = Math.max(0, (verdict.progress * length - 1) / (length - 1));
  const waste = wasteFactor(verdict.walked, length);
  const share = (Math.max(0, progress * waste - MAZE_REV1_DEAD_ZONE) / (1 - MAZE_REV1_DEAD_ZONE));
  const stars = puzzle.stars ?? [];
  return { steps: Math.round(progress * (length - 1)), routeSteps: length - 1, share: Math.min(1, share), waste, stars: mazeStarsTaken(walk, stars).length, starCount: stars.length, walked: Math.max(0, walk.length - 1) };
}

/**
 * D3's keyed maze (levelRev 2's Hard and Expert, mazeKeys.ts): the par is the shortest walk through every key to the
 * exit (the stored `par`); progress is how much of it is done, from what is left to walk (the shortest walk from the
 * trail's head through the keys still to take to the exit), discounted for wandering as the route's share is.
 */
function mazeKeysRun(puzzle: MazePuzzleData, answer: string, cols: number, keys: number[]): MazeRun {
  const walk = mazeKeysWalk(puzzle.cells, puzzle.start, puzzle.exit, decodeMazeTrail(answer, puzzle.start, cols, puzzle.cells.length), cols, keys);
  const tour = typeof puzzle.par === "number" && puzzle.par > 0 ? puzzle.par : mazeTourSteps(puzzle.cells, cols, puzzle.start, keys, puzzle.exit);
  const taken = new Set(mazeKeysTaken(walk, keys).map((i) => keys[i]!));
  const head = walk[walk.length - 1] ?? puzzle.start;
  const left = keys.filter((k) => !taken.has(k));
  const done = head === puzzle.exit && left.length === 0;
  const remaining = done ? 0 : mazeTourSteps(puzzle.cells, cols, head, left, puzzle.exit);
  const progress = Math.max(0, Math.min(1, (tour - remaining) / tour));
  const walked = Math.max(0, walk.length - 1);
  const waste = wasteFactor(walked, tour + 1);
  const share = Math.max(0, progress * waste - MAZE_REV1_DEAD_ZONE) / (1 - MAZE_REV1_DEAD_ZONE);
  return { steps: Math.round(progress * tour), routeSteps: tour, share: Math.min(1, share), waste, stars: 0, starCount: 0, walked };
}

const labyrinth: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "maze" ? mazeRun(puzzle, draft).steps : 0),
  grade({ puzzle, answer, graded, limitMs, msLeft }, ctx) {
    if (puzzle.type !== "maze") return { finished: false, credit: 0 };
    const run = mazeRun(puzzle, answer);
    // mazeRev 4 (the puzzle batch of 3 Nov 2026, parMoves.ts): no stars; a finish is 150 + speed + par moves.
    if (usesParMoves(puzzle)) {
      const facts = { steps: run.walked, parSteps: run.routeSteps };
      if (graded.isCorrect) {
        // mazeRev 5 (puzzle polish, 3 Nov 2026): speed full a little earlier, par points 0 at 1.5× par.
        const strict = usesParStrict(puzzle);
        // A level's maze (stage 3 of the Attention overhaul): its own full-by time (attentionLevels.data.ts).
        // mazeRev 6 (D3, 22 Nov 2026, d3Attention.ts): Normal's speed full by 34 s.
        const fullBy = leveled(puzzle) ? mazeLevel(puzzle).fullByS : usesMazeD3(puzzle) ? MAZE_D3_FULL_BY_S : strict ? PAR_STRICT_FULL_BY_S.maze : MAZE_STD.fullByS;
        const zeroAt = (leveled(puzzle) ? mazeLevel(puzzle).parZeroAt : strict ? PAR_STRICT_ZERO_AT : 2) * run.routeSteps;
        return { finished: true, speed: speedFor(PAR_MOVES_STD.speed, fullBy, msLeft, limitMs), bonus: parPoints(PAR_MOVES_STD.par, run.walked, run.routeSteps, zeroAt), measure: "par", facts };
      }
      const early = ctx.early(MAZE_STD.early / Math.max(1, run.routeSteps), run.steps) * run.waste;
      return { finished: false, credit: MAZE_STD.share * run.share + early, facts };
    }
    const stars = mazeStarPoints(run.stars, run.starCount);
    const facts = { starBonus: Math.round(stars), starsTaken: run.stars };
    if (graded.isCorrect) return { finished: true, speed: speedFor(MAZE_STD.speed, MAZE_STD.fullByS, msLeft, limitMs), bonus: stars, measure: "stars", facts };
    // The early extras are discounted by the same waste factor as the route share, so a scribble earns about nothing.
    const early = ctx.early(MAZE_STD.early / Math.max(1, run.routeSteps), run.steps) * run.waste;
    return { finished: false, credit: MAZE_STD.share * run.share + early + stars, facts };
  },
};

/* ------------------------------------------------------------------ Matchmaker */

const matchmaker: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "pairmatch" ? replayPairs(puzzle.cards, decodePairFlips(draft, pairCardsOf(puzzle)), pairsOf(puzzle)).pairs : 0),
  grade({ puzzle, answer, graded, limitMs, msLeft, latestMs }, ctx) {
    if (puzzle.type !== "pairmatch") return { finished: false, credit: 0 };
    const flips = decodePairFlips(answer, pairCardsOf(puzzle));
    const replay = replayPairs(puzzle.cards, flips, pairsOf(puzzle));
    // Levels (stage 3 of the Attention overhaul): a level's board shares the same 120 and 9 over its own pairs, with
    // its own free misses and speed; Normal's figures are today's (8 and 0.6 a pair over 15, 14 free, full by 60 s).
    const lv = pairLevel(puzzle);
    const pairs = pairsOf(puzzle);
    const perPair = (PAIR_STD.perPair * PAIR_PAIRS) / pairs;
    const early = (PAIR_STD.early * PAIR_PAIRS) / pairs;
    const freeMisses = leveled(puzzle) ? lv.freeMisses : PAIR_STD.freeMisses;
    const fullByS = leveled(puzzle) ? lv.fullByS : PAIR_STD.fullByS;
    // The gold match's time is the phone's word, held to the answer's receipt on the round clock.
    const sent = splitPairGoldTime(answer).goldMs;
    const goldMs = sent === null ? null : Math.min(sent, latestMs);
    const d = pairDepthReplay(puzzle, flips, goldMs);
    // D3 (levelRev 2): a level may start the streak's points sooner (Easy's eight pairs hold no run of eight).
    const streak = pairStreakPoints(d.bestStreak, levelRev2(puzzle) ? (lv.streakFrom ?? PAIR_STD.streakFrom) : PAIR_STD.streakFrom);
    // D3 (levelRev 2's Expert): the gold pair's own window (pairGoldWindowMs; the standard's 30 s everywhere else).
    const gold = pairGoldPoints(d.goldTry, goldMs, pairGoldWindowMs(puzzle) ?? undefined);
    const facts = { bestStreak: d.bestStreak, streakPoints: streak, goldPoints: gold, ...(d.goldTry !== null && goldMs !== null ? { goldMs } : {}) };
    if (graded.isCorrect) {
      // Hard and Expert: the extras fall with the misses made (pairExtrasShare; 1 everywhere else). D3 (levelRev 2): the
      // memory misses only (a miss on a card whose partner had been seen), never a first look.
      const memory = pairCountsMemoryMisses(puzzle);
      const made = memory ? pairMemoryMisses(puzzle.cards, flips) : Math.max(0, replay.tries - replay.pairs);
      const keep = pairExtrasShare(puzzle, made);
      const levelFacts = keep < 1 ? { ...facts, ...(memory ? { memoryMisses: made } : { missesMade: made }), extrasKept: Math.round(keep * 100) } : facts;
      return { finished: true, speed: speedFor(PAIR_STD.speed, fullByS, msLeft, limitMs) * keep, bonus: (streak + gold) * keep, measure: "bonus", facts: levelFacts };
    }
    const misses = Math.max(0, replay.tries - replay.pairs);
    const missCost = (perPair * Math.max(0, misses - freeMisses)) / PAIR_STD.missesPerPair;
    return { finished: false, credit: Math.max(0, perPair * replay.pairs - missCost) + ctx.early(early, replay.pairs) + streak + gold, facts };
  },
};

/** This category's standard games, read by the grader (games.server.ts). */
export const ATTENTION_STANDARD_GAMES: Partial<Record<PuzzleType, StandardGame>> = {
  numhunt: ascend,
  chain,
  symscan: eagleEye,
  spotdiff: doubleTake,
  countup: tally,
  maze: labyrinth,
  pairmatch: matchmaker,
};

/** For the checks: the Eagle Eye grids and the maze run as the grader reads them. */
export const attentionInternals = { scanGrids, mazeRun, tallyCounts } as const;
