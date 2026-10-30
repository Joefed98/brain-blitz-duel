/**
 * Jaywalk x200 check (crossRev 9, 26 Oct 2026; docs/expansions/x200-cross.md; ported from the parked
 * Expansion E1's crossRev 8, never dealt). Proves:
 *  1. Legacy identity: crossRev 3 and 7 bot runs recorded on main before the expansion
 *     (fixtures/cross-expand-legacy.json.gz) replay through the server to the same score and final
 *     state, unflagged (so their checkpoints still match), and old states never gain a new field;
 *     every older revision still lays out nine lanes and no coins.
 *  2. crossRev 9 runs (fixtures/cross-expand-runs.json.gz) replay to the same score and state;
 *     courses and runs are deterministic; the phone's sim score equals the server replay's; rooms deal
 *     crossRev 9.
 *  3. Courses: 14 rows with the island at row 7, buses from crossing 2 and motorbikes from 3, every
 *     crossing proved passable (and fair on 1-2); exactly CROSS_X_COINS_PER_RUN coins a run (four on
 *     each of crossings 1-5, none later) in the fastest lanes, off the middle, each on a column the
 *     lane below leaves open.
 *  4. Features: a coin is collected exactly when the walker stands on its cell; reaching the island
 *     banks it and a later hit in that crossing restarts there; the streak pays 1 x (multiplier - 1)
 *     for each crossing without a hit (x1...x4) and a hit ends it; a scripted run collects a coin.
 *  5. Bounds: buses and motorbikes are drawn within 2 px of their collision boxes.
 *  6. Scores: never above 200; the play part never above 150 and the skill pay never above 50, on
 *     CROSS_V9_SKILL_PAY; no input scores 0.
 *  7. The arcade rule's ceiling: on sampled seeds (CROSS_X200_CEILING_SEEDS, default 6; the report ran all
 *     260) an oracle (scripts/cross-ceiling.ts) takes every coin and crosses without a hit, and its log
 *     scores 200 through the server replay.
 *  8. Room identity: idle, random, weak-bot and elite-bot logs on one seed meet the identical seeded
 *     courses and coins on every crossing both reached (scripts/room-identity/cross.ts).
 *  9. Random swipes at a human-ish rate score next to nothing.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import {
  crossBandParts,
  crossBlocked,
  crossBonusOf,
  crossClosed,
  crossPlayerHalfFp,
  crossSkillRaw,
  CROSS_V9_BAND_CURVE,
  CROSS_V9_SKILL_PAY,
  CROSS_X_COIN_CROSSINGS,
  CROSS_X_CLOSE_MAX,
  CROSS_X_CLOSE_POINTS,
  CROSS_X_CLOSE_TICKS,
  CROSS_X_COINS_PER_RUN,
  crossColumnCentreFp,
  crossCourse,
  crossFairPassable,
  crossGameFor,
  crossMultiplierFor,
  crossPassable,
  CROSS_COURSES,
  CROSS_FAIR_COURSES,
  CROSS_INPUT_MOVE,
  CROSS_KIND_BUS,
  CROSS_KIND_ISLAND,
  CROSS_KIND_MOTO,
  CROSS_KIND_ROADWORKS,
  CROSS_REV_EXPAND,
  CROSS_REV_STD,
  CROSS_REV_STRICT,
  CROSS_X_BONUS_MAX,
  CROSS_X_BUS_FROM,
  CROSS_X_COIN_POINTS,
  CROSS_X_ISLAND,
  CROSS_X_MOTO_FROM,
  CROSS_X_ROWS,
  CROSS_X_SEARCH_TICKS,
  CROSS_X_STREAK_POINTS,
  CROSS_X_WORLD_H,
  type CrossState,
} from "../src/lib/arcade/cross";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { decodeCrossRun, replayCrossRun } from "../src/lib/duel/cross";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { crossStateDigest, playCrossRun, type CrossFixtureRun } from "./cross-expand-record";
import { crossCeilingRun, crossingPath } from "./cross-ceiling";
import { botLog, randomLog, roomIdentity, uniformLog } from "./room-identity/cross";
import { generateCross } from "../src/lib/duel/arcade.server";
import { bandPoints, bandTop } from "../src/lib/arcade/scoreBands";
import { roomSeed } from "./arcade-skill-bands/games";

let passes = 0;
let ceilingMin = 0;
let randomLine = "";
const failures: string[] = [];
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 40) failures.push(message);
}
const load = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString()) as CrossFixtureRun[];
const NEW_FIELDS = ["wide", "coins", "coinTotal", "streak", "streakPts", "banked", "closeCalls", "closeLanes"];

/* 1. Legacy identity. */
const legacy = load("scripts/fixtures/cross-expand-legacy.json.gz");
ok(legacy.length >= 40 && legacy.some((r) => r.rev === 3) && legacy.some((r) => r.rev === CROSS_REV_STRICT), `legacy fixture holds crossRev 3 and 7 runs (${legacy.length})`);
for (const r of legacy) {
  const out = replayCrossRun(r.seed, r.raw, r.rev);
  ok(out.score === r.score && !out.flagged && out.desyncTick === null, `legacy rev ${r.rev} ${r.level} seed ${r.seed}: score ${out.score} (stored ${r.score}), flagged ${out.flagged}`);
  ok(crossStateDigest(out.state) === r.digest, `legacy rev ${r.rev} ${r.level} seed ${r.seed}: final state differs`);
  ok(NEW_FIELDS.every((k) => !(k in out.state)), `legacy rev ${r.rev} seed ${r.seed}: an old state gained a crossRev 9 field`);
}
for (const rev of [undefined, 2, 3, 4, 5, 6, 7]) {
  const s = crossGameFor(rev).init(roomSeed(3)) as CrossState;
  ok(s.courses.every((c) => c.lanes.length === 9 && !c.coins), `crossRev ${rev ?? "none"}: still nine lanes and no coins`);
}

