/**
 * Player kits for the arcade-engine games: Tenfall (tendrop), Mixed Signals
 * (stroop), Letterfall (wordfall), Bonk (whack) and Pull! (clayshoot).
 *
 * Each kit drives the real sim tick by tick and records its input log exactly as
 * the phone does (one event per tick through recordInput, checkpoints every
 * interval, the run's own encoder plus client counters). A play returns ONE
 * timed step: the encoded log the phone auto-submits when the sim ends, at the
 * finishing tick (Tenfall's last clear, Mixed Signals' last sort) or the run's
 * end. Script-only: floats and Math are fine; every random choice is the Rng.
 */
import { appendClientCounters, arcadeCounters } from "../../src/lib/arcade/diagnostics";
import { inputAt, recordInput, TICK_MS, type ArcadeGame, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  tenDropCheckpoint, tenDropGame, tenDropHolding, tdApply,
  TD_CHECKPOINT_INTERVAL, TD_CONFIG, TD_H, TD_INPUT_TAP, type TenDropState,
} from "../../src/lib/arcade/tenDrop";
import { encodeTenDropRun } from "../../src/lib/duel/tenDrop";
import {
  clashCheckpoint, clashDropFp, clashGateYFp, clashGatesAt, clashLaneCount, clashRuleAt, clashVariantOf, colourClashGameFor, CLASH_START_Y_FP,
  CLASH_CHECKPOINT_INTERVAL, CLASH_DROP, CLASH_INPUT_LANE, CLASH_LANE_EXPAND_TICK, CLASH_SET_LANE, CLASH_WORLD_W, type ClashState,
} from "../../src/lib/arcade/colourClash";
import { encodeColourClashRun } from "../../src/lib/duel/colourClash";
import {
  wfFind, wfRestY, wfSettled, wfSpelling, wfWordPoints, wordfallCheckpoint, wordfallGameFor,
  WF_CELL, WF_CHECKPOINT_INTERVAL, WF_COLS, WF_INPUT_ENTER, WF_INPUT_TAP, WF_ROWS, WF_RUN_TICKS, WF_WELL_X, WF_WELL_Y,
  type WordfallState,
} from "../../src/lib/arcade/wordfall";
import { isWordfallWord } from "../../src/lib/arcade/wordfallDict";
import { COMMON_WORDS_RAW } from "../../src/lib/duel/commonWords.server";
import { ensureWordfallDict } from "../../src/lib/duel/wordfallDict.server";
import { encodeWordfallRun } from "../../src/lib/duel/wordfall";
import {
  whackCheckpoint, whackGameFor, whackRule, WHACK_DIAMOND_LIFE_TICKS, WHACK_BOMB, WHACK_CHECKPOINT_INTERVAL, WHACK_HOLES, WHACK_INPUT_TAP, WHACK_STATUS_UP,
  type WhackState,
} from "../../src/lib/arcade/whack";
import { encodeWhackRun } from "../../src/lib/duel/whack";
import {
  clayCheckpoint, clayGameFor, clayGravity, clayWorldH, CLAY_BIRD_FLYING, CLAY_CHECKPOINT_INTERVAL, CLAY_FLYING, CLAY_INPUT_SHOT, CLAY_W,
  type ClayState,
} from "../../src/lib/arcade/clayShoot";
import { encodeClayRun } from "../../src/lib/duel/clayShoot";
import { PROFILES } from "../arcade-skill-bands/human";
import type { PuzzleData } from "../../src/lib/duel/types";
import { hashText, makeRng, thinkMs, type PuzzleKit, type Rng, type Skill } from "./kit";

/* ------------------------------- Shared drive ------------------------------- */

type Ev = Omit<ArcadeInputEvent, "t" | "d"> & { d?: number };
type Pick<S> = (state: S, t: number) => Ev | null;

const ticks = (ms: number) => Math.max(1, Math.round(ms / TICK_MS));
const tickMs = (tick: number) => Math.round(tick * TICK_MS);
/** Reaction to something unexpected, ms (skill mean/sd, floor 120). */
const react = (rng: Rng, skill: Skill) => Math.max(120, rng.normal(skill.reactionMs, skill.reactionSd));

interface Driven<S> { state: S; raw: string }

/**
 * Steps the game to its end, recording the picker's event on the next sim tick
 * as the phone does, then encodes the run as the phone's auto-submit does.
 */
