/**
 * Fission burstRev 9 (Joe's phone-test notes, 27 Oct 2026, docs/phone-notes-oct-2026/fission.md).
 *
 *  1. Rooms deal burstRev 9 at 200 in the 390 × 650 world; older stamps start without its fields (their stored
 *     runs are replayed by expansion-e9-check, arcade-tuning-g1-check and replay-check).
 *  2. The same room for everyone: different players on one seed (a weak bot, an elite bot, random input) start
 *     from the identical state; the carriers and golden atoms are the seed's own (burstScheduleV9) and never
 *     change; every power-up that appears drops where a carrier atom split, on the tick it split, with the
 *     carrier's kind, and nothing else ever drops (no icons from the top, none rolled at the hit).
 *  3. The rules: the golden atom bounces (moves, turns at the floor and walls, stays in the arena), FREEZE stops
 *     it, it never costs a life and a shot takes it for +6; BURST fires three short shots a tap, BURST_GAP apart,
 *     for 8 s, and DOUBLE ends it; the wave-clear bonus (full within the quick time, one less every 2 s, capped)
 *     and no clean-wave count.
 *  4. Scores: doing nothing scores 0; every weak run that hit an atom scores; the server replay scores the bots'
 *     runs as the phone did; good < great < elite medians on the same seeds.
 *
 *   bun scripts/fission-carry-check.ts      (~1 min)
 */
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot as burstBot } from "./arcade-skill-bands/bots/burst";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  burstCarryBonus,
  burstCheckpoint,
  burstGameFor,
  burstGoldenCount,
  burstScheduleV9,
  burstV9ClearPoints,
  burstV9QuickTicks,
  burstWorldHFor,
  BURST_GAP,
  BURST_GOLD_R,
  BURST_ICON_BURST,
  BURST_ICON_DOUBLE,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_REV_CARRY,
  BURST_REV_CLEAN,
  BURST_TALL_H,
  BURST_V8_GOLDENS,
  BURST_V8_GOLDEN_PTS,
  BURST_V9_BURST_TICKS,
  BURST_V9_CAPS,
  BURST_V9_CLEAR_MAX,
  BURST_V9_CLEAR_STEP,
  BURST_V9_GOLDEN_LIFE,
  BURST_V9_KINDS,
  BURST_WORLD_W,
  type BurstState,
} from "../src/lib/arcade/burst";
import { generateBurst } from "../src/lib/duel/arcade.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const section = (name: string) => console.log(`\n== ${name}`);
const spec = GAME_BY_TYPE.get("burst")!;
const game = burstGameFor(BURST_REV_CARRY);
const FP = 256;

/* ============================== 1. Dealt ============================== */
section("Rooms deal burstRev 9");
ok(generateBurst().burstRev === BURST_REV_CARRY, "rooms deal burstRev 9");
ok(LIVE_BANDS.burst.rev === BURST_REV_CARRY && roundMaxFor("burst") === 200, "LIVE_BANDS deals burstRev 9; ROUND_MAX 200");
ok(burstWorldHFor(BURST_REV_CARRY) === BURST_TALL_H, "the 390 × 650 world");
for (let n = 0; n < 4; n++) {
  const seed = spec.seedFor(n);
  const old = burstGameFor(BURST_REV_CLEAN).init(seed);
  ok(old.carry === undefined && old.carriers === undefined && old.gn === undefined, `seed ${seed}: burstRev 8 starts without burstRev 9's fields`);
  ok((old.drops ?? []).length === 7, `seed ${seed}: burstRev 8 keeps its scheduled drops`);
}

