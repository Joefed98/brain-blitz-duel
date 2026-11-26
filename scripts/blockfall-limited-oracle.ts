/**
 * Blockzone's oracle held to Joe's human limits (D5's ladder, 23 Nov 2026; docs/arcade-standard/blockfall.md "Levels
 * (D5, 23 Nov 2026)"): the proof that a level's 200 is within the best human reach. It plays as scripts/blockfall-oracle.ts
 * does (a well down the right edge for fours until the multi-line part is full, flat play, the last stretch low, one
 * piece looked ahead), but every gesture is a human's: the first comes REACT_TICKS (0.25 s) after a piece appears, and
 * each gesture (a turn, a drag to a column, a flick down) at least GAP_TICKS (0.15 s) after the one before, across
 * pieces too. Because the piece keeps falling while the gestures land, every landing is planned in time: each choice
 * (turns, then a drag, then the flick) is played through the level's own sim at the ticks its gestures would land, so
 * the plan is where the piece really locks (a drag blocked by the stack, a lock delay running out, a top-out all count).
 * The log it returns is what a phone would send; scripts/blockfall-level-deal.ts keeps the seeds it takes to exactly
 * 200 through the server replay.
 *
 *   bun scripts/blockfall-limited-oracle.ts [--rev=3] [--level=expert] [seed…]
 */
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  BF_CHECKPOINT_INTERVAL, BF_INPUT_DROP, BF_INPUT_MOVE, BF_INPUT_TURN, BF_LOW_FULL, BF_W, BF_ZONE_MULTI_MAX, bfCheckpoint, bfMultiPoints, bfStackHeight, blockfallGameFor, type BfState,
} from "../src/lib/arcade/blockfall";
import { encodeBlockfallRun, replayBlockfallRun } from "../src/lib/duel/blockfall";
import type { Level } from "../src/lib/levels/levels";
import { bfCandidates, bfValue, type BfCandidate, type BfMode, type BfMove } from "./blockfall/planner";

/** Joe's human limits: 0.25 s to react to a new piece, 0.15 s a gesture. */
export const REACT_TICKS = 15;
export const GAP_TICKS = 9;

const TURNS: readonly BfMove[][] = [[], [{ k: BF_INPUT_TURN, a: 1 }], [{ k: BF_INPUT_TURN, a: 1 }, { k: BF_INPUT_TURN, a: 1 }], [{ k: BF_INPUT_TURN, a: -1 }]];

interface Timed {
  moves: BfMove[];
  /** The ticks its gestures land on. */
  at: number[];
  after: BfState;
  lines: number;
}

type Game = ReturnType<typeof blockfallGameFor>;

/** Plays `moves` from `s` with the first gesture on tick `start` and GAP_TICKS between; the state once the piece locks. */
function playTimed(game: Game, s: BfState, moves: BfMove[], start: number): { after: BfState; at: number[] } | null {
  const at = moves.map((_, i) => start + i * GAP_TICKS);
  const pieces = s.pieces;
  let st = s;
  let i = 0;
  while (st.pieces === pieces && !game.isOver(st)) {
    const t = st.tick + 1;
    const ev = i < at.length && at[i] === t ? { t, k: moves[i]!.k, a: moves[i]!.a, b: 0, c: 0, d: 0 } : null;
    if (ev) i++;
    st = game.step(st, ev);
    if (t > start + 400) return null;
  }
  return { after: st, at: at.slice(0, i) };
}

