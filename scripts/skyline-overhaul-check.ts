/**
 * skyline-overhaul-check (~3 s): High Rise in the Action overhaul (stage 1, 15 Nov 2026; docs/arcade-standard/skyline.md
 * "skylineRev 11", docs/design/game-reviews/action.md).
 *
 *  1. Every stamp before skylineRev 11 replays exactly as on main a3f40ff7 (60 runs on unstamped and skylineRev 2–10,
 *     scripts/fixtures/skyline-overhaul-legacy.json by scripts/skyline-overhaul-record.ts): score, floors, perfect drops,
 *     the end, the final checksum and tick, and no flag. Older stamps carry no lives.
 *  2. Lives (grace): a block that misses costs a life, the run carries on with the same tower and the same block from the
 *     same side, the streak broken; the last life's miss ends the run.
 *  3. The wide-block rescue: after five trims in a row the next block is wide (top + the wide grow, up to the start
 *     width) when the schedule has normal blocks there; never over a gold, narrow or wide block; the count restarts.
 *  4. Rooms deal skylineRev 11; LIVE_BANDS and the standard's spec carry it; the parts are skylineRev 10's.
 *  5. 200 stays as reachable as on skylineRev 10 (a clean run is rev 10's run exactly; the perfect-drop player scores 200
 *     through the server replay on most seeds), the score never reads the lives, and 61 floors ("Skyscraper") stay within
 *     reach after losing two lives. The run is 60 s (the 120 s rule).
 *  6. Runs replay identically (the same log twice, the same checksum) and a lives run replays unflagged.
 *  7. The look: dusk turns to night from the floors built (the same for every player), the plaza and the lives chip.
 */
import { readFileSync } from "node:fs";

import {
  skylineCheckpoint,
  skylineGameFor,
  skylineKindAt,
  skylineLivesGame,
  SKYLINE_KIND_GOLD,
  SKYLINE_KIND_NORMAL,
  SKYLINE_KIND_WIDE,
  SKYLINE_REV_COUNT,
  SKYLINE_REV_LIVES,
  SKYLINE_RUN_SECONDS,
  SKYLINE_RUN_TICKS,
  SKYLINE_START_W,
  SKYLINE_STD_SPEC_V10,
  SKYLINE_STD_SPEC_V11,
  SKYLINE_V11_LIVES,
  SKYLINE_V11_REARM_TICKS,
  SKYLINE_V11_TRIM_RUN,
  SKYLINE_V9_FULL_AT,
  SKYLINE_WIDE_GROW,
  SKYLINE_WORLD_RIGHT,
  skylineStdParts,
  type SkylineState,
} from "../src/lib/arcade/skyline";
import { encodeSkylineRun, replaySkylineRun } from "../src/lib/duel/skyline";
import { generateSkyline } from "../src/lib/duel/arcade.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
function section(name: string): void {
  console.log(`\n${name}`);
}

/* 1. Older stamps replay exactly. */
section("1. Stamps before skylineRev 11 replay as on main a3f40ff7");
interface LegacyRun { rev: number | null; seed: number; raw: string; score: number; blocks: number; perfects: number; survived: boolean; endedSeconds: number; checksum: number; flagged: boolean; tick: number }
const legacy = JSON.parse(readFileSync("scripts/fixtures/skyline-overhaul-legacy.json", "utf8")) as { recordedOn: string; runs: LegacyRun[] };
ok(legacy.runs.length === 60 && new Set(legacy.runs.map((r) => r.rev)).size === 10, `60 legacy runs over 10 stamps (${legacy.runs.length})`);
let same = 0;
for (const r of legacy.runs) {
  const now = replaySkylineRun(r.seed, r.raw, r.rev);
  const match =
    now.score === r.score &&
    now.blocks === r.blocks &&
    now.perfects === r.perfects &&
    now.survived === r.survived &&
    now.endedSeconds === r.endedSeconds &&
    skylineCheckpoint(now.state).checksum === r.checksum &&
    now.state.tick === r.tick &&
    now.flagged === r.flagged;
  if (match) same++;
  else failures.push(`legacy rev ${r.rev} seed ${r.seed}: ${now.score}/${now.blocks}/${now.perfects} vs ${r.score}/${r.blocks}/${r.perfects}`);
  checks++;
}
console.log(`  ${same} of ${legacy.runs.length} legacy runs replay exactly`);
for (const rev of [null, 2, 3, 4, 7, 8, 9, 10]) ok(skylineGameFor(rev).init(5).lives === undefined, `skylineRev ${rev}: no lives`);
ok(legacy.runs.filter((r) => !r.survived).length >= 20 && legacy.runs.some((r) => r.blocks >= 61), "the legacy runs include misses and long towers");