function drive<S extends { tick: number }, C>(
  game: ArcadeGame<S, ArcadeInputEvent | null>,
  seed: number,
  diagKey: string,
  checkpoint: (s: S) => C,
  interval: number,
  encode: (run: { seed: number; claimedScore: number; events: ArcadeInputEvent[]; endTick: number; checkpoints: C[] }) => string,
  pick: Pick<S> | null,
): Driven<S> {
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const cps: C[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    const ev = pick ? pick(state, t) : null;
    if (ev) recordInput(events, { d: 0, ...ev, t }, game.inputRanges);
    state = game.step(state, inputAt(events, t));
    if (state.tick % interval === 0) cps.push(checkpoint(state));
  }
  const score = game.score(state);
  const raw = appendClientCounters(encode({ seed, claimedScore: score, events, endTick: state.tick, checkpoints: cps }), arcadeCounters(diagKey, state, score));
  return { state, raw };
}

/** Planned events by tick; two on one tick slide to the next free tick (one event a tick, like the phone). */
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
  clear(): void { this.q.clear(); }
  get size(): number { return this.q.size; }
}

/* ================================= Tenfall ================================= */

function tenDropDrive(p: PuzzleData, pick: Pick<TenDropState> | null): Driven<TenDropState> {
  return drive(tenDropGame, p.type === "tendrop" ? p.seed : 1, "tendrop", tenDropCheckpoint, TD_CHECKPOINT_INTERVAL, encodeTenDropRun, pick);
}

/** A tap aimed at a tile's centre `dt` ticks from now (where it will be when the finger lands). */
function tdTapAt(s: TenDropState, tileIdx: number, dt: number, jitterPx: number): Ev | null {
  const tile = s.tiles[tileIdx]!;
  const speed = TD_CONFIG.stages[s.stage]!.speed;
  const top = (tile.y + speed * dt) / 256;
  if (top > TD_H - 8) return null;
  return { k: TD_INPUT_TAP, a: tile.col, b: Math.round(Math.max(0, Math.min(TD_H, top + TD_CONFIG.tileH / 2 + jitterPx))), c: 0, d: 0 };
}

/**
 * Fewest further tiles (counting every tile that arrives, taken or not) to hit the target, from each
 * queue position (mod the queue's length) and running total; an overshoot resets the total to 0.
 */
const TD_VALUE = new Map<string, number[][]>();
function tdQueueValue(stage: number, queue: readonly number[], target: number): number[][] {
  const key = `${stage}:${target}:${queue.join(",")}`;
  const hit = TD_VALUE.get(key);
  if (hit) return hit;
  const n = queue.length;
  const V = Array.from({ length: n }, () => new Array<number>(target + 1).fill(1e6));
  for (const row of V) row[target] = 0;
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    for (let j = n - 1; j >= 0; j--) {
      const nx = V[(j + 1) % n]!;
      for (let r = 0; r < target; r++) {
        let v = 1 + nx[r]!;
        const res = tdApply(queue[j]!, r);
        if (res !== null) v = Math.min(v, res === target ? 1 : 1 + nx[res > target ? 0 : res]!);
        if (v < V[j]![r]!) { V[j]![r] = v; changed = true; }
      }
    }
    if (!changed) break;
  }
  TD_VALUE.set(key, V);
  return V;
}

