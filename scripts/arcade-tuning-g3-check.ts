/**
 * Taller worlds, batch 3 (16 Oct 2026): Grappler swingRev 9 (a 390 × 730
 * cavern), Orbit orbitRev 8 (a 390 × 650 view over its SET CHECKPOINT row) and
 * Ball Tracker btRev 4 (the 700-wide board with 12 rows, 700 × 1300).
 *
 *  1. Old rounds: 72 real runs recorded with the code on main before the change
 *     on every revision the three games ever stamped (Grappler and Ball Tracker
 *     unstamped included; Orbit from orbitRev 4, its rev 1–3 paths being proved
 *     by orbit-legacy-replay-check and orbit-rev3-replay-check), in
 *     scripts/fixtures/arcade-tuning-g3-legacy.json (scripts/arcade-tuning-g3-legacy.ts,
 *     skill-band bots through the server encode + replay path), replay through
 *     today's server path to the same score and the same final state, unflagged;
 *     old states carry no `worldH`. 24 runs on the new stamps
 *     (scripts/fixtures/arcade-tuning-g3-runs.json) replay the same way.
 *  2. New rounds: the room generators stamp the taller revisions; each new start
 *     state is the previous revision's with `worldH` added (and only what
 *     follows from it moved); the height is folded into the checkpoint checksum;
 *     stages, reveals, intro demos and effects take the height from the stored
 *     revision; older revisions keep their own.
 *  3. Grappler: the lava 110 px lower under the same ceiling, anchors, spikes and
 *     stalactites, each jet's top where it was; every star re-proved on the
 *     taller cavern (provedLines), clear of anchors, jets and stalactites; the
 *     rooms' bank is the SWING_V4_BANK courses whose search reaches 500 m with
 *     every star on the taller cavern (scripts/swing-bank.ts --tall), and a
 *     sample of them is re-proved here to 150 through the server replay.
 *  4. Orbit: rev 8 plays rev 7 tick for tick (the view is display only): every
 *     bank course rooms deal, played with its proof taps and its black holes in
 *     place, ends in the same state on both and finishes on rev 8 exactly when it
 *     does on rev 7 (451 of 504: every hole-free course, and the hole courses
 *     whose planet-by-planet flights miss rev 7's swept holes); the camera keeps
 *     the rocket on screen and shows the course further ahead (reported).
 *  5. Ball Tracker: the 12-row board (the 9-row one unchanged), the same 30
 *     marbles, release pace and rules; the earliest last landing (3228) proved
 *     by search; every one of the 400 tall bank courses re-solved by its stored
 *     playbook on btRev 4 (all 30 home), every tray reachable at every layout.
 *  6. Scores: the refitted curves keep the band rules; 150 is reached through
 *     the server replay on each new stamp; idle runs score 0.
 *  7. Each game's intro demo stays stopped until one is recorded on the taller revision.
 *
 *   bun scripts/arcade-tuning-g3-check.ts      (CHECKS_FULL=1: more Grappler bank courses re-proved)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { TuningG3Record } from "./arcade-tuning-g3-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bandPoints, bandTop, BAND_FINISH_BONUS, BAND_PARTIAL_TOP, type BandCurve } from "../src/lib/arcade/scoreBands";
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { decodeInputEvents, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  ARCADE_FX_SPECS,
  BALLTRACK_FX,
  ORBIT3_FX,
  SWING_FX,
  balltrackFxFor,
  orbit3FxFor,
  swingFxFor,
} from "../src/lib/arcade/arcadeFxGames.renderer";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "../src/lib/arcade/revealRenderers";
import {
  swingCheckpoint,
  swingGameFor,
  swingProvedPoints,
  swingWorldHFor,
  SWING_JET_HALF_W,
  SWING_REV_SPREAD,
  SWING_REV_TALL,
  SWING_ROCK_HALF_W,
  SWING_STARS,
  SWING_STAR_TOUCH,
  SWING_TALL_DROP,
  SWING_TALL_H,
  SWING_V9_BAND_CURVE,
  type SwingState,
} from "../src/lib/arcade/swing";
import { orbitCheckpoint, ORBIT_INPUT_TAP, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_TOTAL } from "../src/lib/arcade/orbit";
import {
  decodeOrbitHoles,
  decodeRev3Planets,
  initSweptFrom,
  initTallFrom,
  orbitRev3Game,
  orbitWorldHFor,
  ORBIT_BAND_CURVE,
  ORBIT_REV3_WORLD_W,
  ORBIT_TALL_H,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { orbitCamera, orbitCameraResetCache, orbitVisiblePlanets, orbitViewH, ORBIT_CAM_VIEW_H, ORBIT_TALL_VIEW_H } from "../src/lib/arcade/orbitCamera";
import {
  btCheckpoint,
  btLayout,
  btNext,
  btRotatable,
  btTraysAt,
  ballTrackWorldHFor,
  makeBallTrackGame,
  BT_ALWAYS_FIXED,
  BT_BALLS,
  BT_COLS,
  BT_CORNER,
  BT_DROP_TICKS,
  BT_H,
  BT_HOPPER_COL,
  BT_KIND,
  BT_LAST_LAND_MIN,
  BT_LAST_LAND_MIN_TALL,
  BT_LAYOUT,
  BT_LAYOUT_TALL,
  BT_REV_BAND,
  BT_REV_TALL,
  BT_ROWS,
  BT_STEP_TICKS,
  BT_TALL_H,
  BT_TALL_ROWS,
  BT_V4_BAND_CURVE,
  BT_W,
  type BtState,
} from "../src/lib/arcade/ballTrack";
import { replaySwingRun } from "../src/lib/duel/swing";
import { replayOrbitRun } from "../src/lib/duel/orbit";
import { generateOrbit, generateSwing } from "../src/lib/duel/arcade.server";
import { generateBallTrack } from "../src/lib/duel/ballTrack.server";
import { encodeSwingRun } from "../src/lib/duel/swing";
import { proveSwingSeedV4 } from "../src/lib/duel/swingProof.server";
import { SWING_V4_BANK } from "../src/lib/duel/swingBankV4.server";
import { SWING_V9_BANK } from "../src/lib/duel/swingBankV9.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { BALL_TRACK_BANK_TALL } from "../src/lib/duel/ballTrackBankTall.server";

const FP = 256;
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
const read = (path: string) => readFileSync(path, "utf8");
const sameBut = (a: any, b: any, keys: string[]) => {
  const strip = (s: any) => Object.fromEntries(Object.entries(s).filter(([k]) => !keys.includes(k)));
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
};

/** A stored run's replay through the server path (the skill-band spec's). */
function replayStored(run: TuningG3Record): { score: number; state: any; flagged: boolean } {
  const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
  return GAME_BY_TYPE.get(run.type as never)!.replay(run.seed, raw, run.rev);
}

