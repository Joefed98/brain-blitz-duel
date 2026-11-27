/**
 * D3's level-aware Speed players for the ladder (d3-ladder-lib.ts): a game listed here is played by its own player.
 *
 * Bonk (whack): the engine kit's player (kits-engine.ts whackKit: reaction, a colour check, the finger's travel; the
 * same slips and stale-rule pulls), with three things the kit can't do: it drives every whackRev and lawn the stored
 * puzzle names (the kit drives whackRev 3 and 4 only), the finger's travel follows the lawn (Fitts: a longer reach
 * between smaller burrows takes longer, calibrated so Normal's 4 × 4 keeps the kit's 140 ms), and a diamond is always
 * worth a try while it is up (the kit gives up 40 % of diamonds it would reach after 300 ms, whackRev 3's life).
 */
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { recordInput, TICK_MS, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { whackCheckpoint, whackDiamondLife, whackGameFor, whackHolesOf, whackColsOf, whackRule, WHACK_CHECKPOINT_INTERVAL, WHACK_INPUT_TAP, WHACK_STATUS_UP, type WhackState } from "../src/lib/arcade/whack";
import { encodeWhackRun } from "../src/lib/duel/whack";
import { tdApply, tdStagesOf, tdTargetsOf, tenDropCheckpoint, tenDropGame, tenDropHolding, tenDropInit, TD_CHECKPOINT_INTERVAL, TD_CONFIG, TD_H, TD_INPUT_TAP, type TenDropState } from "../src/lib/arcade/tenDrop";
import { encodeTenDropRun } from "../src/lib/duel/tenDrop";

import { SKILLS, hashText, makeRng, thinkMs, type Play, type Rng, type Skill } from "./puzzle-fairness/kit";
import { HUMAN_LIMITS } from "./speed-levels-tune";
import type { D3Players } from "./d3-ladder-lib";
import type { ChainPuzzleData, PuzzleData } from "../src/lib/duel/types";
import { chainBlockOf, chainSpareOf, chainBoardIndex, chainCycleAt, chainLongCycles, chainRequiredAt, chainReversedAt, chainRules, chainTimeLimitMs, chainWindowMs, encodeChainAnswer, type ChainTap } from "../src/lib/duel/chain";
import type { ChainBreak } from "../src/lib/duel/types";
import type { Step } from "./puzzle-fairness/kit";

type Ev = Omit<ArcadeInputEvent, "t" | "d"> & { d?: number };
const ticks = (ms: number) => Math.max(1, Math.round(ms / TICK_MS));
const tickMs = (tick: number) => Math.round(tick * TICK_MS);
const react = (rng: Rng, skill: Skill) => Math.max(120, rng.normal(skill.reactionMs, skill.reactionSd));

/** Steps a game to its end, recording each picked event on the next tick as the phone does (kits-engine.ts drive). */
function drive<S extends { tick: number }, C>(
  game: ArcadeGame<S, ArcadeInputEvent | null>,
  seed: number,
  diagKey: string,
  checkpoint: (s: S) => C,
  interval: number,
  encode: (run: { seed: number; claimedScore: number; events: ArcadeInputEvent[]; endTick: number; checkpoints: C[] }) => string,
  pick: (state: S, t: number) => Ev | null,
): { state: S; raw: string } {
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
  return { state, raw: appendClientCounters(encode({ seed, claimedScore: score, events, endTick: state.tick, checkpoints: cps }), arcadeCounters(diagKey, state, score)) };
}

/** One event a tick, as the phone records (two planned on a tick slide to the next free one). */
class Sched {
  private q = new Map<number, Ev>();
  at(t: number, ev: Ev): number {
    let at = Math.max(1, Math.round(t));
    while (this.q.has(at)) at++;
    this.q.set(at, ev);
    return at;
  }
  take(t: number): Ev | null {
    const ev = this.q.get(t) ?? null;
    if (ev) this.q.delete(t);
    return ev;
  }
}

/* =================================== Bonk =================================== */

/** The finger's travel between two burrows, relative to Normal's typical reach (Fitts' index of difficulty). */
function reachFactor(from: number, to: number, cols: number): number {
  if (from < 0) return 1;
  const dx = (from % cols) - (to % cols);
  const dy = Math.floor(from / cols) - Math.floor(to / cols);
  // A burrow fills about 85 % of its cell; 1.79 is log2(1 + D/W) for Normal's 4 × 4 average reach.
  return Math.log2(1 + Math.hypot(dx, dy) / 0.85) / 1.79;
}

export function playBonk(p: PuzzleData, rng: Rng, skill: Skill): Play {
  if (p.type !== "whack") throw new Error("playBonk: not a Bonk puzzle");
  const game = whackGameFor(p.whackRev, p.bonkLevel);
  const limited = skill === HUMAN_LIMITS;
  const sched = new Sched();
  const seen = new Set<number>();
  let fingerFree = 0;
  let fingerAt = -1;
  const drng = makeRng(hashText(`d3-bonk:diamond:${p.seed}:${skill.level}:${skill.reactionMs}`));
  const tap = (hole: number): Ev => ({ k: WHACK_INPUT_TAP, a: hole, b: 0, c: 0 });
  const move = (r: Rng, to: number, cols: number) => {
    const ms = Math.max(90, r.normal(140, 30)) * skill.pace * reachFactor(fingerAt, to, cols);
    return limited ? Math.max(150, ms) : Math.max(60, ms);
  };
  const run = drive(game, p.seed, "whack", whackCheckpoint, WHACK_CHECKPOINT_INTERVAL, encodeWhackRun, (s: WhackState, t) => {
    const sch = s.schedule;
    const cols = whackColsOf(s);
    for (let i = 0; i < s.next; i++) {
      if (s.status[i] !== WHACK_STATUS_UP || seen.has(i)) continue;
      seen.add(i);
      const rule = whackRule(sch.flips, sch.at[i]!);
      const lastFlip = Math.max(-1e9, ...sch.flips.filter((f) => f <= sch.at[i]!));
      const stale = sch.at[i]! - lastFlip < ticks(skill.reactionMs * 2.5) && rng.chance(Math.min(0.6, 3 * skill.err));
      const believed = stale ? rule ^ 1 : rule;
      let hit = sch.kind[i] === believed;
      if (rng.chance(skill.err)) hit = !hit;
      if (!hit) continue;
      const when = Math.max(t + ticks(react(rng, skill) + Math.max(40, rng.normal(100, 30)) * skill.pace), fingerFree + ticks(move(rng, sch.hole[i]!, cols)));
      if (when >= sch.at[i]! + sch.life[i]! && !rng.chance(0.6)) continue;
      fingerFree = sched.at(when, tap(sch.hole[i]!));
      fingerAt = sch.hole[i]!;
    }
    const dp = s.dp;
    if (dp) for (let d = 0; d < dp.at.length; d++) {
      if (dp.status[d] !== WHACK_STATUS_UP || seen.has(1000 + d)) continue;
      seen.add(1000 + d);
      const when = Math.max(t + ticks(react(drng, skill) + Math.max(30, drng.normal(60, 20)) * skill.pace), fingerFree + ticks(move(drng, dp.hole[d]!, cols)));
      // Always worth a try while it is up (a late one is an empty-hole tap, as the kit's).
      if (when >= dp.at[d]! + whackDiamondLife(dp) && !drng.chance(0.6)) continue;
      fingerFree = sched.at(when, tap(dp.hole[d]!));
      fingerAt = dp.hole[d]!;
    }
    void whackHolesOf;
    return sched.take(t);
  });
  return { steps: [{ answer: run.raw, atMs: tickMs(run.state.tick) }], timed: true };
}

/* ================================== Tenfall ================================== */

/**
 * Tenfall: the engine kit's player (kits-engine.ts tenDropKit: a reaction and 0.45 s × pace to read a tile and add it,
 * planning the fewest tiles to the target over the repeating queue, the odd mis-add), plus what the kit doesn't do: a
 * gold ten is a plan (the gold tile shines, and the deal puts it 1–2 tiles off the fastest line), so a player aims for
 * it whenever its line costs at most `goldDetour` more tiles than the fastest one (an elite 3, an average player 0:
 * gold only when it is on the fastest line).
 */
const INF = 1e6;
const tdValues = new Map<string, number[][]>();
/** Fewest further arrivals to make `target` from each queue position (mod n) and total; `gold` ≥ 0: the gold tile must make it. */
function tdValue(queue: readonly number[], target: number, gold: number): number[][] {
  const key = `${target}:${gold}:${queue.join(",")}`;
  const hit = tdValues.get(key);
  if (hit) return hit;
  const n = queue.length;
  const V = Array.from({ length: n }, () => new Array<number>(target + 1).fill(INF));
  for (let pass = 0; pass < 60; pass++) {
    let changed = false;
    for (let j = n - 1; j >= 0; j--) {
      const nx = V[(j + 1) % n]!;
      for (let r = 0; r < target; r++) {
        let v = 1 + nx[r]!;
        const res = tdApply(queue[j]!, r);
        if (res !== null) {
          if (res === target) v = gold < 0 || j === gold ? 1 : v;
          else v = Math.min(v, 1 + nx[res > target ? 0 : res]!);
        }
        if (v < V[j]![r]!) { V[j]![r] = v; changed = true; }
      }
    }
    if (!changed) break;
  }
  tdValues.set(key, V);
  return V;
}
function tdTapAt(s: TenDropState, tileIdx: number, dt: number, jitterPx: number): Ev | null {
  const tile = s.tiles[tileIdx]!;
  const speed = tdStagesOf(s)[s.stage]!.speed;
  const top = (tile.y + speed * dt) / 256;
  if (top > TD_H - 8) return null;
  return { k: TD_INPUT_TAP, a: tile.col, b: Math.round(Math.max(0, Math.min(TD_H, top + TD_CONFIG.tileH / 2 + jitterPx))), c: 0, d: 0 };
}

/** Tenfall's elite: the human limits' reactions and slips, a top player's quick sums (the kit's 0.45 s × 0.5 a tile). */
export const TENFALL_ELITE: Skill = { ...HUMAN_LIMITS, pace: 0.5 };

export function playTenfall(p: PuzzleData, rng: Rng, skill: Skill, goldDetour: number): Play {
  if (p.type !== "tendrop") throw new Error("playTenfall: not a Tenfall puzzle");
  const rev = p.tenRev ?? 0;
  const stages = p.tenLevel?.stages;
  const game = { ...tenDropGame, init: (seed: number) => tenDropInit(seed, rev, stages) };
  const BASE = 0.45;
  let pending: { tick: number; ev: Ev } | null = null;
  let nextLook = 1;
  let finishTick = 0;
  const run = drive(game, p.seed, "tendrop", tenDropCheckpoint, TD_CHECKPOINT_INTERVAL, encodeTenDropRun, (s, t) => {
    if (s.cleared >= tdTargetsOf(s) && !finishTick) finishTick = s.clearTick;
    if (pending && pending.tick <= t) { const ev = pending.ev; pending = null; nextLook = t + 1; return ev; }
    if (pending || t < nextLook || tenDropHolding(s) || s.cleared > s.stage) return null;
    const target = s.plan.targets[s.stage]!;
    const dt = ticks(react(rng, skill) + thinkMs(rng, BASE, skill));
    const reachable = s.tiles.map((tile, i) => ({ tile, i, ev: tdTapAt(s, i, dt, rng.normal(0, 6)) })).filter((x) => x.ev && x.tile.y > -TD_CONFIG.tileH * 128);
    if (reachable.length === 0) { nextLook = t + 6; return null; }
    const queue = s.plan.queues[s.stage]!;
    const n = queue.length;
    const goldPos = s.plan.gold?.[s.stage] ?? -1;
    const plain = tdValue(queue, target, -1);
    const golden = goldPos >= 0 ? tdValue(queue, target, goldPos) : plain;
    const base = s.nextId - s.queueIndex;
    const at = (V: number[][], pos: number, total: number) => V[((pos % n) + n) % n]![total]!;
    // Aim for gold when its line costs at most `goldDetour` more tiles than the fastest one (counted from now).
    const useGold = goldPos >= 0 && at(golden, s.queueIndex, s.total) - at(plain, s.queueIndex, s.total) <= goldDetour;
    const V = useGold ? golden : plain;
    let choice: (typeof reachable)[number] | undefined;
    if (rng.chance(skill.err)) choice = rng.pick(reachable);
    else {
      let best = at(V, s.queueIndex, s.total);
      for (const x of reachable) best = Math.min(best, at(V, x.tile.id - base, s.total));
      best -= 0.01;
      for (const x of reachable) {
        const r = tdApply(x.tile.tile, s.total);
        if (r === null) continue;
        const q = x.tile.id - base;
        const v = r === target ? (!useGold || x.tile.gold ? -100 : INF) : at(V, q + 1, r > target ? 0 : r) + rng.normal(0, 0.6 * skill.pace);
        if (v < best) { best = v; choice = x; }
      }
    }
    if (!choice) { nextLook = t + 6; return null; }
    pending = { tick: t + dt, ev: choice.ev! };
    return null;
  });
  const s = run.state;
  const end = s.cleared >= tdTargetsOf(s) ? (finishTick || s.clearTick) : s.tick;
  return { steps: [{ answer: run.raw, atMs: tickMs(end) }], timed: true };
}

/* ============================ Don't Break the Chain ============================ */

/**
 * The Chain, both players on the stored puzzle's own boards (chainBlockOf: a new board every cycle at D3's levels),
 * finding the next charm takes a little longer the longer the cycle (6 % a charm over Normal's five, as the kits' six):
 *  - elite: speed-levels-tune's playChain (a 0.25 s reaction, a 0.15 s move and 0.32 s to find the charm, 0.35 s more
 *    on a new board, a quarter slower reversed; a slip is a wrong tap);
 *  - average: the Chain kit's player (kits-speed.ts: 0.85 s × pace a link, 1.1 s on a new board; most slips are a
 *    hesitation that can run past the window, a fifth a wrong tap).
 */
function chainNodesOf(c: ChainPuzzleData, links: number, used: number[][], match: boolean): number[] {
  const board = chainBoardIndex(links, c);
  const need = chainRequiredAt(c, links)!;
  return (c.boards[board] ?? []).map((n, i) => ({ n, i })).filter(({ n, i }) => !(used[board] ?? []).includes(i) && (n.shape === need.shape && n.colour === need.colour) === match).map(({ i }) => i);
}

export function playChainD3(p: PuzzleData, rng: Rng, skill: Skill, model: "elite" | "kit"): Play {
  if (p.type !== "chain") throw new Error("playChainD3: not a Chain puzzle");
  const c = p;
  const taps: ChainTap[] = [];
  const used: number[][] = [];
  const steps: Step[] = [];
  const length = chainRules(c).length;
  const limit = chainTimeLimitMs(c);
  const block = chainBlockOf(c);
  let spares = chainSpareOf(c);
  const finish = (reason: ChainBreak, at: number) => steps.push({ answer: encodeChainAnswer({ taps, reason }), atMs: at });
  let lastT: number | null = null;
  let t = model === "elite" ? 900 : thinkMs(rng, 1.5, skill);
  for (let links = 0; links < length; ) {
    const reversed = chainReversedAt(c, links);
    const firstReversed = reversed && !chainReversedAt(c, links - 1);
    const cycleLen = chainCycleAt(c, links).length;
    const newBoard = links > 0 && links % block === 0;
    const cycleFactor = 1 + 0.06 * (cycleLen - 5);
    let gap: number;
    let wrong: boolean;
    if (model === "elite") {
      const search = (320 * cycleFactor + (newBoard ? 350 : 0)) * (reversed ? 1.25 : 1);
      gap = links === 0 ? 0 : actionMs(rng, skill, search);
      wrong = links > 0 && (rng.chance(skill.err * (reversed ? 1.5 : 1)) || (firstReversed && rng.chance(skill.err * 2)));
    } else {
      const factor = (chainLongCycles(c) ? cycleFactor : 1) * (reversed ? 1.25 : 1);
      gap = links === 0 ? 0 : thinkMs(rng, (newBoard ? 1.1 : 0.85) * factor, skill);
      const mistake = links > 0 && rng.chance(skill.err * (reversed ? 1.5 : 1));
      const forgot = firstReversed && rng.chance(Math.min(0.5, skill.err * 1.5));
      wrong = forgot || (mistake && rng.chance(0.2));
      if (mistake && !wrong) gap += thinkMs(rng, 0.8, skill);
    }
    // From the player's last tap (a forgiven wrong one included).
    const at = (lastT === null ? t : Math.max(lastT, t)) + gap;
    if (lastT !== null && at - lastT > chainWindowMs(links + 1, c)) {
      finish("momentum", lastT + chainWindowMs(links + 1, c));
      return { timed: true, steps };
    }
    if (at > limit) break;
    const pool = chainNodesOf(c, links, used, !wrong);
    const node = pool.length ? rng.pick(pool) : 0;
    taps.push({ node, t: Math.round(at) });
    if (wrong) {
      // Easy's spare link (chainSpareOf): the first wrong tap is forgiven; the chain goes on from the last link.
      if (spares > 0) {
        spares -= 1;
        steps.push({ answer: encodeChainAnswer({ taps, reason: "timer" }), atMs: at });
        t = at;
        continue;
      }
      finish("wrong", at);
      return { timed: true, steps };
    }
    (used[chainBoardIndex(links, c)] ??= []).push(node);
    links += 1;
    lastT = at;
    t = at;
    if (links >= length) finish("complete", at);
    else steps.push({ answer: encodeChainAnswer({ taps, reason: "timer" }), atMs: at });
  }
  return { timed: true, steps };
}
/** speed-levels-tune's action time: a reaction (held to 0.8 of the mean), a 0.15 s move and the search. */
function actionMs(rng: Rng, skill: Skill, searchMs: number): number {
  const reactMs = Math.max(skill.reactionMs * 0.8, rng.normal(skill.reactionMs, skill.reactionSd));
  return reactMs + 150 + searchMs * Math.exp(rng.normal(0, 0.18));
}

export const SPEED_PLAYERS: D3Players = {
  whack: {
    average: (p, rng) => playBonk(p, rng, SKILLS.average),
    elite: (p, rng) => playBonk(p, rng, HUMAN_LIMITS),
  },
  chain: {
    average: (p, rng) => playChainD3(p, rng, SKILLS.average, "kit"),
    elite: (p, rng) => playChainD3(p, rng, HUMAN_LIMITS, "elite"),
  },
  tendrop: {
    average: (p, rng) => playTenfall(p, rng, SKILLS.average, 0),
    // An elite's arithmetic is quick (near-perfect thinking, pace 0.5), its reactions and taps held to the limits.
    elite: (p, rng) => playTenfall(p, rng, TENFALL_ELITE, 3),
  },
};