/* ============================== 2. The same room for everyone ============================== */
section("Different players on one seed: the same carriers and golden atoms; every drop from a carrier's split");
function play(n: number, who: SkillLevel | "random"): BurstState[] {
  const seed = spec.seedFor(n);
  let events: ArcadeInputEvent[] = [];
  if (who === "random") {
    let a = (seed ^ 0x77) >>> 0;
    const r = () => (a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let t = 1; t < game.runTicks; t += 5 + Math.floor(r() * 30)) {
      const fire = r() < 0.6;
      events.push({ t, k: fire ? BURST_INPUT_FIRE : BURST_INPUT_MOVE, a: fire ? 0 : Math.floor(r() * BURST_WORLD_W), b: Math.floor(r() * 2), c: 0, d: 0 });
    }
  } else events = burstBot({ game, seed, rev: BURST_REV_CARRY, human: new Human("burst", seed, who), fixes: true }).events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const states = [s];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    states.push(s);
  }
  return states;
}
let drops = 0;
for (let n = 0; n < 8; n++) {
  const seed = spec.seedFor(n);
  const runs = (["weak", "elite", "random"] as const).map((p) => play(n, p));
  const first = runs[0]![0]!;
  const sched = burstScheduleV9(seed, first.waves, BURST_TALL_H);
  ok(runs.every((r) => JSON.stringify(r[0]) === JSON.stringify(first)), `burst ${n}: every player starts from the same state`);
  ok(JSON.stringify({ goldens: first.goldens, carriers: first.carriers }) === JSON.stringify(sched), `burst ${n}: the carriers and golden atoms are the seed's own`);
  ok((first.drops ?? []).length === 0 && first.goldens!.length === BURST_V8_GOLDENS, `burst ${n}: nothing falls from the top; six golden atoms`);
  ok(sched.carriers.every((c, i) => c.kind === BURST_V9_KINDS[(i + BURST_V9_KINDS.indexOf(sched.carriers[0]!.kind as never)) % 3]), `burst ${n}: the kinds take turns (DOUBLE, BURST, FREEZE)`);
  ok(new Set(sched.carriers.map((c) => c.id)).size === sched.carriers.length, `burst ${n}: one power-up an atom`);
  for (const r of runs) {
    const dropped = new Set<number>();
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1]!;
      const b = r[i]!;
      if (b.carriers !== first.carriers && JSON.stringify(b.carriers) !== JSON.stringify(first.carriers)) ok(false, `burst ${n}: the carriers never change mid-run`);
      const fresh = b.icons.filter((ic) => !a.icons.some((o) => o.x === ic.x && o.kind === ic.kind));
      for (const ic of fresh) {
        // The atom that split on this tick, at the icon's spot: a carrier of that kind.
        const gone = a.balls.filter((ball) => ball.id !== undefined && !b.balls.some((o) => o.id === ball.id));
        const carrier = gone.find((ball) => first.carriers!.some((c) => c.id === ball.id && c.kind === ic.kind));
        ok(!!carrier && b.popTick === b.tick && ic.x === b.popX && Math.abs(ic.y - b.popY) <= 3 * FP, `burst ${n}: an icon at tick ${b.tick} dropped from a carrier's split, at its spot`);
        if (carrier) {
          ok(!dropped.has(carrier.id!), `burst ${n}: carrier ${carrier.id} dropped twice`);
          dropped.add(carrier.id!);
          drops++;
        }
      }
      for (const ball of b.balls) ok(ball.id !== undefined && ball.id >> 8 >= 1 && ball.id >> 8 <= b.wave, `burst ${n}: every atom has an identity from its wave`);
    }
  }
  // The same atom carries the same item for everyone: the weak and elite runs drop the same item from each id both split.
}
ok(drops > 40, `power-ups dropped in the played runs (${drops})`);