/* 2. Lives. */
section("2. Lives: a miss costs one and the run carries on");
const g = skylineLivesGame;
ok(skylineGameFor(SKYLINE_REV_LIVES) === g, "skylineGameFor(11) is the lives game");
const fresh = g.init(4242);
ok(fresh.lives === SKYLINE_V11_LIVES && SKYLINE_V11_LIVES === 3 && fresh.livesLost === 0, "a run starts with 3 lives");
/** A state whose sliding block can't touch the tower (the top is a narrow block at the right; the block at the left). */
function missing(s: SkylineState): SkylineState {
  const top = { x: SKYLINE_WORLD_RIGHT - 4_000, w: 4_000 };
  return { ...s, blocks: [...s.blocks.slice(0, -1), top], x: 0, w: 10_000, dir: 1, streak: 4 };
}
const before = { ...missing(fresh), acted: 1 };
const after1 = g.step(before, true);
ok(after1.lives === 2 && after1.livesLost === 1 && !after1.missed && !g.isOver(after1), "the first miss costs a life and the run carries on");
ok(after1.placed === before.placed && after1.blocks.length === before.blocks.length && after1.streak === 0, "the tower is unchanged and the streak broken");
ok(after1.w === before.w && after1.x === 0 && after1.dir === 1, "the same block comes again from the same side");
ok(after1.lostTick === after1.tick && after1.lostW === before.w, "the lost block is remembered for the art (it falls away)");
// A double tap can't lose two lives: a tap in the half second after a lost life is ignored.
const doubleTap = g.step({ ...missing(after1) }, true);
ok(doubleTap.lives === 2 && doubleTap.livesLost === 1 && doubleTap.x !== after1.x, "a tap straight after a lost life is ignored (the block slides on)");
let rearmed = after1;
for (let k = 0; k < SKYLINE_V11_REARM_TICKS; k++) rearmed = g.step(rearmed, false);
ok(SKYLINE_V11_REARM_TICKS === 30 && g.step({ ...missing(rearmed) }, true).lives === 1, "half a second later a tap counts again");
const after2 = g.step({ ...missing(rearmed) }, true);
ok(after2.lives === 1 && !g.isOver(after2), "the second miss leaves one life");
let rearmed2 = after2;
for (let k = 0; k < SKYLINE_V11_REARM_TICKS; k++) rearmed2 = g.step(rearmed2, false);
const after3 = g.step({ ...missing(rearmed2) }, true);
ok(after3.lives === 0 && after3.missed && g.isOver(after3) && after3.livesLost === 3, "the last life's miss ends the run");
ok(g.step(after3, true) === after3, "nothing moves after the run ends");
const fromRight = g.step({ ...missing(fresh), x: SKYLINE_WORLD_RIGHT - 10_000, dir: -1, blocks: [{ x: 0, w: 4_000 }] }, true);
ok(fromRight.lives === 2 && fromRight.x === SKYLINE_WORLD_RIGHT - 10_000 && fromRight.dir === -1, "a block missed from the right comes again from the right");
// The older stamp still ends on the first miss.
const rev10 = skylineGameFor(SKYLINE_REV_COUNT);
const old = rev10.step({ ...missing(rev10.init(4242)), acted: 1 }, true);
ok(old.missed && rev10.isOver(old), "skylineRev 10 still ends on the first miss");