/* 2. crossRev 9 runs: fixture identity, determinism, server = phone. */
const runs = load("scripts/fixtures/cross-expand-runs.json.gz");
ok(runs.length >= 24 && runs.every((r) => r.rev === CROSS_REV_EXPAND), `crossRev 9 fixture holds ${runs.length} runs`);
for (const r of runs) {
  const out = replayCrossRun(r.seed, r.raw, CROSS_REV_EXPAND);
  ok(out.score === r.score && !out.flagged && crossStateDigest(out.state) === r.digest, `crossRev 9 ${r.level} seed ${r.seed}: replay ${out.score} vs stored ${r.score}, flagged ${out.flagged}`);
}
const game = crossGameFor(CROSS_REV_EXPAND);
{
  const a = game.init(roomSeed(11)) as CrossState;
  const b = game.init(roomSeed(11)) as CrossState;
  ok(JSON.stringify(a) === JSON.stringify(b), "crossRev 9 init is deterministic");
  const one = playCrossRun(CROSS_REV_EXPAND, roomSeed(12), "great", true);
  const two = playCrossRun(CROSS_REV_EXPAND, roomSeed(12), "great", true);
  ok(one.raw === two.raw && one.score === two.score && one.digest === two.digest, "crossRev 9 runs are deterministic");
  const server = replayCrossRun(one.seed, one.raw, CROSS_REV_EXPAND);
  ok(server.score === one.score && !server.flagged, `server replay = phone sim on crossRev 9 (${server.score} vs ${one.score})`);
  const tampered = one.raw.replace(/^(\d+)\|(\d+)/, (_, seed, score) => `${seed}|${Number(score) + 1}`);
  ok(replayCrossRun(one.seed, tampered, CROSS_REV_EXPAND).flagged, "a claimed score the replay does not give is flagged");
  ok(a.wide === 1 && a.tunef === 1 && a.band === 3 && a.rev === CROSS_REV_EXPAND, "crossRev 9 states carry wide, tunef, band 3 and rev 9");
}

