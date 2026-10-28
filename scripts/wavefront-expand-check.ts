/**
 * wavefront-expand-check (the 200 expansion, 26 Oct 2026; docs/expansions/x200-wavefront.md): Wavefront wavRev 10.
 *
 *  1. Old rounds: 32 skill-band runs recorded on the code before the expansion (rev 8 room logs) replay on every
 *     older revision (unstamped, 2–8) to the stored score and final-state digest, and no older state carries a
 *     wavRev 10 field.
 *  2. Rooms (and the practice definition) deal wavRev 10; LIVE_BANDS lists it with wavRev 8 as its strictRev; the
 *     round maximum is 200.
 *  3. Recorded wavRev 10 runs (bots, weak to elite) replay to their stored score, unflagged and in sync, and the
 *     scripted look-ahead run scores 200 through the server replay.
 *  4. Guaranteed opportunities (the arcade rule): on all 260 skill-band seeds (tuning n = 0–59, fresh n = 10000–10199) the run's
 *     plan deals the same power-ups (9, three of each kind, before 51 s, one at a time), the saucers fly at the
 *     same moments, and the ceiling counted from what the seed deals is 200; and reachability: the look-ahead
 *     oracle's stored run on every one of the 260 seeds (scripts/fixtures/wavefront-expand-oracle.json.gz)
 *     replays through the server to 200.
 *  5. Room identity: very different input logs (idle, random, a weak bot, an elite bot) on the same seed see the
 *     same planned power-ups and saucers over the ticks both lived, and the same ships in every wave both reached.
 *  6. The rules on hand-built states: the 800 px world, 36-ship waves, the spread volley, the shield, the capped
 *     streak, hull hits, the open and closed core on the run clock, a cannon's hit points, the gunship counted as
 *     a wave, the planned drops; scores within 0–200, skill within 50, base within 150; no input scores 0.
 *
 *   bun scripts/wavefront-expand-check.ts      (record new runs: bun scripts/wavefront-expand-bands.ts --record;
 *                                               the 200 run: bun scripts/wavefront-expand-ace.ts --seeds=0 --write)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  wavefrontGameFor,
  wavefrontBandParts,
  wavefrontWorldHFor,
  wavCoreOpen,
  wavPlan,
  wavPrecision,
  WAV_X_BOSS_BY,
  WAV_X_SKILL_PRECISE,
  wavShapeBox,
  wavShipY,
  wavSkillPaid,
  wavSkillRaw,
  wavStreakMult,
  WAV_BOSS_Y,
  WAV_CELL,
  WAV_DROP_SHIELD,
  WAV_FORMS_X,
  WAV_PAR_X,
  WAV_REV_EXPAND,
  WAV_REV_PHONE,
  WAV_REV_STRICT,
  WAV_SAUCER_EVERY,
  WAV_V10_BAND_CURVE,
  WAV_X_BOSS_HP,
  WAV_X_CANNON_HP,
  WAV_X_CORE_DAMAGE,
  WAV_X_CORE_PERIOD,
  WAV_X_DROP_Y,
  WAV_X_DROPS,
  WAV_X_EDGE_MAX,
  WAV_X_H,
  WAV_X_MID_HP,
  WAV_X_SAUCERS,
  WAV_X_SHAPES,
  WAV_X_SKILL_CANNON,
  WAV_X_SKILL_CORE,
  WAV_X_SKILL_DROP,
  WAV_X_SKILL_PAY,
  WAV_X_SKILL_SAUCER,
  WAV_X_STREAK_CAP,
  WAV_X_STREAK_STEP,
  type WavState,
} from "../src/lib/arcade/wavefront";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";
import { generateWavefront } from "../src/lib/duel/arcade.server";
import { wavefrontPuzzle } from "../src/puzzles/wavefront";
import { roomSeed } from "./arcade-skill-bands/games";
import { LEGACY_REVS, stateDigest } from "./wavefront-expand-record";
import { RECORDED_SEEDS } from "./wavefront-expand-bands";
import { ALL_LEVELS } from "./arcade-skill-bands/human";
import { botLog, randomLog, scheduleOf } from "./room-identity/wavefront";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

let checks = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (title: string) => console.log(`— ${title}`);
const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  const err = console.error;
  const log = console.log;
  console.error = () => {};
  console.warn = () => {};
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.warn = warn;
    console.error = err;
    console.log = log;
  }
};
const game = wavefrontGameFor(WAV_REV_EXPAND);
/** Plays an input log on wavRev 10 to its end. */
function play(seed: number, events: ArcadeInputEvent[]): { end: WavState; waves: Map<number, string> } {
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as WavState;
  const waves = new Map<number, string>([[1, s.shapes.join("")]]);
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const prev = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if (s.wave !== prev.wave && !s.boss) waves.set(s.wave, s.shapes.join(""));
  }
  return { end: s, waves };
}

