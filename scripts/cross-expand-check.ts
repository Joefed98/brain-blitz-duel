/**
 * Jaywalk expansion check (crossRev 8, 25 Oct 2026; Expansion E1). Proves:
 *  1. Legacy identity: crossRev 3 and 7 bot runs recorded on main before crossRev 8
 *     (fixtures/cross-expand-legacy.json.gz) replay through the server to the same score and final
 *     state, unflagged (so their checkpoints still match), and old states never gain a new field.
 *  2. crossRev 8 runs (fixtures/cross-expand-runs.json.gz) replay to the same score and state;
 *     courses and runs are deterministic; the phone's sim score equals the server replay's.
 *  3. Courses: 14 rows with the island at row 7, buses from crossing 2 and motorbikes from 3, four
 *     coins in the fastest lanes off the middle, every crossing proved passable (and fair on 1–2).
 *  4. Features: a coin is collected exactly when the walker stands on its cell; reaching the island
 *     banks it and a later hit in that crossing restarts there; the streak pays 2 × (multiplier − 1)
 *     for each crossing without a hit (×1…×4) and a hit ends it; a scripted run collects a coin.
 *  5. Bounds: buses and motorbikes are drawn within 2 px of their collision boxes.
 *  6. Scores: never above 200; the play part never above 150, so 200 needs the full 50 bonus; the
 *     near-perfect bot reaches 190+ only with the features.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import {
  crossBandParts,
  crossBlocked,
  crossBonusOf,
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
import { roomSeed } from "./arcade-skill-bands/games";

let passes = 0;
const failures: string[] = [];
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 40) failures.push(message);
}
const load = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString()) as CrossFixtureRun[];
const NEW_FIELDS = ["wide", "coins", "coinTotal", "streak", "streakPts", "banked"];

/* 1. Legacy identity. */
const legacy = load("scripts/fixtures/cross-expand-legacy.json.gz");
ok(legacy.length >= 40 && legacy.some((r) => r.rev === 3) && legacy.some((r) => r.rev === CROSS_REV_STRICT), `legacy fixture holds crossRev 3 and 7 runs (${legacy.length})`);
for (const r of legacy) {
  const out = replayCrossRun(r.seed, r.raw, r.rev);
  ok(out.score === r.score && !out.flagged && out.desyncTick === null, `legacy rev ${r.rev} ${r.level} seed ${r.seed}: score ${out.score} (stored ${r.score}), flagged ${out.flagged}`);
  ok(crossStateDigest(out.state) === r.digest, `legacy rev ${r.rev} ${r.level} seed ${r.seed}: final state differs`);
  ok(NEW_FIELDS.every((k) => !(k in out.state)), `legacy rev ${r.rev} seed ${r.seed}: an old state gained a crossRev 8 field`);
}
for (const rev of [undefined, 2, 3, 4, 5, 6, 7]) {
  const s = crossGameFor(rev).init(roomSeed(3)) as CrossState;
  ok(s.courses.every((c) => c.lanes.length === 9 && !c.coins), `crossRev ${rev ?? "none"}: still nine lanes and no coins`);
}

/* 2. crossRev 8 runs: fixture identity, determinism, server = phone. */
const runs = load("scripts/fixtures/cross-expand-runs.json.gz");
ok(runs.length >= 24 && runs.every((r) => r.rev === CROSS_REV_EXPAND), `crossRev 8 fixture holds ${runs.length} runs`);
for (const r of runs) {
  const out = replayCrossRun(r.seed, r.raw, CROSS_REV_EXPAND);
  ok(out.score === r.score && !out.flagged && crossStateDigest(out.state) === r.digest, `crossRev 8 ${r.level} seed ${r.seed}: replay ${out.score} vs stored ${r.score}, flagged ${out.flagged}`);
}
const game = crossGameFor(CROSS_REV_EXPAND);
{
  const a = game.init(roomSeed(11)) as CrossState;
  const b = game.init(roomSeed(11)) as CrossState;
  ok(JSON.stringify(a) === JSON.stringify(b), "crossRev 8 init is deterministic");
  const one = playCrossRun(CROSS_REV_EXPAND, roomSeed(12), "great");
  const two = playCrossRun(CROSS_REV_EXPAND, roomSeed(12), "great");
  ok(one.raw === two.raw && one.score === two.score && one.digest === two.digest, "crossRev 8 runs are deterministic");
  const server = replayCrossRun(one.seed, one.raw, CROSS_REV_EXPAND);
  ok(server.score === one.score && !server.flagged, `server replay = phone sim on crossRev 8 (${server.score} vs ${one.score})`);
  const tampered = one.raw.replace(/^(\d+)\|(\d+)/, (_, seed, score) => `${seed}|${Number(score) + 1}`);
  ok(replayCrossRun(one.seed, tampered, CROSS_REV_EXPAND).flagged, "a claimed score the replay does not give is flagged");
  ok(a.wide === 1 && a.tunef === 1 && a.band === 3 && a.rev === CROSS_REV_EXPAND, "crossRev 8 states carry wide, tunef, band 3 and rev 8");
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
    ok(coins.length === 4, `${tag}: four coins (${coins.length})`);
    for (const cell of coins) {
      const lane = cell >> 4;
      const col = cell & 15;
      const kind = course.lanes[lane - 1]?.kind;
      ok(lane >= 1 && lane <= CROSS_X_ROWS && kind !== CROSS_KIND_ISLAND && kind !== CROSS_KIND_ROADWORKS, `${tag}: a coin sits in a traffic lane (${lane})`);
      ok([1, 2, 10, 11].includes(col), `${tag}: a coin sits off the middle (column ${col})`);
    }
    ok(coins.filter((c) => c >> 4 < CROSS_X_ISLAND).length === 2 && coins.filter((c) => c >> 4 > CROSS_X_ISLAND).length === 2, `${tag}: two coins each side of the island`);
    ok(crossPassable(course, CROSS_X_SEARCH_TICKS), `${tag}: proved passable`);
    if (index < CROSS_FAIR_COURSES) ok(crossFairPassable(course, CROSS_X_SEARCH_TICKS), `${tag}: fair (up-only walker)`);
  });
}