const tenDropKit: PuzzleKit = {
  type: "tendrop",
  nothing: (p) => tenDropDrive(p, null).raw,
  spam(p, rng) {
    // Random column + height at ~6 taps a second.
    let nextTap = 1;
    const random = tenDropDrive(p, (_s, t) => {
      if (t < nextTap) return null;
      nextTap = t + rng.int(8, 13);
      return { k: TD_INPUT_TAP, a: rng.below(4), b: rng.int(0, TD_H), c: 0, d: 0 };
    }).raw;
    // Tap every tile that appears (the lowest on screen), ~5 a second, never thinking about the total.
    let nextAll = 1;
    const every = tenDropDrive(p, (s, t) => {
      if (t < nextAll || s.tiles.length === 0) return null;
      nextAll = t + rng.int(10, 14);
      let low = -1;
      s.tiles.forEach((tile, i) => { if (tile.y > 0 && (low < 0 || tile.y > s.tiles[low]!.y)) low = i; });
      return low < 0 ? null : tdTapAt(s, low, 1, 0);
    }).raw;
    return [{ label: "random-taps", answer: random }, { label: "tap-every-tile", answer: every }];
  },
  play(p, rng, skill) {
    // BASE 0.45 s per tile on top of reaction: read the tile, add it to the total, judge the overshoot.
    const BASE = 0.45;
    let pending: { tick: number; ev: Ev } | null = null;
    let nextLook = 1;
    let finishTick = 0;
    const run = tenDropDrive(p, (s, t) => {
      if (s.cleared >= 10 && !finishTick) finishTick = s.clearTick;
      if (pending && pending.tick <= t) { const ev = pending.ev; pending = null; nextLook = t + 1; return ev; }
      if (pending || t < nextLook || tenDropHolding(s) || s.cleared > s.stage) return null;
      const target = s.plan.targets[s.stage]!;
      const dt = ticks(react(rng, skill) + thinkMs(rng, BASE, skill));
      const reachable = s.tiles.map((tile, i) => ({ tile, i, ev: tdTapAt(s, i, dt, rng.normal(0, 6)) })).filter((x) => x.ev && x.tile.y > -TD_CONFIG.tileH * 128);
      if (reachable.length === 0) { nextLook = t + 6; return null; }
      let choice: (typeof reachable)[number] | undefined;
      if (rng.chance(skill.err)) {
        // Mis-add: taps a tile without the right sum in mind (often overshoots and resets).
        choice = rng.pick(reachable);
      } else {
        // Plans like a player reading the tiles on screen (about one pass of the repeating queue is in view):
        // fewest tiles to the target from each
        // (total, queue position) over the stage's repeating queue, with judgement blur growing with pace.
        const queue = s.plan.queues[s.stage]!;
        const V = tdQueueValue(s.stage, queue, target);
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
          const v = r === target ? -100 : at(q + 1, r > target ? 0 : r) + rng.normal(0, 0.6 * skill.pace);
          if (v < best) { best = v; choice = x; }
        }
      }
      if (!choice) { nextLook = t + 6; return null; }
      pending = { tick: t + dt, ev: choice.ev! };
      return null;
    });
    const s = run.state;
    const end = s.cleared >= 10 ? (finishTick || s.clearTick) : s.tick;
    return { steps: [{ answer: run.raw, atMs: tickMs(end) }], timed: true };
  },
};

/* ============================== Mixed Signals ============================== */

function clashDrive(p: PuzzleData, pick: Pick<ClashState> | null): Driven<ClashState> {
  const game = colourClashGameFor(clashVariantOf(p.type === "stroop" ? p : null));
  return drive(game, p.type === "stroop" ? p.seed : 1, "stroop", clashCheckpoint, CLASH_CHECKPOINT_INTERVAL, encodeColourClashRun, pick);
}

const laneX = (lane: number, tick: number) => Math.floor(((lane + 0.5) * CLASH_WORLD_W) / clashLaneCount(tick));

/** Tick the current word lands if swiped down on `dropAt` (or falls in on its own first). */
function clashLanding(s: ClashState, t: number, dropAt: number): number {
  const item = s.items.at(-1)!;
  // clashRev 5: the taller board's lower gates and faster drop (the sim's own numbers).
  const gate = clashGateYFp(s);
  const natural = Math.max(1, Math.trunc((gate - CLASH_START_Y_FP) / item.fallTicks));
  const y = s.itemY + natural * (dropAt - t);
  if (y >= gate) return t - 1 + Math.ceil((gate - s.itemY) / natural);
  return dropAt - 1 + Math.ceil((gate - y) / clashDropFp(s));
}

/** One word: optionally steer to `lane`, then swipe down, with these gaps (ticks). */
function clashWordBot(choose: (s: ClashState, at: number) => number | null, delay: () => number, gesture: () => number, leave?: (s: ClashState) => boolean): Pick<ClashState> {
  const sched = new Sched();
  let seen = 0;
  return (s, t) => {
    const item = s.items.at(-1);
    if (item && item.spawn < t && s.items.length !== seen) {
      seen = s.items.length;
      sched.clear();
      // clashRev 8: a "don't sort" word the player recognises is left to fall (no input at all).
      if (item.kind === 1 && leave?.(s)) return sched.take(t);
      let at = t + delay();
      const g = gesture();
      const lane = choose(s, clashLanding(s, t, at + g));
      // The fourth gate only exists from 30 s: wait for it to appear before steering into it.
      if (lane !== null && lane >= clashLaneCount(at)) at = Math.max(at, CLASH_LANE_EXPAND_TICK + 1);
      let dropAt = at;
      if (lane !== null && lane !== s.lane) {
        sched.at(at, { k: CLASH_INPUT_LANE, a: CLASH_SET_LANE, b: laneX(lane, at), c: 0 });
        dropAt = at + g;
      }
      sched.at(dropAt, { k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0 });
    }
    return sched.take(t);
  };
}