/* 1. Old rounds. */
section("Old rounds replay unchanged on every older revision");
{
  const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-expand-legacy.json.gz")).toString()) as {
    runs: { name: string; seed: number; raw: string; revs: { rev: number | null; score: number; digest: string }[] }[];
  };
  ok(legacy.runs.length === 32, `32 legacy runs (got ${legacy.runs.length})`);
  for (const run of legacy.runs)
    for (const { rev, score, digest } of run.revs) {
      const r = quiet(() => replayWavefrontRun(run.seed, run.raw, rev));
      ok(r.score === score, `${run.name} on wavRev ${rev ?? "-"}: stored ${score}, replays ${r.score}`);
      ok(stateDigest(r.state) === digest, `${run.name} on wavRev ${rev ?? "-"}: final state differs`);
      ok(!("x10" in (r.state as object)) && !("streak" in (r.state as object)) && !("plan" in (r.state as object)), `${run.name} on wavRev ${rev ?? "-"}: carries a wavRev 10 field`);
      if (rev === WAV_REV_STRICT) ok(!r.flagged && r.desyncTick == null, `${run.name}: unflagged on wavRev 8`);
    }
  for (const rev of LEGACY_REVS) ok(!("x10" in (wavefrontGameFor(rev).init(1) as object)), `wavRev ${rev ?? "-"} starts with no wavRev 10 field`);
}

/* 2. Dealing. */
// Since 27 Oct 2026 rooms deal wavRev 11 (Joe's phone notes, wavefront-phone-check proves its dealing); wavRev 10 rounds
// keep replaying and scoring exactly as below.
section("Rooms deal wavRev 11 (after wavRev 10), scored to 200");
ok(generateWavefront().wavRev === WAV_REV_PHONE && WAV_REV_EXPAND === 10 && WAV_REV_PHONE === 11, "rooms deal wavRev 11, the revision after wavRev 10");
ok((wavefrontPuzzle.generate() as { wavRev?: number }).wavRev === WAV_REV_PHONE, "practice's definition deals wavRev 11");
ok(LIVE_BANDS.wavefront.strictRev === WAV_REV_STRICT && WAV_V10_BAND_CURVE.points.at(-1) === 140, "LIVE_BANDS: wavRev 8 is still the strictRev; wavRev 10's base curve still tops at 140");
ok(roundMaxFor("wavefront") === 200, "Wavefront's round maximum is 200");
ok(wavefrontWorldHFor(WAV_REV_EXPAND) === WAV_X_H && WAV_X_H === 800, "wavRev 10 plays in the 390 × 800 world");

