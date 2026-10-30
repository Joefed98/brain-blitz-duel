/**
 * Fission (`burst`) under the arcade scoring standard: burstRev 10 (docs/arcade-standard/burst.md).
 *
 * Parts (straight lines, 200 in all): core 140 × atoms popped ÷ 87 (every split piece counts; golden atoms are not
 * atoms), wave clears up to 35 (7 a wave × 5), golden atoms up to 25 (5 each × 5), power-ups 0; each life lost −5.
 *
 * `perfect()` plays an oracle through the real sim and scores it through the server's replay (replayBurstRun): the
 * oracle uses the phone's own inputs (a snap move, c = 1, puts the ship exactly under a spot, as a finger in the
 * control strip does; a tap fires), searching each shot with the sim itself: of the spots and moments it could fire
 * from, it takes the one whose shot pops something soonest without the ship being touched, golden atoms first.
 * PERFECT_SEED is a room seed on which it pops all 87 atoms, clears every wave within its quick time, takes all five
 * golden atoms and loses no life.
 */
import {
  burstCheckpoint,
  burstGameFor,
  burstGoldenCount,
  burstStdParts,
  BURST_CHECKPOINT_INTERVAL,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_MOVE_SNAP,
  BURST_REV_STD,
  BURST_V10_PARTS,
  BURST_WORLD_W,
  type BurstState,
} from "../../src/lib/arcade/burst";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { encodeBurstRun, replayBurstRun } from "../../src/lib/duel/burst";
import type { StdEntry, StdRun } from "./entry";

const FP = 256;
const game = burstGameFor(BURST_REV_STD);
/** How far ahead (ticks) the oracle looks for a shot's result, and the firing delays it tries. */
const FLIGHT = 90;
const DELAYS = [0, 3, 6, 10, 15, 20, 28, 36];

type Ev = Omit<ArcadeInputEvent, "t">;
const snap = (x: number): Ev => ({ k: BURST_INPUT_MOVE, a: Math.max(12, Math.min(BURST_WORLD_W - 12, Math.round(x))), b: 0, c: BURST_MOVE_SNAP, d: 0 });

/** Steps `s` with a plan (tick offset → event), up to `n` ticks; null if a life is lost or the run ends badly. */
function run(s: BurstState, plan: Map<number, Ev>, n: number, stop: (s: BurstState) => boolean): { s: BurstState; k: number } | null {
  let st = s;
  for (let k = 1; k <= n; k++) {
    const ev = plan.get(k);
    st = game.step(st, ev ? { ...ev, t: st.tick + 1 } : null);
    if (st.lives < s.lives) return null;
    if (stop(st)) return { s: st, k };
    if (game.isOver(st)) return null;
  }
  return null;
}

/** Whether the ship can stand at its spot for `n` ticks untouched. */
function safeFor(s: BurstState, n: number): boolean {
  let st = s;
  for (let k = 0; k < n && !game.isOver(st); k++) {
    st = game.step(st, null);
    if (st.lives < s.lives) return false;
  }
  return true;
}