/** Every distinct timed landing from `s`, its first gesture on `start`. */
function timedCandidates(game: Game, s: BfState, start: number): Timed[] {
  const out: Timed[] = [];
  const seen = new Set<string>();
  for (const turns of TURNS) {
    for (let dx = -(BF_W - 1); dx <= BF_W - 1; dx++) {
      const moves = [...turns, ...(dx ? [{ k: BF_INPUT_MOVE, a: dx }] : []), { k: BF_INPUT_DROP, a: 0 }];
      const r = playTimed(game, s, moves, start);
      if (!r) continue;
      const key = `${r.after.ended}:${r.after.board.join("")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ moves, at: r.at, after: r.after, lines: r.after.lines - s.lines });
    }
  }
  return out;
}

const asCandidate = (c: Timed): BfCandidate => ({ moves: c.moves, after: c.after, lines: c.lines, hold: false });

/**
 * The oracle's run on a level: `rev` (2 Normal, 3 a level deal) and `level` pick the game (gravity, lock delay,
 * previews, the core's full) exactly as a dealt puzzle's.
 */
export function blockfallLimitedEvents(seed: number, rev: number, level: Level | null): { events: ArcadeInputEvent[]; state: BfState } {
  const game = blockfallGameFor(rev, level);
  const runTicks = game.runTicks;
  const LOW_FROM = runTicks - 20 * 60;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let planFor = -1;
  let queue: { t: number; k: number; a: number }[] = [];
  let lastGesture = -1e9;
  let appeared = 0;
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    const id = s.pieces;
    if (id !== planFor) {
      planFor = id;
      appeared = s.tick;
      queue = [];
      const start = Math.max(appeared + REACT_TICKS, lastGesture + GAP_TICKS, t);
      const high = bfStackHeight(s.board) > 7;
      const mode: BfMode = s.tick >= LOW_FROM ? "low" : bfMultiPoints(s) < BF_ZONE_MULTI_MAX && !high ? "well" : "flat";
      const first = timedCandidates(game, s, start)
        .filter((c) => c.after.ended !== 2)
        .map((c) => ({ c, v: bfValue(asCandidate(c), mode) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 8);
      let best: Timed | null = null;
      let bestV = -Infinity;
      for (const { c, v } of first) {
        if (c.after.ended) {
          // The buzzer came first: nothing after it.
          if (v > bestV) {
            bestV = v;
            best = c;
          }
          continue;
        }
        // One piece ahead (the next piece on screen), placed at once: the board it leaves.
        let v2 = -Infinity;
        for (const d of bfCandidates(c.after, false)) v2 = Math.max(v2, bfValue({ ...d, lines: d.lines + c.lines }, mode));
        if (v2 > bestV) {
          bestV = v2;
          best = c;
        }
      }
      best ??= first[0]?.c ?? null;
      // The last seconds: a piece that would leave the stack above the low mark is left to fall on its own, if it is
      // still falling at the buzzer.
      const lateOk = best && (best.after.ended || bfStackHeight(best.after.board) <= (s.lv?.lowFull ?? BF_LOW_FULL));
      if (best && (s.tick < runTicks - 330 || lateOk)) queue = best.moves.map((m, i) => ({ t: best!.at[i] ?? -1, k: m.k, a: m.a })).filter((q) => q.t > 0);
    }
    if (queue.length && queue[0]!.t === t) {
      const m = queue.shift()!;
      recordInput(events, { t, k: m.k, a: m.a, b: 0, c: 0, d: 0 }, game.inputRanges);
      lastGesture = t;
    }
    const ev = events[events.length - 1];
    s = game.step(s, ev && ev.t === t ? ev : null);
  }
  return { events, state: s };
}

/** The oracle's log as the phone encodes it (with checkpoints) and its server replay. */
export function blockfallLimitedRun(seed: number, rev: number, level: Level | null) {
  const game = blockfallGameFor(rev, level);
  const { events } = blockfallLimitedEvents(seed, rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % BF_CHECKPOINT_INTERVAL === 0) checkpoints.push(bfCheckpoint(s));
  }
  const raw = encodeBlockfallRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  return { raw, events, result: replayBlockfallRun(seed, raw, rev, level) };
}

/** Whether an event log keeps Joe's limits: REACT_TICKS after each piece appears, GAP_TICKS between gestures. */
export function blockfallKeepsLimits(seed: number, rev: number, level: Level | null, events: readonly ArcadeInputEvent[]): boolean {
  const game = blockfallGameFor(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  let appeared = 0;
  let pieces = s.pieces;
  let last = -1e9;
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    const ev = at.get(t) ?? null;
    if (ev) {
      // A gesture comes REACT_TICKS or more after its piece appeared, and GAP_TICKS or more after the gesture before it.
      if (t - appeared < REACT_TICKS || t - last < GAP_TICKS) return false;
      last = t;
    }
    s = game.step(s, ev);
    if (s.pieces !== pieces) {
      pieces = s.pieces;
      appeared = s.tick;
    }
  }
  return true;
}

if (import.meta.main) {
  const rev = Number(process.argv.find((a) => a.startsWith("--rev="))?.slice(6) ?? 3);
  const level = (process.argv.find((a) => a.startsWith("--level="))?.slice(8) ?? "expert") as Level;
  const seeds = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number);
  for (const seed of seeds.length ? seeds : [1, 2, 3, 4, 5]) {
    const t0 = Date.now();
    const { result: r, events } = blockfallLimitedRun(seed, rev, level === "normal" ? null : level);
    console.log(`seed ${seed}: ${r.score} · ${r.lines} lines, ${r.doubles}/${r.triples}/${r.quads} multi, stack ${r.height}, ${r.pieces} pieces, topped ${r.toppedOut}, flagged ${r.flagged}, limits ${blockfallKeepsLimits(seed, rev, level === "normal" ? null : level, events)} (${Date.now() - t0} ms)`);
  }
}