const clashKit: PuzzleKit = {
  type: "stroop",
  nothing: (p) => clashDrive(p, null).raw,
  spam(p, rng) {
    const fast = () => rng.int(12, 18);
    const random = clashDrive(p, clashWordBot((_s, at) => rng.below(clashLaneCount(at)), fast, fast)).raw;
    const same = clashDrive(p, clashWordBot(() => 0, fast, fast)).raw;
    const dropOnly = clashDrive(p, clashWordBot(() => null, fast, fast)).raw;
    return [
      { label: "random-gate", answer: random },
      { label: "same-gate", answer: same },
      { label: "drop-where-spawned", answer: dropOnly },
    ];
  },
  play(p, rng, skill) {
    // BASE 0.45 s per word on top of reaction: read word + ink against the current rule, find the gate.
    const BASE = 0.45;
    const run = clashDrive(p, clashWordBot(
      (s, at) => {
        const item = s.items.at(-1)!;
        // The word is judged by the rule and gates when it lands; the banner flashes before a swap,
        // so the player goes by the rule (and gates) it will land under.
        const land = at;
        const gates = clashGatesAt(s, land);
        const rule = clashRuleAt(s, land);
        const wanted = rule === 0 ? item.ink : item.word;
        const right = Math.max(0, gates.indexOf(wanted));
        if (!rng.chance(skill.err)) return right;
        // Stroop slip: goes by the other cue (the wrong one of word / ink), else a random other gate.
        const other = gates.indexOf(rule === 0 ? item.word : item.ink);
        if (other >= 0 && other !== right) return other;
        const others = gates.map((_, i) => i).filter((i) => i !== right);
        return rng.pick(others);
      },
      () => ticks(react(rng, skill) + thinkMs(rng, BASE, skill)),
      () => ticks(Math.max(120, rng.normal(220, 40) * skill.pace)),
      // clashRev 8: spots the grey, dashed "don't sort" word unless it slips (half again as often as a Stroop slip).
      () => !rng.chance(Math.min(0.9, skill.err * 1.5)),
    ));
    const s = run.state;
    return { steps: [{ answer: run.raw, atMs: tickMs(s.finishTick > 0 ? s.finishTick : s.tick) }], timed: true };
  },
};

/* ================================ Letterfall ================================ */

/**
 * The words a player actually knows: the common-word list (SCOWL sizes ≤ 35) and their plain -s plurals,
 * kept only where Letterfall accepts them. The full list's rare words (URIAL, AECIA…) are not human play.
 */
let VOCAB: Set<string> | null = null;
let PREFIXES: Set<string> | null = null;
function prefixes(): Set<string> {
  if (!PREFIXES) {
    ensureWordfallDict();
    VOCAB = new Set<string>();
    for (const w of COMMON_WORDS_RAW.split(/\s+/)) {
      if (!/^[a-z]+$/.test(w)) continue;
      for (const v of [w, `${w}s`]) if (isWordfallWord(v)) VOCAB.add(v);
    }
    PREFIXES = new Set<string>();
    for (const word of VOCAB) for (let i = 1; i <= word.length; i++) PREFIXES.add(word.slice(0, i));
  }
  return PREFIXES;
}

interface WfCell { col: number; index: number; id: number; letter: number }

function wfCells(s: WordfallState): WfCell[][] {
  return s.well.map((stack, col) => {
    const out: WfCell[] = [];
    for (let index = 0; index < stack.length; index++) {
      const t = stack[index]!;
      if (!wfSettled(t, index)) break;
      out.push({ col, index, id: t.id, letter: t.l });
    }
    return out;
  });
}

