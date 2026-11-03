/**
 * ink-x200-check (x200, 26 Oct 2026): Rainbow Bridge inkRev 10 — the 390 × 674 world with bounce clouds, wind zones,
 * ink stars, silver coins and a shamrock, every one of them dealt in a fixed number on every seed, scored to 200.
 *
 *   1. Legacy identity: every older revision's starting state (unstamped … inkRev 8) is byte-identical to the code
 *      before the expansion (sha-256 digests recorded on main), and 40 inkRev 8 skill-bot runs recorded on main
 *      replay through the server to the same score, levels, fails and end tick, unflagged.
 *   2. Rooms deal inkRev 10: 390 × 674, its gravity, maximum 200; LIVE_BANDS measures it against inkRev 8.
 *   3. Determinism: the same seed builds the same levels and the same inputs give the same checkpoints.
 *   4. Guaranteed opportunities, on sample seeds: exactly 8 ink stars, 4 clouds, 3 wind zones, 24 silver coins and one
 *      shamrock; per level the reference pots as a phone draws it (holding 3 px either way, never touching a cloud),
 *      the coin never pots unaided, the bonus line takes its star (after a bounce on a cloud level), passes every
 *      silver coin and the shamrock, rides the wind on a wind level, and the live levels pot with a hand-drawn stroke.
 *  4b. No needle levels: on 24 more seeds (8 of them seeds that once dealt one), every level has a line a finger can
 *      draw (static levels: the reference and the bonus line as a phone sends them, holding 3 px either way, every pickup
 *      on the bonus line; live levels: the hand-drawn stroke). scripts/ink-x200-drawable.ts scans thousands of seeds.
 *   5. The perfect-play ceiling reaches 200 through the server replay on sample seeds (scripts/ink-x200-oracle.ts
 *      runs all 260 skill-band seeds for the report).
 *   6. Recorded inkRev 10 runs (scripts/fixtures/ink-x200-runs.json.gz) replay to the same score and state, and the
 *      perfect ones score 200.
 *   7. Rules on hand-built states: the cloud's spring, the wind's push (in the air only), pickups count only once the
 *      coin is potted, level 1's misses cost no fail (level 2's do), three fails end the run.
 *   8. Scoring: the skill pay rises, never passes 50 and pays 50 only for every bonus; scores never pass 200; no input
 *      scores 0; random input scores near 0.
 *   9. Room identity: very different logs (idle, random, a weak bot, an elite bot, the perfect run) see the same dealt
 *      levels and features (scripts/room-identity/inkbridge.ts), and the levels never change in play.
 *  10. Bounds rule: the bounce cloud's art (and its widest squash) sits within 2 px of its capsule; the silver coin and
 *      the shamrock within 2 px of their pickup circles.
 *
 *   bun scripts/ink-x200-check.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas } from "@napi-rs/canvas";
import {
  inkBridgeGameFor,
  inkCheckpoint,
  inkFeaturePaid,
  inkWorldHFor,
  inkX200Proof,
  staticDrawable,
  INK_CLOUD_HW,
  INK_CLOUD_KICK,
  INK_CLOUD_LEVELS,
  INK_CLOUD_R,
  INK_FAILS,
  INK_FEATURE_MAX,
  INK_FEATURE_RAW_MAX,
  INK_INPUT_DROP_AGAIN,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  INK_LEVELS,
  INK_REV_EXPAND,
  INK_REV_SPREAD,
  INK_REV_CLOVER,
  INK_REV_STRICT,
  INK_SHAMROCK_R,
  INK_SILVER_PER_LEVEL,
  INK_SILVER_R,
  INK_TALL_GRAVITY,
  INK_TALL_H,
  INK_V10_SKILL_PAY,
  INK_WIND_LEVELS,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { generateInkBridge, pinInkPreClover } from "../src/lib/duel/arcade.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roomSeed } from "./arcade-skill-bands/games";
import { inkOracleRun } from "./ink-x200-oracle";
import { randomInkLog } from "./ink-x200-bands";
import { roomIdentity } from "./room-identity/inkbridge";
import { playRevOf } from "./scoring-targets-revs";

Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
const { INK_BCLOUD_ART, INK_PICKUP_ART } = await import("../src/lib/arcade/inkBridge.renderer");

const failures: string[] = [];
let checks = 0;
function ok(cond: unknown, message: string): void {
  checks++;
  if (!cond && failures.length < 40) failures.push(message);
}
const section = (name: string) => console.log(`— ${name}`);
const t0 = performance.now();
const game = inkBridgeGameFor(INK_REV_EXPAND);
/** Sample seeds: skill-band seed indices (tuning 0–59, fresh 60–259). */
const SAMPLE = [0, 7, 141, 259].map(roomSeed);
const oracles = new Map<number, ReturnType<typeof inkOracleRun>>();
const oracle = (seed: number) => oracles.get(seed) ?? oracles.set(seed, inkOracleRun(seed)).get(seed)!;