/* 3. The wide-block rescue. */
section("3. The wide-block rescue after five trims in a row");
/** A state about to place an imperfect (trimmed) drop on a normal block, the trim count at `run`. */
function trimming(seed: number, run: number): SkylineState {
  const s = g.init(seed);
  let k = s;
  // Place a few floors first (perfect drops) so the schedule's index moves past the opening.
  for (let t = 0; t < 4000 && k.placed < 8; t++) k = g.step(k, Math.abs(k.x - k.blocks[k.blocks.length - 1]!.x) <= 700);
  const top = k.blocks[k.blocks.length - 1]!;
  return { ...k, x: top.x + 9_000, w: top.w, trimRun: run };
}
let rescued = 0;
let held = 0;
for (let seed = 1; seed <= 60; seed++) {
  const s = trimming(seed * 97, SKYLINE_V11_TRIM_RUN - 1);
  const at = s.placed + 1;
  const n = g.step(s, true);
  ok(n.placed === s.placed + 1 && n.perfects === s.perfects, `seed ${seed}: the drop is a trim`);
  const normalNext = skylineKindAt(s, at) === SKYLINE_KIND_NORMAL && skylineKindAt(s, at + 1) === SKYLINE_KIND_NORMAL;
  if (normalNext) {
    rescued++;
    const top = n.blocks[n.blocks.length - 1]!;
    ok(skylineKindAt(n, at) === SKYLINE_KIND_WIDE && n.w === Math.min(SKYLINE_START_W, top.w + SKYLINE_WIDE_GROW), `seed ${seed}: the next block is wide`);
    ok(n.trimRun === 0 && n.rescues === 1, `seed ${seed}: the trim count restarts`);
    ok(n.x === (n.dir === 1 ? 0 : SKYLINE_WORLD_RIGHT - n.w), `seed ${seed}: the wide block starts at its side`);
    ok(skylineKindAt(s, at) === SKYLINE_KIND_NORMAL, `seed ${seed}: the shared schedule is not changed`);
  } else {
    held++;
    ok(skylineKindAt(n, at) === skylineKindAt(s, at) && n.trimRun === SKYLINE_V11_TRIM_RUN && (n.rescues ?? 0) === 0, `seed ${seed}: no rescue over a special block`);
  }
  const short = g.step(trimming(seed * 97, SKYLINE_V11_TRIM_RUN - 2), true);
  ok(short.trimRun === SKYLINE_V11_TRIM_RUN - 1 && (short.rescues ?? 0) === 0, `seed ${seed}: four trims in a row: no rescue yet`);
}
ok(rescued > 30, `the rescue came on most seeds (${rescued} rescued, ${held} held for a special block)`);
const goldNext = (() => {
  const s = trimming(7, SKYLINE_V11_TRIM_RUN - 1);
  const kinds = (s.kinds ?? []).slice();
  kinds[s.placed + 1] = SKYLINE_KIND_GOLD;
  return g.step({ ...s, kinds }, true);
})();
ok(skylineKindAt(goldNext, goldNext.placed) === SKYLINE_KIND_GOLD && (goldNext.rescues ?? 0) === 0, "a gold block is never replaced by a rescue");
const perfectDrop = (() => {
  const s = trimming(9, 3);
  const top = s.blocks[s.blocks.length - 1]!;
  return g.step({ ...s, x: top.x }, true);
})();
ok(perfectDrop.trimRun === 0 && perfectDrop.perfects > 0, "a perfect drop restarts the trim count");

/* 4. What rooms deal. */
section("4. Rooms deal skylineRev 11");
ok(generateSkyline().skylineRev === SKYLINE_REV_LIVES && SKYLINE_REV_LIVES === 11, "rooms deal skylineRev 11");
ok(LIVE_BANDS.skyline.rev === SKYLINE_REV_LIVES && (LIVE_BANDS.skyline as { std?: unknown }).std === SKYLINE_STD_SPEC_V11, "LIVE_BANDS lists skylineRev 11 with its spec");
ok(ARCADE_STANDARD.skyline.spec === SKYLINE_STD_SPEC_V11 && SKYLINE_STD_SPEC_V11.rev === 11, "the standard's spec is skylineRev 11's");
ok(JSON.stringify(SKYLINE_STD_SPEC_V11.parts) === JSON.stringify(SKYLINE_STD_SPEC_V10.parts), "the parts are skylineRev 10's");
ok(SKYLINE_STD_SPEC_V11.parts.reduce((a, p) => a + p.max, 0) === 200, "the parts sum to 200");