/* 3. Courses. */
for (let n = 0; n < 6; n++) {
  const s = game.init(roomSeed(40 + n)) as CrossState;
  ok(s.courses.length === CROSS_COURSES, "ten crossings laid out");
  s.courses.forEach((course, index) => {
    const tag = `seed ${roomSeed(40 + n)} crossing ${index + 1}`;
    ok(course.lanes.length === CROSS_X_ROWS && course.lanes[CROSS_X_ISLAND - 1]?.kind === CROSS_KIND_ISLAND, `${tag}: 14 rows, the island at row 7`);
    ok(course.lanes.filter((l) => l.kind === CROSS_KIND_ISLAND).length === 1, `${tag}: one island`);
    const buses = course.lanes.filter((l) => l.kind === CROSS_KIND_BUS);
    const motos = course.lanes.filter((l) => l.kind === CROSS_KIND_MOTO);
    ok(index >= CROSS_X_BUS_FROM ? buses.length >= 1 : buses.length === 0, `${tag}: buses from crossing 2 (${buses.length})`);
    ok(index >= CROSS_X_MOTO_FROM ? motos.length >= 1 : motos.length === 0, `${tag}: motorbikes from crossing 3 (${motos.length})`);
    const cars = course.lanes.filter((l) => !l.kind);
    const fastestCar = Math.max(...cars.map((l) => l.speed));
    for (const b of buses) ok(b.blockW >= 34_816 && b.blockW > Math.max(...cars.map((l) => l.blockW)) && b.speed > 0, `${tag}: a bus is longer than every car`);
    for (const m of motos) ok(m.speed > fastestCar && (m.offsets?.length ?? 0) === 2 && m.blockW < 11_264, `${tag}: a motorbike is narrow, sparse and faster than every car`);
    const coins = course.coins ?? [];
    ok(coins.length === (index < CROSS_X_COIN_CROSSINGS ? 4 : 0), `${tag}: ${index < CROSS_X_COIN_CROSSINGS ? "four coins" : "no coins"} (${coins.length})`);
    for (const cell of coins) {
      const lane = cell >> 4;
      const col = cell & 15;
      const kind = course.lanes[lane - 1]?.kind;
      ok(lane >= 1 && lane <= CROSS_X_ROWS && kind !== CROSS_KIND_ISLAND && kind !== CROSS_KIND_ROADWORKS, `${tag}: a coin sits in a traffic lane (${lane})`);
      ok([1, 2, 10, 11].includes(col), `${tag}: a coin sits off the middle (column ${col})`);
      ok(!crossClosed(course, lane - 1, col), `${tag}: the lane below a coin leaves its column open`);
    }
    if (coins.length) ok(coins.filter((c) => c >> 4 < CROSS_X_ISLAND).length === 2 && coins.filter((c) => c >> 4 > CROSS_X_ISLAND).length === 2, `${tag}: two coins each side of the island`);
    ok(crossPassable(course, CROSS_X_SEARCH_TICKS), `${tag}: proved passable`);
    if (index < CROSS_FAIR_COURSES) ok(crossFairPassable(course, CROSS_X_SEARCH_TICKS), `${tag}: fair (up-only walker)`);
  });
}

// One density schedule: crossing k's car lanes have the same speeds, lengths and gaps on every seed (only which lane
// gets which, directions and phases differ), when the crossing has the same number of car lanes.
{
  const sig = new Map<string, string>();
  let compared = 0;
  for (let n = 0; n < 40; n++) {
    const s = game.init(roomSeed(n)) as CrossState;
    s.courses.forEach((course, index) => {
      const cars = course.lanes.filter((l) => !l.kind);
      const key = `${index}:${cars.length}`;
      const shape = JSON.stringify([cars.map((l) => l.speed).sort((x, y) => x - y), cars.map((l) => l.blockW).sort((x, y) => x - y), cars.map((l) => l.period - l.blockW).sort((x, y) => x - y)]);
      const seen = sig.get(key);
      if (seen === undefined) sig.set(key, shape);
      else {
        compared++;
        ok(seen === shape, `crossing ${index + 1} (${cars.length} car lanes): the same speeds, lengths and gaps on every seed`);
      }
    });
  }
  ok(compared >= 200, `the density schedule compared on ${compared} crossings`);
}