/* 1. Legacy identity. */
section("Legacy identity (unstamped … inkRev 8)");
{
  const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/ink-expand-legacy.json.gz")).toString()) as {
    runs: { rev: number; level: string; seed: number; raw: string; score: number; levels: number; fails: number; tick: number }[];
    initDigests: Record<string, string>;
  };
  for (const [key, digest] of Object.entries(fixture.initDigests)) {
    const [revText, seedText] = key.split(":");
    const rev = revText === "undefined" ? undefined : Number(revText);
    const state = inkBridgeGameFor(rev).init(Number(seedText));
    ok(createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16) === digest, `inkRev ${revText} seed ${seedText}: the starting state changed`);
  }
  for (const run of fixture.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, run.rev);
    ok(!r.flagged && r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick, `inkRev ${run.rev} ${run.level} seed ${run.seed}: replays to ${r.score} (stored ${run.score})`);
  }
  ok(fixture.runs.length === 40 && Object.keys(fixture.initDigests).length === 40, "40 recorded runs and 40 digests");
  console.log(`  ${Object.keys(fixture.initDigests).length} starting states and ${fixture.runs.length} recorded inkRev 8 runs unchanged`);
}

/* 2. Rooms deal inkRev 10. */
section("inkRev 10 (390 × 674, scored to 200); rooms deal inkRev 11 since the phone notes (ink-v11-check)");
{
  const live = LIVE_BANDS.inkbridge as { rev: number; strictRev?: number };
  // inkRev 13 (Nov 2026: clovers, ink par, more birds; ink-v13-check) moved rooms and LIVE_BANDS on: the deal is pinned to
  // the one before it (inkRev 12, inkRev 11's play), and LIVE_BANDS lists inkRev 13, still against inkRev 8.
  const wasInk = pinInkPreClover(true);
  ok(playRevOf("inkbridge", generateInkBridge().inkRev) === INK_REV_SPREAD && INK_REV_EXPAND === 10 && INK_REV_SPREAD === 11 && live.rev === INK_REV_CLOVER && live.strictRev === INK_REV_STRICT, "rooms dealt inkRev 11's play before inkRev 13 (inkRev 10's world, ink-v11-check; inkRev 12 re-scored it on the arcade standard); LIVE_BANDS lists inkRev 13, measured against inkRev 8");
  pinInkPreClover(wasInk);
  ok(roundMaxFor("inkbridge") === 200, "Rainbow Bridge's maximum is 200");
  ok(inkWorldHFor(INK_REV_EXPAND) === INK_TALL_H && INK_TALL_H === 674 && inkWorldHFor(INK_REV_STRICT) === 620 && inkWorldHFor(undefined) === 620, "the world is 674 tall on inkRev 10, 620 before");
  const s = game.init(SAMPLE[0]!);
  ok(s.worldH === INK_TALL_H && s.rev === INK_REV_EXPAND && s.tricks === 0 && s.stars === 0 && s.silver === 0 && s.shamrocks === 0, "the state carries the taller world and the counters");
  ok(s.list.every((l) => l.worldH === INK_TALL_H && l.gravity !== undefined) && s.list.slice(0, 8).every((l) => l.gravity === INK_TALL_GRAVITY), "every level carries the taller world and its gravity");
  ok(inkBridgeGameFor(INK_REV_STRICT).init(SAMPLE[0]!).worldH === undefined, "an inkRev 8 state has no world height of its own");
  ok(game.inputRanges?.[0]?.b?.[1] === INK_TALL_H, "strokes may reach the taller world's bottom");
}

