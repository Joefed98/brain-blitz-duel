/**
 * wavefront-phone-check (Joe's phone notes, 27 Oct 2026; docs/phone-notes-oct-2026/wavefront.md): Wavefront wavRev 11.
 *
 *  1. Dealing: rooms and practice deal wavRev 11's play, since 29 Oct 2026 as wavRev 12 (the arcade scoring standard,
 *     LIVE_BANDS on WAV_V12_BAND_CURVE, wavRev 8 still its strictRev); the round maximum is 200; the 390 × 800 world.
 *     Older revisions are wavefront-expand-check's (wavRev 10's recorded runs and the legacy fixture replay there exactly
 *     as before) and no older state carries a wavRev 11 (or 12) field.
 *  2. Recorded wavRev 11 runs (the band bots, weak to flawless; scripts/fixtures/wavefront-phone-runs.json.gz,
 *     `bun scripts/wavefront-phone-bands.ts --record`) replay to their stored score and final state, unflagged; on
 *     wavRev 12 the same logs step tick for tick (every checkpoint the same) to the same state but its scoring fields.
 *  3. Seeded carriers (the arcade rule): on all 260 skill-band seeds every formation wave has two carriers, one SPREAD and
 *     one SHIELD, never an armour slot, the same on every call; wave 1's are in the starting state.
 *  4. Room identity: very different logs (idle, random, a weak bot, an elite bot) on the same seed see the same ships and
 *     the same carriers in every wave both reach; every power-up that falls is the carried kind of a ship just shot
 *     (from its slot) or the laser of a saucer just shot; none falls from the top; and the mothership arrives only once
 *     wave 5 is destroyed (after the gunship and five waves), never on the clock.
 *  5. The rules on hand-built states: no streak or multiplier; a carrier shot drops its power-up where it fell, a
 *     carrier that rams the ship takes it with it; a saucer shot drops the laser; catching one gives it; no planned
 *     drop; no mothership at 78 s while wave 5 flies.
 *  6. Scoring: the base curve and skill pay rise, the base curve is above wavRev 10's flat stretch (scores lifted),
 *     a perfect fast run scores 200 (150 with no skill points), no input scores 0, random drags score little.
 *  7. wavRev 12 (docs/arcade-standard/wavefront.md): the core's full figure (294) derived from the waves and met at the
 *     mothership's arrival in the recorded perfect runs, five saucers a 90 s run (fewer only for a shorter run), and
 *     every part's rule on built states (arcade-standard-check proves the sum, the 200s, played and idle runs).
 *
 *   bun scripts/wavefront-phone-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  wavCarriers,
  wavCheckpoint,
  wavefrontBandParts,
  wavefrontGameFor,
  wavefrontWorldHFor,
  wavShapeBox,
  wavShipY,
  wavSkillPaidR11,
  wavSkillRawR11,
  wavWaves,
  WAV_ARMOUR_BY_WAVE,
  WAV_CELL,
  WAV_DROP_PIERCE,
  WAV_DROP_SHIELD,
  WAV_DROP_SPREAD,
  WAV_PAR_X,
  WAV_R11_CARRIERS,
  WAV_R11_SKILL_PAY,
  WAV_REV_EXPAND,
  WAV_REV_PHONE,
  WAV_REV_STD,
  WAV_REV_STRICT,
  WAV_V10_BAND_CURVE,
  WAV_V11_BAND_CURVE,
  WAV_V12_BAND_CURVE,
  WAV_X_BOSS_BY,
  WAV_X_BOSS_HP,
  WAV_X_MID_HP,
  WAV_X_SAUCERS,
  WAV_SAUCER_EVERY,
  WAV_STD_CORE_FULL,
  wavStdSaucers,
  wavStdSaucersFlown,
  wavStdScore,
  wavStdUnits,
  WAV_X_EDGE_MAX,
  WAV_X_H,
  WAV_X_SHAPES,
  type WavState,
} from "../src/lib/arcade/wavefront";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { decodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import { generateWavefront } from "../src/lib/duel/arcade.server";
import { wavefrontPuzzle } from "../src/puzzles/wavefront";
import { roomSeed } from "./arcade-skill-bands/games";
import { playRevOf } from "./scoring-targets-revs";
import { ALL_LEVELS } from "./arcade-skill-bands/human";
import { LEGACY_REVS, stateDigest } from "./wavefront-expand-record";
import { PHONE_RECORDED_SEEDS } from "./wavefront-phone-bands";
import { botLog, randomLog, roomIdentity, scheduleOf } from "./room-identity/wavefront";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

let checks = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (title: string) => console.log(`— ${title}`);
const game = wavefrontGameFor(WAV_REV_PHONE);

/* 1. Dealing. */
section("Rooms deal wavRev 11's play (since 29 Oct 2026 as wavRev 12), scored to 200");
// Since 29 Oct 2026 rooms deal wavRev 12 (the arcade scoring standard: wavRev 11's play in fixed parts; arcade-standard-check
// proves its scoring, section 2 below that wavRev 11 logs replay on it tick for tick); wavRev 11 rounds replay as before.
ok(WAV_REV_PHONE === 11 && WAV_REV_STD === 12 && generateWavefront().wavRev === WAV_REV_STD && playRevOf("wavefront", WAV_REV_STD) === WAV_REV_PHONE, "rooms deal wavRev 12, wavRev 11's play");
ok((wavefrontPuzzle.generate() as { wavRev?: number }).wavRev === WAV_REV_STD, "practice's definition deals wavRev 12");
ok(LIVE_BANDS.wavefront.rev === WAV_REV_STD && LIVE_BANDS.wavefront.curve === WAV_V12_BAND_CURVE && LIVE_BANDS.wavefront.strictRev === WAV_REV_STRICT, "LIVE_BANDS: wavRev 12 on WAV_V12_BAND_CURVE, wavRev 8 its strictRev");
ok(wavefrontWorldHFor(WAV_REV_STD) === WAV_X_H && wavefrontGameFor(WAV_REV_STD).runTicks === game.runTicks, "wavRev 12 plays in the same 390 × 800 world for the same 90 s");
for (const rev of [...LEGACY_REVS, WAV_REV_EXPAND, WAV_REV_PHONE]) ok(!("std" in (wavefrontGameFor(rev).init(1) as object)) && !("coresHit" in (wavefrontGameFor(rev).init(1) as object)), `wavRev ${rev ?? "-"} starts with no wavRev 12 field`);
ok(roundMaxFor("wavefront") === 200, "Wavefront's round maximum is 200");
ok(wavefrontWorldHFor(WAV_REV_PHONE) === WAV_X_H, "wavRev 11 plays in wavRev 10's 390 × 800 world");
for (const rev of [...LEGACY_REVS, WAV_REV_EXPAND]) ok(!("r11" in (wavefrontGameFor(rev).init(1) as object)) && !("carry" in (wavefrontGameFor(rev).init(1) as object)), `wavRev ${rev ?? "-"} starts with no wavRev 11 field`);