/* 4. Features through every recorded and fresh run, tick by tick. */
let coinsSeen = 0;
let islandRespawns = 0;
let startRespawns = 0;
let streakPays = 0;
let streakEnds = 0;
const fresh = ["average", "good", "great", "near"].flatMap((level) => [0, 1, 2].map((n) => playCrossRun(CROSS_REV_EXPAND, roomSeed(70 + n), level as never)));
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
  }
  const parts = crossBandParts(s);
  ok(parts.points <= 150 && parts.bonus <= CROSS_X_BONUS_MAX && game.score(s) <= 200, `seed ${r.seed}: play part ${parts.points} ≤ 150, bonus ${parts.bonus} ≤ 50, score ≤ 200`);
  ok(game.score(s) === Math.min(200, parts.points + crossBonusOf(s)), `seed ${r.seed}: score = play part + bonus`);
}
ok(coinsSeen >= 20, `coins were collected in the runs (${coinsSeen})`);
ok(islandRespawns >= 3 && startRespawns >= 3, `hits restarted on the island (${islandRespawns}) and on the pavement (${startRespawns})`);
ok(streakPays >= 10 && streakEnds >= 1, `the streak paid (${streakPays}) and was ended by hits (${streakEnds})`);
ok(crossMultiplierFor(1) === 1 && crossMultiplierFor(2) === 2 && crossMultiplierFor(3) === 3 && crossMultiplierFor(4) === 4 && crossMultiplierFor(9) === 4, "the multiplier runs ×1, ×2, ×3, ×4");

// A scripted walker: from the start, side-step to the first coin's column, then hop up whenever the next lane looks clear.
{
  const seed = roomSeed(5);
  let s = game.init(seed) as CrossState;
  const target = (crossCourse(s).coins ?? []).find((c) => c >> 4 < CROSS_X_ISLAND)!;
  const col = target & 15;
  const log: ArcadeInputEvent[] = [];
  while (!game.isOver(s) && s.tick < 1800 && !(s.coinTotal ?? 0)) {
    const t = s.tick + 1;
    let a = -1;
    if (s.tick >= s.pauseUntil && s.hop === 0 && (log.length === 0 || t - log[log.length - 1]!.t >= 8)) {
      if (s.col !== col && s.lane === 0) a = s.col < col ? 3 : 2;
      else if (s.lane < target >> 4) {
        const next = crossCourse(s).lanes[s.lane];
        let clear = !!next;
        for (let k = 0; k < 30 && clear && next; k++) if (crossBlocked(next, crossColumnCentreFp(s.col), t + 6 + k - s.crossStart, 13 * 256)) clear = false;
        const here = crossCourse(s).lanes[s.lane - 1];
        let danger = false;
        for (let k = 0; k < 8 && here && s.lane >= 1; k++) if (crossBlocked(here, crossColumnCentreFp(s.col), t + k - s.crossStart, 13 * 256)) danger = true;
        if (clear) a = 0;
        else if (danger) a = 1;
      }
    }
    const ev = a >= 0 ? { t, k: CROSS_INPUT_MOVE, a, b: 0, c: 0, d: 0 } : null;
    if (ev) log.push(ev);
    s = game.step(s, ev);
  }
  ok((s.coinTotal ?? 0) === 1 && game.score(s) >= CROSS_X_COIN_POINTS, `a scripted walker collects the first coin (coins ${s.coinTotal}, lives ${s.lives})`);
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

/* 6. The maximum: 200 only with the full bonus. */
{
  const base = game.init(roomSeed(1)) as CrossState;
  const full = { ...base, acted: 1, crossings: 9, reached: 0 } as CrossState;
  ok(game.score(full) === 150, `a long run with no coins or streak tops out at 150 (${game.score(full)})`);
  ok(game.score({ ...full, coinTotal: 12, streakPts: 14 }) === 200, "150 of play plus a 50 bonus is 200");
  ok(game.score({ ...full, coinTotal: 40, streakPts: 60 }) === 200, "the bonus is capped at 50 and the score at 200");
  ok(game.score({ ...full, coinTotal: 12, streakPts: 12 }) === 198, "a 48 bonus is 198");
  ok(game.score({ ...base, coinTotal: 5 }) === 0, "no input scores 0");
  ok(roundMaxFor("cross") === 200, "Jaywalk's round maximum is 200");
  const near = runs.filter((r) => r.level === "near");
  ok(near.some((r) => r.score >= 190), `the near-perfect bot reaches 190+ (${near.map((r) => r.score).join(", ")})`);
  for (const r of runs) {
    const st = replayCrossRun(r.seed, r.raw, CROSS_REV_EXPAND).state;
    if (r.score >= 190) ok(crossBonusOf(st) >= 40, `seed ${r.seed}: ${r.score} needed the features (bonus ${crossBonusOf(st)})`);
  }
  ok(CROSS_X_WORLD_H === 727, "the world is 390×727");
}

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL cross-expand-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS cross-expand-check: ${passes} checks — legacy crossRev 3/7 identity, crossRev 8 replay and determinism, courses, coins, island, streak, bounds and the 200 maximum (${coinsSeen} coins, ${islandRespawns} island restarts, ${streakPays} streak pays)`);