// Exactly CROSS_X_COINS_PER_RUN coins on every run (60 room seeds): the seed decides where, never how many.
{
  let worst = Infinity;
  let most = 0;
  for (let n = 0; n < 60; n++) {
    const s = game.init(roomSeed(n)) as CrossState;
    const total = s.courses.reduce((a, c) => a + (c.coins?.length ?? 0), 0);
    worst = Math.min(worst, total);
    most = Math.max(most, total);
  }
  ok(worst === CROSS_X_COINS_PER_RUN && most === CROSS_X_COINS_PER_RUN && CROSS_X_COINS_PER_RUN === 20, `every run holds exactly ${CROSS_X_COINS_PER_RUN} coins (${worst}-${most} on 60 seeds)`);
  // The arcade scoring standard (29 Oct 2026) moved rooms on to crossRev 10 (crossRev 9's courses, busier crossing by
  // crossing, scored on the standard); arcade-standard-check covers it, and crossRev 9 replays as before here.
  ok(generateCross().crossRev === CROSS_REV_STD, "rooms deal crossRev 10, the standard's revision on crossRev 9's world");
}

/* 4. Features through every recorded and fresh run, tick by tick. */
let coinsSeen = 0;
let islandRespawns = 0;
let startRespawns = 0;
let streakPays = 0;
let streakEnds = 0;
let closeSeen = 0;
const fresh = ["average", "good", "great", "near"].flatMap((level) => [0, 1, 2].map((n) => playCrossRun(CROSS_REV_EXPAND, roomSeed(70 + n), level as never, true)));
for (const r of [...runs, ...fresh]) {
  const events = new Map(decodeCrossRun(r.raw).events.map((e) => [e.t, e]));
  let s = game.init(r.seed) as CrossState;
  while (!game.isOver(s)) {
    const prev = s;
    s = game.step(s, events.get(s.tick + 1) ?? null);
    const course = crossCourse(s);
    if ((s.coinTotal ?? 0) > (prev.coinTotal ?? 0)) {
      coinsSeen++;
      const at = (course.coins ?? []).indexOf(s.lane * 16 + s.col);
      ok(s.coinTotal === (prev.coinTotal ?? 0) + 1 && at >= 0 && ((s.coins ?? 0) & (1 << at)) !== 0 && !((prev.coins ?? 0) & (1 << at)) && s.hop === 0, `seed ${r.seed} tick ${s.tick}: a coin counted off its cell`);
    }
    if (s.lives < prev.lives && !s.dead) {
      if (prev.banked) {
        islandRespawns++;
        ok(s.lane === CROSS_X_ISLAND && s.banked === 1, `seed ${r.seed} tick ${s.tick}: a hit after the island restarts there (lane ${s.lane})`);
      } else {
        startRespawns++;
        ok(s.lane === 0, `seed ${r.seed} tick ${s.tick}: a hit before the island restarts on the pavement`);
      }
      ok(s.streak === 0, `seed ${r.seed} tick ${s.tick}: a hit ends the streak`);
      if ((prev.streak ?? 0) > 0) streakEnds++;
    }
    if (s.crossings > prev.crossings) {
      ok(s.coins === 0 && s.banked === 0, `seed ${r.seed} tick ${s.tick}: a new crossing starts with fresh coins and no island`);
      if (!prev.hitThisCrossing) {
        const pay = CROSS_X_STREAK_POINTS * (crossMultiplierFor(s.streak ?? 0) - 1);
        ok(s.streak === (prev.streak ?? 0) + 1 && s.streakPts === (prev.streakPts ?? 0) + pay, `seed ${r.seed} tick ${s.tick}: the streak pays ${pay}`);
        if (pay > 0) streakPays++;
      } else ok(s.streak === 0 && s.streakPts === prev.streakPts, `seed ${r.seed} tick ${s.tick}: a crossing with a hit pays no streak`);
    }
    if (s.lane === CROSS_X_ISLAND && s.hop === 0 && !s.dead) ok(s.banked === 1, `seed ${r.seed} tick ${s.tick}: standing on the island banks it`);
    // A close call: counted only on the tick a forward hop lands in a traffic lane, unhit, with a vehicle over that
    // column within the last CROSS_X_CLOSE_TICKS ticks; once per lane a crossing.
    if (s.crossings === prev.crossings) {
      const landedHere = prev.hop === 1 && s.hop === 0 && s.lane === prev.lane + 1 && s.lives === prev.lives && s.lane >= 1 && s.lane <= CROSS_X_ROWS;
      const laneDef = course.lanes[s.lane - 1];
      let passed = false;
      if (landedHere && laneDef && laneDef.kind !== CROSS_KIND_ROADWORKS && laneDef.kind !== CROSS_KIND_ISLAND)
        for (let k = 1; k <= CROSS_X_CLOSE_TICKS && !passed; k++) passed = crossBlocked(laneDef, crossColumnCentreFp(s.col), s.tick - s.crossStart - k, crossPlayerHalfFp(s));
      const fresh = !((prev.closeLanes ?? 0) & (1 << s.lane));
      const want = (prev.closeCalls ?? 0) + (passed && fresh ? 1 : 0);
      ok((s.closeCalls ?? 0) === want, `seed ${r.seed} tick ${s.tick}: close calls ${s.closeCalls} (expected ${want})`);
      if (want > (prev.closeCalls ?? 0)) closeSeen++;
    }
  }
  const parts = crossBandParts(s);
  ok(parts.points <= 150 && parts.bonus <= CROSS_X_BONUS_MAX && game.score(s) <= 200, `seed ${r.seed}: play part ${parts.points} ≤ 150, bonus ${parts.bonus} ≤ 50, score ≤ 200`);
  ok(game.score(s) === Math.min(200, parts.points + crossBonusOf(s)), `seed ${r.seed}: score = play part + bonus`);
}
ok(coinsSeen >= 20, `coins were collected in the runs (${coinsSeen})`);
ok(islandRespawns >= 3 && startRespawns >= 3, `hits restarted on the island (${islandRespawns}) and on the pavement (${startRespawns})`);
ok(streakPays >= 10 && streakEnds >= 1, `the streak paid (${streakPays}) and was ended by hits (${streakEnds})`);
ok(closeSeen >= 10, `close calls were made in the runs (${closeSeen})`);
ok(crossSkillRaw({ coinTotal: 0, streakPts: 0, closeCalls: 90 }) === CROSS_X_CLOSE_MAX && crossSkillRaw({ coinTotal: 1, streakPts: 2, closeCalls: 3 }) === 3 + 2 + 3, `close calls add ${CROSS_X_CLOSE_POINTS} skill point each, at most ${CROSS_X_CLOSE_MAX} a run`);
ok(crossMultiplierFor(1) === 1 && crossMultiplierFor(2) === 2 && crossMultiplierFor(3) === 3 && crossMultiplierFor(4) === 4 && crossMultiplierFor(9) === 4, "the multiplier runs ×1, ×2, ×3, ×4");