/** Every word on the settled tiles (one path per distinct word), valued by points then danger relief. */
function wfWords(s: WordfallState, cap = 400): { cells: WfCell[]; len: number; value: number }[] {
  const pre = prefixes();
  const cells = wfCells(s);
  const heights = s.well.map((st) => st.length);
  const found = new Map<string, { cells: WfCell[]; len: number; value: number }>();
  const path: WfCell[] = [];
  const used = new Set<number>();
  const visit = (cell: WfCell, word: string) => {
    if (found.size >= cap) return;
    const w = word + wfSpelling(cell.letter);
    if (!pre.has(w) || path.length >= 12) return;
    path.push(cell);
    used.add(cell.id);
    if (w.length >= 3 && VOCAB!.has(w)) {
      let danger = 0;
      for (const c of path) danger += heights[c.col]! * heights[c.col]!;
      // A column one or two tiles from the top comes first: clearing from it beats points.
      const top = Math.max(...path.map((c) => heights[c.col]!));
      const rescue = top >= WF_ROWS - 3 ? 1e6 * top : 0;
      const value = rescue + wfWordPoints(w.length) * 1000 + danger;
      const prev = found.get(w);
      if (!prev || prev.value < value) found.set(w, { cells: [...path], len: w.length, value });
    }
    for (let dc = -1; dc <= 1; dc++) for (let di = -1; di <= 1; di++) {
      const next = cells[cell.col + dc]?.[cell.index + di];
      if (next && !used.has(next.id)) visit(next, w);
    }
    path.pop();
    used.delete(cell.id);
  };
  for (const column of cells) for (const cell of column) visit(cell, "");
  return [...found.values()].sort((a, b) => b.value - a.value);
}

const wfCentre = (col: number, index: number): Ev => ({
  k: WF_INPUT_TAP, a: WF_WELL_X + col * WF_CELL + WF_CELL / 2, b: WF_WELL_Y + wfRestY(index) / 256 + WF_CELL / 2, c: 0,
});

function wordfallDrive(p: PuzzleData, pick: Pick<WordfallState> | null): Driven<WordfallState> {
  const rev = p.type === "wordfall" ? p.wordfallRev : undefined;
  ensureWordfallDict();
  return drive(wordfallGameFor(rev), p.type === "wordfall" ? p.seed : 1, "wordfall", wordfallCheckpoint, WF_CHECKPOINT_INTERVAL, (r) => encodeWordfallRun(r, rev), pick);
}

const wordfallKit: PuzzleKit = {
  type: "wordfall",
  nothing: (p) => wordfallDrive(p, null).raw,
  spam(p, rng) {
    // Random taps anywhere in the well (~5 a second) with Enter every 3–6 taps.
    let next = 1;
    let taps = 0;
    let enterAfter = rng.int(3, 6);
    const random = wordfallDrive(p, (_s, t) => {
      if (t < next) return null;
      next = t + rng.int(9, 14);
      if (taps >= enterAfter) { taps = 0; enterAfter = rng.int(3, 6); return { k: WF_INPUT_ENTER, a: 0, b: 0, c: 0 }; }
      taps++;
      return { k: WF_INPUT_TAP, a: WF_WELL_X + rng.int(0, WF_COLS * WF_CELL - 1), b: WF_WELL_Y + rng.int(0, WF_ROWS * WF_CELL - 1), c: 0 };
    }).raw;
    // Random adjacent 3–4 tile chains, then Enter, at ~5 taps a second.
    let nextC = 1;
    let chain: WfCell[] = [];
    let at = 0;
    const chains = wordfallDrive(p, (s, t) => {
      if (t < nextC) return null;
      nextC = t + rng.int(9, 14);
      if (chain.length === 0) {
        const cells = wfCells(s);
        const all = cells.flat();
        if (all.length === 0) return null;
        const want = rng.int(3, 4);
        chain = [rng.pick(all)];
        while (chain.length < want) {
          const last = chain[chain.length - 1]!;
          const near: WfCell[] = [];
          for (let dc = -1; dc <= 1; dc++) for (let di = -1; di <= 1; di++) {
            const c = cells[last.col + dc]?.[last.index + di];
            if (c && !chain.some((x) => x.id === c.id)) near.push(c);
          }
          if (near.length === 0) break;
          chain.push(rng.pick(near));
        }
        at = 0;
      }
      if (at < chain.length) { const c = chain[at++]!; return wfCentre(c.col, c.index); }
      chain = [];
      return { k: WF_INPUT_ENTER, a: 0, b: 0, c: 0 };
    }).raw;
    return [{ label: "random-taps+enter", answer: random }, { label: "random-chains+enter", answer: chains }];
  },
  play(p, rng, skill) {
    // BASE 4 s to spot a word on the board (good phone player), then ~0.35 s per letter tap and Enter.
    const BASE_FIND = 4;
    const BASE_TAP = 0.35;
    type Act = { tick: number; id: number | null; ev?: Ev };
    let queue: Act[] = [];
    let nextLook = ticks(thinkMs(rng, 2, skill));
    const run = wordfallDrive(p, (s, t) => {
      if (queue.length && queue[0]!.tick <= t) {
        const act = queue.shift()!;
        if (act.ev) return act.ev;
        if (act.id === null) return { k: WF_INPUT_ENTER, a: 0, b: 0, c: 0 };
        const where = wfFind(s.well, act.id);
        if (!where || !wfSettled(where.tile, where.index)) { queue = []; nextLook = t + ticks(500); return null; }
        return wfCentre(where.col, where.index);
      }
      if (queue.length || t < nextLook) return null;
      const words = wfWords(s);
      const tallest = Math.max(...s.well.map((st) => st.length));
      const late = s.tick > WF_RUN_TICKS - 300;
      const ok = words.filter((w) => w.len >= 4 || tallest >= 6 || late);
      if (ok.length === 0) { nextLook = t + ticks(800 * skill.pace); return null; }
      // People rarely see the very best word: weaker players settle further down the list.
      const span = Math.min(ok.length, 1 + Math.round(5 * skill.pace));
      const choice = ok[Math.floor(rng.next() * rng.next() * span)]!;
      let ids: (number | null)[] = choice.cells.map((c) => c.id);
      let wrong: Ev | null = null;
      if (rng.chance(skill.err)) {
        // Misread a letter: one wrong neighbour in the chain, submitted as a non-word.
        const cells = wfCells(s);
        const k = rng.int(1, choice.cells.length - 1);
        const prev = choice.cells[k - 1]!;
        const near: WfCell[] = [];
        for (let dc = -1; dc <= 1; dc++) for (let di = -1; di <= 1; di++) {
          const c = cells[prev.col + dc]?.[prev.index + di];
          if (c && !choice.cells.some((x) => x.id === c.id)) near.push(c);
        }
        if (near.length) { const c = rng.pick(near); ids = ids.slice(0, k); wrong = wfCentre(c.col, c.index); }
      }
      let at = t + ticks(thinkMs(rng, BASE_FIND, skill));
      queue = [];
      for (const id of ids) { queue.push({ tick: at, id }); at += ticks(thinkMs(rng, BASE_TAP, skill, 0.25)); }
      if (wrong) { queue.push({ tick: at, id: -1, ev: wrong }); at += ticks(thinkMs(rng, BASE_TAP, skill, 0.25)); }
      queue.push({ tick: at, id: null });
      nextLook = at + ticks(wrong ? 600 : 300);
      return null;
    });
    return { steps: [{ answer: run.raw, atMs: tickMs(run.state.tick) }], timed: true };
  },
};