/* 2. Recorded runs. */
section("Recorded wavRev 11 runs replay to their stored scores");
{
  const data = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-phone-runs.json.gz")).toString()) as {
    runs: { level: string; n: number; seed: number; score: number; raw: string; digest: string }[];
  };
  ok(data.runs.length === ALL_LEVELS.length * PHONE_RECORDED_SEEDS.length, `${ALL_LEVELS.length * PHONE_RECORDED_SEEDS.length} recorded wavRev 11 runs (got ${data.runs.length})`);
  for (const run of data.runs) {
    const r = replayWavefrontRun(run.seed, run.raw, WAV_REV_PHONE);
    ok(!r.flagged && r.desyncTick == null, `${run.level} #${run.n}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score && stateDigest(r.state) === run.digest, `${run.level} #${run.n}: stored ${run.score}, replays ${r.score}`);
    ok(r.score > 0 && r.score <= 200, `${run.level} #${run.n}: score within 1–200 (${r.score})`);
    ok((r.state as WavState).r11 === 1 && ((r.state as WavState).streakPts ?? 0) === 0, `${run.level} #${run.n}: a wavRev 11 state with no streak points`);
    // wavRev 12 (scoring only): the same log replays on it tick for tick, to the same state but its two scoring fields.
    // The server replay on wavRev 12 meets every stored checkpoint (the stored raw claims its wavRev 11 score, the only flag).
    const std = replayWavefrontRun(run.seed, run.raw, WAV_REV_STD);
    const { std: mark, coresHit, ...rest } = std.state as WavState;
    ok(std.desyncTick == null && (!std.flagged || std.reason === "score did not match the replay") && mark === 1 && typeof coresHit === "number", `${run.level} #${run.n}: replays on wavRev 12 with every checkpoint met (${std.reason ?? ""})`);
    ok(stateDigest(rest) === run.digest, `${run.level} #${run.n}: wavRev 12 replays the wavRev 11 log to the same final state`);
    // Tick for tick: both revisions stepped on the log, every tick's checkpoint (checksum included) the same.
    {
      const events = decodeWavefrontRun(run.raw)!.events ?? [];
      const byTick = new Map(events.map((e) => [e.t, e]));
      const g12 = wavefrontGameFor(WAV_REV_STD);
      let a = game.init(run.seed) as WavState;
      let b = g12.init(run.seed) as WavState;
      let same = true;
      while (!game.isOver(a) && a.tick < game.runTicks) {
        const e = byTick.get(a.tick + 1) ?? null;
        a = game.step(a, e) as WavState;
        b = g12.step(b, e) as WavState;
        if (JSON.stringify(wavCheckpoint(a)) !== JSON.stringify(wavCheckpoint(b))) same = false;
      }
      ok(same && g12.isOver(b) === game.isOver(a), `${run.level} #${run.n}: wavRev 12 steps the log tick for tick as wavRev 11`);
    }
    ok(std.score >= 1 && std.score <= 200, `${run.level} #${run.n}: scores 1–200 on wavRev 12 (${std.score})`);
  }
}