/* 5. 200 and Skyscraper. */
section("5. 200 reachable, the 120 s rule, Skyscraper");
/**
 * The perfect-drop player: on each tick, drop if the drop would be perfect (seen through the sim itself). With `missFirst`,
 * it first narrows the tower with three sloppy drops (so a block can miss it), loses that many lives, then plays perfectly.
 */
function perfectPlayer(seed: number, missFirst = 0): { taps: number[]; state: SkylineState; checkpoints: ReturnType<typeof skylineCheckpoint>[] } {
  let s = g.init(seed);
  const taps: number[] = [];
  const checkpoints: ReturnType<typeof skylineCheckpoint>[] = [];
  let sloppy = 0;
  for (let t = 1; t <= SKYLINE_RUN_TICKS && !g.isOver(s); t++) {
    const trial = g.step(s, true);
    const top = s.blocks[s.blocks.length - 1]!;
    let tap: boolean;
    if (missFirst > 0 && sloppy < 3) tap = trial.placed > s.placed && trial.blocks[trial.blocks.length - 1]!.w < top.w * 0.7 && trial.blocks[trial.blocks.length - 1]!.w > top.w * 0.5;
    else if (missFirst > 0 && (s.livesLost ?? 0) < missFirst) tap = (trial.livesLost ?? 0) > (s.livesLost ?? 0);
    else tap = trial.perfects > s.perfects;
    if (tap) {
      taps.push(t);
      if (missFirst > 0 && sloppy < 3) sloppy++;
      s = trial;
    } else s = g.step(s, false);
    if (s.tick % 300 === 0) checkpoints.push(skylineCheckpoint(s));
  }
  return { taps, state: s, checkpoints };
}
let at200 = 0;
let at200Old = 0;
let floors = Infinity;
let floors61 = 0;
let sameAsOld = 0;
let livesFloors61 = 0;
let lives200 = 0;
const SEEDS = 24;
for (let k = 0; k < SEEDS; k++) {
  const seed = 50_000 + k * 1_337;
  const p = perfectPlayer(seed);
  const raw = encodeSkylineRun({ seed, claimedScore: g.score(p.state), inputs: p.taps, endTick: 0, checkpoints: p.checkpoints });
  const r = replaySkylineRun(seed, raw, SKYLINE_REV_LIVES);
  ok(!r.flagged && r.score === g.score(p.state), `seed ${seed}: the perfect run replays unflagged`);
  if (r.score === 200) at200++;
  floors = Math.min(floors, r.blocks);
  if (r.blocks >= SKYLINE_V9_FULL_AT) floors61++;
  // A run with no miss and no trim is skylineRev 10's run exactly: the same score and floors.
  let o10 = rev10.init(seed);
  const tapSet = new Set(p.taps);
  for (let t = 1; t <= SKYLINE_RUN_TICKS && !rev10.isOver(o10); t++) o10 = rev10.step(o10, tapSet.has(t));
  if (rev10.score(o10) === r.score && o10.placed === r.blocks) sameAsOld++;
  if (rev10.score(o10) === 200) at200Old++;
  const m = perfectPlayer(seed, 2);
  const rawM = encodeSkylineRun({ seed, claimedScore: g.score(m.state), inputs: m.taps, endTick: 0, checkpoints: m.checkpoints });
  const rm = replaySkylineRun(seed, rawM, SKYLINE_REV_LIVES);
  ok(rm.state.livesLost === 2 && rm.state.lives === 1 && !rm.flagged && !rm.state.missed, `seed ${seed}: two lives lost early, the run carries on (unflagged) to the clock`);
  if (rm.blocks >= SKYLINE_V9_FULL_AT) livesFloors61++;
  if (rm.score === 200) lives200++;
}
console.log(`  perfect player: ${at200}/${SEEDS} at 200 through the server replay (skylineRev 10: ${at200Old}), ${floors61}/${SEEDS} with 61+ floors (fewest ${floors})`);
console.log(`  after narrowing the tower and losing two lives: ${livesFloors61}/${SEEDS} still build 61 floors, ${lives200}/${SEEDS} still score 200`);
ok(sameAsOld === SEEDS && at200 === at200Old, `a clean run scores as on skylineRev 10, so 200 is as reachable as before (${at200} vs ${at200Old}, ${sameAsOld}/${SEEDS} identical)`);
ok(at200 >= SEEDS * 0.8, `a perfect run scores 200 on most seeds (${at200}/${SEEDS})`);
ok(floors61 >= SEEDS * 0.8, `Skyscraper: a perfect run builds 61 floors in 60 s on most seeds (${floors61}/${SEEDS})`);
ok(livesFloors61 >= SEEDS / 2, `61 floors stay within reach after losing two lives (${livesFloors61}/${SEEDS})`);
{
  const p = perfectPlayer(50_000);
  const hurt = { ...p.state, lives: 1, livesLost: 2 } as SkylineState;
  ok(g.score(hurt) === g.score(p.state), "the score never reads the lives: a lost life costs only its time and the streak");
}
ok(SKYLINE_RUN_SECONDS <= 120 && SKYLINE_RUN_TICKS === SKYLINE_RUN_SECONDS * 60, "the run is at most 120 s (60 s)");
const def = readFileSync("src/puzzles/skyline.tsx", "utf8");
ok(/generate: \(\) => \(\{ type: "skyline", seed: 1, skylineRev: SKYLINE_REV_LIVES \}\)/.test(def), "practice's local generate deals skylineRev 11");
const parts = skylineStdParts({ ...g.init(1), acted: 1, placed: 61 } as SkylineState)!;
ok(parts[0]!.points === 140, "61 floors fill the floors part (140)");