/* 3. Determinism. */
section("Determinism");
{
  const a = JSON.stringify(game.init(SAMPLE[1]!).list);
  const b = JSON.stringify(inkBridgeGameFor(INK_REV_EXPAND).init(SAMPLE[1]!).list);
  ok(a === b, "the same seed builds the same levels");
  const run = oracle(SAMPLE[1]!);
  const replayed = (events: typeof run.events) => {
    let r = game.init(SAMPLE[1]!) as InkState;
    const byTick = new Map(events.map((e) => [e.t, e]));
    const cps: unknown[] = [];
    while (!game.isOver(r) && r.tick < game.runTicks) {
      r = game.step(r, byTick.get(r.tick + 1) ?? null);
      if (r.tick % 300 === 0) cps.push(inkCheckpoint(r));
    }
    return JSON.stringify(cps);
  };
  ok(replayed(run.events) === replayed(run.events), "the same inputs give the same checkpoints");
}

/* 4. Guaranteed opportunities. */
section("Every seed deals the same features, each proved");
for (const seed of SAMPLE) {
  const s = game.init(seed);
  const proof = inkX200Proof(seed);
  const bonus = s.list.slice(0, 8);
  ok(bonus.every((l) => l.star && l.starRef) && s.list.slice(8).every((l) => !l.star && !l.silver && !l.wind && !l.clouds), `seed ${seed}: an ink star on each of levels 1–8, none on the live levels`);
  ok(bonus.filter((l) => l.clouds?.length).length === INK_CLOUD_LEVELS && bonus.filter((l) => l.wind).length === INK_WIND_LEVELS && !bonus.some((l) => l.wind && l.clouds), `seed ${seed}: exactly ${INK_CLOUD_LEVELS} cloud levels and ${INK_WIND_LEVELS} wind levels, never both on one`);
  ok(bonus.every((l) => l.silver?.length === INK_SILVER_PER_LEVEL) && s.list.filter((l) => l.shamrock).length === 1, `seed ${seed}: ${INK_SILVER_PER_LEVEL} silver coins on each of levels 1–8 and one shamrock`);
  ok(s.list.slice(8).every((l) => l.liveHand?.length === 1), `seed ${seed}: each live level has its hand-drawn live stroke`);
  for (const l of proof) {
    const where = `seed ${seed} level ${l.level + 1} (${l.kind})`;
    ok(l.ref, `${where}: the reference pots as a phone draws it (and holds)`);
    ok(!l.unaided, `${where}: the coin never pots unaided`);
    if (l.level < 8) {
      ok(l.bonus, `${where}: the bonus line takes the star${l.kind === "cloud" ? " after a cloud bounce" : ""} and pots`);
      ok(l.silverOnLine === l.silver && l.silver === INK_SILVER_PER_LEVEL, `${where}: the bonus line passes all ${l.silver} silver coins (${l.silverOnLine})`);
      ok(l.shamrock !== false, `${where}: the bonus line passes the shamrock`);
      if (l.kind === "wind") ok((l.windTicks ?? 0) >= 10, `${where}: the bonus line rides the wind (${l.windTicks} ticks)`);
    } else ok(l.hand, `${where}: the hand-drawn live stroke pots (also started 5 ticks late)`);
  }
}
console.log(`  ${SAMPLE.length} seeds: every count fixed, every line proved`);