/* 3. Recorded wavRev 10 runs and the 200. */
section("Recorded wavRev 10 runs replay to their stored scores; 200 is reachable");
{
  const data = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-expand-runs.json.gz")).toString()) as {
    runs: { level: string; n: number; seed: number; score: number; raw: string; digest: string }[];
    ace: { seed: number; raw: string; score: number };
  };
  ok(data.runs.length === ALL_LEVELS.length * RECORDED_SEEDS.length, `${ALL_LEVELS.length * RECORDED_SEEDS.length} recorded wavRev 10 runs (got ${data.runs.length})`);
  for (const run of data.runs) {
    const r = replayWavefrontRun(run.seed, run.raw, WAV_REV_EXPAND);
    ok(!r.flagged && r.desyncTick == null, `${run.level} #${run.n}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score && stateDigest(r.state) === run.digest, `${run.level} #${run.n}: stored ${run.score}, replays ${r.score}`);
    ok(r.score > 0 && r.score <= 200, `${run.level} #${run.n}: score within 1–200 (${r.score})`);
  }
  const ace = replayWavefrontRun(data.ace.seed, data.ace.raw, WAV_REV_EXPAND);
  ok(!ace.flagged && ace.desyncTick == null && ace.score === 200, `the scripted run scores 200 through the server replay (got ${ace.score})`);
  ok((ace.state as WavState).bossKilled === 1, "the 200 run destroys the boss");
  ok(quiet(() => replayWavefrontRun(data.ace.seed, data.ace.raw, WAV_REV_STRICT)).score <= 150, "the 200 run's log scores at most 150 on wavRev 8");
}

/* 4. Guaranteed opportunities and the perfect-play ceiling. */
section("Every seed deals the same opportunities; the perfect-play ceiling is 200 on all 260 seeds");
const FALL_TICKS = Math.ceil(((WAV_X_H - 66) - WAV_X_DROP_Y) / 4);
/** The skill-band seed sets (docs/arcade-bands-elite.md): tuning n = 0–59, fresh n = 10000–10199. */
const SEED_SETS = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i)];

/**
 * What a flawless player can collect on a seed, counted from what it deals: every planned power-up (all fall
 * before 51 s, long before the earliest the mothership can be reached), the saucers that fly before 60 s, both
 * bosses' cannons, as many open-core hits as their hit points allow once the cannons are down, and the streak's
 * capped points; the base's 140 for every ship, wave and boss hit point and the full 10 for a quick kill.
 */
export function wavCeiling(seed: number): { raw: number; score: number } {
  const plan = wavPlan(seed);
  const drops = plan.drops.filter((d) => d.t < 51 * 60).length;
  const saucers = Array.from({ length: WAV_X_SAUCERS }, (_, i) => (i + 1) * WAV_SAUCER_EVERY).filter((t) => t <= 60 * 60).length;
  const core = Math.ceil((WAV_X_MID_HP - 2 * WAV_X_CANNON_HP) / WAV_X_CORE_DAMAGE) + Math.ceil((WAV_X_BOSS_HP - 2 * WAV_X_CANNON_HP) / WAV_X_CORE_DAMAGE);
  // Every weak-point hit (both bosses' cannons, then the core hits) dead centre.
  const precise = wavPrecision(0) * (4 * WAV_X_CANNON_HP + core);
  const raw = WAV_X_STREAK_CAP + WAV_X_SKILL_DROP * drops + WAV_X_SKILL_SAUCER * saucers + WAV_X_SKILL_CANNON * 4 + WAV_X_SKILL_CORE * core + WAV_X_SKILL_PRECISE * precise;
  const score = Math.min(200, bandPoints(WAV_V10_BAND_CURVE, WAV_PAR_X) + 10 + Math.min(WAV_X_EDGE_MAX, bandPoints(WAV_X_SKILL_PAY, raw)));
  return { raw, score };
}
{
  let lowest = Infinity;
  let lowestRaw = Infinity;
  for (const n of SEED_SETS) {
    const seed = roomSeed(n);
    const plan = wavPlan(seed);
    const kinds = [0, 1, 2].map((k) => plan.drops.filter((d) => d.k === k).length);
    ok(plan.drops.length === WAV_X_DROPS && kinds.every((c) => c === WAV_X_DROPS / 3), `seed #${n}: ${WAV_X_DROPS} power-ups, three of each kind (${kinds.join("/")})`);
    ok(plan.drops.every((d, i) => i === 0 || d.t - plan.drops[i - 1]!.t > FALL_TICKS) && plan.drops.at(-1)!.t < 51 * 60, `seed #${n}: one power-up on screen at a time, the last before 51 s`);
    ok(plan.saucers.length === WAV_X_SAUCERS && WAV_X_SAUCERS === 5, `seed #${n}: five saucers`);
    const c = wavCeiling(seed);
    lowest = Math.min(lowest, c.score);
    lowestRaw = Math.min(lowestRaw, c.raw);
  }
  ok(lowest === 200, `the lowest perfect-play ceiling over 260 seeds is ${lowest}`);
  ok(lowestRaw >= WAV_X_SKILL_PAY.units.at(-1)!, `every seed deals at least ${WAV_X_SKILL_PAY.units.at(-1)} skill points (lowest ${lowestRaw})`);
  console.log(`  perfect-play ceiling: lowest ${lowest} over 260 seeds (skill points dealt: at least ${lowestRaw}, the full 50 at ${WAV_X_SKILL_PAY.units.at(-1)})`);
}

