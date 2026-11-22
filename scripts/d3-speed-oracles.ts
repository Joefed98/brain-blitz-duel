/**
 * D3's proof players for the Speed engine games (22 Nov 2026; difficulty-spec.md rule 6: 200 reachable under Joe's
 * human limits, 0.25 s to react and 0.15 s to move). Each plays a dealt run through the real sim at exactly the limits
 * (never faster), with no slip, and is graded by the server's own replay. A run it takes to 200 is a proof that a person
 * at the limits can score 200 on that deal. A script library, not a check (d3-speed-ladder-check.ts reads it).
 *
 *  - Bonk: every right-colour target tapped no sooner than 24 ticks after it rose (15 to react, 9 to move) and 9 ticks
 *    after the last tap, earliest sink first; both diamonds the same way; never a wrong colour or a hedgehog.
 *  - Pull!: every clay shot in launch order, at its own centre, no sooner than 24 ticks after its launch and 9 after the
 *    last shot (a shot on a clay never hits a bird: clays are checked first).
 *  - Tenfall: the gold-aware player (d3-speed-players.ts playTenfall) with no slip and no spread: a 250 ms reaction and
 *    the 250 ms floor to read and add each tile; the best of its lines aiming for gold at a detour of 0 to 6 tiles.
 */
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { whackCheckpoint, whackGameFor, whackRule, whackDiamondLife, WHACK_BOMB, WHACK_CHECKPOINT_INTERVAL, WHACK_INPUT_TAP, WHACK_STATUS_UP, WHACK_STATUS_WAITING, type WhackState } from "../src/lib/arcade/whack";
import { encodeWhackRun } from "../src/lib/duel/whack";
import { clayCheckpoint, clayGameFor, clayGravity, clayWorldH, CLAY_CHECKPOINT_INTERVAL, CLAY_FLYING, CLAY_INPUT_SHOT, CLAY_W, type ClayState } from "../src/lib/arcade/clayShoot";
import { encodeClayRun } from "../src/lib/duel/clayShoot";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { makeRng, type Skill } from "./puzzle-fairness/kit";
import { HUMAN_LIMITS } from "./speed-levels-tune";
import { playTenfall } from "./d3-speed-players";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { ascendLayoutAt, encodeNumberTaps, encodeTapTimes, type NumberTap } from "../src/lib/duel/tapLog";
import { chainBlockOf, chainBoardIndex, chainCycleAt, chainRequiredAt, chainReversedAt, chainRules, encodeChainAnswer, type ChainTap } from "../src/lib/duel/chain";

type Ev = Omit<ArcadeInputEvent, "t" | "d">;
/** 0.25 s to react and 0.15 s to move, in 60 Hz ticks; the move alone between two taps. */
export const LIMIT_REACT_MOVE_TICKS = 24;
export const LIMIT_MOVE_TICKS = 9;

function drive<S extends { tick: number }, C>(
  game: ArcadeGame<S, ArcadeInputEvent | null>,
  seed: number,
  key: string,
  checkpoint: (s: S) => C,
  interval: number,
  encode: (run: { seed: number; claimedScore: number; events: ArcadeInputEvent[]; endTick: number; checkpoints: C[] }) => string,
  pick: (state: S, t: number) => Ev | null,
): string {
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const cps: C[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    const ev = pick(state, t);
    if (ev) recordInput(events, { d: 0, ...ev, t }, game.inputRanges);
    const last = events[events.length - 1];
    state = game.step(state, last && last.t === t ? last : null);
    if (state.tick % interval === 0) cps.push(checkpoint(state));
  }
  const score = game.score(state);
  return appendClientCounters(encode({ seed, claimedScore: score, events, endTick: state.tick, checkpoints: cps }), arcadeCounters(key, state, score));
}

/** Bonk at the limits: earliest sink first among the targets (and diamonds) a person could reach by now. */
export function oracleBonk(p: PuzzleData): string {
  if (p.type !== "whack") throw new Error("oracleBonk: not Bonk");
  const game = whackGameFor(p.whackRev, p.bonkLevel);
  let lastTap = -1_000;
  return drive(game, p.seed, "whack", whackCheckpoint, WHACK_CHECKPOINT_INTERVAL, encodeWhackRun, (s: WhackState, t) => {
    if (t - lastTap < LIMIT_MOVE_TICKS) return null;
    const sch = s.schedule;
    let best: { hole: number; deadline: number } | null = null;
    // Targets up now (or rising this tick), right colour, reacted to by now, still up on this tick.
    for (let i = 0; i < sch.at.length; i++) {
      const up = s.status[i] === WHACK_STATUS_UP || (s.status[i] === WHACK_STATUS_WAITING && sch.at[i]! <= t);
      if (!up || sch.kind[i] === WHACK_BOMB || sch.kind[i] !== whackRule(sch.flips, sch.at[i]!)) continue;
      const deadline = sch.at[i]! + sch.life[i]! - 1;
      if (t < sch.at[i]! + LIMIT_REACT_MOVE_TICKS || t > deadline) continue;
      if (!best || deadline < best.deadline) best = { hole: sch.hole[i]!, deadline };
    }
    const dp = s.dp;
    if (dp) for (let d = 0; d < dp.at.length; d++) {
      if (dp.status[d] !== WHACK_STATUS_UP) continue;
      const deadline = dp.at[d]! + whackDiamondLife(dp) - 1;
      if (t < dp.at[d]! + LIMIT_REACT_MOVE_TICKS || t > deadline) continue;
      if (!best || deadline < best.deadline) best = { hole: dp.hole[d]!, deadline };
    }
    if (!best) return null;
    lastTap = t;
    return { k: WHACK_INPUT_TAP, a: best.hole, b: 0, c: 0 };
  });
}

