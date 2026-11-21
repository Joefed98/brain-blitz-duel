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
 *  8. Edge to edge: the world meets the screen's fill without a seam.
 *  9. Stage 2's effects (display only): the fall and the 2 px squash, the sliver's wobble within 2 px, the perfect drop's
 *     gold ring at the join (drawn, then gone), the tock rising with the streak, the end's count and pull-back and the
 *     stage's hold, and no edge glow for the six Action games (the shared layer's edge glow and the success layer's
 *     milestone frame), the `moment` hook called at the event's point, and every other game keeping its edge glow.
 * 10. Stage 2's reveal: the run picture agrees with the server's replay on every legacy run and a rev-11 run with trims,
 *     a rescue and two lost lives; the drawing (gold perfects, red losses, transparent); the component's three big
 *     numbers and legend, no stray symbols; ArcadeReveal draws it in place of the tiles.
 * 11. Stage 3 (15 Nov 2026, Joe: no block of text lines above the run picture): the shared arcade reveal, mounted in
 *     happy-dom on that run's stored reveal in practice and in a room, reads the score, then the big numbers and the
 *     picture, then the stored breakdown in the shared layout (every stored part line a row of the shared list, none
 *     above the picture), with no stat tiles; Roofbound's reveal reads in the same order (the shared layout).
 */
import { readFileSync } from "node:fs";

