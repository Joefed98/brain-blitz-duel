/**
 * The scoring standard's Pattern and Logic games, first half (docs/scoring-standard.md, "Pattern and Logic (first half)
 * decisions"): Gridlock, Tessellate, Skid, Topsy-Turvy, Gradient, Turntable, Lightbender, Chroma Lines, Pipeline and
 * Heave. Each turns the game's own grade (grade.ts) and a replay of the answer with the game's own rules into the one
 * shape (shape.ts); the numbers are patternRules.ts's (the help texts quote the same). Server-only.
 */
import type { StandardContext, StandardGame, StandardInput } from "./grade.server";
import { cleanPoints, parPoints, speedPoints } from "./shape";
import { wasteFactor } from "../puzzleScoreRev";
import type { TimedDraft } from "./timeline";
import { BLOCK_STD, FLOW_STD, ICE_STD, LASER_STD, PATTERN_STD, PUSH_STD, SHARE_CREDIT, SHARE_EARLY, TOPSY_STD, patternFullByS, type PatternStdType } from "./patternRules";
import type { PuzzleData, UnblockVehicle, PuzzleType } from "../types";
import { UNBLOCK_COLS } from "../types";
import { applyMove, decodeMoves, isSolved as unblockSolved, vehicleCells } from "../unblock";
import { blockGeometry, decodePlacements, verifyPlacements } from "../blockParty";
import { blockPartyCounts, flowRouteCounts } from "../progressFigures";
import { decodeSlideMoves, replaySlide, slideBoard, slideDistance, type SlideBoard, type SlideState } from "../slide";
import { replayGems } from "../depth4/iceGems";
import { decodeGravityTilts } from "../gravity";
import { isTopsy, replayTopsyPuzzle } from "../topsy";
import { JUMBLED_MOVABLE, jumbledInPlace, replayGradientAnswer } from "../jumbled";
import { decodeRingTaps, freshOffsets, replayRings, ringColour, ringsApply } from "../rings";
import { decodeFlowPaths, verifyFlow } from "../flow";
import { decodeSides } from "../logic";
import { gradePipesBoard } from "../logic.server";
import { decodePipesTaps, pipesAfterTaps } from "../depth4/pipesTaps";
import { cratesOnTargets, decodePushMoves, replayPush } from "../push";
import { FLOW_PAIRS, LASER_MAX_FIRES, RINGS_SEGMENTS } from "../types";

type Of<T extends PuzzleData["type"]> = Extract<PuzzleData, { type: T }>;