/* =================================== Bonk =================================== */

function whackDrive(p: PuzzleData, pick: Pick<WhackState> | null): Driven<WhackState> {
  // whackRev 3 adds diamonds (its own game); every older revision plays the same board.
  return drive(whackGameFor(p.type === "whack" && p.whackRev === 3 ? 3 : undefined), p.type === "whack" ? p.seed : 1, "whack", whackCheckpoint, WHACK_CHECKPOINT_INTERVAL, encodeWhackRun, pick);
}
const whackTap = (hole: number): Ev => ({ k: WHACK_INPUT_TAP, a: hole, b: 0, c: 0 });

const whackKit: PuzzleKit = {
  type: "whack",
  nothing: (p) => whackDrive(p, null).raw,
  spam(p, rng) {
    // Every burrow in turn, ~8 taps a second (two thumbs).
    let next = 1;
    let hole = 0;
    const all = whackDrive(p, (_s, t) => {
      if (t < next) return null;
      next = t + rng.int(6, 9);
      hole = (hole + 1) % WHACK_HOLES;
      return whackTap(hole);
    }).raw;
    // Random burrows ~5 a second.
    let nextR = 1;
    const random = whackDrive(p, (_s, t) => {
      if (t < nextR) return null;
      nextR = t + rng.int(10, 14);
      return whackTap(rng.below(WHACK_HOLES));
    }).raw;
    // Whack anything that pops, colour ignored, at a fast reaction.
    const sched = new Sched();
    const seen = new Set<number>();
    const any = whackDrive(p, (s, t) => {
      for (let i = 0; i < s.next; i++) if (s.status[i] === WHACK_STATUS_UP && !seen.has(i)) { seen.add(i); sched.at(t + ticks(rng.normal(260, 40)), whackTap(s.schedule.hole[i]!)); }
      return sched.take(t);
    }).raw;
    return [{ label: "tap-all-burrows", answer: all }, { label: "random-burrows", answer: random }, { label: "hit-every-pop", answer: any }];
  },
  play(p, rng, skill) {
    // Per pop: reaction + ~0.1 s colour check (× pace), finger travel ≥ 0.12 s between taps; no thinkMs floor (250 ms is too slow here).
    const sched = new Sched();
    const seen = new Set<number>();
    let fingerFree = 0;
    let diamondRng: Rng | null = null;
    const run = whackDrive(p, (s, t) => {
      const sch = s.schedule;
      for (let i = 0; i < s.next; i++) {
        if (s.status[i] !== WHACK_STATUS_UP || seen.has(i)) continue;
        seen.add(i);
        const rule = whackRule(sch.flips, sch.at[i]!);
        const lastFlip = Math.max(-1e9, ...sch.flips.filter((f) => f <= sch.at[i]!));
        // Just after a flip the old rule still pulls (often for weaker players, rarely for the best).
        const stale = sch.at[i]! - lastFlip < ticks(skill.reactionMs * 2.5) && rng.chance(Math.min(0.6, 3 * skill.err));
        const believed = stale ? rule ^ 1 : rule;
        let tap = sch.kind[i] === believed;
        if (rng.chance(skill.err)) tap = !tap; // a slip: taps the wrong colour / a bomb, or freezes on a target
        if (!tap) continue;
        const when = Math.max(t + ticks(react(rng, skill) + Math.max(40, rng.normal(100, 30)) * skill.pace), fingerFree + ticks(Math.max(90, rng.normal(140, 30)) * skill.pace));
        // Too late: the ball is gone before the finger lands; usually the player still taps (an empty-hole tap).
        if (when >= sch.at[i]! + sch.life[i]! && !rng.chance(0.6)) continue;
        fingerFree = sched.at(when, whackTap(sch.hole[i]!));
      }
      // whackRev 3: a diamond is always worth a tap; it is quick, so slower players often arrive too late.
      // Its own stream, so the targets play out exactly as on whackRev 2.
      const dp = s.dp;
      const drng = dp ? (diamondRng ??= makeRng(hashText(`whack:diamond:${p.type === "whack" ? p.seed : 1}:${skill.level}:${skill.reactionMs}`))) : null;
      if (dp && drng) for (let d = 0; d < dp.at.length; d++) {
        if (dp.status[d] !== WHACK_STATUS_UP || seen.has(1000 + d)) continue;
        seen.add(1000 + d);
        const when = Math.max(t + ticks(react(drng, skill) + Math.max(30, drng.normal(60, 20)) * skill.pace), fingerFree + ticks(Math.max(90, drng.normal(140, 30)) * skill.pace));
        if (when >= dp.at[d]! + WHACK_DIAMOND_LIFE_TICKS && !drng.chance(0.6)) continue;
        sched.at(when, whackTap(dp.hole[d]!));
      }
      return sched.take(t);
    });
    return { steps: [{ answer: run.raw, atMs: tickMs(run.state.tick) }], timed: true };
  },
};