/* 4b. No needle levels: every level of more seeds has a line a finger can draw (scripts/ink-x200-drawable.ts scans thousands). */
section("No needle levels: a hand-drawable line on every level");
{
  // Skill-band seed indices whose levels were needles before generation re-ran the finished level's proof (a cloud
  // placed after the reference was proved, or a bonus line whose stored release missed its star), then a spread.
  const NEEDLES_BEFORE = [136, 459, 468, 2194, 2214, 2310, 2347, 2452];
  const seeds = [...NEEDLES_BEFORE, ...Array.from({ length: 16 }, (_, i) => 300 + 97 * i)];
  let levels = 0;
  for (const n of seeds)
    for (const l of inkX200Proof(roomSeed(n))) {
      levels++;
      const drawable = l.level < 8 ? staticDrawable(l) : l.ref && l.hand === true && !l.unaided;
      ok(drawable, `seed index ${n} level ${l.level + 1} (${l.kind}): no line a finger can draw (a needle level)`);
    }
  console.log(`  ${levels} levels on ${seeds.length} more seeds (${NEEDLES_BEFORE.length} that once had a needle), each with a phone-drawn line that holds 3 px either way`);
}

/* 5. The ceiling. */
section("The perfect-play ceiling is 200 through the server replay");
for (const seed of SAMPLE.slice(1, 3)) {
  const o = oracle(seed);
  ok(o.replayed === o.score && o.score === 200 && o.levels === INK_LEVELS && o.raw === INK_FEATURE_RAW_MAX, `seed ${seed}: the perfect run scores ${o.replayed} (raw ${o.raw}/${INK_FEATURE_RAW_MAX}, ${o.levels} levels, ${o.endedSeconds.toFixed(1)} s)`);
}

/* 6. Recorded inkRev 10 runs. */
section("Recorded inkRev 10 runs replay unchanged");
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/ink-x200-runs.json.gz")).toString()) as { runs: { who: string; seed: number; raw: string; score: number; levels: number; fails: number; tick: number; checksum: number }[] };
  for (const run of fx.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, INK_REV_EXPAND);
    ok(!r.flagged && r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick && inkCheckpoint(r.state).checksum === run.checksum, `${run.who} seed ${run.seed}: replays to ${r.score} (stored ${run.score})`);
    if (run.who === "perfect") ok(r.score === 200, `the stored perfect run on seed ${run.seed} scores 200 (${r.score})`);
  }
  ok(fx.runs.length >= 14 && fx.runs.some((r) => r.who === "perfect"), "bot runs at four levels and perfect runs recorded");
}