{
  // Reachability: a player that actually plays each seed (the oracle, scripts/wavefront-expand-ace.ts --fast).
  const oracle = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-expand-oracle.json.gz")).toString()) as { runs: { n: number; seed: number; log: string }[] };
  ok(oracle.runs.length === 260 && oracle.runs.every((r, i) => r.n === SEED_SETS[i] && r.seed === roomSeed(r.n)), `the oracle has a stored run for each of the 260 seeds (${oracle.runs.length})`);
  const lowest = { tuning: Infinity, fresh: Infinity };
  for (const r of oracle.runs) {
    const res = replayWavefrontRun(r.seed, r.log, WAV_REV_EXPAND);
    ok(!res.flagged && res.desyncTick == null, `oracle seed #${r.n}: replays unflagged`);
    const set = r.n < 60 ? "tuning" : "fresh";
    lowest[set] = Math.min(lowest[set], res.score);
  }
  ok(lowest.tuning === 200 && lowest.fresh === 200, `the oracle reaches 200 on every seed through the server replay (lowest ${lowest.tuning} tuning, ${lowest.fresh} fresh)`);
  console.log(`  reachability: the oracle's lowest score is ${lowest.tuning} on the 60 tuning seeds and ${lowest.fresh} on the 200 fresh ones`);
}

/* 5. Room identity. */
section("Room identity: what the seed deals never depends on the play");
for (const n of [0, 7, 10001]) {
  const seed = roomSeed(n);
  // wavRev 10's own bots (the room-identity module now plays the revision rooms deal).
  const logs = [[], randomLog(seed), botLog(seed, "weak", WAV_REV_EXPAND), botLog(seed, "elite", WAV_REV_EXPAND)];
  const runs = logs.map((log) => ({ ...play(seed, log), schedule: scheduleOf(seed, WAV_REV_EXPAND, log) }));
  for (let a = 1; a < runs.length; a++) {
    const lived = Math.min(runs[0]!.end.tick, runs[a]!.end.tick);
    const left = runs[0]!.schedule.filter((e) => e.t <= lived);
    const right = runs[a]!.schedule.filter((e) => e.t <= lived);
    ok(left.length > 0 && JSON.stringify(left) === JSON.stringify(right), `seed #${n}: log ${a} sees the idle run's power-ups and saucers over the ${lived} ticks both lived`);
    let same = 0;
    for (const [wave, ships] of runs[a]!.waves)
      if (runs[1]!.waves.has(wave)) {
        same++;
        ok(runs[1]!.waves.get(wave) === ships, `seed #${n}: wave ${wave} has the same ships for log 1 and log ${a}`);
      }
    ok(same > 0, `seed #${n}: logs 1 and ${a} share a wave`);
  }
  ok(runs[3]!.end.wave > runs[0]!.end.wave, `seed #${n}: the elite run gets further than the idle one (so the comparison spans different play)`);
  const plan = wavPlan(seed);
  const elite = runs[3]!.schedule.filter((e) => e.what.startsWith("power-up"));
  ok(elite.length === plan.drops.filter((d) => d.t <= runs[3]!.end.tick).length, `seed #${n}: the elite run sees every planned power-up up to its end`);
}