/* =================================== Pull! =================================== */

function clayDrive(p: PuzzleData, pick: Pick<ClayState> | null): Driven<ClayState> {
  const rev = p.type === "clayshoot" ? p.clayRev : undefined;
  return drive(clayGameFor(rev), p.type === "clayshoot" ? p.seed : 1, "clayshoot", clayCheckpoint, CLAY_CHECKPOINT_INTERVAL, (r) => encodeClayRun(r, rev), pick);
}

/** Where clay i will be after dt ticks (sim motion: x += vx; vy += g; y += vy), px. */
function clayAt(s: ClayState, i: number, dt: number): { x: number; y: number } {
  let x = s.x[i]!;
  let y = s.y[i]!;
  let vy = s.vy[i]!;
  const g = clayGravity(s);
  for (let k = 0; k < dt; k++) { x += s.schedule.vx[i]!; vy += g; y += vy; }
  return { x: x / 256, y: y / 256 };
}
/** The flying bird nearest a point, or -1. */
function flyingBird(s: ClayState, near: { x: number; y: number }): number {
  let best = -1;
  let bestD = Infinity;
  s.birdStatus?.forEach((st, i) => {
    if (st !== CLAY_BIRD_FLYING) return;
    const d = Math.hypot(s.birdX![i]! / 256 - near.x, s.birdY![i]! / 256 - near.y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}
/** Where bird i will be after dt ticks (straight line), px. */
function birdAt(s: ClayState, i: number, dt: number): { x: number; y: number } {
  const b = s.birds!;
  return { x: (s.birdX![i]! + b.vx[i]! * dt) / 256, y: (s.birdY![i]! + b.vy[i]! * dt) / 256 };
}
/** A shot at (x, y), clamped to the sky (clayRev 6: the taller one). */
const shotIn = (s: ClayState, x: number, y: number): Ev => ({ k: CLAY_INPUT_SHOT, a: Math.round(Math.max(0, Math.min(CLAY_W, x))), b: Math.round(Math.max(0, Math.min(clayWorldH(s), y))), c: 0 });

const clayKit: PuzzleKit = {
  type: "clayshoot",
  nothing: (p) => clayDrive(p, null).raw,
  spam(p, rng) {
    const randomAt = (lo: number, hi: number) => {
      let next = 1;
      return clayDrive(p, (s, t) => {
        if (t < next) return null;
        next = t + rng.int(lo, hi);
        return shotIn(s, rng.int(0, CLAY_W), rng.int(0, clayWorldH(s)));
      }).raw;
    };
    // Mash on whatever is flying (clays or birds), no lead, ~6 a second.
    let next = 1;
    const mash = clayDrive(p, (s, t) => {
      if (t < next) return null;
      next = t + rng.int(8, 12);
      const things: { x: number; y: number }[] = [];
      s.status.forEach((st, i) => { if (st === CLAY_FLYING) things.push({ x: s.x[i]! / 256, y: s.y[i]! / 256 }); });
      s.birdStatus?.forEach((st, i) => { if (st === CLAY_BIRD_FLYING) things.push({ x: s.birdX![i]! / 256, y: s.birdY![i]! / 256 }); });
      const at = things.length ? rng.pick(things) : { x: rng.int(0, CLAY_W), y: rng.int(0, clayWorldH(s)) };
      return shotIn(s, at.x, at.y);
    }).raw;
    return [
      { label: "random-6/s", answer: randomAt(8, 12) },
      { label: "random-3/s", answer: randomAt(16, 24) },
      { label: "mash-on-movers", answer: mash },
    ];
  },
  play(p, rng, skill) {
    // Per clay: reaction to the launch + ~0.25 s to track and lead it (× pace); a re-shot after a miss ~0.3 s.
    // Touch error from the arcade humans: tap timing sd and aim sd by level (scripts/arcade-skill-bands/human.ts).
    const prof = PROFILES[skill.level];
    let pending: { tick: number; ev: Ev } | null = null;
    let nextFree = 0;
    const tried = new Set<number>();
    const run = clayDrive(p, (s, t) => {
      if (pending && pending.tick <= t) { const ev = pending.ev; pending = null; return ev; }
      if (pending || t < nextFree) return null;
      // The clay that leaves soonest among those in flight (oldest launch first).
      let target = -1;
      for (let i = 0; i < s.status.length; i++) if (s.status[i] === CLAY_FLYING) { target = i; break; }
      if (target < 0) return null;
      const first = !tried.has(target);
      tried.add(target);
      const delayMs = first ? react(rng, skill) + thinkMs(rng, 0.25, skill) * 0.4 : Math.max(150, rng.normal(300, 60) * skill.pace);
      const dt = ticks(delayMs);
      const aim = clayAt(s, target, dt);
      if (aim.x < -10 || aim.x > CLAY_W + 10 || aim.y > clayWorldH(s) + 10) { nextFree = t + 3; return null; }
      const slip = rng.chance(skill.err) ? 3 : 1;
      const late = Math.round((rng.normal(0, prof.timingSdMs) * slip) / TICK_MS);
      // A bird in flight is sometimes taken for a clay on the first look (a quarter of the slip rate,
      // 14 Oct 2026): the shot goes where that bird will be. More birds in the sky, more of these.
      const bird = first ? flyingBird(s, aim) : -1;
      const fooled = bird >= 0 && rng.chance(skill.err * 0.25);
      const at = fooled ? birdAt(s, bird, dt) : aim;
      pending = { tick: Math.max(t + 1, t + dt + late), ev: shotIn(s, at.x + rng.normal(0, prof.aimSdPx * slip), at.y + rng.normal(0, prof.aimSdPx * slip)) };
      nextFree = pending.tick + ticks(Math.max(100, rng.normal(180, 40) * skill.pace));
      return null;
    });
    return { steps: [{ answer: run.raw, atMs: tickMs(run.state.tick) }], timed: true };
  },
};

export const KITS_ENGINE: PuzzleKit[] = [tenDropKit, clashKit, wordfallKit, whackKit, clayKit];