/* 7. Rules on hand-built states. */
section("Rules: the cloud, the wind, pickups, the warm-up level, three fails");
{
  const base = game.init(SAMPLE[2]!);
  const blank = (over: Partial<InkState["list"][number]>, level = 2): InkState => {
    const list = [...base.list];
    list[level] = { ...base.list[level]!, blocks: [], clouds: [], wind: undefined, silver: [], shamrock: undefined, slideAmp: 0, ...over } as InkState["list"][number];
    const sp = list[level]!.spoutX;
    return { ...base, list, level, levels: level, ink: base.ink * 4, ball: { x: sp * 256, y: 50 * 256, vx: 0, vy: 0, on: -1, u: 0, sp: 0, stall: 0 } };
  };
  const release = (s: InkState) => game.step(s, { t: s.tick + 1, k: INK_INPUT_RELEASE, a: 1, b: 0, c: 0, d: 0 });
  // The cloud: a coin falling on it springs back up at the kick speed or more.
  {
    let s = release(blank({ spoutX: 200, clouds: [{ x: 200, y: 300 }] }));
    let up = 0;
    for (let i = 0; i < 200 && !up; i++) {
      s = game.step(s, null);
      if (s.cloudTick === s.tick) up = -s.ball.vy;
    }
    ok(up >= INK_CLOUD_KICK && s.cloudHit === 1, `a coin falling on a cloud springs back up (${up})`);
  }
  // The wind: a coin in the air inside the zone gains its push every tick; outside it, none.
  {
    const wind = { x0: 150, y0: 40, x1: 250, y1: 400, ax: 20 };
    let s = release(blank({ spoutX: 200, wind }));
    const vx0 = s.ball.vx;
    let s2 = game.step(s, null);
    ok(s2.ball.vx - vx0 === 20, `the wind pushes a coin in the air by its strength each tick (${s2.ball.vx - vx0})`);
    let calm = release(blank({ spoutX: 100, wind }));
    calm = game.step(calm, null);
    ok(calm.ball.vx === 0, "no push outside the zone");
    // A coin rolling on a line inside the zone keeps to the line: once it has landed (no wind), the same moment
    // with the wind switched on rolls exactly the same.
    let still = blank({ spoutX: 180 });
    for (const [x, y, c] of [[160, 70, 1], [300, 130, 0]] as const) still = game.step(still, { t: still.tick + 1, k: INK_INPUT_STROKE, a: x, b: y, c, d: 0 });
    still = release(still);
    for (let i = 0; i < 60 && still.ball.on < 0; i++) still = game.step(still, null);
    const list = [...still.list];
    list[still.level] = { ...list[still.level]!, wind: { x0: 0, y0: 0, x1: 390, y1: 674, ax: 26 } };
    let roll: InkState = { ...still, list };
    let same = still.ball.on >= 0;
    let rolled = 0;
    for (let i = 0; i < 30; i++) {
      roll = game.step(roll, null);
      still = game.step(still, null);
      if (still.ball.on >= 0) rolled++;
      if (roll.ball.x !== still.ball.x || roll.ball.y !== still.ball.y || roll.ball.sp !== still.ball.sp) {
        if (still.ball.on >= 0 || roll.ball.on >= 0) same = false;
        break;
      }
    }
    ok(same && rolled >= 10, `a rolling coin is not pushed by the wind (rolled ${rolled} ticks the same)`);
    s2 = s;
  }
  // Pickups count only once the coin is potted: a coin through a silver coin that then misses banks nothing.
  {
    let s = release(blank({ spoutX: 200, silver: [{ x: 200, y: 120 }], shamrock: { x: 200, y: 200 } }, 3));
    for (let i = 0; i < 40; i++) s = game.step(s, null);
    ok(s.silverGot === 1 && s.shamrockGot === 1, "the falling coin picks up the silver coin and the shamrock");
    s = game.step(s, { t: s.tick + 1, k: INK_INPUT_DROP_AGAIN, a: 2, b: 0, c: 0, d: 0 });
    ok(s.silver === 0 && s.shamrocks === 0 && s.silverGot === 0 && s.fails === 1, "a missed drop banks no pickups and costs a fail on level 4");
  }
  // Level 1 is a warm-up: its misses cost no fail; three misses later on end the run.
  {
    let s = game.init(SAMPLE[2]!);
    for (let k = 0; k < 5; k++) {
      s = release(s);
      s = game.step(s, { t: s.tick + 1, k: INK_INPUT_DROP_AGAIN, a: 3 + k, b: 0, c: 0, d: 0 });
    }
    ok(s.fails === 0 && s.level === 0 && !s.ended, `five misses on level 1 cost no fail (${s.fails})`);
    let t = blank({}, 1);
    for (let k = 0; k < INK_FAILS; k++) {
      t = release(t);
      t = game.step(t, { t: t.tick + 1, k: INK_INPUT_DROP_AGAIN, a: 9 + k, b: 0, c: 0, d: 0 });
    }
    ok(t.fails === INK_FAILS && t.ended === 2, "three misses on level 2 end the run");
  }
}

/* 8. Scoring. */
section("Scoring: the skill pay, the 200 cap, no input, random input");
{
  let prev = -1;
  let rises = true;
  for (let raw = 0; raw <= INK_FEATURE_RAW_MAX + 40; raw++) {
    const p = inkFeaturePaid(raw);
    if (p < prev || p > INK_FEATURE_MAX) rises = false;
    if (raw < INK_V10_SKILL_PAY.units[INK_V10_SKILL_PAY.units.length - 1]! && p >= INK_FEATURE_MAX) rises = false;
    prev = p;
  }
  ok(rises && inkFeaturePaid(INK_FEATURE_RAW_MAX) === INK_FEATURE_MAX && inkFeaturePaid(0) === 0, "the skill pay rises, never passes 50 and pays 50 only at its top knot");
  ok(INK_V10_SKILL_PAY.units[INK_V10_SKILL_PAY.units.length - 1]! <= INK_FEATURE_RAW_MAX, "every bonus taken reaches the full 50");
  const s = game.init(SAMPLE[0]!);
  ok(game.score({ ...s, acted: 1, levels: INK_LEVELS, ended: 1, endedTick: 1, tick: 1, stars: 99, tricks: 99, silver: 999, shamrocks: 9 }) === 200, "a perfect run scores exactly 200, whatever the counters say");
  ok(game.score({ ...s, acted: 0 }) === 0, "no input scores 0");
  const randoms = [0, 1, 2, 3, 4, 5].map((n) => {
    const seed = roomSeed(n);
    const ev = randomInkLog(INK_REV_EXPAND, seed);
    let r = game.init(seed) as InkState;
    const byTick = new Map(ev.map((e) => [e.t, e]));
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    return game.score(r);
  });
  ok(Math.max(...randoms) <= 60, `random input stays near 0 (${randoms.join(", ")})`);
}