function num(extra: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = extra?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Speed points on the game's own rules (patternRules.ts). */
function speed(type: PatternStdType, input: StandardInput): number {
  const r = PATTERN_STD[type];
  return speedPoints(r.speed, input.msLeft, input.limitMs, patternFullByS(type, input.puzzle as { tilesRev?: number }) * 1000);
}

/** The par bonus on the game's own rules: full at par, 0 at twice par. */
function par(type: PatternStdType, used: number | null, parValue: number | null | undefined): number {
  const max = PATTERN_STD[type].par ?? 0;
  return used === null || !parValue ? 0 : parPoints(max, used, parValue);
}

/** "Up to 120 by share … + up to 10 early" over `total` parts, `done` of them done. */
function shareCredit(ctx: StandardContext, done: number, total: number): number {
  if (!(total > 0)) return 0;
  const d = Math.max(0, Math.min(total, done));
  return (SHARE_CREDIT * d) / total + ctx.early(SHARE_EARLY / total, d);
}

/**
 * Today's unfinished penalty on the move games (rev 1's waste factor, puzzleScoreRev.ts: every move over the minimum
 * costs evenly, nothing left at 4× it), kept on their progress credit: random or wasteful moving earns about 0.
 */
function waste(moves: number | null | undefined, minMoves: number | null | undefined): number {
  return wasteFactor(moves ?? 0, minMoves ?? 0);
}

/** Per-puzzle memo (WeakMap on the stored puzzle object, so nothing outlives a grade's puzzle). */
function memo<K extends object, V>(store: WeakMap<K, V>, key: K, make: () => V): V {
  let v = store.get(key);
  if (v === undefined) {
    v = make();
    store.set(key, v);
  }
  return v;
}

/* ------------------------------------------------------------------ Gridlock (unblock) */

/**
 * The cars in the gold car's way: those standing in its row ahead of its nose, and (for each car that must move) the
 * cars standing where it has to go to leave the cells it must free, taking its way out (up or down, left or right)
 * with the fewest cars in it. Counted once each; the gold car itself is never counted.
 */
export function gridlockChain(vehicles: readonly UnblockVehicle[]): number {
  const N = UNBLOCK_COLS;
  const gold = vehicles.find((v) => v.id === 0);
  if (!gold) return 0;
  const at = new Map<number, UnblockVehicle>();
  for (const v of vehicles) for (const c of vehicleCells(v)) at.set(c, v);
  const chain = new Set<number>();
  const queue: { v: UnblockVehicle; free: number[] }[] = [];
  const need = (cells: readonly number[]) => {
    const byCar = new Map<UnblockVehicle, number[]>();
    for (const c of cells) {
      const v = at.get(c);
      if (!v || v.id === 0 || chain.has(v.id)) continue;
      byCar.set(v, [...(byCar.get(v) ?? []), c]);
    }
    for (const [v, free] of byCar) {
      chain.add(v.id);
      queue.push({ v, free });
    }
  };
  const lane: number[] = [];
  for (let col = gold.col + gold.len; col < N; col++) lane.push(gold.row * N + col);
  need(lane);
  while (queue.length) {
    const { v, free } = queue.shift()!;
    // Positions along the car's own axis: rows for a vertical car, columns for a horizontal one.
    const along = (c: number) => (v.axis === "v" ? Math.floor(c / N) : c % N);
    const cellAt = (k: number) => (v.axis === "v" ? k * N + v.col : v.row * N + k);
    const lo = Math.min(...free.map(along));
    const hi = Math.max(...free.map(along));
    const start = v.axis === "v" ? v.row : v.col;
    const end = start + v.len - 1;
    const ways: number[][] = [];
    // Back (up or left) until its far end is before `lo`; on (down or right) until its near end is past `hi`.
    const backTo = lo - v.len;
    if (backTo >= 0) ways.push(Array.from({ length: start - backTo }, (_, i) => cellAt(backTo + i)));
    const onTo = hi + v.len;
    if (onTo <= N - 1) ways.push(Array.from({ length: onTo - end }, (_, i) => cellAt(end + 1 + i)));
    if (!ways.length) continue;
    const cars = (cells: number[]) => new Set(cells.map((c) => at.get(c)).filter((o): o is UnblockVehicle => !!o && o.id !== 0 && o.id !== v.id).map((o) => o.id)).size;
    const best = ways.reduce((a, b) => (cars(b) < cars(a) ? b : a));
    need(best);
  }
  return chain.size;
}

/**
 * Cars cleared from the gold car's way, net: the chain at the start less the shortest chain any board the player stood
 * on had (the closest they got, as Skid's route and today's solver progress count it; Undo and Reset never take it
 * back). A solve clears the whole chain.
 */
function gridlockCleared(puzzle: Of<"unblock">, answer: string): { cleared: number; total: number } {
  const total = gridlockChain(puzzle.vehicles);
  let state = puzzle.vehicles.map((v) => ({ ...v }));
  const history = [state];
  let best = total;
  for (const move of decodeMoves(answer)) {
    if (move.id === -1 && move.to === 0) {
      if (history.length > 1) history.pop();
      state = history[history.length - 1]!;
      continue;
    }
    if (move.id === -2 && move.to === 0) {
      history.length = 1;
      state = history[0]!;
      continue;
    }
    const next = applyMove(state, move);
    if (!next) continue;
    state = next;
    history.push(state);
    if (unblockSolved(state)) return { cleared: total, total };
    best = Math.min(best, gridlockChain(state));
  }
  return { cleared: Math.max(0, total - best), total };
}

const gridlock: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"unblock">;
    const extra = input.graded.extra;
    if (input.graded.isCorrect) {
      const moves = num(extra, "moves");
      return { finished: true, speed: speed("unblock", input), bonus: par("unblock", moves, p.par ?? p.minMoves), measure: "par" };
    }
    const { cleared, total } = gridlockCleared(p, input.answer);
    const w = waste(num(extra, "moves"), p.minMoves);
    return { finished: false, credit: shareCredit(ctx, cleared, total) * w, facts: { carsCleared: cleared, carsBlocking: total, waste: w } };
  },
  parts: (puzzle, draft) => gridlockCleared(puzzle as Of<"unblock">, draft).cleared,
};