/** A skill-band player's run on a revision, sent through the server's encode + replay. */
async function botRun(type: string, rev: number, level: SkillLevel, n: number) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const { bot } = await import(`./arcade-skill-bands/bots/${type}.ts`);
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(spec.type, seed, level) });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const byTick = new Map((out.events ?? []).map((e: any) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, byTick.get(t) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  return { score, result: spec.replay(seed, raw, rev) };
}

/* ============================== 1. Stored rounds ============================== */
section("Stored rounds replay and score exactly as before");
for (const [file, label] of [["scripts/fixtures/arcade-tuning-g3-legacy.json", "before"], ["scripts/fixtures/arcade-tuning-g3-runs.json", "taller"]] as const) {
  const fixture = JSON.parse(read(file)) as { runs: TuningG3Record[] };
  const per = new Map<string, number>();
  for (const run of fixture.runs) {
    const result = replayStored(run);
    ok(result.score === run.score && !result.flagged, `${label} ${run.type} rev ${run.rev} ${run.level}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${label} ${run.type} rev ${run.rev} ${run.level}: the replayed final state differs`);
    if (label === "before") ok(result.state.worldH === undefined, `${run.type} rev ${run.rev}: an old state carries worldH`);
    else ok(typeof result.state.worldH === "number", `${run.type} rev ${run.rev}: a taller state has no worldH`);
    per.set(`${run.type} ${run.rev ?? "-"}`, (per.get(`${run.type} ${run.rev ?? "-"}`) ?? 0) + 1);
  }
  ok(fixture.runs.length === (label === "before" ? 72 : 24), `${label}: ${fixture.runs.length} stored runs`);
  console.log(`  ${label}: ${fixture.runs.length} runs (${[...per].map(([k, v]) => `${k}: ${v}`).join(", ")})`);
}

/* ============================== 2. New rounds ============================== */
section("New rounds: stamps, start states, checksums, worlds by revision");
{
  for (let k = 0; k < 12; k++) {
    const swing = generateSwing();
    ok(swing.swingRev === SWING_REV_TALL && SWING_V9_BANK.some((e) => e.seed === swing.seed), "rooms deal swingRev 9 on a course re-proved for the taller cavern");
    const orbit = generateOrbit();
    ok(orbit.orbitRev === ORBIT_REV_TALL && orbit.planets?.length === ORBIT_TOTAL + 1, "rooms deal orbitRev 8 with the course's planets");
    const bt = generateBallTrack();
    ok(bt.btRev === BT_REV_TALL && bt.course.rows === BT_TALL_ROWS && JSON.stringify(bt.course) === JSON.stringify(BALL_TRACK_BANK_TALL[bt.seed - 1]!.course), "rooms deal btRev 4 on a 12-row bank course");
  }
  for (const [type, field, rev] of [["swing", "swingRev", SWING_REV_TALL], ["orbit", "orbitRev", ORBIT_REV_TALL], ["balltrack", "btRev", BT_REV_TALL]] as const)
    ok(puzzleUsesBands({ type, [field]: rev } as never), `${type} ${rev} scores on the bands`);

  ok(swingWorldHFor(SWING_REV_TALL) === 730 && swingWorldHFor(SWING_REV_SPREAD) === 620 && swingWorldHFor(undefined) === 620, "Grappler world heights by revision");
  ok(orbitWorldHFor(ORBIT_REV_TALL) === 650 && ORBIT_TALL_H === ORBIT_TALL_VIEW_H && orbitWorldHFor(ORBIT_REV_SWEPT) === 620 && orbitWorldHFor(undefined) === 620, "Orbit view heights by revision");
  ok(ballTrackWorldHFor(BT_REV_TALL) === 1300 && BT_TALL_H === 1300 && ballTrackWorldHFor(BT_REV_BAND) === 1000 && BT_H === 1000 && BT_W === 700, "Ball Tracker board heights by revision (700 × 1300 is 390 × 724 on a 390-wide arena)");

  // Grappler: rev 9 starts as rev 8 with the lava lower, jets taller by the same amount, stars re-proved, worldH.
  for (const { seed } of SWING_V9_BANK.slice(0, 6)) {
    const s9 = swingGameFor(SWING_REV_TALL).init(seed);
    const s8 = swingGameFor(SWING_REV_SPREAD).init(seed);
    ok(s9.worldH === SWING_TALL_H && sameBut(s9, s8, ["worldH", "floor", "jets", "starSpots"]), `Grappler ${seed}: swingRev 9 starts as swingRev 8 (the same cavern, anchors, hazards and rng) with worldH`);
    ok(s9.floor.every((y, i) => y === s8.floor[i]! + SWING_TALL_DROP), `Grappler ${seed}: every lava point 110 px lower`);
    ok(s9.jets!.every((j, i) => sameBut(j, s8.jets![i], ["h"]) && j.h === s8.jets![i]!.h + SWING_TALL_DROP), `Grappler ${seed}: each jet erupts 110 px higher from the lower lava (its top unchanged)`);
    ok(swingCheckpoint(s9).checksum !== swingCheckpoint({ ...s9, worldH: undefined }).checksum, "Grappler: worldH folds into the checksum");
  }
  // Orbit: rev 8 starts as rev 7 with the view height.
  for (const entry of ORBIT_HOLE_BANK.slice(0, 6)) {
    const planets = decodeRev3Planets(ORBIT_REV3_BANK.find((e) => e.seed === entry.seed)!.planets);
    const o8 = initTallFrom(planets, ORBIT_REV3_WORLD_W, decodeOrbitHoles(entry.holes));
    const o7 = initSweptFrom(planets, ORBIT_REV3_WORLD_W, decodeOrbitHoles(entry.holes));
    ok(o8.worldH === ORBIT_TALL_H && sameBut(o8, o7, ["worldH"]), `Orbit ${entry.seed}: orbitRev 8 starts as orbitRev 7 with worldH`);
    ok(orbitCheckpoint(o8 as never).checksum !== orbitCheckpoint({ ...o8, worldH: undefined } as never).checksum, "Orbit: worldH folds into the checksum");
  }
  // Ball Tracker: rev 4 starts as rev 3 on its own board, with worldH.
  for (const entry of BALL_TRACK_BANK_TALL.slice(0, 6)) {
    const b4 = makeBallTrackGame(entry.course, BT_REV_TALL).init(1);
    const b3 = makeBallTrackGame(entry.course, BT_REV_BAND).init(1);
    ok(b4.worldH === BT_TALL_H && sameBut(b4, b3, ["worldH"]) && b4.vert.length === BT_COLS * BT_TALL_ROWS, "Ball Tracker: btRev 4 starts as btRev 3 on the 84-cell board with worldH");
    ok(btCheckpoint(b4).checksum !== btCheckpoint({ ...b4, worldH: undefined }).checksum, "Ball Tracker: worldH folds into the checksum");
    ok(makeBallTrackGame(entry.course, BT_REV_TALL).inputRanges![0]!.a[1] === BT_COLS * BT_TALL_ROWS - 1, "Ball Tracker: a tap may name any of the 84 cells");
  }

  // Effects: the tall specs in ARCADE_FX_SPECS, older rounds at their own height, through fxSpecAt.
  const fx = ARCADE_FX_SPECS as Record<string, { height: number }>;
  ok(fx.swing!.height === 730 && fx.orbit!.height === 650 && fx.balltrack!.height === 1300, "ARCADE_FX_SPECS hold the taller heights rooms deal");
  ok(swingFxFor({ worldH: 730 } as SwingState).height === 730 && swingFxFor({} as SwingState) === SWING_FX, "Grappler effects by state height");
  ok(orbit3FxFor({ worldH: 650 } as OrbitRev3State).height === 650 && orbit3FxFor({} as OrbitRev3State) === ORBIT3_FX, "Orbit effects by view height");
  ok(balltrackFxFor({ worldH: 1300 } as BtState).height === 1300 && balltrackFxFor({} as BtState) === BALLTRACK_FX, "Ball Tracker effects by state height");

  // Reveals and intro demos: the stored revision's height; older rounds keep theirs.
  const rh = (type: string, puzzle: any) => revealWorldH(ARCADE_REVEAL_RENDERERS[type]!, { type, seed: 1, ...puzzle });
  ok(rh("swing", { swingRev: SWING_REV_TALL }) === 730 && rh("swing", { swingRev: SWING_REV_SPREAD }) === 620 && rh("swing", {}) === 620, "Grappler reveal height by revision");
  ok(rh("orbit", { orbitRev: ORBIT_REV_TALL }) === 650 && rh("orbit", { orbitRev: ORBIT_REV_SWEPT }) === 620 && rh("orbit", {}) === 620, "Orbit reveal height by revision");
  ok(rh("balltrack", { btRev: BT_REV_TALL }) === 1300 && rh("balltrack", { btRev: BT_REV_BAND }) === 1000 && rh("balltrack", {}) === 1000, "Ball Tracker reveal height by revision");
  // Stages size their arena slot from the stored revision.
  ok(/worldH=\{swingWorldHFor\(data\?\.swingRev\)\}/.test(read("src/puzzles/swing.tsx")), "Grappler's stage sizes its world from swingRev");
  ok(/worldH=\{orbitWorldHFor\(data\?\.orbitRev\)\}/.test(read("src/puzzles/orbit.tsx")), "Orbit's stage sizes its view from orbitRev");
  ok(/btLayout\(course\)/.test(read("src/puzzles/ballTrack.tsx")) && /ArcadeArenaSlot width=\{BT_W\} height=\{BT_H\}/.test(read("src/puzzles/ballTrack.tsx")), "Ball Tracker's stage sizes its board from the stored course");
}

/* ============================== 3. Grappler ============================== */
section("Grappler: a taller cavern; stars re-proved; the bank re-proved to 500 m");
{
  ok(SWING_V9_BANK.length >= 290 && SWING_V9_BANK.every((e) => e.stars === SWING_STARS && SWING_V4_BANK.some((v) => v.seed === e.seed)), `the taller-cavern bank: ${SWING_V9_BANK.length} of ${SWING_V4_BANK.length} SWING_V4_BANK courses, each proved with every star`);
  const order = SWING_V9_BANK.map((e) => SWING_V4_BANK.findIndex((v) => v.seed === e.seed));
  ok(order.every((i, k) => k === 0 || i > order[k - 1]!), "the taller-cavern bank keeps SWING_V4_BANK's order");
  const sample = SWING_V9_BANK.slice(0, FULL ? 60 : 12);
  let stars = 0;
  let lavaMin = Infinity;
  let moved = 0;
  for (const { seed } of sample) {
    const s = swingGameFor(SWING_REV_TALL).init(seed);
    const s8 = swingGameFor(SWING_REV_SPREAD).init(seed);
    lavaMin = Math.min(lavaMin, ...s.floor);
    ok((s.starSpots ?? []).length === SWING_STARS, `course ${seed}: ten stars`);
    const proved = new Set<string>();
    for (let j = 1; j + 1 < s.anchors.length; j++) {
      // Only the gaps near a star are searched.
      if (!(s.starSpots ?? []).some(([x]) => Math.abs(x - s.anchors[j]!.x) < 600 * FP)) continue;
      for (const [x, y] of swingProvedPoints(s, j)) proved.add(`${x},${y}`);
    }
    for (const [k, [x, y]] of (s.starSpots ?? []).entries()) {
      ok(proved.has(`${x},${y}`), `course ${seed} star ${k}: on a line proved from a standard swing in the taller cavern`);
      ok(s.anchors.every((a) => Math.abs(a.x - x) > 30 * FP || Math.abs(a.y - y) > 30 * FP), `course ${seed} star ${k}: clear of the anchor rings`);
      ok((s.jets ?? []).every((jet) => Math.abs(jet.x - x) > SWING_JET_HALF_W + SWING_STAR_TOUCH), `course ${seed} star ${k}: clear of the lava jets`);
      ok((s.rocks ?? []).every((r) => Math.abs(r.x - x) > SWING_ROCK_HALF_W + SWING_STAR_TOUCH), `course ${seed} star ${k}: clear of the stalactites`);
      stars++;
      const was = s8.starSpots?.[k];
      if (!was || was[0] !== x || was[1] !== y) moved++;
    }
  }
  ok(lavaMin >= (540 + 110) * FP, "the lava never rises above 650 px");
  console.log(`  ${stars} stars on ${sample.length} bank courses on proved lines (${moved} at a different spot from rev 8); the lava at 650–700 px`);
  // The search on the taller cavern reaches 500 m with every star; its run scores 150 through the server replay.
  for (const { seed } of SWING_V9_BANK.slice(0, FULL ? 8 : 2)) {
    const w = proveSwingSeedV4(seed, { rev: SWING_REV_TALL });
    ok(!!w && w.stars === SWING_STARS, `course ${seed}: the taller-cavern search finishes with every star`);
    if (!w) continue;
    const game = swingGameFor(SWING_REV_TALL);
    let state = game.init(seed);
    const events = new Map(w.log.map((e) => [e.t, e]));
    const checkpoints: unknown[] = [];
    while (!game.isOver(state)) {
      state = game.step(state, events.get(state.tick + 1) ?? null);
      if (state.tick % 300 === 0) checkpoints.push(swingCheckpoint(state));
    }
    const raw = encodeSwingRun({ seed, claimedScore: game.score(state), events: w.log, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
    const result = replaySwingRun(seed, raw, SWING_REV_TALL);
    ok(result.score === 150 && !result.flagged && result.metres >= 500, `course ${seed}: 150 through the server replay (got ${result.score})`);
  }
}

/* ============================== 4. Orbit ============================== */
section("Orbit: rev 7 play in a taller view; every bank course finishes with its proof taps");
{
  const bankBySeed = new Map(ORBIT_REV3_BANK.map((e) => [e.seed, e]));
  const holesBySeed = new Map(ORBIT_HOLE_BANK.map((e) => [e.seed, e]));
  const tapAt = (taps: Set<number>) => (t: number): ArcadeInputEvent | null => (taps.has(t) ? { t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
  let finished = 0;
  let finished7 = 0;
  let same = 0;
  let aheadOld = 0;
  let aheadNew = 0;
  let planetsOld = 0;
  let planetsNew = 0;
  let samples = 0;
  let offScreen = 0;
  const viewed = FULL ? ORBIT_REV3_BANK.length : 40;
  for (const [n, course] of ORBIT_REV3_BANK.entries()) {
    const holes = holesBySeed.get(course.seed);
    const taps = new Set(course.taps);
    const tap = tapAt(taps);
    const planets = decodeRev3Planets(course.planets);
    const rows = decodeOrbitHoles(holes?.holes ?? []);
    let s8 = initTallFrom(planets, ORBIT_REV3_WORLD_W, rows);
    let s7 = initSweptFrom(decodeRev3Planets(course.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes?.holes ?? []));
    const camera = n < viewed;
    if (camera) orbitCameraResetCache();
    while (!orbitRev3Game.isOver(s8) && s8.tick < orbitRev3Game.runTicks) {
      const input = tap(s8.tick + 1);
      s8 = orbitRev3Game.step(s8, input);
      s7 = orbitRev3Game.step(s7, input);
      if (camera && s8.flying === 0 && s8.tick % 6 === 0) {
        // Both cameras on the same tick: how far above the rocket each view reaches, and how many planets ahead show.
        const c8 = orbitCamera(s8);
        const c7 = orbitCamera(s7);
        const y = s8.y / FP;
        aheadNew += y - c8.y;
        aheadOld += y - c7.y;
        planetsNew += orbitVisiblePlanets(s8, c8).filter((i) => i > s8.cur).length;
        planetsOld += orbitVisiblePlanets(s7, c7).filter((i) => i > s7.cur).length;
        if (y < c8.y || y > c8.y + orbitViewH(s8) || s8.x / FP < c8.x || s8.x / FP > c8.x + 390) offScreen++;
        samples++;
      }
    }
    if (s8.finished === 1) finished++;
    if (s7.finished === 1) finished7++;
    ok(s8.finished === s7.finished, `course ${course.seed}: its proof taps finish on orbitRev 8 exactly when they finish on orbitRev 7`);
    if (sameBut(s8, s7, ["worldH"]) && orbitRev3Game.score(s8) === orbitRev3Game.score(s7)) same++;
  }
  // Every course without holes finishes with its own taps; a course with holes is played with its own planet-by-planet
  // taps, the holes in place (the black-hole witness was proved on orbitRev 4's timing, before the fly-in). Since rev 7's
  // swept holes, some of those flights cross a hole and jump ahead, off the taps' timing: the same courses on rev 7 and rev 8.
  ok(finished === finished7 && finished >= 450, `the bank's proof taps finish ${finished} of ${ORBIT_REV3_BANK.length} courses on orbitRev 8, as on orbitRev 7 (${finished7})`);
  ok(same === ORBIT_REV3_BANK.length, `orbitRev 8 plays orbitRev 7 tick for tick (${same} / ${ORBIT_REV3_BANK.length} proof runs end in the same state and score)`);
  ok(offScreen === 0, `the rocket stays inside the taller view on every sampled tick (${offScreen} outside)`);
  ok(samples > 0 && aheadNew / samples - aheadOld / samples >= 20, "the taller view shows the course further ahead");
  ok(ORBIT_CAM_VIEW_H === 620 && orbitViewH({}) === 620 && orbitViewH({ worldH: 650 }) === 650, "older rounds keep the 620 view");
  console.log(
    `  ${finished} of ${ORBIT_REV3_BANK.length} bank courses finish with their proof taps on orbitRev 8 (${finished7} on orbitRev 7); on ${viewed} of them, settled in orbit, the view reaches ` +
      `${(aheadOld / samples).toFixed(0)} → ${(aheadNew / samples).toFixed(0)} px above the rocket (+${(aheadNew / samples - aheadOld / samples).toFixed(0)} px) and shows ` +
      `${(planetsOld / samples).toFixed(2)} → ${(planetsNew / samples).toFixed(2)} planets ahead`,
  );
}

/* ============================== 5. Ball Tracker ============================== */
section("Ball Tracker: 12 rows, the same marbles and rules; every tall course solvable");
{
  // The 9-row board is unchanged.
  ok(BT_LAYOUT.rows === BT_ROWS && BT_ROWS === 9 && BT_KIND === BT_LAYOUT.kind && BT_CORNER === BT_LAYOUT.corner && BT_ALWAYS_FIXED === BT_LAYOUT.alwaysFixed, "the 9-row board is the original layout");
  ok(fnv(JSON.stringify([BT_KIND, BT_CORNER, BT_ALWAYS_FIXED])) === 1469370889, "the 9-row board's tiles, corners and fixed straights are byte for byte the original");
  ok(BT_LAYOUT_TALL.rows === 12 && BT_LAYOUT_TALL.kind.length === 84 && BT_LAYOUT_TALL.bottom === 77 && BT_LAYOUT_TALL.h === 1300, "the tall board: 7 × 12 cells, 1300 px");
  ok(BT_LAYOUT_TALL.alwaysFixed.join() === [10, 17, 24, 31, 38, 45, 52, 59].join(), "the hopper column is fixed down to three rows above the bottom");
  ok(BT_BALLS === 30 && BT_DROP_TICKS === 103 && BT_STEP_TICKS === 16, "the same 30 marbles, release pace and step");
  // The earliest last landing on the tall board: a breadth-first search over every tube setting.
  const minSteps = (rows: number) => {
    const layout = rows === 12 ? BT_LAYOUT_TALL : BT_LAYOUT;
    const course = { trays: [-1, 0, 1, 2, 3, 0, 1], relay: { tick: 1e9, trays: [] }, shuffle: { tick: 1e9, trays: [] }, balls: [], fixed: [], ...(rows === 12 ? { rows: 12 } : {}) } as never;
    let frontier = [{ cell: BT_HOPPER_COL, above: true }];
    const seen = new Set<string>();
    for (let step = 2; step < 40; step++) {
      const next: typeof frontier = [];
      for (const q of frontier) {
        for (const v of layout.kind[q.cell] === 2 ? [false] : [false, true]) {
          const n = btNext(q.cell, q.above, v, course, 0, 0);
          if (n.cell >= 100) return step + 1;
          if (n.cell < 0 || seen.has(`${n.cell}|${n.fromAbove}`)) continue;
          seen.add(`${n.cell}|${n.fromAbove}`);
          next.push({ cell: n.cell, above: n.fromAbove });
        }
      }
      frontier = next;
    }
    return -1;
  };
  const lastRelease = 1 + (BT_BALLS - 1) * BT_DROP_TICKS;
  ok(lastRelease + minSteps(9) * BT_STEP_TICKS === BT_LAST_LAND_MIN, `9 rows: the last marble lands at tick ${BT_LAST_LAND_MIN} at the earliest (${minSteps(9)} steps)`);
  ok(lastRelease + minSteps(12) * BT_STEP_TICKS === BT_LAST_LAND_MIN_TALL, `12 rows: the last marble lands at tick ${BT_LAST_LAND_MIN_TALL} at the earliest (${minSteps(12)} steps)`);
  // Every tall bank course: rows 12, the bank's rules, every tray reachable at every layout, all 30 home by its playbook on btRev 4.
  let solved = 0;
  let reachable = 0;
  for (const entry of BALL_TRACK_BANK_TALL) {
    const c = entry.course;
    const layout = btLayout(c);
    const upper = c.fixed.filter((x) => x < (layout.rows - 3) * BT_COLS);
    if (c.rows !== BT_TALL_ROWS || layout !== BT_LAYOUT_TALL || upper.length < 12 || upper.length > 15 || c.fixed.some((x) => x >= layout.bottom || layout.kind[x] !== 1) || c.balls.length !== BT_BALLS) ok(false, `a tall course breaks the bank's rules`);
    const rot = new Set(btRotatable(c));
    const reach = [0, c.relay.tick, c.shuffle.tick].every((t) =>
      btTraysAt(c, t).every((tray, col) => {
        if (tray < 0) return true;
        const queue = [{ cell: BT_HOPPER_COL, above: true }];
        const seen = new Set<string>();
        while (queue.length) {
          const q = queue.shift()!;
          for (const v of layout.kind[q.cell] === 2 ? [false] : rot.has(q.cell) ? [false, true] : [false]) {
            const n = btNext(q.cell, q.above, v, c, t, 0);
            if (n.cell >= 100) {
              if (n.cell - 100 === col) return true;
              continue;
            }
            if (n.cell < 0 || seen.has(`${n.cell}|${n.fromAbove}`)) continue;
            seen.add(`${n.cell}|${n.fromAbove}`);
            queue.push({ cell: n.cell, above: n.fromAbove });
          }
        }
        return false;
      }),
    );
    if (reach) reachable++;
    const game = makeBallTrackGame(c, BT_REV_TALL);
    const byTick = new Map(decodeInputEvents(entry.playbook).map((e) => [e.t, e]));
    let s = game.init(1);
    while (!game.isOver(s)) s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.home === BT_BALLS && game.score(s) >= 140) solved++;
  }
  ok(BALL_TRACK_BANK_TALL.length === 400, `${BALL_TRACK_BANK_TALL.length} tall courses`);
  ok(reachable === BALL_TRACK_BANK_TALL.length, `every tray reachable at the start, after the re-lay and after the shuffle on every tall course (${reachable} / ${BALL_TRACK_BANK_TALL.length})`);
  ok(solved === BALL_TRACK_BANK_TALL.length, `every tall course's stored playbook brings all 30 home on btRev 4 (${solved} / ${BALL_TRACK_BANK_TALL.length})`);
  console.log(`  ${solved} / ${BALL_TRACK_BANK_TALL.length} tall courses solved by their playbooks on btRev 4; earliest last landing ${BT_LAST_LAND_MIN} → ${BT_LAST_LAND_MIN_TALL}`);
}

/* ============================== 6. Scores ============================== */
section("Refitted curves keep the band rules; 150 is reachable");
{
  const curves: [string, BandCurve, number, number][] = [
    ["swing", SWING_V9_BAND_CURVE, 1, 10],
    ["orbit", ORBIT_BAND_CURVE, 1, 0],
    ["balltrack", BT_V4_BAND_CURVE, 1, 0],
  ];
  for (const [type, curve, unit] of curves) {
    const { units, points } = curve;
    ok(units[0] === 0 && points[0] === 0, `${type}: curve starts at (0, 0)`);
    for (let i = 1; i < units.length; i++) ok(units[i]! > units[i - 1]! && points[i]! >= points[i - 1]!, `${type}: knot ${i} ascends and never falls`);
    ok(Math.max(...points) === BAND_PARTIAL_TOP && bandPoints(curve, bandTop(curve)) === BAND_PARTIAL_TOP, `${type}: tops out at ${BAND_PARTIAL_TOP}`);
    const full = units.at(-1)!;
    ok(bandPoints(curve, full) + BAND_FINISH_BONUS - bandPoints(curve, full - unit) <= 12, `${type}: one unit short of the top is at most 12 below a finish`);
  }
  ok(BT_LAST_LAND_MIN_TALL > BT_LAST_LAND_MIN, "Ball Tracker's speed window starts at the tall board's earliest landing");
  // An idle run scores 0.
  const idle: [string, any][] = [
    ["swing", swingGameFor(SWING_REV_TALL)],
    ["balltrack", makeBallTrackGame(BALL_TRACK_BANK_TALL[0]!.course, BT_REV_TALL)],
  ];
  for (const [type, game] of idle) {
    let s: any = game.init(SWING_V9_BANK[0]!.seed);
    while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, null);
    ok(game.score(s) === 0, `${type}: doing nothing scores 0`);
  }
  {
    const e = ORBIT_HOLE_BANK[0]!;
    let s = initTallFrom(decodeRev3Planets(ORBIT_REV3_BANK.find((c) => c.seed === e.seed)!.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes));
    while (!orbitRev3Game.isOver(s) && s.tick < orbitRev3Game.runTicks) s = orbitRev3Game.step(s, null);
    ok(orbitRev3Game.score(s) === 0, "orbit: doing nothing scores 0");
  }
  // Best scores through the server replay: skill-band players reach 150 on Orbit (near-perfect) and Ball Tracker
  // (great, all 30 home early); Grappler's 150 is its bank witness above.
  const proofs: [string, number, SkillLevel, number][] = [
    ["orbit", ORBIT_REV_TALL, "near", 1],
    ["balltrack", BT_REV_TALL, "great", 1],
  ];
  for (const [type, rev, level, n] of proofs) {
    const { score, result } = await botRun(type, rev, level, n);
    ok(result.score === 150 && score === result.score && !result.flagged, `${type} rev ${rev}: a ${level} run reaches ${result.score} through the server replay (want 150)`);
    console.log(`  ${type} rev ${rev}: ${result.score} via the server replay (${level}, room seed ${n})`);
  }
  // A recorded orbitRev 8 run replays through the puzzle-shaped server path with the stored planets and holes.
  {
    const e = ORBIT_HOLE_BANK[0]!;
    const planets = ORBIT_REV3_BANK.find((c) => c.seed === e.seed)!.planets;
    let s = initTallFrom(decodeRev3Planets(planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes));
    const taps = new Set(e.taps);
    const events: ArcadeInputEvent[] = [];
    const checkpoints: unknown[] = [];
    while (!orbitRev3Game.isOver(s) && s.tick < orbitRev3Game.runTicks) {
      const t = s.tick + 1;
      const ev = taps.has(t) ? { t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null;
      if (ev) events.push(ev);
      s = orbitRev3Game.step(s, ev);
      if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
    }
    const raw = GAME_BY_TYPE.get("orbit")!.encode({ seed: e.seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints }, ORBIT_REV_TALL, e.seed);
    const result = replayOrbitRun(e.seed, raw, ORBIT_REV_TALL, planets, e.holes);
    ok(result.score === orbitRev3Game.score(s) && !result.flagged && (result.state as OrbitRev3State).worldH === ORBIT_TALL_H, `orbit: a stored orbitRev 8 round replays through replayOrbitRun to ${result.score}`);
  }
}

/* ============================== 7. Intro demos ============================== */
section("Intro demos stay stopped until re-recorded on the taller revision");
{
  const src = read("src/lib/duel/introDemo.functions.ts");
  ok(/data\.type === "swing" && demo\?\.puzzle\.type === "swing" && demo\.puzzle\.swingRev !== SWING_REV_TALL\) return null/.test(src), "Grappler's demo plays only on swingRev 9");
  ok(/data\.type === "orbit" && demo\?\.puzzle\.type === "orbit" && demo\.puzzle\.orbitRev !== ORBIT_REV_TALL\) return null/.test(src), "Orbit's demo plays only on orbitRev 8");
  ok(/data\.type === "balltrack" && demo\?\.puzzle\.type === "balltrack" && demo\.puzzle\.btRev !== BT_REV_TALL\) return null/.test(src), "Ball Tracker's demo plays only on btRev 4");
}

if (failures.length) {
  console.log(`FAIL arcade-tuning-g3: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`arcade-tuning-g3: ${checks} checks passed — 72 stored runs on every older revision and 24 on the taller ones replay unchanged; rooms deal swingRev 9, orbitRev 8 and btRev 4; worlds, reveals and effects by revision; Grappler's stars and bank re-proved, Orbit's bank courses finish in the taller view, every tall Ball Tracker course solvable; refitted curves and 150 via the server replay; demos stopped`);