/* ============================== 3. The rules ============================== */
section("The bouncing golden atom, BURST shots, the wave-clear bonus");
{
  const seed = spec.seedFor(3);
  const s0 = game.init(seed);
  const g0 = s0.goldens![0]!;
  // The golden atom appears on its tick and moves under gravity, turning at the floor and the walls.
  let s = { ...s0, tick: g0.tick - 1, wave: 1, nextWaveAt: 99999, balls: [{ size: 3, x: 10 * FP, y: 600 * FP, vx: 0, vy: 0, id: 0x111 }], acted: 1, freeze: 0 } as BurstState;
  s = game.step(s, null);
  ok(s.gn === 0 && s.gx !== undefined, "the golden atom appears on its tick");
  const xs: number[] = [];
  const ys: number[] = [];
  let floorBounce = false;
  let prevVy = s.gvy ?? 0;
  for (let i = 0; i < BURST_V9_GOLDEN_LIFE - 2; i++) {
    s = game.step({ ...s, balls: [{ size: 3, x: 10 * FP, y: 600 * FP, vx: 0, vy: 0, id: 0x111 }], x: 380 * FP, targetX: 380 * FP }, null);
    if (s.gn !== 0) break;
    xs.push(s.gx!);
    ys.push(s.gy!);
    if (prevVy > 0 && (s.gvy ?? 0) < 0) floorBounce = true;
    prevVy = s.gvy ?? 0;
    ok(s.gx! - BURST_GOLD_R * FP >= 0 && s.gx! + BURST_GOLD_R * FP <= BURST_WORLD_W * FP && s.gy! + BURST_GOLD_R * FP <= BURST_TALL_H * FP, "the golden atom stays inside the arena");
  }
  ok(new Set(xs).size > 100 && new Set(ys).size > 50 && floorBounce, "the golden atom moves and bounces off the floor");
  let gone = s;
  for (let i = 0; i < 10; i++) gone = game.step(gone, null);
  ok(gone.gn === -1, "the golden atom goes after its life");
  // FREEZE stops it.
  let f = { ...s0, tick: g0.tick - 1, wave: 1, nextWaveAt: 99999, balls: [], acted: 1 } as BurstState;
  f = game.step(f, null);
  f = game.step(f, null);
  const at = [f.gx, f.gy];
  f = game.step({ ...f, freeze: 30 }, null);
  ok(f.gx === at[0] && f.gy === at[1], "FREEZE stops the golden atom too");
  // It never costs a life: the ship under it all its life.
  let h = { ...s0, tick: g0.tick - 1, wave: 1, nextWaveAt: 99999, balls: [], acted: 1 } as BurstState;
  for (let i = 0; i < BURST_V9_GOLDEN_LIFE; i++) {
    h = game.step(h, null);
    if (h.gn === 0) h = { ...h, x: h.gx!, targetX: h.gx! };
  }
  ok(h.lives === 3, "the golden atom never costs a life");
  // A shot takes it: +6.
  let t = { ...s0, tick: g0.tick - 1, wave: 1, nextWaveAt: 99999, balls: [], acted: 1 } as BurstState;
  t = game.step(t, null);
  t = { ...t, freeze: 200, x: t.gx!, targetX: t.gx! };
  t = game.step(t, { t: t.tick + 1, k: BURST_INPUT_FIRE, a: 0, b: 1, c: 0, d: 0 });
  for (let i = 0; i < 80; i++) t = game.step(t, null);
  ok(burstGoldenCount(t) === 1 && t.gn === -1 && burstCarryBonus(t).gold === BURST_V8_GOLDEN_PTS, "a shot takes the golden atom for +6");
  ok(BURST_V9_CAPS.gold === BURST_V8_GOLDENS * BURST_V8_GOLDEN_PTS, "the golden-atom cap is all six");

  // BURST: three short shots a tap, BURST_GAP apart, for 8 s; DOUBLE ends it.
  let b = { ...s0, tick: 300, wave: 1, nextWaveAt: 99999, balls: [], acted: 1, icons: [{ x: 200 * FP, y: 610 * FP, kind: BURST_ICON_BURST }], x: 200 * FP, targetX: 200 * FP } as BurstState;
  b = game.step(b, null);
  ok(b.burst === 1 && b.burstT === BURST_V9_BURST_TICKS - 0 && b.bursts === 1, "catching BURST turns on BURST shots for 8 s");
  b = game.step(b, { t: b.tick + 1, k: BURST_INPUT_FIRE, a: 0, b: 1, c: 0, d: 0 });
  const fired: number[] = [];
  let shots = b.shots.length;
  if (shots) fired.push(b.tick);
  for (let i = 0; i < 3 * BURST_GAP; i++) {
    b = game.step(b, null);
    if (b.shots.length > shots) fired.push(b.tick);
    shots = b.shots.length;
  }
  ok(fired.length === 3 && fired[1]! - fired[0]! === BURST_GAP && fired[2]! - fired[1]! === BURST_GAP && b.shots.every((x) => x.short === 1), "a tap fires three short shots BURST_GAP apart");
  let e = b;
  for (let i = 0; i < BURST_V9_BURST_TICKS; i++) e = game.step(e, null);
  ok(e.burst === 0 && e.burstT === 0, "BURST ends after 8 s");
  const d = game.step({ ...b, icons: [{ x: 200 * FP, y: 610 * FP, kind: BURST_ICON_DOUBLE }] }, null);
  ok(d.burst === 0 && (d.double ?? 0) > 0, "DOUBLE ends BURST");

  // The wave-clear bonus.
  ok(burstV9ClearPoints(0, 300) === BURST_V9_CLEAR_MAX && burstV9ClearPoints(300, 300) === BURST_V9_CLEAR_MAX && burstV9ClearPoints(301, 300) === BURST_V9_CLEAR_MAX && burstV9ClearPoints(300 + BURST_V9_CLEAR_STEP, 300) === BURST_V9_CLEAR_MAX - 1 && burstV9ClearPoints(99999, 300) === 0, "full within the quick time, one less every 2 s, never below 0");
  ok(burstV9QuickTicks([{ size: 0, side: 0, lift: 0 }]) === 60 + 36 * 15 && burstV9QuickTicks([{ size: 1, side: 0, lift: 0 }, { size: 2, side: 1, lift: 0 }]) === 60 + 36 * 10, "the quick time counts every atom a wave holds");
  let w = { ...s0, tick: 100, wave: 1, waveAt: 50, nextWaveAt: 0, balls: [{ size: 3, x: 200 * FP, y: 400 * FP, vx: 0, vy: 0, id: 0x118 }], x: 200 * FP, targetX: 200 * FP, acted: 1, freeze: 9999 } as BurstState;
  w = game.step(w, { t: 101, k: BURST_INPUT_FIRE, a: 0, b: 1, c: 0, d: 0 });
  for (let i = 0; i < 60; i++) w = game.step(w, null);
  ok(w.cleared === 1 && w.clearPts === BURST_V9_CLEAR_MAX && w.quickWaves === 1 && (w.cleanWaves ?? 0) === 0 && (w.groups ?? []).length === 0, "a quick wave clear pays the full bonus; no clean-wave count");
  ok(burstCarryBonus({ ...w, clearPts: 999 }).clear === BURST_V9_CAPS.clear, "the wave-clear bonus is capped");
}