/* ------------------------------------------------------------------ Tessellate (blockparty) */

const cellsKey = (cells: readonly number[]) => [...cells].sort((a, b) => a - b).join(",");

function blockLegal(puzzle: Of<"blockparty">, answer: string) {
  return verifyPlacements(puzzle.blockers, decodePlacements(answer), blockGeometry(puzzle)).legal;
}

/** Pieces on their solution cells, less pieces placed elsewhere (today's rule: random drops earn about 0). */
function blockNet(puzzle: Of<"blockparty">, answer: string): number {
  const legal = blockLegal(puzzle, answer);
  const { inSpot } = blockPartyCounts(puzzle.solution ?? [], legal);
  return Math.max(0, 2 * inSpot - legal.length);
}

/**
 * "Right first time": the pieces whose first placement in the timeline is where they stand at the end (on a finish),
 * or where they stand now on their solution cells (unfinished). Null without a timeline.
 */
export function blockRightFirstTime(puzzle: Of<"blockparty">, answer: string, drafts: readonly TimedDraft[] | null, finished: boolean): number | null {
  if (!drafts) return null;
  const first = new Map<number, string>();
  for (const d of drafts) for (const pl of blockLegal(puzzle, d.draft)) if (!first.has(pl.piece)) first.set(pl.piece, cellsKey(pl.cells));
  const spots = new Set((puzzle.solution ?? []).map((s) => cellsKey(s.cells)));
  let n = 0;
  for (const pl of blockLegal(puzzle, answer)) {
    const k = cellsKey(pl.cells);
    if (first.get(pl.piece) === k && (finished || spots.has(k))) n++;
  }
  return n;
}

const tessellate: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"blockparty">;
    const pieces = blockGeometry(p).pieces.length;
    const right = blockRightFirstTime(p, input.answer, input.drafts, input.graded.isCorrect);
    const firstTime = pieces > 0 ? (BLOCK_STD.firstTime * (right ?? 0)) / pieces : 0;
    const facts = { rightFirstTime: right };
    if (input.graded.isCorrect) return { finished: true, speed: speed("blockparty", input), bonus: firstTime, measure: "first time", facts };
    const net = blockNet(p, input.answer);
    return { finished: false, credit: BLOCK_STD.perPiece * net + ctx.early(BLOCK_STD.earlyPerPiece, net) + firstTime, facts: { ...facts, piecesRight: net } };
  },
  parts: (puzzle, draft) => blockNet(puzzle as Of<"blockparty">, draft),
};

/* ------------------------------------------------------------------ Skid (iceslide) */

const SLIDE_BOARDS = new WeakMap<object, SlideBoard>();
const SLIDE_DIST = new WeakMap<object, Map<number, number | null>>();

function slideDist(puzzle: Of<"iceslide">, state: SlideState): number | null {
  const board = memo(SLIDE_BOARDS, puzzle, () => slideBoard(puzzle));
  const cache = memo(SLIDE_DIST, puzzle, () => new Map<number, number | null>());
  const key = state.mask * 4096 + state.cell;
  if (!cache.has(key)) cache.set(key, slideDistance(board, state));
  return cache.get(key)!;
}

/** The route closed: the start's fewest slides to the exit less the fewest from the closest state the ball reached. */
function skidClosed(puzzle: Of<"iceslide">, answer: string): { closed: number; total: number } {
  const board = memo(SLIDE_BOARDS, puzzle, () => slideBoard(puzzle));
  const total = slideDist(puzzle, { cell: puzzle.start, mask: 0 }) ?? 0;
  const replay = replaySlide(board, decodeSlideMoves(answer));
  if (replay.solved) return { closed: total, total };
  let best = total;
  for (const s of replay.visited) {
    const d = slideDist(puzzle, s);
    if (d !== null && d < best) best = d;
  }
  return { closed: Math.max(0, total - best), total };
}

const skid: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"iceslide">;
    const gems = p.gems ?? [];
    const got = gems.length ? replayGems(memo(SLIDE_BOARDS, p, () => slideBoard(p)), gems, decodeSlideMoves(input.answer)).collected : 0;
    const gemPoints = gems.length ? (ICE_STD.gems * got) / gems.length : 0;
    if (input.graded.isCorrect) return { finished: true, speed: speed("iceslide", input), bonus: gemPoints, measure: "gems" };
    const { closed, total } = skidClosed(p, input.answer);
    const w = waste(num(input.graded.extra, "moves"), p.minMoves);
    return { finished: false, credit: shareCredit(ctx, closed, total) * w + gemPoints, facts: { routeClosed: closed, route: total, gemsCollected: got, waste: w } };
  },
  parts: (puzzle, draft) => skidClosed(puzzle as Of<"iceslide">, draft).closed,
};

