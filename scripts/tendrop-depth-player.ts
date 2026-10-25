/**
 * Tenfall tenRev 4 players for the depth tuning (scripts/tendrop-depth-bands.ts) and the depth check
 * (scripts/tendrop-depth-check.ts). Script-only: floats and Math are fine here; every run they make is a real
 * phone answer (the input log on the sim tick it applied, checkpoints, counters) graded by the server's replay.
 *
 * `playTenDrop` is the puzzle-fairness Tenfall kit's player (scripts/puzzle-fairness/kits-engine.ts: the same
 * reaction, think time, tap aim and mis-add rate) on tenRev 4's start state, planning over (queue position,
 * total) with a gold ten (made by the gold tile) worth `goldWeight` tiles of time. goldWeight 0 plays as the kit does.
 */
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { inputAt, recordInput, TICK_MS, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  tdApply,
  tenDropCheckpoint,
  tenDropGame,
  tenDropHolding,
  tenDropInit,
  TD_CHECKPOINT_INTERVAL,
  TD_CONFIG,
  TD_H,
  TD_INPUT_TAP,
  TD_TARGETS,
  type TenDropState,
} from "@/lib/arcade/tenDrop";
import { encodeTenDropRun } from "@/lib/duel/tenDrop";
import { thinkMs, type Rng, type Skill } from "./puzzle-fairness/kit";

type Ev = Omit<ArcadeInputEvent, "t">;
const ticks = (ms: number) => Math.max(1, Math.round(ms / TICK_MS));

/** An elite player (beyond the shared SKILLS' near-perfect): faster reading, no mis-adds. */
export const ELITE: Skill = { level: "near", pace: 0.35, err: 0, reactionMs: 140, reactionSd: 15 };

function tapAt(s: TenDropState, i: number, dt: number, jitter: number): Ev | null {
  const tile = s.tiles[i]!;
  const top = (tile.y + TD_CONFIG.stages[s.stage]!.speed * dt) / 256;
  if (top > TD_H - 8) return null;
  return { k: TD_INPUT_TAP, a: tile.col, b: Math.round(Math.max(0, Math.min(TD_H, top + TD_CONFIG.tileH / 2 + jitter))), c: 0, d: 0 };
}