/* 6. Rules. */
section("Rules: world, waves, spread, shield, streak, weak points, gunship, planned drops");
const step = (s: WavState, n = 1): WavState => {
  for (let k = 0; k < n; k++) s = game.step(s, null) as WavState;
  return s;
};
const base = game.init(12345) as WavState;
ok(base.x10 === 1 && base.worldH === WAV_X_H && base.shapes.length === WAV_X_SHAPES && WAV_X_SHAPES === 36, "wave 1 is a 36-ship grid in the 800 px world");
ok(wavShipY(base) === WAV_X_H - 66, "the ship sits 66 px above the bottom");
for (let wave = 2; wave <= 5; wave++) ok(WAV_FORMS_X[wave]!.length === 36, `wave ${wave}'s shape has 36 slots (30 and six escorts)`);
ok(wavStreakMult(0) === 1 && wavStreakMult(WAV_X_STREAK_STEP - 1) === 1 && wavStreakMult(WAV_X_STREAK_STEP) === 2 && wavStreakMult(2 * WAV_X_STREAK_STEP) === 3 && wavStreakMult(999) === 3, "streak multiplier ×1, ×2 from 10, ×3 from 20, never more");
{
  let s: WavState = { ...base, enter: 0, fy: 84, spread: 2, fireIn: 1, bolts: [] };
  s = step(s);
  ok(s.bolts.length === 3 && s.bolts.filter((b) => b.sd).length === 2 && s.spread === 1, "a spread volley fires three bolts and uses one volley");
  ok(s.bolts.some((b) => (b.v ?? 0) < 0) && s.bolts.some((b) => (b.v ?? 0) > 0), "the spread bolts angle out both ways");
}
{
  const y = wavShipY(base);
  let s: WavState = { ...base, enter: 0, fy: 84, shield: 100, streak: 9, reds: [{ x: base.shipX * 256, y: (y - 8) * 256 }], invuln: 0 };
  s = step(s);
  ok(s.lives === base.lives && s.shieldBlocks === 1 && s.shield === 0 && s.streak === 9, "the shield absorbs a hit, keeps the streak and is spent");
  let t: WavState = { ...base, enter: 0, fy: 84, shield: 0, streak: 9, reds: [{ x: base.shipX * 256, y: (y - 8) * 256 }], invuln: 0 };
  t = step(t);
  ok(t.lives === base.lives - 1 && t.streak === 0, "without it the hit costs a life and the streak");
}
{
  const box = wavShapeBox({ ...base, fy: 84 }, 0);
  let s: WavState = { ...base, enter: 0, fy: 84, streak: 19, streakPts: 0, fireIn: 99, bolts: [{ x: (box.x + WAV_CELL / 2) * 256, y: (box.y + WAV_CELL + 2) * 256 }] };
  s = step(s);
  ok(s.streak === 20 && s.streakPts === 2 && s.shapesDown === 1, "a hit grows the streak and pays ×3 less one");
  let m: WavState = { ...base, enter: 0, fy: 84, streak: 5, fireIn: 99, bolts: [{ x: 5 * 256, y: 40 * 256 }] };
  m = step(m);
  ok(m.streak === 0, "a centre bolt leaving the top breaks the streak");
  let sd: WavState = { ...base, enter: 0, fy: 84, streak: 5, fireIn: 99, bolts: [{ x: 5 * 256, y: 40 * 256, sd: 1, v: -512 }] };
  sd = step(sd);
  ok(sd.streak === 5, "a spread bolt leaving does not");
  ok(wavSkillRaw({ ...base, streakPts: 999 }) === WAV_X_STREAK_CAP, `the streak's points count at most ${WAV_X_STREAK_CAP}`);
}
{
  // Weak points on the mothership: the open core takes 3 and grows the streak, the closed core (hull) 1 and keeps it, a cannon its own hit points.
  const boss = { x: 131, dir: 1, hp: 36, fireIn: 999, mid: 0, maxHp: 36, guns: [WAV_X_CANNON_HP, WAV_X_CANNON_HP], at: 0 };
  const at = (bx: number, tick: number, extra: Partial<WavState> = {}) => step({ ...base, enter: 0, tick, shapes: base.shapes.map(() => 0), wave: 6, boss: { ...boss, guns: [...boss.guns] }, fireIn: 99, bolts: [{ x: bx * 256, y: (WAV_BOSS_Y + 40) * 256 }], redIn: 999, streak: 4, ...extra });
  const open = at(131 + 64, 10);
  ok(wavCoreOpen(null, 11) && open.boss!.hp === 36 - WAV_X_CORE_DAMAGE && open.weakHits === 1 && open.streak === 5, "a hit on the open core takes 3 and grows the streak");
  const shut = at(131 + 64, WAV_X_CORE_PERIOD / 2 + 10);
  ok(!wavCoreOpen(null, WAV_X_CORE_PERIOD / 2 + 11) && shut.boss!.hp === 35 && (shut.weakHits ?? 0) === 0 && shut.streak === 4, "a hit on the closed core takes 1 and keeps the streak as it was");
  ok(wavCoreOpen(null, WAV_X_CORE_PERIOD * 7 + 3) && !wavCoreOpen(null, WAV_X_CORE_PERIOD * 7 + WAV_X_CORE_PERIOD / 2), "the core opens on the run clock (the same moments for everyone)");
  ok(open.precise === wavPrecision(0) && wavPrecision(0) === 3 && wavPrecision(1) === 3 && wavPrecision(2) === 2 && wavPrecision(3) === 2 && wavPrecision(4) === 1 && wavPrecision(5) === 1 && wavPrecision(6) === 0, "precision: 3 within 1 px of the centre, 2 within 3, 1 within 5, else 0");
  const off = at(131 + 64 + 5, 10); // the boss slides 1 px this tick: 4 px off its centre
  ok(off.weakHits === 1 && off.precise === 1, "an open-core hit 4 px off centre pays 1 precision point");
  ok((shut.precise ?? 0) === 0, "a hull hit pays no precision");
  const gun = at(131 + 8, 10, { boss: { ...boss, guns: [1, WAV_X_CANNON_HP] } });
  ok(gun.boss!.guns![0] === 0 && gun.cannonsDown === 1 && gun.drop === null && gun.boss!.hp === 35 && gun.streak === 5 && gun.precise === 3, "a cannon's last hit destroys it (the boss takes one), grows the streak, pays its precision and drops nothing");
}
{
  // The mothership by WAV_X_BOSS_BY at the latest: what is left of the formations leaves (no units for it).
  const late = step({ ...base, enter: 0, fy: 84, wave: 5, tick: WAV_X_BOSS_BY - 1, redIn: 999 } as WavState);
  ok(late.boss !== null && !late.boss!.mid && late.bossAt === WAV_X_BOSS_BY && late.shapes.every((c) => c === 0) && late.shapesDown === base.shapesDown && late.wavesCleared === base.wavesCleared, `the mothership arrives at ${WAV_X_BOSS_BY / 60} s whatever is left`);
  const mid = step({ ...base, enter: 0, wave: 4, shapes: base.shapes.map(() => 0), boss: { x: 147, dir: 1, hp: 9, fireIn: 999, mid: 1, maxHp: 16, guns: [4, 4], at: 0 }, tick: WAV_X_BOSS_BY - 1, redIn: 999 } as WavState);
  ok(mid.boss !== null && !mid.boss!.mid && (mid.midKilled ?? 0) === 0, "a gunship still flying at that moment leaves for the mothership");
  const early = step({ ...base, enter: 0, tick: WAV_X_BOSS_BY - 1, bossAt: 3000, boss: { x: 131, dir: 1, hp: 20, fireIn: 999, mid: 0, maxHp: 36, guns: [0, 0], at: 0 }, shapes: base.shapes.map(() => 0), wave: 6, redIn: 999 } as WavState);
  ok(early.bossAt === 3000 && early.boss!.hp === 20, "a mothership that came sooner stays as it is");
}
{
  // Saucers drop nothing; power-ups come only from the plan, at its moments and places.
  const s0 = game.init(99) as WavState;
  const s = step({ ...s0, enter: 0, fy: 84, saucerDir: 1, saucerX: 100 * 256, fireIn: 99, bolts: [{ x: 102 * 256, y: 60 * 256 }] });
  ok(s.saucers === 1 && s.drop === null, "a saucer shot down drops nothing");
  const plan = wavPlan(99);
  const first = plan.drops[0]!;
  const before = step({ ...s0, tick: first.t - 1 });
  ok(before.drop !== null && before.drop.x === first.x * 256 && before.drop.y === WAV_X_DROP_Y * 256 + 4 * 256 && before.drop.k === first.k && before.dropsSeen === 1, "the first planned power-up appears at its tick, x and kind");
  const y = wavShipY(base);
  const c = step({ ...base, enter: 0, fy: 84, drop: { x: base.shipX * 256, y: (y - 4) * 256, wait: 0, k: WAV_DROP_SHIELD } });
  ok((c.shield ?? 0) > 0 && c.powerups === 1 && c.drop === null, "catching a shield raises it and counts a power-up");
}
{
  let s: WavState = { ...base, enter: 0, wave: 4, wavesCleared: 3, shapes: base.shapes.map(() => 0), boss: { x: 147, dir: 1, hp: 1, fireIn: 999, mid: 1, maxHp: 16, guns: [0, 0], at: 0 }, fireIn: 99, bolts: [{ x: (147 + 48) * 256, y: (WAV_BOSS_Y + 40) * 256 }], redIn: 999 };
  s = step(s);
  ok(s.midKilled === 1 && s.wavesCleared === 4 && s.boss === null && s.wave === 4 && s.shapes.some((c) => c !== 0) && (s.enter ?? 0) > 0, "the gunship down counts a wave and wave 4 flies in");
}
{
  ok(bandPoints(WAV_V10_BAND_CURVE, WAV_PAR_X) === 140 && bandPoints(WAV_X_SKILL_PAY, 1e6) === WAV_X_EDGE_MAX, "the base curve tops at 140 at a perfect run, the skill pay at 50");
  let prev = -1;
  for (let u = 0; u <= WAV_PAR_X + 5; u++) {
    const p = bandPoints(WAV_V10_BAND_CURVE, u);
    if (p < prev) ok(false, `the base curve falls at ${u}`);
    prev = p;
  }
  let prevPay = -1;
  for (let u = 0; u <= 200; u++) {
    const p = bandPoints(WAV_X_SKILL_PAY, u);
    if (p < prevPay) ok(false, `the skill pay falls at ${u}`);
    prevPay = p;
  }
  const perfect = { ...base, shapesDown: 180, armourHits: 30, wavesCleared: 6, bossDmg: 52, bossKilled: 1, bossAt: 3000, tick: 3100, streakPts: 9999, powerups: 9, saucers: 4, cannonsDown: 4, weakHits: 13, precise: 60, acted: 1 };
  const full = wavefrontBandParts(perfect);
  ok(full.points === 140 && full.bonus === 60 && wavSkillPaid(perfect) === 50, "a perfect fast run: 140 + 10 + 50");
  ok(game.score(perfect) === 200, "…which is exactly 200");
  ok(wavefrontBandParts({ ...perfect, saucers: 0 }).units === full.units, "saucers are skill points, not base units");
  ok(game.score({ ...perfect, streakPts: 0, powerups: 0, saucers: 0, cannonsDown: 0, weakHits: 0, precise: 0 }) === 150, "with no skill points the same run scores 150");
  ok(game.score({ ...base, acted: 0 }) === 0, "no input scores 0");
  const random = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => play(roomSeed(n), randomLog(roomSeed(n))).end).map((s) => game.score(s));
  ok(Math.max(...random) <= 40, `random drags score little (${random.join(", ")})`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL wavefront-expand-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS wavefront-expand-check: ${checks} checks — old rounds unchanged on every revision, wavRev 10 (rooms now deal 11): recorded runs and a 200 replay, the counted ceiling and the oracle's 200 on all 260 seeds, room identity, the new rules`);