// A scripted walker (the oracle's path for one coin, scripts/cross-ceiling.ts): on three seeds, each coin of the
// first crossing on its own is taken by a log that walks to it, counted once, as 3 skill points.
for (const n of [5, 17, 61]) {
  const seed = roomSeed(n);
  const init = game.init(seed) as CrossState;
  const course = crossCourse(init);
  (course.coins ?? []).forEach((cell, bit) => {
    const path = crossingPath(course, crossPlayerHalfFp(init), 1, 1500, 1 << bit);
    const byTick = new Map(path.steps.map((st) => [st.rel, { t: st.rel, k: CROSS_INPUT_MOVE, a: st.a, b: 0, c: 0, d: 0 }]));
    let s = init;
    while (!game.isOver(s) && s.crossings === 0) s = game.step(s, byTick.get(s.tick + 1) ?? null);
    // One coin is 3 skill points (paid on CROSS_V9_SKILL_PAY's rising scale).
    ok(path.finished && s.crossings === 1 && ((s.coins ?? 0) === 0) && (s.coinTotal ?? 0) >= 1 && crossSkillRaw({ coinTotal: 1, streakPts: 0 }) === CROSS_X_COIN_POINTS && game.score(s) === bandPoints(CROSS_V9_BAND_CURVE, crossBandParts(s).units) + crossBonusOf(s), `seed ${seed}: a walker takes the coin at lane ${cell >> 4} column ${cell & 15} and crosses (coins ${s.coinTotal}, lives ${s.lives})`);
  });
}