/** Pull! at the limits: each clay in launch order, at its centre on the tick the shot lands. */
export function oraclePull(p: PuzzleData): string {
  if (p.type !== "clayshoot") throw new Error("oraclePull: not Pull!");
  const game = clayGameFor(p.clayRev, p.pullLevel);
  let lastShot = -1_000;
  return drive(game, p.seed, "clayshoot", clayCheckpoint, CLAY_CHECKPOINT_INTERVAL, (r) => encodeClayRun(r, p.clayRev), (s: ClayState, t) => {
    if (t - lastShot < LIMIT_MOVE_TICKS) return null;
    // The flying clay launched first, once a person could have reacted to it.
    let target = -1;
    for (let i = 0; i < s.status.length; i++) {
      if (s.status[i] !== CLAY_FLYING) continue;
      if (t < s.schedule.launch[i]! + LIMIT_REACT_MOVE_TICKS) continue;
      target = i;
      break;
    }
    if (target < 0) return null;
    // Where the clay will be after this tick's motion (the sim moves before it resolves the shot).
    const g = clayGravity(s);
    const x = (s.x[target]! + s.schedule.vx[target]!) / 256;
    const y = (s.y[target]! + s.vy[target]! + g) / 256;
    if (x < 0 || x > CLAY_W || y < 0 || y > clayWorldH(s)) return null;
    lastShot = t;
    return { k: CLAY_INPUT_SHOT, a: Math.round(x), b: Math.round(y), c: 0 };
  });
}

/** Tenfall's limits player with no slip and no spread. */
export const TENFALL_ORACLE: Skill = { ...HUMAN_LIMITS, pace: 0.5, err: 0, reactionSd: 0 };
/** The best of the limits player's lines over gold detours of 0 to 6 tiles (each run exactly at the limits). */
export function oracleTenfall(p: PuzzleData): string {
  let best = { score: -1, answer: "" };
  for (let detour = 0; detour <= 6; detour++) {
    const answer = playTenfall(p, makeRng(1), TENFALL_ORACLE, detour).steps.at(-1)!.answer;
    const score = gradeAnswer(p, answer, 0).score;
    if (score > best.score) best = { score, answer };
    if (score >= 200) break;
  }
  return best.answer;
}

/** The server's grade of a proof run (score, flagged). */
export function proofScore(p: PuzzleData): { score: number; flagged: boolean } {
  const answer = p.type === "whack" ? oracleBonk(p) : p.type === "clayshoot" ? oraclePull(p) : oracleTenfall(p);
  const g = gradeAnswer(p, answer, 0);
  return { score: g.score, flagged: !!(g.extra as { flagged?: unknown } | undefined)?.flagged };
}

/* ============ Flash, Ascend and the Chain: a person exactly at the limits, no slip ============ */

/** Flash: every gold tapped exactly 250 ms after it shows, no trap tapped. */
export function proofFlash(p: PuzzleData): string {
  if (p.type !== "reaction") throw new Error("proofFlash: not Flash");
  return encodeTapTimes(p.flashes.map((f) => f + 250));
}

/** Ascend: each disc after 0.25 s to react, 0.15 s to move and 35 ms a disc still on the board to find it. */
export function proofAscend(p: PuzzleData): { answer: string; atMs: number } {
  if (p.type !== "numhunt") throw new Error("proofAscend: not Ascend");
  const taps: NumberTap[] = [];
  let t = 400;
  let lastLayout = 0;
  for (let reached = 0; reached < p.spots.length; reached++) {
    const index = p.layouts.indexOf(ascendLayoutAt(p, t));
    if (index > lastLayout) (t += 600), (lastLayout = index);
    t += 250 + 150 + 35 * (p.spots.length - reached) * (p.descending ? 1.1 : 1);
    taps.push({ n: ascendLayoutAt(p, t)[reached]!.n, t: Math.round(t) });
  }
  return { answer: encodeNumberTaps(taps), atMs: t };
}

/** The Chain: each link after 0.25 s to react, 0.15 s to move and the elite's search (0.32 s, more on a new board). */
export function proofChain(p: PuzzleData): { answer: string; atMs: number } {
  if (p.type !== "chain") throw new Error("proofChain: not the Chain");
  const taps: ChainTap[] = [];
  const used: number[][] = [];
  const length = chainRules(p).length;
  const block = chainBlockOf(p);
  let t = 900;
  for (let links = 0; links < length; links++) {
    const reversed = chainReversedAt(p, links);
    const newBoard = links > 0 && links % block === 0;
    const cycleFactor = 1 + 0.06 * (chainCycleAt(p, links).length - 5);
    if (links > 0) t += 250 + 150 + (320 * cycleFactor + (newBoard ? 350 : 0)) * (reversed ? 1.25 : 1);
    const board = chainBoardIndex(links, p);
    const need = chainRequiredAt(p, links)!;
    const node = (p.boards[board] ?? []).findIndex((n, i) => !(used[board] ?? []).includes(i) && n.shape === need.shape && n.colour === need.colour);
    taps.push({ node, t: Math.round(t) });
    (used[board] ??= []).push(node);
  }
  return { answer: encodeChainAnswer({ taps, reason: "complete" }), atMs: t };
}

/** The server's grade of the limits proof run for Flash, Ascend or the Chain (graded with the clock it ends on). */
export function tapProofScore(p: PuzzleData): number {
  const limit = puzzleTimeLimitMs(p);
  if (p.type === "reaction") return gradeAnswer(p, proofFlash(p), 0).score;
  const run = p.type === "numhunt" ? proofAscend(p) : proofChain(p);
  return gradeAnswer(p, run.answer, Math.max(0, limit - run.atMs)).score;
}
