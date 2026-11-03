/**
 * Blockfall's oracle (blockfallRev 1, and Blockzone's blockfallRev 2 with `rev` 2: no hold, 90 s; docs/arcade-standard/blockfall.md): flawless play that reaches 200 on a seed.
 * It knows only what the screen shows (the piece, the next three, the hold) and plays at a steady, quick pace through
 * the shared planner (scripts/blockfall/planner.ts): a well kept down the right edge for fours until the multi-line
 * part is full, then flat play, and over the last 10 s play that keeps the stack low. The log it returns is what a
 * phone would send; blockfall-deal.ts keeps the seeds whose log scores exactly 200 through the server replay.
 *
 *   bun scripts/blockfall-oracle.ts [--rev=2] [seed…]
 */
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { BF_LOW_FULL, BF_MULTI_MAX, bfCheckpoint, bfMultiPoints, bfRunTicksFor, bfStackHeight, blockfallGameFor, BF_CHECKPOINT_INTERVAL, BLOCKFALL_REV_ZONE, type BfState } from "../src/lib/arcade/blockfall";
import { encodeBlockfallRun, replayBlockfallRun } from "../src/lib/duel/blockfall";
import { bfBest, bfCandidates, bfValue, type BfCandidate, type BfMode } from "./blockfall/planner";

/** Ticks between a piece's arrival and the oracle's first input, and between inputs. */
const THINK = 18;
const GAP = 4;
/** The last stretch played low. */
/** The last stretch in which a piece that would raise the stack too high is left to fall on its own. */
const HOVER_TICKS = 200;

/** `rev` 1 (the default, the deal file's proofs) or 2 (Blockzone: 90 s, no hold). */
export function blockfallOracleEvents(seed: number, rev = 1): { events: ArcadeInputEvent[]; state: BfState } {
  const game = blockfallGameFor(rev);
  const runTicks = bfRunTicksFor(rev);
  const hold = rev < BLOCKFALL_REV_ZONE;
  const LOW_FROM = runTicks - (hold ? 12 : 20) * 60;
  const hover = hold ? HOVER_TICKS : 330;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let planFor = -1;
  let queue: { t: number; k: number; a: number }[] = [];
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    // A new piece (a lock or a hold brings one): plan from where it is now.
    const id = s.pieces * 2 + s.held;
    if (id !== planFor && queue.length === 0) {
      planFor = id;
      const high = bfStackHeight(s.board) > (hold ? 9 : 7);
      const mode: BfMode = s.tick >= LOW_FROM ? "low" : bfMultiPoints(s) < BF_MULTI_MAX && !high ? "well" : "flat";
      // Without a hold (Blockzone) the oracle looks one piece ahead (the next piece on screen).
      const best = hold ? bfBest(s, mode, hold) : bfBestAhead(s, mode);
      // The last few seconds: a piece that would leave the stack above the low mark is left in the air.
      const late = s.tick >= runTicks - hover && best !== null && bfStackHeight(best.after.board) > BF_LOW_FULL;
      if (best && !late) queue = best.moves.map((m, i) => ({ t: t + THINK + i * GAP, k: m.k, a: m.a }));
    }
    if (queue.length && queue[0]!.t <= t) {
      const m = queue.shift()!;
      recordInput(events, { t, k: m.k, a: m.a, b: 0, c: 0, d: 0 }, game.inputRanges);
      // A hold brings a new piece: the rest of the plan is for that piece.
    }
    const ev = events[events.length - 1];
    s = game.step(s, ev && ev.t === t ? ev : null);
  }
  return { events, state: s };
}

/** The best landing judged with the next piece's best landing after it (two pieces deep, no hold). */
function bfBestAhead(s: BfState, mode: BfMode): BfCandidate | null {
  let best: BfCandidate | null = null;
  let bestV = -Infinity;
  const first = bfCandidates(s, false)
    .map((c) => ({ c, v: bfValue(c, mode) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);
  for (const { c } of first) {
    if (c.after.ended) continue;
    let v2 = -Infinity;
    for (const d of bfCandidates(c.after, false)) v2 = Math.max(v2, bfValue({ ...d, lines: d.lines + c.lines }, mode));
    if (v2 > bestV) {
      bestV = v2;
      best = c;
    }
  }
  return best ?? first[0]?.c ?? null;
}

/** The oracle's log as the phone encodes it (with checkpoints) and its server replay. */
export function blockfallOracleRun(seed: number, rev = 1) {
  const game = blockfallGameFor(rev);
  const { events } = blockfallOracleEvents(seed, rev);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % BF_CHECKPOINT_INTERVAL === 0) checkpoints.push(bfCheckpoint(s));
  }
  const raw = encodeBlockfallRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  return { raw, events, result: replayBlockfallRun(seed, raw, rev) };
}

if (import.meta.main) {
  const rev = Number(process.argv.find((a) => a.startsWith("--rev="))?.slice(6) ?? 1);
  const seeds = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number);
  for (const seed of seeds.length ? seeds : [1, 2, 3, 4, 5]) {
    const t0 = Date.now();
    const { result: r } = blockfallOracleRun(seed, rev);
    console.log(`seed ${seed}: ${r.score} · ${r.lines} lines, ${r.doubles}/${r.triples}/${r.quads} multi, stack ${r.height}, ${r.pieces} pieces, flagged ${r.flagged} (${Date.now() - t0} ms)`);
  }
}