/* ------------------------------------------------------------------ Topsy-Turvy (gravity) */

const topsy: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"gravity">;
    if (!isTopsy(p)) return { finished: false, credit: 0 };
    const replay = replayTopsyPuzzle(p, decodeGravityTilts(input.answer));
    const totalStars = p.boards.reduce((n, b) => n + b.stars.length, 0);
    const balls = p.boards.reduce((n, b) => n + b.starts.length, 0);
    const starPts = (stars: number) => (totalStars > 0 ? (TOPSY_STD.stars * stars) / totalStars : 0);
    if (input.graded.isCorrect) {
      const parTilts = (p.boardMins ?? []).reduce((n, m) => n + m, 0);
      const bonus = starPts(replay.stars) + par("gravity", replay.tilts, parTilts);
      return { finished: true, speed: speed("gravity", input), bonus, measure: "stars + par", facts: { parTilts } };
    }
    // Unfinished: stars count only on boards cleared (today's rule: random tilting collects stars too), and the balls'
    // credit takes the move games' waste factor on the tilts against the fewest for the boards reached (random tilting
    // gets balls home on these boards; it earns about 0).
    const reachedMins = (p.boardMins ?? []).slice(0, replay.boards.length).reduce((n, m) => n + m, 0);
    const w = waste(replay.tilts, reachedMins);
    return { finished: false, credit: shareCredit(ctx, replay.home, balls) * w + starPts(replay.clearedStars), facts: { waste: w } };
  },
  parts: (puzzle, draft) => (isTopsy(puzzle) ? replayTopsyPuzzle(puzzle, decodeGravityTilts(draft)).home : 0),
};

/* ------------------------------------------------------------------ Gradient (tiles) */

/** Tiles put in place (they lock once home), out of those that started out of place. */
function gradientPlaced(puzzle: Of<"tiles">, answer: string): { placed: number; total: number } {
  const startIn = jumbledInPlace(puzzle.frame);
  const total = JUMBLED_MOVABLE - startIn;
  const replay = replayGradientAnswer(puzzle, answer);
  return { placed: Math.max(0, replay.inPlace - startIn), total };
}

const gradient: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"tiles">;
    if (input.graded.isCorrect) return { finished: true, speed: speed("tiles", input), bonus: par("tiles", num(input.graded.extra, "moves"), p.par), measure: "par" };
    const { placed, total } = gradientPlaced(p, input.answer);
    return { finished: false, credit: shareCredit(ctx, placed, total) };
  },
  parts: (puzzle, draft) => gradientPlaced(puzzle as Of<"tiles">, draft).placed,
};

/* ------------------------------------------------------------------ Turntable (rings) */

const RINGS_SOLVED = new WeakMap<object, number[]>();

/**
 * Segments of the spokes in place: of the 40 ring segments (five rings, eight spokes), those showing the colour their
 * spoke has in the finished turntable (the stored solution's offsets, turned together whichever way matches best).
 */
export function ringsSegmentsInPlace(puzzle: Of<"rings">, offsets: readonly number[]): number {
  const solved = memo(RINGS_SOLVED, puzzle, () => (puzzle.solution ?? []).reduce<number[]>((o, tap) => ringsApply(o, tap, puzzle.pattern), freshOffsets()));
  let best = 0;
  for (let g = 0; g < RINGS_SEGMENTS; g++) {
    const target = solved.map((o) => (o + g) % RINGS_SEGMENTS);
    let n = 0;
    for (let ring = 0; ring < puzzle.segments.length; ring++)
      for (let spoke = 0; spoke < RINGS_SEGMENTS; spoke++) if (ringColour(puzzle.segments, [...offsets], ring, spoke) === ringColour(puzzle.segments, target, ring, spoke)) n++;
    best = Math.max(best, n);
  }
  return best;
}