/** The oracle's next plan from state `s` (offsets from now), or an escape. */
function decide(s: BurstState): Map<number, Ev> {
  let best: { plan: Map<number, Ev>; cost: number } | null = null;
  // Where each atom (and the golden atom) will be after each delay, from the sim itself.
  const future: BurstState[] = [s];
  for (let k = 1; k <= DELAYS.at(-1)! + 1; k++) future.push(game.step(future[k - 1]!, null));
  const goldUp = (s.gn ?? -1) >= 0;
  for (const d of DELAYS) {
    const f = future[d + 1]!;
    const xs: number[] = f.balls.map((b) => b.x / FP);
    if ((f.gn ?? -1) >= 0) xs.push((f.gx ?? 0) / FP);
    for (const x0 of xs) {
      for (const off of [0, -4, 4]) {
        const x = x0 + off;
        const plan = new Map<number, Ev>([[d + 1, snap(x)], [d + 2, { k: BURST_INPUT_FIRE, a: 0, b: (s.tick + d) & 1, c: 0, d: 0 }]]);
        const before = { hits: s.hits, gold: burstGoldenCount(s) };
        const r = run(s, plan, d + 2 + FLIGHT, (st) => st.hits > before.hits || burstGoldenCount(st) > before.gold);
        if (!r) continue;
        const gold = burstGoldenCount(r.s) > before.gold;
        // The ship must also survive standing there a little after the hit (the next decision moves it).
        if (!safeFor(r.s, 8)) continue;
        const cost = r.k - (gold && goldUp ? 1000 : 0);
        if (!best || cost < best.cost) best = { plan, cost };
      }
    }
    if (best && best.cost < d + 2) break;
  }
  if (best) return best.plan;
  // Nothing to hit safely now: move to the safest spot for a moment.
  for (let x = 12; x <= BURST_WORLD_W - 12; x += 6) {
    const plan = new Map<number, Ev>([[1, snap(x)]]);
    if (safeForAfter(s, plan)) return plan;
  }
  return new Map();
}

function safeForAfter(s: BurstState, plan: Map<number, Ev>): boolean {
  let st = s;
  for (let k = 1; k <= 30 && !game.isOver(st); k++) {
    const ev = plan.get(k);
    st = game.step(st, ev ? { ...ev, t: st.tick + 1 } : null);
    if (st.lives < s.lives) return false;
  }
  return true;
}

/** Plays the oracle on a seed; returns the input log and the final state. */
export function playOracle(seed: number): { events: ArcadeInputEvent[]; state: BurstState } {
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let plan = new Map<number, Ev>();
  let planAt = 0;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const busy = s.shots.length > 0 || s.burstLeft > 0;
    const offset = s.tick + 1 - planAt;
    const pending = [...plan.keys()].some((k) => k >= offset);
    if (!busy && !pending && (s.balls.length > 0 || (s.gn ?? -1) >= 0)) {
      plan = decide(s);
      planAt = s.tick;
    }
    const ev = plan.get(s.tick + 1 - planAt);
    const e = ev ? { ...ev, t: s.tick + 1 } : null;
    if (e) events.push(e);
    s = game.step(s, e);
  }
  return { events, state: s };
}

/** A room seed on which the oracle plays a perfect run (found by scanning; see the check). */
export const PERFECT_SEED = 1453580015;

export const entry: StdEntry = {
  type: "burst",
  field: "burstRev",
  rev: BURST_REV_STD,
  parts: [
    { key: "core", label: "Atoms popped (every split piece counts), 140 × popped ÷ 87", max: BURST_V10_PARTS.core },
    { key: "clear", label: "Wave clears: up to 7 a wave × 5, full within the quick time, 0 at twice it", max: BURST_V10_PARTS.clear },
    { key: "gold", label: "Golden atoms: 5 each × 5", max: BURST_V10_PARTS.gold },
  ],
  /** The oracle's run on PERFECT_SEED, encoded as the phone does and scored by the server's replay. */
  perfect(): StdRun[] {
    const { events, state } = playOracle(PERFECT_SEED);
    const checkpoints: unknown[] = [];
    let s = game.init(PERFECT_SEED);
    const byTick = new Map(events.map((e) => [e.t, e]));
    while (!game.isOver(s) && s.tick < game.runTicks) {
      s = game.step(s, byTick.get(s.tick + 1) ?? null);
      if (s.tick % BURST_CHECKPOINT_INTERVAL === 0) checkpoints.push(burstCheckpoint(s));
    }
    const raw = encodeBurstRun({ seed: PERFECT_SEED, claimedScore: game.score(state), events, endTick: state.tick, checkpoints } as never);
    const replay = replayBurstRun(PERFECT_SEED, raw, BURST_REV_STD);
    const p = burstStdParts(replay.state);
    return [{ label: "an oracle run, server replay", score: replay.score, parts: { core: p.core, clear: p.clear, gold: p.gold } }];
  },
};