/* 9. Room identity. */
section("Room identity: different logs see the same dealt run");
for (const seed of SAMPLE.slice(0, 1)) {
  const logs = roomIdentity.logs(seed, INK_REV_EXPAND);
  const lists = logs.map((log) => JSON.stringify(roomIdentity.scheduleOf(seed, INK_REV_EXPAND, log)));
  ok(lists.every((l) => l === lists[0]) && lists[0]!.length > 100, `seed ${seed}: ${logs.length} logs (idle, random, weak, elite, perfect) see the same levels and features`);
  const ends = logs.map((log) => {
    let r = game.init(seed) as InkState;
    const byTick = new Map(log.map((e) => [e.t, e]));
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    return r.levels;
  });
  ok(new Set(ends).size >= 3, `seed ${seed}: the logs really differ (levels reached ${ends.join(", ")})`);
}

/* 10. Bounds rule. */
section("Art on its collision shapes (within 2 px)");
{
  const K = 4;
  const { w, h, paint, widen } = INK_BCLOUD_ART;
  for (const sx of [1, 1 + widen]) {
    const c = createCanvas(Math.ceil(w * K * sx) + 8 * K, h * K);
    const ctx = c.getContext("2d");
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(K * sx, K);
    ctx.translate(-w / 2, -h / 2);
    paint(ctx as unknown as CanvasRenderingContext2D);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let outside = 0;
    let holes = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const px = (x + 0.5 - c.width / 2) / K;
        const py = (y + 0.5 - c.height / 2) / K;
        const d = Math.hypot(Math.max(0, Math.abs(px) - INK_CLOUD_HW), py);
        const a = data[(y * c.width + x) * 4 + 3]!;
        if (a > 8 && d > INK_CLOUD_R + 2) outside++;
        if (sx === 1 && a < 200 && d < INK_CLOUD_R - 1.5) holes++;
      }
    ok(outside === 0, `cloud squash ×${sx.toFixed(2)}: no drawn pixel more than 2 px outside the capsule (${outside})`);
    if (sx === 1) ok(holes === 0, `the cloud fills its capsule (${holes} see-through pixels)`);
  }
  for (const [name, art, r] of [["silver coin", INK_PICKUP_ART.silver, INK_SILVER_R], ["shamrock", INK_PICKUP_ART.shamrock, INK_SHAMROCK_R]] as const) {
    const c = createCanvas((art.w + 8) * K, (art.w + 8) * K);
    const ctx = c.getContext("2d");
    ctx.scale(K, K);
    ctx.translate(4, 4);
    art.paint(ctx as unknown as CanvasRenderingContext2D);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let outside = 0;
    let lit = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const d = Math.hypot((x + 0.5) / K - 4 - r, (y + 0.5) / K - 4 - r);
        const a = data[(y * c.width + x) * 4 + 3]!;
        if (a > 8 && d > r + 2) outside++;
        if (a > 8) lit++;
      }
    ok(outside === 0 && lit > 0, `the ${name} sits within 2 px of its pickup circle (${outside} outside)`);
  }
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL ink-x200-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ink-x200-check: ${checks} checks in ${((performance.now() - t0) / 1000).toFixed(1)} s — legacy identity, inkRev 10 kept (rooms deal inkRev 11), fixed and proved features, a 200 ceiling and recorded runs through the server replay, the rules, the scoring, room identity, the art's bounds`);