/** Spoke segments put in place beyond those in place at the start, out of those that weren't (a solve: all of them). */
function ringsSolvedSegments(puzzle: Of<"rings">, answer: string): { done: number; total: number } {
  const all = puzzle.segments.length * RINGS_SEGMENTS;
  const start = ringsSegmentsInPlace(puzzle, freshOffsets());
  const replay = replayRings(puzzle.segments, puzzle.pattern, decodeRingTaps(answer));
  const now = replay.solved ? all : ringsSegmentsInPlace(puzzle, replay.offsets);
  return { done: Math.max(0, now - start), total: all - start };
}

const turntable: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"rings">;
    if (input.graded.isCorrect) return { finished: true, speed: speed("rings", input), bonus: par("rings", num(input.graded.extra, "moves"), p.par ?? p.minMoves), measure: "par" };
    const { done, total } = ringsSolvedSegments(p, input.answer);
    const w = waste(num(input.graded.extra, "moves"), p.minMoves);
    return { finished: false, credit: shareCredit(ctx, done, total) * w, facts: { segmentsPlaced: done, segments: total, waste: w } };
  },
  parts: (puzzle, draft) => ringsSolvedSegments(puzzle as Of<"rings">, draft).done,
};

/* ------------------------------------------------------------------ Lightbender (laser) */

interface Shot {
  t: number;
  gems: number;
  bomb: boolean;
}

function laserShots(extra: Record<string, unknown> | null | undefined): Shot[] {
  const raw = extra?.["shots"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => s as Partial<Shot>)
    .filter((s): s is Shot => typeof s.t === "number" && typeof s.gems === "number" && typeof s.bomb === "boolean");
}

/**
 * Lightbender's unfinished gems: the best shot without a bomb (and, when a shot was left, the layout standing at the
 * buzzer, as today's timeout draft counted it). Gem k's time is the first shot without a bomb that lit k gems (the
 * buzzer's layout: the buzzer).
 */
export function laserBestGems(extra: Record<string, unknown> | null | undefined, limitMs: number, maxFires: number): { gems: number; times: (number | null)[] } {
  const shots = laserShots(extra).filter((s) => !s.bomb);
  const finalGems = num(extra, "gemsLit") ?? 0;
  const fired = laserShots(extra).length;
  if (fired < maxFires && extra?.["hitBomb"] !== true && finalGems > 0) shots.push({ t: limitMs, gems: finalGems, bomb: false });
  const gems = shots.reduce((m, s) => Math.max(m, s.gems), 0);
  const times: (number | null)[] = [];
  for (let k = 1; k <= gems; k++) times.push(shots.filter((s) => s.gems >= k).reduce<number | null>((m, s) => (m === null || s.t < m ? s.t : m), null));
  return { gems, times };
}

const lightbender: StandardGame = {
  grade(input) {
    const p = input.puzzle as Of<"laser">;
    const extra = input.graded.extra;
    if (input.graded.isCorrect) {
      const mirrors = num(extra, "solveMirrors") ?? num(extra, "mirrorsPlaced");
      const fewer = mirrors === null || !p.par ? 0 : parPoints(LASER_STD.mirrors, mirrors, p.par);
      const first = num(extra, "fires") === 1 ? LASER_STD.firstShot : 0;
      return { finished: true, speed: speed("laser", input), bonus: fewer + first, measure: "elegant beam" };
    }
    const { gems, times } = laserBestGems(extra, input.limitMs, LASER_MAX_FIRES);
    const early = times.reduce<number>((sum, t) => sum + (t === null ? 0 : LASER_STD.earlyPerGem * (1 - Math.max(0, Math.min(input.limitMs, t)) / input.limitMs)), 0);
    return { finished: false, credit: LASER_STD.perGem * gems + early, facts: { bestGems: gems } };
  },
};

/* ------------------------------------------------------------------ Chroma Lines (flow) */

function flowPaths(puzzle: Of<"flow">, answer: string): number[][] {
  return decodeFlowPaths(answer, puzzle.pairs.length || FLOW_PAIRS);
}

/** Pairs joined along their solution route, less pairs joined off it (today's rule: random lines earn about 0). */
function flowNet(puzzle: Of<"flow">, answer: string): number {
  const paths = flowPaths(puzzle, answer);
  const verdict = verifyFlow(puzzle.pairs, paths, puzzle.walls ?? []);
  const { onRoute } = flowRouteCounts(puzzle.solution, paths, verdict.joined);
  return Math.max(0, 2 * onRoute - verdict.pairsJoined);
}