/* ============================== 4. Scores ============================== */
section("Scores: nothing scores 0, trying scores, the server agrees, skill orders");
{
  let s = game.init(spec.seedFor(1));
  while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, null);
  ok(game.score(s) === 0, "doing nothing scores 0");
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  const by: Record<string, number[]> = {};
  for (const level of ["weak", "good", "great", "elite"] as const) {
    for (let n = 0; n < 16; n++) {
      const seed = spec.seedFor(n);
      const events = burstBot({ game, seed, rev: BURST_REV_CARRY, human: new Human("burst", seed, level), fixes: true }).events ?? [];
      const byTick = new Map(events.map((e) => [e.t, e]));
      let st = game.init(seed);
      const checkpoints: unknown[] = [];
      while (!game.isOver(st) && st.tick < game.runTicks) {
        st = game.step(st, byTick.get(st.tick + 1) ?? null);
        if (st.tick % 300 === 0) checkpoints.push(burstCheckpoint(st));
      }
      const score = game.score(st);
      const raw = spec.encode({ seed, claimedScore: score, events, endTick: st.tick, checkpoints }, BURST_REV_CARRY, seed);
      const replay = spec.replay(seed, raw, BURST_REV_CARRY);
      ok(replay.score === score && !replay.flagged, `${level} seed ${n}: the server replay scores ${replay.score}, the phone ${score}`);
      if (st.hits > 0) ok(score > 0, `${level} seed ${n}: a run that hit atoms scores (${score})`);
      ok(score <= 200, `${level} seed ${n}: at most 200`);
      (by[level] ??= []).push(score);
    }
  }
  const m = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, med(v)]));
  console.log(`  medians on 16 seeds: ${JSON.stringify(m)}`);
  ok(m.weak! < m.good! && m.good! < m.great! && m.great! < m.elite!, "weak < good < great < elite medians on the same seeds");
}

if (failures.length) {
  console.log(`\nFAIL fission-carry-check: ${failures.length} of ${checks} checks failed`);
  for (const f of [...new Set(failures)].slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nPASS fission-carry-check: ${checks} checks — rooms deal burstRev 9; the same carriers and golden atoms for every player, every drop from a carrier's split; the bouncing golden atom, BURST shots and the wave-clear bonus; scores ordered by skill`);