/* 6. Replays are identical. */
section("6. Replays are identical");
const a = perfectPlayer(777, 1);
ok(a.state.livesLost === 1, "the replay sample lost a life");
const encA = encodeSkylineRun({ seed: 777, claimedScore: g.score(a.state), inputs: a.taps, endTick: 0, checkpoints: a.checkpoints });
const r1 = replaySkylineRun(777, encA, SKYLINE_REV_LIVES);
const r2 = replaySkylineRun(777, encA, SKYLINE_REV_LIVES);
ok(skylineCheckpoint(r1.state).checksum === skylineCheckpoint(r2.state).checksum && r1.score === r2.score, "the same log replays to the same state twice");
ok(r1.livesLost === 1 && !r1.flagged && r1.score === g.score(a.state), "a run with a lost life replays unflagged to the phone's score");
const noLives = { ...a.state, lives: undefined, livesLost: undefined, trimRun: undefined, rescues: undefined } as SkylineState;
ok(skylineCheckpoint(a.state).checksum !== skylineCheckpoint(noLives).checksum, "the lives fold into the checkpoint checksum");
// A tampered log (a claimed extra life) is flagged: the phone's checkpoints were taken with a life lost.
const forged = encodeSkylineRun({ seed: 777, claimedScore: g.score(a.state), inputs: a.taps.slice(1), endTick: 0, checkpoints: a.checkpoints });
ok(replaySkylineRun(777, forged, SKYLINE_REV_LIVES).flagged, "a log that doesn't match its checkpoints is flagged");

