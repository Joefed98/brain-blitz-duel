/**
 * The arcade scoring standard's Fission oracle (scripts/arcade-standard/burst.ts, burstRev 13 there) on any stamp and
 * level, for burstRev 14 (D5, 22 Nov 2026; docs/arcade-standard/burst.md "burstRev 14"): the same search, line for line,
 * with the game passed in. It plays the phone's own inputs (a snap move, c = 1, puts the ship exactly under a spot; a tap
 * fires), searching each shot with the sim itself: of the spots and moments it could fire from, it takes the one whose
 * shot pops something soonest without the ship being touched, golden atoms first. A script library, not a check.
 *
 *   bun scripts/burst-small-oracle.ts [--rev=14] [--level=normal] [--from=0] [--count=200]   (scans room seeds for a perfect run)
 */
import {
  burstCheckpoint,
  burstGameFor,
  burstGoldenCount,
  BURST_CHECKPOINT_INTERVAL,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_MOVE_SNAP,
  BURST_REV_SMALL,
  BURST_WORLD_W,
  type BurstState,
} from "../src/lib/arcade/burst";
import type { ArcadeGame, ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBurstRun } from "../src/lib/duel/burst";
import type { Level } from "../src/lib/levels/levels";

type Game = ArcadeGame<BurstState, ArcadeInputEvent | null>;
const FP = 256;
/** How far ahead (ticks) the oracle looks for a shot's result, and the firing delays it tries (the standard entry's). */
const FLIGHT = 90;
const DELAYS = [0, 3, 6, 10, 15, 20, 28, 36];

type Ev = Omit<ArcadeInputEvent, "t">;
const snap = (x: number): Ev => ({ k: BURST_INPUT_MOVE, a: Math.max(12, Math.min(BURST_WORLD_W - 12, Math.round(x))), b: 0, c: BURST_MOVE_SNAP, d: 0 });

function run(game: Game, s: BurstState, plan: Map<number, Ev>, n: number, stop: (s: BurstState) => boolean): { s: BurstState; k: number } | null {
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

function safeFor(game: Game, s: BurstState, n: number): boolean {
  let st = s;
  for (let k = 0; k < n && !game.isOver(st); k++) {
    st = game.step(st, null);
    if (st.lives < s.lives) return false;
  }
  return true;
}

function safeForAfter(game: Game, s: BurstState, plan: Map<number, Ev>): boolean {
  let st = s;
  for (let k = 1; k <= 30 && !game.isOver(st); k++) {
    const ev = plan.get(k);
    st = game.step(st, ev ? { ...ev, t: st.tick + 1 } : null);
    if (st.lives < s.lives) return false;
  }
  return true;
}

function decide(game: Game, s: BurstState): Map<number, Ev> {
  let best: { plan: Map<number, Ev>; cost: number } | null = null;
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
        const r = run(game, s, plan, d + 2 + FLIGHT, (st) => st.hits > before.hits || burstGoldenCount(st) > before.gold);
        if (!r) continue;
        const gold = burstGoldenCount(r.s) > before.gold;
        if (!safeFor(game, r.s, 8)) continue;
        const cost = r.k - (gold && goldUp ? 1000 : 0);
        if (!best || cost < best.cost) best = { plan, cost };
      }
    }
    if (best && best.cost < d + 2) break;
  }
  if (best) return best.plan;
  for (let x = 12; x <= BURST_WORLD_W - 12; x += 6) {
    const plan = new Map<number, Ev>([[1, snap(x)]]);
    if (safeForAfter(game, s, plan)) return plan;
  }
  return new Map();
}

/** Plays the oracle on a seed of a stamp and level; returns the input log, the final state and the run as the phone sends it. */
export function playBurstOracle(seed: number, rev: number = BURST_REV_SMALL, level?: Level | null): { events: ArcadeInputEvent[]; state: BurstState; raw: string } {
  const game = burstGameFor(rev, level) as Game;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let plan = new Map<number, Ev>();
  let planAt = 0;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const busy = s.shots.length > 0 || s.burstLeft > 0;
    const offset = s.tick + 1 - planAt;
    const pending = [...plan.keys()].some((k) => k >= offset);
    if (!busy && !pending && (s.balls.length > 0 || (s.gn ?? -1) >= 0)) {
      plan = decide(game, s);
      planAt = s.tick;
    }
    const ev = plan.get(s.tick + 1 - planAt);
    const e = ev ? { ...ev, t: s.tick + 1 } : null;
    if (e) events.push(e);
    s = game.step(s, e);
    if (s.tick % BURST_CHECKPOINT_INTERVAL === 0) checkpoints.push(burstCheckpoint(s));
  }
  const raw = encodeBurstRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints } as never);
  return { events, state: s, raw };
}

if (import.meta.main) {
  const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const rev = Number(opt("rev") ?? BURST_REV_SMALL);
  const level = (opt("level") ?? "normal") as Level;
  const from = Number(opt("from") ?? 0);
  const count = Number(opt("count") ?? 200);
  const seeds = opt("seeds")?.split(",").map(Number);
  // --dealt: the seeds of the real deals (level-tune's dealAt, deal n = from … from + count − 1), graded by gradeAnswer.
  const dealt = process.argv.includes("--dealt");
  const { replayBurstRun } = await import("../src/lib/duel/burst");
  const { roomSeed } = await import("./arcade-skill-bands/games");
  const { dealAt } = await import("./level-tune");
  const { gradeAnswer } = await import("../src/lib/duel/gradeAnswer.server");
  const list = seeds ?? Array.from({ length: count }, (_, i) => (dealt ? (dealAt("burst", level, from + i) as unknown as { seed: number }).seed : roomSeed(from + i)));
  let found = 0;
  for (let i = 0; i < list.length; i++) {
    const seed = list[i]!;
    const { raw } = playBurstOracle(seed, rev, level);
    const score = dealt ? gradeAnswer(dealAt("burst", level, from + i), raw, 0).score : replayBurstRun(seed, raw, rev, level).score;
    if (score === 200) found++;
    console.log(`burstRev ${rev} ${level} ${dealt ? `deal ${from + i} ` : ""}seed ${seed}: ${score}${score === 200 ? "  ← perfect" : ""}`);
  }
  console.log(`${found} of ${list.length} seeds at 200`);
}