/* 5. Bounds: buses and motorbikes drawn within 2 px of their boxes. */
{
  Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 1 } });
  if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
  const { drawBus, drawMotorbike } = await import("../src/lib/arcade/cross.renderer");
  const outside = (draw: (ctx: CanvasRenderingContext2D) => void, x: number, y: number, w: number, h: number) => {
    const canvas = createCanvas(400, 120);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    draw(ctx);
    const data = canvas.getContext("2d").getImageData(0, 0, 400, 120).data;
    let worst = 0;
    let painted = 0;
    for (let py = 0; py < 120; py++)
      for (let pxl = 0; pxl < 400; pxl++) {
        if (data[(py * 400 + pxl) * 4 + 3]! < 24) continue;
        painted++;
        const dx = Math.max(x - (pxl + 1), pxl - (x + w), 0);
        const dy = Math.max(y - (py + 1), py - (y + h), 0);
        worst = Math.max(worst, dx, dy);
      }
    // Nothing drawn would pass trivially: a vehicle covers a good share of its box.
    return painted >= w * h * 0.25 ? worst : 99;
  };
  for (const w of [136, 150, 168]) for (const dir of [1, -1]) {
    const worst = outside((ctx) => drawBus(ctx, 40, 30, w, 32, dir, "#D7322B"), 40, 30, w, 32);
    ok(worst <= 2, `a ${w} px bus (dir ${dir}) is drawn within 2 px of its box (${worst} px out)`);
  }
  for (const w of [36, 40, 43]) for (const dir of [1, -1]) {
    const worst = outside((ctx) => drawMotorbike(ctx, 60, 30, w, 32, dir, "#F25C54"), 60, 30, w, 32);
    ok(worst <= 2, `a ${w} px motorbike (dir ${dir}) is drawn within 2 px of its box (${worst} px out)`);
  }
}

/* 6. The maximum: 150 of play, 50 of skill pay. */
{
  const base = game.init(roomSeed(1)) as CrossState;
  const full = { ...base, acted: 1, crossings: 9, reached: 0 } as CrossState;
  const top = bandTop(CROSS_V9_SKILL_PAY);
  ok(game.score(full) === 150, `a long run with no coins or streak tops out at 150 (${game.score(full)})`);
  ok(game.score({ ...full, crossings: 5, reached: 0, coinTotal: 20, streakPts: 30 }) === 200, `the skill cap never binds below 200: ${bandPoints(CROSS_V9_BAND_CURVE, 5 * 16)} of play and every coin with a long streak make 200 (${game.score({ ...full, crossings: 5, reached: 0, coinTotal: 20, streakPts: 30 })})`);
  ok(crossSkillRaw({ coinTotal: 20, streakPts: 9 }) === 69, "skill points: 3 a coin plus the streak points");
  ok(game.score({ ...full, coinTotal: 20, streakPts: top - 60 }) === 200, `150 of play and ${top} skill points (every coin and a streak) is 200`);
  ok(game.score({ ...full, coinTotal: 20, streakPts: 60 }) === 200, "the skill pay is capped at 50 and the score at 200");
  ok(crossBonusOf({ coinTotal: 20, streakPts: top - 61 }) < CROSS_X_BONUS_MAX, "one skill point short of the top knot pays less than 50");
  let prev = -1;
  let rising = true;
  for (let raw = 0; raw <= top + 5; raw++) {
    const pay = bandPoints(CROSS_V9_SKILL_PAY, raw);
    if (pay < prev || pay > CROSS_X_BONUS_MAX) rising = false;
    prev = pay;
  }
  ok(rising, "the skill pay never falls as skill points rise, and never passes 50");
  ok(bandPoints(CROSS_V9_SKILL_PAY, 15) <= 8, `a few coins pay little (15 skill points pay ${bandPoints(CROSS_V9_SKILL_PAY, 15)})`);
  ok(game.score({ ...base, coinTotal: 5 }) === 0, "no input scores 0");
  ok(roundMaxFor("cross") === 200, "Jaywalk's round maximum is 200");
  ok(runs.some((r) => r.level === "oracle" && r.score === 200 && replayCrossRun(r.seed, r.raw, CROSS_REV_EXPAND).score === 200), "a stored crossRev 9 run reaches 200 through the server replay (the perfect-play oracle's)");
  for (const r of runs) {
    const st = replayCrossRun(r.seed, r.raw, CROSS_REV_EXPAND).state;
    if (r.score >= 190) ok(crossBonusOf(st) >= 40, `seed ${r.seed}: ${r.score} needed the features (bonus ${crossBonusOf(st)})`);
  }
  ok(CROSS_X_WORLD_H === 727, "the world is 390x727");
}