/* 3. Carriers. */
section("Every seed's waves carry the same power-ups, the same for every call");
const SEED_SETS = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i)];
for (const n of SEED_SETS) {
  const seed = roomSeed(n);
  let fine = true;
  for (let wave = 1; wave <= 5; wave++) {
    const skip = wave === 1 ? 0 : WAV_ARMOUR_BY_WAVE[Math.min(wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]![0];
    const carry = wavCarriers(seed, wave, skip);
    const slots = carry.map((k, i) => [k, i] as const).filter(([k]) => k >= 0);
    fine &&= carry.length === WAV_X_SHAPES && slots.length === WAV_R11_CARRIERS;
    fine &&= slots.some(([k]) => k === WAV_DROP_SPREAD) && slots.some(([k]) => k === WAV_DROP_SHIELD);
    fine &&= slots.every(([, i]) => i >= skip);
    fine &&= JSON.stringify(carry) === JSON.stringify(wavCarriers(seed, wave, skip));
  }
  ok(fine, `seed #${n}: every wave has one SPREAD and one SHIELD carrier, never armour, the same on every call`);
  const init = game.init(seed) as WavState;
  ok(JSON.stringify(init.carry) === JSON.stringify(wavCarriers(seed, 1)) && init.pickups?.length === 0 && init.r11 === 1, `seed #${n}: wave 1's carriers are in the starting state`);
}

/* 4. Room identity. */
section("Room identity: carriers, drops and the mothership never depend on the play");
interface Seen {
  end: WavState;
  waves: Map<number, string>;
  bad: string[];
  drops: number;
  bossCleared: number[];
}
function play(seed: number, events: ArcadeInputEvent[]): Seen {
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as WavState;
  const waves = new Map<number, string>([[1, `${s.shapes.join("")}|${(s.carry ?? []).join(",")}`]]);
  const bad: string[] = [];
  const bossCleared: number[] = [];
  let drops = 0;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const prev = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if (s.wave !== prev.wave && !s.boss) {
      waves.set(s.wave, `${s.shapes.join("")}|${(s.carry ?? []).join(",")}`);
      const skip = WAV_ARMOUR_BY_WAVE[Math.min(s.wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]![0];
      if (JSON.stringify(s.carry) !== JSON.stringify(wavCarriers(seed, s.wave, skip))) bad.push(`wave ${s.wave}'s carriers are not its seeded ones`);
    }
    if (s.boss && !s.boss.mid && !(prev.boss && !prev.boss.mid)) bossCleared.push(s.wavesCleared);
    if (s.drop) bad.push(`a power-up fell from the top at tick ${s.tick}`);
    // Every new power-up: a saucer's laser on a saucer kill, or the carried kind of a slot that just lost its ship.
    const fresh = (s.pickups ?? []).filter((p) => !(prev.pickups ?? []).some((q) => q.i === p.i));
    // A wave cleared on this tick: every carrier still flying before it was shot down on it.
    const sameWave = s.wave === prev.wave;
    const lost = (prev.carry ?? []).map((k, i) => (k >= 0 && (!sameWave || (s.shapes[i] === 0 && s.carry![i] === -1)) ? k : -1));
    let saucerKills = s.saucers - prev.saucers;
    for (const p of fresh) {
      drops++;
      if (p.k === WAV_DROP_PIERCE && saucerKills > 0) {
        saucerKills--;
        continue;
      }
      const at = lost.findIndex((k) => k === p.k);
      if (at < 0) bad.push(`tick ${s.tick}: a ${p.k} power-up with no carrier or saucer shot`);
      else lost[at] = -1;
    }
    if ((s.pickupsMade ?? 0) - (prev.pickupsMade ?? 0) !== fresh.length) bad.push(`tick ${s.tick}: pickupsMade out of step`);
  }
  return { end: s, waves, bad, drops, bossCleared };
}
let elitesDropped = 0;
let bossesSeen = 0;
for (const n of [0, 3, 7, 10001, 10042]) {
  const seed = roomSeed(n);
  const logs = roomIdentity.logs(seed);
  const runs = logs.map((log) => play(seed, log));
  runs.forEach((r, k) => ok(r.bad.length === 0, `seed #${n} log ${k}: ${r.bad.slice(0, 2).join("; ")}`));
  for (let a = 1; a < runs.length; a++) {
    let same = 0;
    for (const [wave, ships] of runs[a]!.waves)
      for (let b = 0; b < a; b++)
        if (runs[b]!.waves.has(wave)) {
          same++;
          ok(runs[b]!.waves.get(wave) === ships, `seed #${n}: wave ${wave} has the same ships and carriers for logs ${b} and ${a}`);
        }
    ok(same > 0, `seed #${n}: log ${a} shares a wave with an earlier log`);
  }
  for (const r of runs) {
    bossesSeen += r.bossCleared.length;
    ok(r.bossCleared.every((c) => c === wavWaves(r.end) + 1), `seed #${n}: the mothership arrives only after the gunship and five waves are cleared (${r.bossCleared.join(",")})`);
  }
  ok(runs[3]!.end.wave > runs[0]!.end.wave, `seed #${n}: the elite run gets further than the idle one`);
  elitesDropped += runs[3]!.drops;
}
ok(elitesDropped > 0, `elite runs shoot carriers and saucers down and their power-ups fall (${elitesDropped})`);
ok(bossesSeen > 0, `some run reaches the mothership (${bossesSeen})`);
{
  // An idle run never sees the mothership: no arrival on the clock.
  const idle = play(roomSeed(1), []);
  ok(idle.end.boss === null || idle.end.boss === undefined || Boolean(idle.end.boss?.mid), "an idle run never sees the mothership");
  // (The gun fires on its own, so an idle ship still shoots ships down: its power-ups are proved above like any run's.)
  const weakLate = play(roomSeed(2), botLog(roomSeed(2), "weak"));
  ok(weakLate.bossCleared.every((c) => c === 6), "a weak run sees the mothership only after clearing everything before it");
}

/* 5. Rules. */
section("Rules: no streak, carriers, saucer lasers, no early mothership");
const step = (s: WavState, k = 1): WavState => {
  for (let i = 0; i < k; i++) s = game.step(s, null) as WavState;
  return s;
};
const base = game.init(12345) as WavState;
{
  const box = wavShapeBox({ ...base, fy: 84 }, 0);
  let s: WavState = { ...base, enter: 0, fy: 84, carry: base.shapes.map((_, i) => (i === 0 ? WAV_DROP_SPREAD : -1)), fireIn: 99, bolts: [{ x: (box.x + WAV_CELL / 2) * 256, y: (box.y + WAV_CELL + 2) * 256 }] };
  s = step(s);
  ok(s.shapesDown === 1 && (s.streak ?? 0) === 0 && (s.streakPts ?? 0) === 0, "a hit grows no streak and pays no streak points");
  ok(s.pickups!.length === 1 && s.pickups![0]!.k === WAV_DROP_SPREAD && s.carry![0] === -1 && s.pickupsMade === 1, "a carrier shot down drops its power-up");
  ok(s.pickups![0]!.x === (box.x + WAV_CELL / 2) * 256, "…where the ship was");
  const t = step({ ...s, fireIn: 99 }, 30);
  ok(t.pickups![0]!.y > s.pickups![0]!.y, "…and it falls");
  const plain = step({ ...base, enter: 0, fy: 84, carry: base.shapes.map(() => -1), fireIn: 99, bolts: [{ x: (box.x + WAV_CELL / 2) * 256, y: (box.y + WAV_CELL + 2) * 256 }] });
  ok(plain.shapesDown === 1 && plain.pickups!.length === 0, "a ship that carries nothing drops nothing");
}
{
  const s = step({ ...base, enter: 0, fy: 84, saucerDir: 1, saucerX: 100 * 256, fireIn: 99, bolts: [{ x: 102 * 256, y: 60 * 256 }] });
  ok(s.saucers === 1 && s.pickups!.length === 1 && s.pickups![0]!.k === WAV_DROP_PIERCE, "a saucer shot down drops the purple laser");
}
{
  const y = wavShipY(base);
  const c = step({ ...base, enter: 0, fy: 84, pickups: [{ x: base.shipX * 256, y: (y - 4) * 256, k: WAV_DROP_SHIELD, i: 1 }] });
  ok((c.shield ?? 0) > 0 && c.powerups === 1 && c.pickups!.length === 0, "catching a carried shield raises it and counts a power-up");
  const l = step({ ...base, enter: 0, fy: 84, pickups: [{ x: base.shipX * 256, y: (y - 4) * 256, k: WAV_DROP_PIERCE, i: 1 }] });
  ok(l.pierce > 0 && l.powerups === 1, "catching the laser arms the piercing shot");
  const miss = step({ ...base, enter: 0, fy: 84, pickups: [{ x: 30 * 256, y: (WAV_X_H - 1) * 256, k: WAV_DROP_SPREAD, i: 1 }] }, 2);
  ok(miss.pickups!.length === 0 && (miss.powerups ?? 0) === 0, "a power-up that falls past the bottom is gone");
}
{
  let s = base;
  for (let i = 0; i < 2000 && !game.isOver(s); i++) s = step(s);
  ok(!s.drop && (s.dropsSeen ?? 0) === 0, "no planned power-up falls from the top");
}
{
  const late = step({ ...base, enter: 0, fy: 84, wave: 5, tick: WAV_X_BOSS_BY - 1, redIn: 999 } as WavState);
  ok(!late.boss && late.shapes.some((c) => c !== 0) && !late.bossAt, `no mothership at ${WAV_X_BOSS_BY / 60} s while wave 5 still flies`);
  const mid = step({ ...base, enter: 0, wave: 4, shapes: base.shapes.map(() => 0), boss: { x: 147, dir: 1, hp: 9, fireIn: 999, mid: 1, maxHp: 16, guns: [4, 4], at: 0 }, tick: WAV_X_BOSS_BY - 1, redIn: 999 } as WavState);
  ok(Boolean(mid.boss?.mid), "a gunship still flying at that moment stays");
}
{
  const box = wavShapeBox({ ...base, fy: 84 }, 7);
  const y = wavShipY(base);
  // A diver of slot 7 just above the ship, diving straight down onto it.
  void box;
  const d = { cell: 7, t: 0, x: base.shipX * 256, y: (y - 10) * 256, x0: base.shipX * 256, y0: (y - 10) * 256, tx: base.shipX * 256, sway: 0 };
  const s = step({ ...base, enter: 0, fy: 84, carry: base.shapes.map((_, i) => (i === 7 ? WAV_DROP_SHIELD : -1)), divers: [d], invuln: 0, fireIn: 99, redIn: 999 });
  ok(s.rammed === 1 && s.carry![7] === -1 && s.pickups!.length === 0, "a carrier that rams the ship takes its power-up with it");
}

/* 6. Scoring. */
section("Scoring: lifted, monotonic, 200 at the top, nothing for no input");
{
  let prev = -1;
  let lifted = true;
  for (let u = 0; u <= WAV_PAR_X + 5; u++) {
    const p = bandPoints(WAV_V11_BAND_CURVE, u);
    if (p < prev) ok(false, `the base curve falls at ${u}`);
    prev = p;
    if (u <= 300 && p < bandPoints(WAV_V10_BAND_CURVE, u)) lifted = false;
  }
  ok(lifted, "the wavRev 11 base curve is at least wavRev 10's up to 300 units, where wavRev 10 sat flat (scores lifted)");
  ok(bandPoints(WAV_V11_BAND_CURVE, 270) - bandPoints(WAV_V10_BAND_CURVE, 270) >= 20 && bandPoints(WAV_V11_BAND_CURVE, 300) - bandPoints(WAV_V10_BAND_CURVE, 300) >= 15, "…by at least 20 points at 270 units and 15 at 300");
  let prevPay = -1;
  for (let u = 0; u <= 400; u++) {
    const p = bandPoints(WAV_R11_SKILL_PAY, u);
    if (p < prevPay) ok(false, `the skill pay falls at ${u}`);
    prevPay = p;
  }
  ok(bandPoints(WAV_V11_BAND_CURVE, WAV_PAR_X) === 140 && bandPoints(WAV_R11_SKILL_PAY, 1e6) === WAV_X_EDGE_MAX, "the base curve tops at 140 at a perfect run, the skill pay at 50");
  const perfect = { ...base, shapesDown: 180, armourHits: 30, wavesCleared: 6, bossDmg: 52, bossKilled: 1, bossAt: 3000, tick: 3100, powerups: 15, saucers: 5, cannonsDown: 4, weakHits: 13, precise: 60, acted: 1 };
  ok(wavSkillPaidR11(perfect) === 50 && wavefrontBandParts(perfect).points === 140, "a perfect fast run: 140 + 10 + 50");
  ok(game.score(perfect) === 200, "…which is exactly 200");
  ok(wavSkillRawR11({ ...perfect, streakPts: 999 }) === wavSkillRawR11(perfect), "streak points count for nothing");
  ok(game.score({ ...perfect, powerups: 0, saucers: 0, cannonsDown: 0, weakHits: 0, precise: 0 }) === 150, "with no skill points the same run scores 150");
  ok(game.score({ ...base, acted: 0 }) === 0, "no input scores 0");
  const random = [0, 1, 2, 3, 4, 5].map((n) => play(roomSeed(n), randomLog(roomSeed(n))).end).map((s) => game.score(s));
  ok(Math.max(...random) <= 60, `random drags score little (${random.join(", ")})`);
}

/* 7. wavRev 12: the arcade scoring standard (docs/arcade-standard/wavefront.md; arcade-standard-check proves the parts' sum,
 * the perfect runs, played and idle runs and the help). Here: the core's fixed full figure, the saucers a run flies, and
 * each part's rule on built states. */
section("wavRev 12: the core's full figure, five saucers a run, each part's rule");
{
  const g12 = wavefrontGameFor(WAV_REV_STD);
  // The core's full figure from the sim's deterministic waves: five waves of WAV_X_SHAPES, the armour's cells replaced by
  // its hits, six cleared waves (the gunship one) and the gunship's hit points.
  let derived = 0;
  for (let wave = 1; wave <= 5; wave++) {
    derived += WAV_X_SHAPES;
    if (wave >= 2) {
      const [cells, hits] = WAV_ARMOUR_BY_WAVE[Math.min(wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]!;
      derived += hits - cells;
    }
  }
  derived += 6 * 15 + WAV_X_MID_HP;
  ok(WAV_STD_CORE_FULL === derived && WAV_STD_CORE_FULL === WAV_PAR_X - WAV_X_BOSS_HP && WAV_STD_CORE_FULL === 294, `the core is full at ${derived} units, everything before the mothership (${WAV_STD_CORE_FULL})`);
  ok(JSON.stringify(WAV_V12_BAND_CURVE.units) === JSON.stringify([0, WAV_STD_CORE_FULL]) && JSON.stringify(WAV_V12_BAND_CURVE.points) === JSON.stringify([0, 150]), "WAV_V12_BAND_CURVE is one straight line, 0 → 150 at the full figure");
  // Replayed: every recorded perfect run holds exactly the full figure the tick the mothership arrives, and no more after.
  const recorded = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-std-runs.json.gz")).toString()) as { runs: { n: number; seed: number; raw: string }[] };
  for (const r of recorded.runs) {
    const events = decodeWavefrontRun(r.raw)!.events ?? [];
    const byTick = new Map(events.map((e) => [e.t, e]));
    let s = g12.init(r.seed) as WavState;
    let atArrival = -1;
    while (!g12.isOver(s) && s.tick < g12.runTicks) {
      const prev = s;
      s = g12.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
      if (!prev.bossAt && s.bossAt) atArrival = wavStdUnits(s);
    }
    ok(atArrival === WAV_STD_CORE_FULL && wavStdUnits(s) === WAV_STD_CORE_FULL, `perfect run #${r.n}: ${atArrival} units when the mothership arrives, ${wavStdUnits(s)} at the end (the full ${WAV_STD_CORE_FULL})`);
  }
  // Saucers: one every WAV_SAUCER_EVERY ticks while the 90 s clock runs, whatever the play, so a run that lasts the
  // 90 s flies exactly WAV_X_SAUCERS (5, not 6) and a shorter one the saucers due by its end (wavStdSaucersFlown).
  ok(WAV_X_SAUCERS === 5 && Math.trunc((g12.runTicks - 1) / WAV_SAUCER_EVERY) === 5, "the 90 s clock flies 5 saucers (at 15, 30, 45, 60 and 75 s)");
  let lasted = 0;
  let runsSeen = 0;
  for (let n = 0; n < 12; n++) {
    const seed = roomSeed(n);
    for (const log of [[], randomLog(seed), botLog(seed, "weak", WAV_REV_STD), botLog(seed, "near", WAV_REV_STD), botLog(seed, "perfect", WAV_REV_STD)]) {
      const flew = scheduleOf(seed, WAV_REV_STD, log).filter((e) => e.what.startsWith("saucer")).length;
      const byTick = new Map(log.map((e) => [e.t, e]));
      let s = g12.init(seed) as WavState;
      while (!g12.isOver(s) && s.tick < g12.runTicks) s = g12.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
      runsSeen++;
      if (s.tick >= g12.runTicks) lasted++;
      ok(flew === wavStdSaucersFlown(s) && (s.tick < g12.runTicks || flew === WAV_X_SAUCERS), `seed #${n}: a run ending at tick ${s.tick} flew ${flew} saucers (${wavStdSaucersFlown(s)} due)`);
    }
  }
  ok(lasted > 0, `some runs last the 90 s and fly all 5 (${lasted} of ${runsSeen})`);
  // Each part's rule on built states (a run that took everything before the boss).
  const b = g12.init(12345) as WavState;
  const full: WavState = { ...b, acted: 1, shapesDown: 152, armourHits: 36, wavesCleared: 6, bossDmg: WAV_X_MID_HP + WAV_X_BOSS_HP, midKilled: 1, bossKilled: 1, bossAt: 4000, tick: 4000 + 1200, saucers: 5, cannonsDown: 4, coresHit: 3, lives: 3, ended: 1 };
  const parts = (s: WavState) => wavStdScore(s);
  ok(parts(full).core === 150 && g12.score(full) === 200, "every part full: 150 + 10 + 10 + 20 + 10 = 200");
  ok(parts({ ...full, shapesDown: 152 - 1 }).core === Math.floor((150 * 293) / 294) && parts({ ...full, bossDmg: WAV_X_MID_HP }).core === 150, "the core: one ship short costs its share; the mothership's hit points are not core units");
  ok(parts({ ...full, tick: 4000 + 1800 }).features.speed === 5 && parts({ ...full, tick: 4000 + 2400 }).features.speed === 0 && parts({ ...full, tick: 4000 + 600 }).features.speed === 10, "boss speed: 10 within 20 s of its arrival, 5 at 30 s, 0 at 40 s");
  const unkilled: WavState = { ...full, bossKilled: 0, ended: 1, tick: g12.runTicks, bossDmg: WAV_X_MID_HP + WAV_X_BOSS_HP - 1 };
  ok(parts(unkilled).features.boss === 0 && parts(unkilled).features.speed === 0 && g12.score(unkilled) === 180, "the boss standing at the buzzer: no kill and no speed (180)");
  // Saucers: 4 each; a run ended by the boss's kill is credited the saucers its clock would still have flown.
  ok(parts({ ...full, saucers: 3 }).features.saucers === 12, "3 saucers of 5: 12");
  const early: WavState = { ...full, tick: 4400, bossAt: 3500, saucers: 4 };
  ok(wavStdSaucersFlown(early) === 4 && wavStdSaucers(early) === 5 && parts(early).features.saucers === 20, "the boss destroyed at 73 s with all four saucers flown shot: the fifth (75 s) is credited, 20");
  ok(parts({ ...early, saucers: 3 }).features.saucers === 16 && parts({ ...unkilled, tick: g12.runTicks, saucers: 4 }).features.saucers === 16, "…a saucer missed still costs 4; a run not finished by the kill is credited nothing");
  ok(parts({ ...full, ended: 2, bossKilled: 0, lives: 0, tick: 3000, saucers: 3 }).features.saucers === 12, "a run lost early is credited nothing for the saucers still to come");
  // Cannons and weak points: six, equal shares.
  ok(parts({ ...full, cannonsDown: 0, coresHit: 0 }).features.weak === 0 && parts({ ...full, cannonsDown: 2, coresHit: 1 }).features.weak === 5 && parts({ ...full, cannonsDown: 4, coresHit: 2 }).features.weak === 8, "cannons and weak points: 10 × taken ÷ 6 (0, 5 at 3, 8 at 5)");
  // Lives and power-ups.
  ok(g12.score({ ...full, lives: 1 }) === 190 && g12.score({ ...full, powerups: 9 }) === 200, "each life lost costs 5; power-ups pay nothing");
  ok(g12.score({ ...b, acted: 1, lives: 0, ended: 2 }) === 1 && g12.score({ ...b, acted: 0 }) === 0, "anyone who plays scores at least 1; no input scores 0");
  // An open-core hit marks its own boss (the gunship bit 1, the mothership bit 2); older revisions never carry the field.
  const boss = { x: 147, dir: 1, hp: 16, fireIn: 999, mid: 1, maxHp: 16, guns: [0, 0], at: 0 };
  const coreX = 147 + 48;
  const tickOpen = 150 * 40;
  const hitG = g12.step({ ...b, enter: 0, wave: 4, shapes: b.shapes.map(() => 0), boss, tick: tickOpen - 1, redIn: 999, fireIn: 99, bolts: [{ x: coreX * 256, y: (84 + 48 + 4) * 256 }] } as WavState, null) as WavState;
  ok(hitG.weakHits === 1 && hitG.coresHit === 1, "an open-core hit on the gunship marks bit 1");
  const hitB = g12.step({ ...b, enter: 0, wave: 6, shapes: b.shapes.map(() => 0), boss: { ...boss, mid: 0, hp: 36, maxHp: 36, x: 131 }, bossAt: 1, coresHit: 1, tick: tickOpen - 1, redIn: 999, fireIn: 99, bolts: [{ x: (131 + 64) * 256, y: (84 + 48 + 4) * 256 }] } as WavState, null) as WavState;
  ok(hitB.weakHits === 1 && hitB.coresHit === 3, "…and on the mothership bit 2");
  const old = game.step({ ...b, r11: 1, std: undefined, coresHit: undefined, enter: 0, wave: 4, shapes: b.shapes.map(() => 0), boss, tick: tickOpen - 1, redIn: 999, fireIn: 99, bolts: [{ x: coreX * 256, y: (84 + 48 + 4) * 256 }] } as WavState, null) as WavState;
  ok(old.weakHits === 1 && old.coresHit === undefined, "a wavRev 11 state never gains the field");
  const random12 = [0, 1, 2, 3, 4, 5].map((n) => {
    const seed = roomSeed(n);
    const byTick = new Map(randomLog(seed).map((e) => [e.t, e]));
    let s = g12.init(seed) as WavState;
    while (!g12.isOver(s) && s.tick < g12.runTicks) s = g12.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    return g12.score(s);
  });
  console.log(`  wavRev 12: random drags score ${random12.join(", ")}`);
  ok(random12.every((v) => v >= 1 && v < 150), `random drags score at least 1 and well short of a full core (${random12.join(", ")})`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL wavefront-phone-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS wavefront-phone-check: ${checks} checks — rooms deal wavRev 11's play (as wavRev 12), recorded runs replay on 11 and 12, seeded carriers on 260 seeds, room identity, no early mothership, the new rules, the lifted scores and wavRev 12's parts`);