const CACHE = new Map<string, number[][]>();
/** Fewest tiles to the target from (position, total), plus `goldWeight` when the ten is not made by the gold tile. */
function value(queue: readonly number[], target: number, gold: number, goldWeight: number): number[][] {
  const key = `${target}:${gold}:${goldWeight}:${queue.join(",")}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const n = queue.length;
  const V = Array.from({ length: n }, () => new Array<number>(target).fill(1e6));
  for (let pass = 0; pass < 60; pass++) {
    let changed = false;
    for (let j = n - 1; j >= 0; j--) {
      const nx = V[(j + 1) % n]!;
      for (let r = 0; r < target; r++) {
        let v = 1 + nx[r]!;
        const res = tdApply(queue[j]!, r);
        if (res !== null) v = Math.min(v, res === target ? 1 + (j === gold ? 0 : goldWeight) : 1 + nx[res > target ? 0 : res]!);
        if (v < V[j]![r]!) {
          V[j]![r] = v;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  CACHE.set(key, V);
  return V;
}

export interface TenDropPlayed { raw: string; state: TenDropState }

/** One run on (seed, tenRev) by a kit-style player; `goldWeight` > 0 plays for gold tens. */
export function playTenDrop(seed: number, rev: number | undefined, rng: Rng, skill: Skill, goldWeight: number): TenDropPlayed {
  const BASE = 0.45;
  let state = tenDropInit(seed, rev);
  const events: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof tenDropCheckpoint>[] = [];
  let pending: { tick: number; ev: Ev } | null = null;
  let nextLook = 1;
  const pick = (s: TenDropState, t: number): Ev | null => {
    if (pending && pending.tick <= t) {
      const ev = pending.ev;
      pending = null;
      nextLook = t + 1;
      return ev;
    }
    if (pending || t < nextLook || tenDropHolding(s) || s.cleared > s.stage) return null;
    const target = s.plan.targets[s.stage]!;
    const react = Math.max(120, rng.normal(skill.reactionMs, skill.reactionSd));
    const dt = ticks(react + thinkMs(rng, BASE, skill));
    const reachable = s.tiles
      .map((tile, i) => ({ tile, i, ev: tapAt(s, i, dt, rng.normal(0, 6)) }))
      .filter((x) => x.ev && x.tile.y > -TD_CONFIG.tileH * 128);
    if (reachable.length === 0) {
      nextLook = t + 6;
      return null;
    }
    let choice: (typeof reachable)[number] | undefined;
    if (rng.chance(skill.err)) choice = rng.pick(reachable);
    else {
      const queue = s.plan.queues[s.stage]!;
      const gold = goldWeight > 0 ? (s.plan.gold?.[s.stage] ?? -1) : -1;
      const V = value(queue, target, gold, goldWeight > 0 ? goldWeight : 0);
      const n = queue.length;
      const base = s.nextId - s.queueIndex;
      const at = (pos: number, total: number) => V[((pos % n) + n) % n]![total]!;
      let best = at(s.queueIndex, s.total);
      for (const x of reachable) best = Math.min(best, at(x.tile.id - base, s.total));
      best -= 0.01;
      for (const x of reachable) {
        const r = tdApply(x.tile.tile, s.total);
        if (r === null) continue;
        const q = x.tile.id - base;
        const v = r === target
          ? (x.tile.gold || goldWeight <= 0 ? -100 : -100 + goldWeight)
          : at(q + 1, r > target ? 0 : r) + rng.normal(0, 0.6 * skill.pace);
        if (v < best) {
          best = v;
          choice = x;
        }
      }
    }
    if (!choice) {
      nextLook = t + 6;
      return null;
    }
    pending = { tick: t + dt, ev: choice.ev! };
    return null;
  };
  while (!tenDropGame.isOver(state) && state.tick < tenDropGame.runTicks) {
    const t = state.tick + 1;
    const ev = pick(state, t);
    if (ev) recordInput(events, { ...ev, t }, tenDropGame.inputRanges);
    state = tenDropGame.step(state, inputAt(events, t));
    if (state.tick % TD_CHECKPOINT_INTERVAL === 0) cps.push(tenDropCheckpoint(state));
  }
  const score = tenDropGame.score(state);
  const raw = appendClientCounters(
    encodeTenDropRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints: cps }),
    arcadeCounters("tendrop", state, score),
  );
  return { raw, state };
}

/**
 * A scripted best run for the 200 proof: no reaction or think time, it taps the tile it plans for (gold tens
 * first, then fewest tiles) as soon as the tile is fully on the board.
 */
export function playTenDropPerfect(seed: number, rev: number, goldWeight = 6): TenDropPlayed {
  let state = tenDropInit(seed, rev);
  const events: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof tenDropCheckpoint>[] = [];
  let decided = 0;
  const pick = (s: TenDropState): Ev | null => {
    if (tenDropHolding(s) || s.cleared > s.stage || s.cleared >= TD_TARGETS) return null;
    const target = s.plan.targets[s.stage]!;
    const queue = s.plan.queues[s.stage]!;
    const V = value(queue, target, goldWeight > 0 ? (s.plan.gold?.[s.stage] ?? -1) : -1, goldWeight);
    const n = queue.length;
    const base = s.nextId - s.queueIndex;
    const at = (pos: number, total: number) => V[((pos % n) + n) % n]![total]!;
    // Each tile is judged once, the tick it arrives, by the plan (take or let it fall), as the plan assumes.
    for (const x of s.tiles) {
      if (x.id < decided) continue;
      decided = x.id + 1;
      const q = x.id - base;
      const r = tdApply(x.tile, s.total);
      if (r === null) continue;
      const skip = at(q + 1, s.total) + 1;
      const take = r === target ? 1 + (x.gold || goldWeight <= 0 ? 0 : goldWeight) : 1 + at(q + 1, r > target ? 0 : r);
      if (take <= skip) return tapAt(s, s.tiles.indexOf(x), 1, 0);
    }
    return null;
  };
  while (!tenDropGame.isOver(state) && state.tick < tenDropGame.runTicks) {
    const t = state.tick + 1;
    const ev = pick(state);
    if (ev) recordInput(events, { ...ev, t }, tenDropGame.inputRanges);
    state = tenDropGame.step(state, inputAt(events, t));
    if (state.tick % TD_CHECKPOINT_INTERVAL === 0) cps.push(tenDropCheckpoint(state));
  }
  const score = tenDropGame.score(state);
  const raw = appendClientCounters(
    encodeTenDropRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints: cps }),
    arcadeCounters("tendrop", state, score),
  );
  return { raw, state };
}