/**
 * Redraws in a timeline: each time a pair's completed path (joining its two dots) is later changed or cleared. Null
 * without a timeline.
 */
export function flowRedraws(puzzle: Of<"flow">, drafts: readonly TimedDraft[] | null): number | null {
  if (!drafts) return null;
  const done: (string | null)[] = puzzle.pairs.map(() => null);
  let redraws = 0;
  for (const d of drafts) {
    const paths = flowPaths(puzzle, d.draft);
    const joined = verifyFlow(puzzle.pairs, paths, puzzle.walls ?? []).joined;
    puzzle.pairs.forEach((_, i) => {
      const key = (paths[i] ?? []).join(",");
      if (done[i] !== null && key !== done[i]) {
        redraws++;
        done[i] = null;
      }
      if (done[i] === null && joined[i]) done[i] = key;
    });
  }
  return redraws;
}

const chroma: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"flow">;
    if (input.graded.isCorrect) {
      const redraws = flowRedraws(p, input.drafts);
      return { finished: true, speed: speed("flow", input), bonus: redraws === null ? 0 : cleanPoints(FLOW_STD.clean, FLOW_STD.perRedraw, redraws), measure: "clean", facts: { redraws } };
    }
    return { finished: false, credit: shareCredit(ctx, flowNet(p, input.answer), p.pairs.length) };
  },
  parts: (puzzle, draft) => flowNet(puzzle as Of<"flow">, draft),
};

/* ------------------------------------------------------------------ Pipeline (pipes) */

/** Tiles connected to the source beyond those connected at the start, out of those that weren't. */
function pipesConnected(puzzle: Of<"pipes">, answer: string): { done: number; total: number } {
  const start = gradePipesBoard(puzzle.source, decodeSides(puzzle.tiles, "")).connected;
  const taps = (puzzle.pipesRev ?? 0) >= 1 ? decodePipesTaps(answer, puzzle.tiles.length) : null;
  const board = taps ? pipesAfterTaps(puzzle.tiles, taps) : decodeSides(puzzle.tiles, answer);
  const now = gradePipesBoard(puzzle.source, board).connected;
  return { done: Math.max(0, now - start), total: puzzle.tiles.length - start };
}

const pipeline: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"pipes">;
    if (input.graded.isCorrect) return { finished: true, speed: speed("pipes", input), bonus: par("pipes", num(input.graded.extra, "turns"), p.par), measure: "par" };
    const { done, total } = pipesConnected(p, input.answer);
    return { finished: false, credit: shareCredit(ctx, done, total) };
  },
  parts: (puzzle, draft) => pipesConnected(puzzle as Of<"pipes">, draft).done,
};

/* ------------------------------------------------------------------ Heave (push) */

function heaveState(puzzle: Of<"push">, answer: string) {
  const replay = replayPush(puzzle.walls, puzzle.targets, puzzle.pusher, puzzle.crates, decodePushMoves(answer));
  const home = Math.max(0, replay.cratesOnTargets - cratesOnTargets(puzzle.crates, puzzle.targets));
  const gold = puzzle.gold ? replay.state.crates[puzzle.gold.crate] === puzzle.gold.target : false;
  return { replay, home, gold };
}

const heave: StandardGame = {
  grade(input, ctx) {
    const p = input.puzzle as Of<"push">;
    const { replay, home, gold } = heaveState(p, input.answer);
    const goldPts = gold ? PUSH_STD.gold : 0;
    if (input.graded.isCorrect) return { finished: true, speed: speed("push", input), bonus: goldPts + par("push", replay.pushes, p.minPushes), measure: "gold crate + par" };
    const w = waste(replay.pushes, p.minPushes);
    return { finished: false, credit: (PUSH_STD.perCrate * home + ctx.early(PUSH_STD.earlyPerCrate, home)) * w + goldPts, facts: { cratesPlaced: home, goldOnMark: gold, waste: w } };
  },
  parts: (puzzle, draft) => heaveState(puzzle as Of<"push">, draft).home,
};

/** This category's standard games, read by the grader (games.server.ts). */
export const PATTERN_STANDARD_GAMES: Partial<Record<PuzzleType, StandardGame>> = {
  unblock: gridlock,
  blockparty: tessellate,
  iceslide: skid,
  gravity: topsy,
  tiles: gradient,
  rings: turntable,
  laser: lightbender,
  flow: chroma,
  pipes: pipeline,
  push: heave,
};