/* 7. The look. */
section("7. The look (display only)");
const art = readFileSync("src/lib/arcade/skyline.renderer.ts", "utf8");
const { skylineNightShare } = await import("../src/lib/arcade/skyline.renderer");
let mono = true;
for (let p = 1; p <= 80; p++) if (skylineNightShare(p) < skylineNightShare(p - 1)) mono = false;
ok(mono && skylineNightShare(0) === 0 && skylineNightShare(80) === 1, "dusk turns to night as floors are built, never back");
ok(art.includes("drawPlaza(") && art.includes("paintCity(") && art.includes("paintDusk("), "the plaza, the city and the dusk sky are drawn");
ok(/label: "LIVES"/.test(art), "the HUD shows the lives");
// The materials pass (15 Nov 2026): the city, the plaza and the jib are held still, drawn alike in the world and beside it.
ok(/function drawBackdrop\(ctx: CanvasRenderingContext2D, worldH: number/.test(art) && !/drawEdgeRamps/.test(art), "the city is held still (no camera on it, no edge fade)");
ok(/drawCityBand\(ctx, rect\.x/.test(art) && /drawJib\(ctx, rect\.x/.test(art) && /drawPlaza\(ctx, worldH - GROUND_LIFT/.test(art), "the scene beside the world draws the same city, jib and plaza");
const sim = readFileSync("src/lib/arcade/skyline.ts", "utf8");
ok(!/skylineNightShare|paintCity|Math\.random/.test(sim), "the sim never reads the look (and nothing random)");

/* 8. Edge to edge. */
section("8. Edge to edge: the world meets the screen's fill without a seam");
{
  const { createCanvas, Path2D: NapiPath2D } = await import("@napi-rs/canvas");
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 1, getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {} },
  });
  class Surface {
    constructor(w: number, h: number) {
      return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    }
  }
  Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
  if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
  const R = await import("../src/lib/arcade/skyline.renderer");
  const { skylineWorldHFor, SKYLINE_WORLD_W } = await import("../src/lib/arcade/skyline");
  const { ARENA_FILL_SIDES } = await import("../src/lib/arcade/arenaFills.renderer");
  ok((ARENA_FILL_SIDES as readonly string[]).includes("skyline"), "High Rise is listed as filling its sides (arcade-fill-check proves the sides in the browser)");
  ok(/scene=\{skylineSceneFill\(nightKey \/ SKYLINE_NIGHT_STEPS\)\} sceneKey=\{nightKey\}/.test(def), "the stage paints the fill at the world's own night step (repainted when it changes)");
  const WH = skylineWorldHFor(SKYLINE_REV_LIVES);
  // Play areas (CSS px) under a 52 px header: the iPhone 11 app, 390 × 844, 375 × 667 and the desktop column.
  const SCREENS = [
    { name: "414x896 app", w: 414, h: 896 - 52 - 34 },
    { name: "390x844", w: 390, h: 844 - 52 - 34 },
    { name: "375x667", w: 375, h: 667 - 52 },
    { name: "desktop 640x1120", w: 640, h: 1120 - 56 },
  ];
  // States from dusk to night: the tower at 0, 25 and 55 floors (the camera moved on the last two).
  const states: SkylineState[] = [];
  for (const want of [0, 25, 55]) {
    let s = g.init(31);
    for (let t = 1; t < 3600 && !g.isOver(s) && s.placed < want; t++) s = g.step(s, g.step(s, true).perfects > s.perfects);
    // The sliding block centred: it sweeps to the world's edges in play (a game piece, not the backdrop this tests).
    states.push({ ...s, x: (SKYLINE_WORLD_RIGHT - s.w) >> 1 });
  }
  const lum = (d: Uint8ClampedArray, i: number) => [d[i]!, d[i + 1]!, d[i + 2]!];
  let worst = 0;
  let worstRow = 0;
  for (const scr of SCREENS) {
    const scale = Math.min(scr.w / SKYLINE_WORLD_W, scr.h / WH);
    const ox = (scr.w - SKYLINE_WORLD_W * scale) / 2;
    const view = { worldW: SKYLINE_WORLD_W, worldH: WH, left: -ox / scale, top: 0, right: (scr.w - ox) / scale, bottom: scr.h / scale, scale, boxTop: 0 };
    for (const s of states) {
      const night = R.skylineNightStep(s.placed);
      const screen = createCanvas(scr.w, scr.h);
      const sc = screen.getContext("2d") as unknown as CanvasRenderingContext2D;
      sc.setTransform(scale, 0, 0, scale, ox, 0);
      R.skylineSceneFill(night)(sc, view);
      sc.setTransform(1, 0, 0, 1, 0, 0);
      const ww = Math.round(SKYLINE_WORLD_W * scale);
      const wh = Math.round(WH * scale);
      const world = createCanvas(ww, wh);
      const wc = world.getContext("2d") as unknown as CanvasRenderingContext2D;
      for (let k = 0; k < 90; k++) R.drawSkylineArt(wc, s, { width: ww, height: wh });
      sc.drawImage(world as unknown as CanvasImageSource, Math.round(ox), 0);
      if (process.env.EDGE_SHOTS) (await import("node:fs")).writeFileSync(`${process.env.EDGE_SHOTS}/${scr.name.replace(/ /g, "_")}-${s.placed}.png`, screen.toBuffer("image/png"));
      const img = sc.getImageData(0, 0, scr.w, scr.h).data;
      const at = (x: number, y: number) => (y * scr.w + x) * 4;
      const where = `${scr.name}, ${s.placed} floors`;
      // Sides: the world's edge columns must show what lies beside it, the still scene the fill paints (drawn here across the
      // boundary as the reference), so world and fill meet without a seam however the camera has moved the city. Compared in
      // bands of 8 rows, the whole height (the crane's jib included: it runs on beside the world too).
      const ref = createCanvas(scr.w, scr.h);
      const rc = ref.getContext("2d") as unknown as CanvasRenderingContext2D;
      rc.setTransform(scale, 0, 0, scale, ox, 0);
      R.paintSkylineStatic(rc, { x: view.left, y: 0, w: view.right - view.left, h: WH }, WH, night);
      const refImg = rc.getImageData(0, 0, scr.w, scr.h).data;
      const x0 = Math.round(ox);
      const x1 = x0 + ww;
      if (x0 >= 4) {
        let sum = 0;
        let n = 0;
        let bad = 0;
        for (let y0 = 0; y0 + 8 <= wh - 4; y0 += 8) {
          for (const [inX, outX] of [[x0 + 1, x0 - 2], [x1 - 2, x1 + 1]] as const) {
            const a = [0, 0, 0];
            const b = [0, 0, 0];
            const o = [0, 0, 0];
            for (let y = y0; y < y0 + 8; y++) {
              const p = lum(img, at(inX, y));
              const q = lum(refImg, at(inX, y));
              const r = lum(img, at(outX, y));
              const t = lum(refImg, at(outX, y));
              for (let c = 0; c < 3; c++) {
                a[c]! += p[c]!;
                b[c]! += q[c]!;
                o[c]! += Math.abs(r[c]! - t[c]!);
              }
            }
            const d = (Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!)) / 3 / 8;
            ok((o[0]! + o[1]! + o[2]!) / 24 <= 3, `${where}: beside the world is the still scene (row ${y0})`);
            sum += d;
            n++;
            if (d > 16) {
              bad++;
              if (process.env.EDGE_DEBUG) console.log("BAD", where, inX === x0 + 1 ? "L" : "R", y0, a.map((v) => Math.round(v / 8)), b.map((v) => Math.round(v / 8)));
            }
            if (d > worst) {
              worst = d;
              worstRow = y0;
            }
          }
        }
        ok(sum / n <= 6, `${where}: the world's edge matches the scene beside it (mean ${(sum / n).toFixed(1)} per channel)`);
        ok(bad / n <= 0.03, `${where}: at most 3 % of the edge's 8-row bands step by more than 16 (${bad} of ${n})`);
        // Beside the world, nothing is the screen edge's black.
        let black = 0;
        for (let y = 0; y < wh; y += 4) {
          const c = lum(img, at(Math.max(0, x0 - 3), y));
          if (Math.abs(c[0]! - 7) <= 3 && Math.abs(c[1]! - 7) <= 3 && Math.abs(c[2]! - 9) <= 3) black++;
        }
        ok(black === 0, `${where}: no black beside the world (${black} rows)`);
      }
      // Bottom: the world's bottom rows against the fill's top rows.
      if (scr.h - wh > 6) {
        let sum = 0;
        for (let x = x0 + 2; x < x1 - 2; x++) {
          const a = lum(img, at(x, wh - 2));
          const b = lum(img, at(x, wh + 1));
          sum += (Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!)) / 3;
        }
        ok(sum / (x1 - x0 - 4) <= 8, `${where}: no colour step under the world (mean ${(sum / (x1 - x0 - 4)).toFixed(1)})`);
      }
    }
  }
  console.log(`  largest 8-row band step at the sides: ${worst.toFixed(1)} (row ${worstRow})`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} High Rise overhaul checks`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} High Rise overhaul checks`);