import {
  skylineCheckpoint,
  SKYLINE_CHECKPOINT_INTERVAL,
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


/* 9. Stage 2: the effects (display only). */
section("9. Stage 2: the effects (a drop, a perfect drop, a trim, a sliver, a lost life, the end)");
{
  const { createCanvas } = await import("@napi-rs/canvas");
  let clockMs = 50_000;
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clockMs } });
  const R = await import("../src/lib/arcade/skyline.renderer");
  const FX = await import("../src/lib/arcade/arcadeFx.renderer");
  const SR = await import("../src/lib/arcade/success.renderer");
  const SPECS = await import("../src/lib/arcade/arcadeFxGames.renderer");
  const { skylineWorldHFor, SKYLINE_WORLD_W } = await import("../src/lib/arcade/skyline");
  const sounds = readFileSync("src/lib/fx/gameSounds.ts", "utf8");
  const WH = skylineWorldHFor(SKYLINE_REV_LIVES);
  const size = { width: SKYLINE_WORLD_W, height: WH };
  // Every physical action within 900 ms and no more than 2 px off the sim's blocks.
  ok(R.DROP_FALL_TICKS * (1000 / 60) <= 900, "the drop's fall is under 900 ms");
  let squashMax = 0;
  for (let a = 0; a < 40; a++) squashMax = Math.max(squashMax, Math.abs(R.skylineSquashPx(a)));
  ok(squashMax <= 2 && squashMax >= 1.9 && R.skylineSquashPx(18) === 0 && R.skylineSquashPx(-1) === 0, `the tower squashes about 2 px and settles (${squashMax.toFixed(2)} px, gone after 18 ticks = 300 ms)`);
  let tiltMax = 0;
  for (let a = 0; a < 80; a++) tiltMax = Math.max(tiltMax, Math.abs(R.skylineSliverTilt(a)));
  ok(tiltMax * 36 <= 2 && tiltMax > 0 && R.skylineSliverTilt(60) === 0, `a sliver wobbles at most 2 px at its corners (${(tiltMax * 36).toFixed(2)} px) and stops within a second`);
  ok(R.PERFECT_RING_TICKS * (1000 / 60) <= 900 && R.SKYLINE_END_COUNT_MS <= 900, "the ring and the count-up each end within 900 ms");
  // The perfect drop's tock rises with the streak.
  const { skylinePerfectRate } = await import("../src/lib/fx/gameSounds");
  ok(skylinePerfectRate(1) === 1 && skylinePerfectRate(0) === 1 && Math.abs(skylinePerfectRate(8) - 2 ** (7 / 12)) < 1e-9 && skylinePerfectRate(30) === skylinePerfectRate(8), "the perfect tock rises a semitone a drop in the streak, up to seven");
  ok(/sfx\("skyline\.perfect", "correct", 1, skylinePerfectRate\(state\.streak \?\? 1\), false, true\)/.test(sounds), "the perfect drop plays skyline.perfect at the streak's pitch");
  ok(/ownCue\("skyline\.trim"/.test(sounds) && /ownCue\("skyline\.sliver"/.test(sounds) && /ownCue\("skyline\.lifeLost"/.test(sounds) && /sfx\("shared\.celebrate\.chime"/.test(sounds), "trim, sliver, lost life and the gold block keep their slots");

  /** Plays to a state with `floors` perfect drops, drawing every tick on `ctx` (the renderer's memory sees each landing). */
  function playPerfect(ctx: CanvasRenderingContext2D, seed: number, floors: number, extraTicks: number): SkylineState {
    let s = g.init(seed);
    for (let t = 0; t < 3000 && s.placed < floors; t++) {
      s = g.step(s, g.step(s, true).perfects > s.perfects);
      clockMs += 1000 / 60;
      R.drawSkylineArt(ctx, s, size);
    }
    for (let k = 0; k < extraTicks; k++) {
      s = g.step(s, false);
      clockMs += 1000 / 60;
      R.drawSkylineArt(ctx, s, size);
    }
    return s;
  }
  const gold = (d: Uint8ClampedArray, i: number) => d[i]! > 190 && d[i + 1]! > 140 && d[i + 2]! < 140 && d[i]! - d[i + 2]! > 90;
  /** Gold pixels in the band of rows round y, outside the columns [x0, x1] (the ring reaches past the block). */
  function goldBeside(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number): number {
    const d = ctx.getImageData(0, 0, size.width, size.height).data;
    let n = 0;
    for (let yy = Math.max(0, Math.round(y) - 14); yy < Math.min(size.height, Math.round(y) + 14); yy++) {
      for (let xx = 0; xx < size.width; xx++) {
        if (xx >= x0 - 2 && xx <= x1 + 2) continue;
        if (gold(d, (yy * size.width + xx) * 4)) n++;
      }
    }
    return n;
  }
  const perfectCanvas = createCanvas(size.width, size.height);
  const pc = perfectCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const sP = playPerfect(pc, 77, 3, 0);
  // Ten ticks after the third perfect drop: the ring has spread past the block's edges at the join.
  let sRing = sP;
  for (let k = 0; k < 10; k++) {
    sRing = g.step(sRing, false);
    clockMs += 1000 / 60;
    R.drawSkylineArt(pc, sRing, size);
  }
  const join = R.skylineJoinAt({ x: 0, y: 0 });
  const top = sRing.blocks[sRing.blocks.length - 1]!;
  const blockH = 36;
  const ringNow = goldBeside(pc, join.y + blockH, top.x / 256, (top.x + top.w) / 256);
  for (let k = 0; k < 60; k++) {
    sRing = g.step(sRing, false);
    clockMs += 1000 / 60;
    R.drawSkylineArt(pc, sRing, size);
  }
  const ringLater = goldBeside(pc, join.y + blockH, top.x / 256, (top.x + top.w) / 256);
  ok(ringNow > 20 && ringLater < ringNow / 4, `a perfect drop draws a gold ring at the join, beyond the block (${ringNow} gold px), gone a second later (${ringLater})`);
  ok(join.y > 0 && join.y < size.height && Math.abs(join.x - (top.x + top.w / 2) / 256) < 2, "the success layer's burst point is the tower's top join, not mid-screen");

  // The edge glow is gone for the Action games: a perfect moment paints nothing along the world's edge.
  const edgeSpec = R.SKYLINE_FX_EXPAND;
  ok(FX.arcadeFxEdgeless(edgeSpec) && SR.edgelessGame("skyline"), "High Rise's success layer is edgeless");
  for (const id of ["flip", "swing", "ricochet", "bastion", "orbit", "orbit3", "skyline"]) ok(SR.edgelessGame(id), `${id}: no edge glow`);
  for (const id of ["breaker", "hover", "rally", "pinball", "slice", "inkbridge", "tilt"]) ok(!SR.edgelessGame(id), `${id}: keeps its edge glow (other categories' sessions own theirs)`);
  for (const [name, spec] of Object.entries(SPECS.ARCADE_FX_SPECS as Record<string, { game: string }>)) {
    const action = ["flip", "swing", "ricochet", "bastion", "skyline", "orbit"].includes(name);
    ok(FX.arcadeFxEdgeless(spec) === action, `${name}: edgeless ${action}`);
  }
  // Painting: an edgeless spec's perfect moment leaves the world's edge untouched and calls its moment hook at the event's
  // point; the same spec with the edge glow on paints the edge.
  const W = 200;
  const H = 300;
  const moments: { x: number; y: number; kind: string }[] = [];
  const mk = (game: string, edgeGlow?: boolean) => ({
    game,
    world: "realworld" as const,
    width: W,
    height: H,
    fit: "world" as const,
    ...(edgeGlow === undefined ? {} : { edgeGlow }),
    moment: (_c: CanvasRenderingContext2D, m: { x: number; y: number; kind: string }) => moments.push({ x: m.x, y: m.y, kind: m.kind }),
    events: [{ kind: "perfect" as const, count: (s: { n: number }) => s.n, at: () => ({ x: 120, y: 200 }), label: () => null, textOnly: true }],
  });
  function edgeAlpha(spec: ReturnType<typeof mk>): number {
    const c = createCanvas(W, H);
    const cx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    FX.arcadeFx(cx, spec as never, { tick: 1, n: 0 }, () => {}, { width: W, height: H });
    clockMs += 16;
    FX.arcadeFx(cx, spec as never, { tick: 2, n: 1 }, () => {}, { width: W, height: H });
    clockMs += 250;
    cx.clearRect(0, 0, W, H);
    FX.arcadeFx(cx, spec as never, { tick: 3, n: 1 }, () => {}, { width: W, height: H });
    const stats = FX.arcadeFxMomentStats(cx, spec);
    ok(stats.live && stats.at?.x === 120 && stats.at?.y === 200, `${spec.game}: the moment is live at the event's point`);
    const d = cx.getImageData(0, 0, W, H).data;
    let a = 0;
    for (let y = 0; y < H; y++) for (const x of [3, 4, 5, W - 5, W - 4]) a += d[(y * W + x) * 4 + 3]!;
    return a;
  }
  moments.length = 0;
  const edgeless = edgeAlpha(mk("skyline"));
  ok(edgeless === 0, `an Action game's perfect moment paints nothing on the world's edge (alpha ${edgeless})`);
  ok(moments.length > 0 && moments.every((m) => m.x === 120 && m.y === 200 && m.kind === "perfect"), `the edgeless spec's moment hook is called at the event's point (${moments.length} frames)`);
  moments.length = 0;
  const edged = edgeAlpha(mk("not-action"));
  ok(edged > 1000 && moments.length === 0, `a game outside the Action group keeps its edge glow (alpha ${edged}) and no hook is called`);
  ok(edgeAlpha(mk("not-action-off", false)) === 0, "edgeGlow: false turns any game's edge glow off");
  // The success layer's milestone frame (every 5th success) draws no edge on an Action id, and still does on another.
  function milestoneEdge(id: string): number {
    const c = createCanvas(W, H);
    const cx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    for (let k = 0; k <= 5; k++) SR.successFrame(cx, { id, tick: 10 + k, count: k, colour: "#FFD84A", width: W, height: H, point: { x: 100, y: 150 } });
    cx.clearRect(0, 0, W, H);
    SR.successFrame(cx, { id, tick: 22, count: 5, colour: "#FFD84A", width: W, height: H, point: { x: 100, y: 150 } });
    const d = cx.getImageData(0, 0, W, H).data;
    let a = 0;
    for (let y = 20; y < H - 20; y++) a += d[(y * W + 5) * 4 + 3]!;
    return a;
  }
  ok(milestoneEdge("skyline") === 0 && milestoneEdge("orbit3") === 0, "the success layer's milestone frame is off for the Action games");
  ok(milestoneEdge("breaker") > 0, "the milestone frame still draws for other games");

  // The end: the camera pulls back over the whole tower and the floor count counts up from 0.
  ok(R.skylineEndCountAt(40, 0) === 0 && R.skylineEndCountAt(40, R.SKYLINE_END_COUNT_MS) === 40 && R.skylineEndCountAt(40, 450) < 40 && R.skylineEndCountAt(40, 450) > 20, "the floor count counts up to the floors built");
  const endCanvas = createCanvas(size.width, size.height);
  const ec = endCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  let sEnd = playPerfect(ec, 31, 45, 0);
  for (let t = 0; t < 4000 && !g.isOver(sEnd); t++) {
    sEnd = g.step(sEnd, false);
    if (t % 50 === 0) R.drawSkylineArt(ec, sEnd, size);
  }
  for (let k = 0; k < 90; k++) {
    clockMs += 1000 / 60;
    R.drawSkylineArt(ec, sEnd, size);
  }
  const endTop = R.skylineJoinAt({ x: 0, y: -1 }).y;
  ok(g.isOver(sEnd) && endTop > WH * 0.14 + 44 && endTop < WH * 0.5, `at the end the whole tower is in view under the count (its top at ${endTop.toFixed(0)} of ${WH})`);
  ok(/time - missedAt\.current >= Math\.max\(SKYLINE_END_HOLD_MS/.test(def) && R.SKYLINE_END_HOLD_MS >= 1000 && R.SKYLINE_END_HOLD_MS <= 1500, "the stage holds its submit while the end plays (drafts carry the same run)");
  if (process.env.EFFECT_SHOTS) {
    const fs = await import("node:fs");
    fs.writeFileSync(`${process.env.EFFECT_SHOTS}/end.png`, endCanvas.toBuffer("image/png"));
  }
}

/* 10. Stage 2: the answer reveal's picture of the run. */
let s10Raw = "";
section("10. Stage 2: the reveal's picture of the run (the stored log through the real sim)");
{
  const { skylineRunSummary } = await import("../src/lib/duel/skylineSummary");
  const R = await import("../src/lib/arcade/skyline.renderer");
  const { createCanvas } = await import("@napi-rs/canvas");
  // Every legacy run's picture agrees with the server's replay (floors, perfect drops, the end).
  let agree = 0;
  for (const r of legacy.runs) {
    const now = replaySkylineRun(r.seed, r.raw, r.rev);
    const sum = skylineRunSummary(r.seed, r.raw, r.rev);
    const perfectFloors = sum.floors.filter((f) => f.kind === "perfect" || f.kind === "gold").length;
    if (sum.placed === now.blocks && sum.floors.length === now.blocks + 1 && sum.perfects === now.perfects && perfectFloors === now.perfects && sum.survived === now.survived) agree++;
    else failures.push(`summary rev ${r.rev} seed ${r.seed}: ${sum.placed}/${sum.perfects} vs ${now.blocks}/${now.perfects}`);
    checks++;
  }
  console.log(`  ${agree} of ${legacy.runs.length} legacy runs: the picture matches the replay`);
  // A rev-11 run with trims, two lost lives and a wide-block rescue.
  let s = g.init(13);
  const taps: number[] = [];
  const lostAt: number[] = [];
  const checkpoints: ReturnType<typeof skylineCheckpoint>[] = [];
  for (let t = 1; t <= SKYLINE_RUN_TICKS && !g.isOver(s); t++) {
    const top = s.blocks[s.blocks.length - 1]!;
    const off = s.x - top.x;
    const overlap = Math.min(s.x + s.w, top.x + top.w) - Math.max(s.x, top.x);
    const rearmed = !s.lostTick || t - s.lostTick > SKYLINE_V11_REARM_TICKS;
    let tap = false;
    // Five trims (floors 3–7: the rescue follows), a miss on floors 10 and 17, perfect drops otherwise.
    if (s.placed >= 2 && s.placed < 7) tap = off > 6_000 && off < 8_000;
    else if ((s.placed === 9 || s.placed === 16) && (s.livesLost ?? 0) < (s.placed === 9 ? 1 : 2)) tap = rearmed && overlap <= 0;
    else tap = Math.abs(off) <= 700;
    if (tap) taps.push(t);
    const before = s.livesLost ?? 0;
    s = g.step(s, tap);
    if ((s.livesLost ?? 0) > before) lostAt.push(s.placed);
    if (s.tick % SKYLINE_CHECKPOINT_INTERVAL === 0) checkpoints.push(skylineCheckpoint(s));
  }
  const raw = encodeSkylineRun({ seed: 13, claimedScore: g.score(s), inputs: taps, endTick: s.tick, checkpoints });
  s10Raw = raw;
  const replay = replaySkylineRun(13, raw, SKYLINE_REV_LIVES);
  const sum = skylineRunSummary(13, raw, SKYLINE_REV_LIVES);
  ok(replay.livesLost === 2 && sum.livesLost === 2 && sum.losses.length === 2, `the run lost two lives (${sum.livesLost})`);
  ok(sum.losses.map((l) => l.floor - 1).join() === lostAt.join(), `each loss is drawn at the floor it happened on (${sum.losses.map((l) => l.floor - 1).join()})`);
  ok(sum.rescues >= 1 && sum.floors.some((f) => f.kind === "wide"), `the wide-block rescue shows as a wide floor (${sum.rescues} rescues)`);
  ok(sum.floors.some((f) => f.kind === "trim") && sum.bestStreak === replay.bestStreak && sum.bestRun !== null && sum.bestRun.to - sum.bestRun.from + 1 === sum.bestStreak, `trims show, and the best streak (${sum.bestStreak}) is the bracketed run`);
  ok(sum.placed === replay.blocks && sum.perfects === replay.perfects && !replay.flagged, "the picture's numbers are the replay's (an unflagged run)");
  // The drawing: transparent, every floor painted, the loss in red.
  const W = 340;
  const c = createCanvas(W, 240);
  const cx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  R.drawSkylineRunPicture(cx, sum, { width: W, height: 240 });
  const d = cx.getImageData(0, 0, W, 240).data;
  let red = 0;
  let goldPx = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i]! > 220 && d[i + 1]! < 140 && d[i + 2]! < 150 && d[i + 3]! > 200) red++;
    if (d[i]! > 200 && d[i + 1]! > 150 && d[i + 2]! < 110 && d[i + 3]! > 200) goldPx++;
  }
  ok(red > 30 && goldPx > 500, `the picture shows the lost lives in red (${red} px) and the perfect drops in gold (${goldPx} px)`);
  ok(d[3] === 0 && d[(10 * W + W - 2) * 4 + 3] === 0, "the picture is drawn on the reveal's own gradient (transparent around the tower)");
  ok(R.skylineRunFloorPx(72, 240) >= 3 && R.skylineRunFloorPx(5, 240) === 14, "floors are as tall as fit, 3 to 14 px");
  if (process.env.EFFECT_SHOTS) (await import("node:fs")).writeFileSync(`${process.env.EFFECT_SHOTS}/picture.png`, c.toBuffer("image/png"));
  // The component: three big numbers, a legend with short plain labels, one picture; wired into the shared reveal.
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { skylinePuzzle } = await import("../src/puzzles/skyline");
  ok(typeof skylinePuzzle.RunPicture === "function", "High Rise declares its run picture");
  const html = renderToStaticMarkup(React.createElement(skylinePuzzle.RunPicture!, { puzzle: { type: "skyline", seed: 13, skylineRev: SKYLINE_REV_LIVES } as never, myAnswer: raw }));
  const stat = (name: string) => new RegExp(`data-skyline-stat="${name}"[^>]*><span[^>]*>(\\d+)</span>`).exec(html)?.[1];
  ok(stat("floors") === String(replay.blocks) && stat("perfects") === String(replay.perfects) && stat("streak") === String(replay.bestStreak), `the big numbers are floors, perfect drops and the best streak (${stat("floors")}, ${stat("perfects")}, ${stat("streak")})`);
  ok(/text-4xl/.test(html) && (html.match(/<canvas/g) ?? []).length === 1, "big type and one picture");
  for (const name of ["perfect", "trim", "wide", "lost"]) ok(html.includes(`data-skyline-legend="${name}"`), `the legend names ${name}`);
  const text = html.replace(/<[^>]+>/g, " ");
  ok(!/[×→·]/.test(text) && !/\bcore\b|\bunits\b/i.test(text), "no stray ×, arrows or jargon in the picture's text");
  const arcadeReveal = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8");
  ok(/<GameRunPicture puzzle=\{puzzle\} myAnswer=\{myAnswer\} \/>/.test(arcadeReveal) && /ownPicture \? \[\]/.test(arcadeReveal), "the shared arcade reveal draws the game's picture, its numbers in place of the tiles");
}

/* 11. Stage 3: the reveal reads as Roofbound's, Moon Climb's and Iron Wall's. */
section("11. Stage 3: the shared reveal: the score, then the big numbers and the picture, then the breakdown");
{
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
  for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLCanvasElement", "Element", "Node", "Event", "MouseEvent", "PointerEvent", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history"] as const) {
    const value = (win as unknown as Record<string, unknown>)[key];
    const bind = typeof value === "function" && !/^[A-Z]/.test(key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import("react");
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ArcadeReveal } = await import("../src/components/duel/ArcadeReveal");
  const { loadGameDef } = await import("../src/lib/duel/gameLoader");
  const { buildArcadeReveal } = await import("../src/lib/arcade/reveal");
  await loadGameDef("skyline");
  await loadGameDef("flip");
  /** The reveal column's parts in document order. */
  const order = (host: HTMLElement): string[] => {
    const names: string[] = [];
    const walk = (el: Element) => {
      for (const child of Array.from(el.children)) {
        if (child.hasAttribute("data-reveal-score")) names.push("score");
        else if (child.hasAttribute("data-reveal-run-picture")) {
          names.push("picture");
          continue;
        } else if (child.hasAttribute("data-reveal-breakdown")) names.push(child.hasAttribute("hidden") ? "breakdown(folded)" : "breakdown");
        else if (child.hasAttribute("data-reveal-summary")) names.push("summary");
        else if (child.hasAttribute("data-reveal-tiles")) names.push("tiles");
        else if (child.hasAttribute("data-chart-panel")) names.push("chart");
        walk(child);
      }
    };
    const col = host.querySelector("[data-reveal-column]");
    if (col) walk(col);
    return names;
  };
  const mount = async (puzzle: unknown, answer: string, score: number, reveal: unknown, practice: boolean) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => {
      root.render(React.createElement(ArcadeReveal, { puzzle, myAnswer: answer, myScore: score, myReveal: reveal, practice, players: [{ slot: 0, name: "You", isMe: true, score }], round: 1 } as never));
    });
    await act(async () => void (await new Promise((r) => setTimeout(r, 20))));
    return { host, root };
  };
  const run = replaySkylineRun(13, s10Raw, SKYLINE_REV_LIVES);
  const reveal = buildArcadeReveal("skyline", run, run.score)!;
  const parts = reveal.lines.filter((l) => !/^Total → /.test(l));
  for (const practice of [true, false]) {
    const { host, root } = await mount({ type: "skyline", seed: 13, skylineRev: SKYLINE_REV_LIVES }, s10Raw, run.score, reveal, practice);
    const where = practice ? "practice" : "a room";
    const seen = order(host);
    // Changed with Joe's approval, 21 Nov 2026 (the reveal template, P2): in a room the chart is the stage's Room view, straight after the run's
    // picture ("Your run"), and the summary and folded breakdown sit under the stage, shown on both views.
    const want = practice ? ["score", "picture", "breakdown"] : ["score", "picture", "chart", "summary", "breakdown(folded)"];
    ok(seen.join() === want.join(), `${where}: the reveal reads ${want.join(" → ")} (${seen.join(" → ")})`);
    const pic = host.querySelector("[data-reveal-run-picture] [data-skyline-run-picture]");
    ok(Boolean(pic) && pic!.querySelectorAll("[data-skyline-stat]").length === 3 && pic!.querySelectorAll("canvas").length === 1, `${where}: the three big numbers and the picture straight under the score`);
    ok(!host.querySelector("[data-reveal-tiles]"), `${where}: no stat tiles (the picture's numbers say them)`);
    const rows = Array.from(host.querySelectorAll("[data-reveal-breakdown] li[data-line]")).map((li) => li.getAttribute("data-line"));
    ok(parts.length >= 4 && parts.every((l) => rows.includes(l)), `${where}: every stored part line is a row of the shared breakdown (${rows.length} rows for ${parts.length} parts)`);
    const above = host.querySelector("[data-reveal-column]")!.innerHTML.split("data-reveal-run-picture")[0]!;
    const loose = parts.filter((l) => above.includes(l.split(":")[0]! + ":") || above.includes(l));
    ok(loose.length === 0, `${where}: no breakdown line above the picture (${loose.join(" | ")})`);
    await act(async () => root.unmount());
    host.remove();
  }
  // Roofbound's reveal reads the same way: the shared layout, not a High Rise special case.
  const { encodeFlipLog } = await import("./flip-x200-record");
  const { FLIP_DEAL_V13 } = await import("../src/lib/duel/flipDealV13.server");
  const { replayFlipRun } = await import("../src/lib/duel/flip");
  const flipSeed = FLIP_DEAL_V13[0]!;
  const { raw: flipRaw } = encodeFlipLog(13, flipSeed, []);
  const flipRun = replayFlipRun(flipSeed, flipRaw, 13);
  const flipReveal = buildArcadeReveal("flip", flipRun, flipRun.score);
  ok(Boolean(flipReveal), "Roofbound's stored reveal builds");
  if (flipReveal) {
    const { host, root } = await mount({ type: "flip", seed: flipSeed, flipRev: 13 }, flipRaw, flipRun.score, flipReveal, true);
    const seen = order(host);
    ok(seen.join() === "score,picture,breakdown" && Boolean(host.querySelector("[data-reveal-run-picture] [data-run-picture='flip']")), `Roofbound's reveal reads the same: ${seen.join(" → ")}`);
    await act(async () => root.unmount());
    host.remove();
  }
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} High Rise overhaul checks`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} High Rise overhaul checks`);