/* 7. The ceiling: an oracle takes every coin and reaches 200 through the server replay. */
{
  const count = Number(process.env.CROSS_X200_CEILING_SEEDS ?? 6);
  let min = Infinity;
  for (let k = 0; k < count; k++) {
    const index = k < count / 2 ? k * 7 : 60 + k * 31;
    const r = crossCeilingRun(roomSeed(index));
    min = Math.min(min, r.score);
    ok(r.score === 200 && !r.flagged && r.coins === CROSS_X_COINS_PER_RUN && r.coins === r.coinsOffered, `seed index ${index}: the perfect-play ceiling reaches 200 through the server replay (${r.score}, coins ${r.coins}/${r.coinsOffered}, ${r.crossings} crossings)`);
    ok(bandPoints(CROSS_V9_SKILL_PAY, crossSkillRaw({ coinTotal: r.coins, streakPts: r.streakPts })) >= 50, `seed index ${index}: perfect play earns the 50 of skill pay that 150 of play needs, without a close call`);
  }
  ceilingMin = min;
}

/* 8. Room identity: very different logs on one seed meet the same seeded courses and coins. */
for (const n of [3, 77]) {
  const seed = roomSeed(n);
  // crossRev 9 logs (roomIdentity.logs plays the bots on the revision rooms deal, crossRev 10 since the standard).
  const logs = [[], randomLog(seed), botLog(seed, "weak", CROSS_REV_EXPAND), botLog(seed, "elite", CROSS_REV_EXPAND)];
  const lists = logs.map((log) => roomIdentity.scheduleOf(seed, CROSS_REV_EXPAND, log));
  const reached = lists.map((l) => l.length);
  ok(Math.max(...reached) >= 3 && Math.min(...reached) >= 1 && new Set(reached).size >= 2, `seed ${seed}: the logs reach different crossings (${reached.join(", ")})`);
  const longest = lists.reduce((best, l) => (l.length > best.length ? l : best));
  for (let i = 0; i < lists.length; i++)
    ok(JSON.stringify(lists[i]) === JSON.stringify(longest.slice(0, lists[i]!.length)), `seed ${seed}: log ${i} meets the same courses and coins as the others on every crossing both reached`);
}

/* 9. Random input: uniformly random swipes at a human-ish rate score next to nothing. */
{
  const scores: number[] = [];
  for (let n = 0; n < 20; n++) {
    const seed = roomSeed(200 + n);
    const log = uniformLog(seed);
    const byTick = new Map(log.map((e) => [e.t, e]));
    let s = game.init(seed) as CrossState;
    while (!game.isOver(s)) s = game.step(s, byTick.get(s.tick + 1) ?? null);
    scores.push(game.score(s));
  }
  scores.sort((x, y) => x - y);
  randomLine = `random swipes: median ${scores[10]}, max ${scores[19]}`;
  ok(scores[10]! <= 40, `${randomLine} (stays near 0)`);
}

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL cross-x200-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS cross-x200-check: ${passes} checks — legacy crossRev 3/7 identity, crossRev 9 replay and determinism, courses, 20 coins a run, island, streak, bounds, the skill pay, the ceiling (min ${ceilingMin}), room identity, ${randomLine} (${coinsSeen} coins, ${islandRespawns} island restarts, ${streakPays} streak pays)`);
