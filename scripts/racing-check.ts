/**
 * Apex (`racing`; racingRev 1 and, dealt since 31 Oct 2026, racingRev 2; docs/arcade-standard/racing.md): the sim,
 * the deals and the standard's parts. Sections 1–7 prove racingRev 1 as it was; 8 proves racingRev 1 replays exactly as
 * recorded on main before racingRev 2; 9–12 prove racingRev 2.
 *
 *  1. deterministic: the same log replays to the same state twice, and the server path agrees with the phone's run;
 *  2. the deal: every RACING_DEAL entry a valid seed (300, distinct), racingDealSeed picks from it, and the oracle's
 *     run replays through replayRacingRun to exactly 200, unflagged (24 entries at quick depth, all 300 with
 *     CHECKS_FULL=1);
 *  3. no input scores 0; one wasted input scores at least 1;
 *  4. the parts: maximums sum to 200, the core a straight line in distance, clean sectors floor(30 × clean ÷ 8),
 *     finish 10 and speed (full at par, 0 at the buzzer) only on a finish;
 *  5. the rules: grass slows the car hard, the tyre wall stops it sideways and costs speed, a touch dirties only its
 *     own sector, a curve pushes the car outwards;
 *  6. a tampered claimed score is flagged; out-of-range payloads are clamped (and flagged), never rejected;
 *  7. every circuit is exactly RACING_LAP_SEGS long with two hairpins and a chicane;
 *  8. legacy: 36 racingRev 1 runs recorded on main b154694 (scripts/racing-legacy-record.ts: the oracle, four bot
 *     levels and a random player on six deal seeds) replay to the same score, final tick and checksum;
 *  9. racingRev 2's start: five lights one a second from tick 30, out at RACING_V2_GO; the car cannot move before
 *     lights out whatever is held, inputs then still count as played, the throttle held through the lights leaves on
 *     the first tick after; the race clock and the speed part run from lights out; the run is the lights longer and
 *     the round's clock fits it;
 * 10. racingRev 2's joystick: the dead zone, the expo (half the gain at mid-stick, the same full lock), odd symmetry,
 *     the wheels following the stick at most RACING_V2_WHEEL_RATE a tick, and the steering moving the car by the wheel;
 * 11. racingRev 2's deal: 300 distinct seeds, racingDealSeedV2 and the server's generateRacing deal from it on
 *     racingRev 2, and the oracle takes 24 (all with CHECKS_FULL=1) to exactly 200 through the server replay, home by
 *     RACING_V2_PAR_TICKS from lights out;
 * 12. racingRev 2's replay: deterministic, the server agrees with the phone, a tampered claim is flagged, and the
 *     rev-2 checksum covers the wheel;
 * 13. legacy: 36 racingRev 2 runs recorded on main 6326101 before racingRev 3 (scripts/racing-legacy-record.ts --rev=2)
 *     replay to the same score, final tick and checksum;
 * 14. racingRev 3 is dealt (3 Nov 2026): rooms and practice deal it from RACING_DEAL_V3 (300 distinct seeds), and the
 *     oracle takes 24 (all with CHECKS_FULL=1) to exactly 200 through the server replay, at or above the full pace;
 * 15. racingRev 3's gravel: the car slows to RACING_V3_OFF_KEEP % of the speed it left the tarmac at (racingRev 2 to
 *     about 105 km/h), the throttle cannot raise it past that while off, and back on the tarmac it regains that speed
 *     faster than racingRev 2 would; the corner speed signs (every corner slower than flat out, its speed rounded down
 *     to 10 km/h, held from the centre with full lock in the sim, and a little over the limit running wide);
 * 16. racingRev 3's parts: pace (a straight line in average speed) and clean sectors (5 each), 200 in all; its
 *     replay is deterministic, agrees with the phone, flags a tampered claim, and its checksum covers the gravel's
 *     speed and recovery target (racingRev 2's unchanged).
 *
 *   bun scripts/racing-check.ts      (CHECKS_FULL=1 for the whole deal)
 */
import { stdSpecMax } from "../src/lib/arcade/arcadeStandard";
import { checkInputEvents, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  buildRacingTrack,
  racingGameFor,
  racingGoTick,
  racingLightsOn,
  racingRaceTicks,
  racingV2SteerTarget,
  RACING_REV_2,
  RACING_REV_DEALT,
  RACING_STICK_MAX,
  RACING_V2_DEAD,
  RACING_V2_GO,
  RACING_V2_LIGHT0,
  RACING_V2_PAR_TICKS,
  RACING_V2_RUN_TICKS,
  RACING_V2_WHEEL_RATE,
  racingChecksum,
  racingGame,
  racingInit,
  racingStdParts,
  racingStep,
  racingTrack,
  RACING_CLEAN_X,
  RACING_INPUT_RANGES,
  RACING_INPUT_STICK,
  RACING_LAP_SEGS,
  RACING_OFF_CAP,
  RACING_PAR_TICKS,
  RACING_RUN_TICKS,
  RACING_SEC_CHICANE,
  RACING_SEC_HAIRPIN,
  RACING_SECTOR_LEN,
  RACING_STD_SPEC,
  RACING_TOTAL,
  RACING_VMAX,
  RACING_WALL_LIMIT,
  RACING_ACCEL,
  RACING_REV_3,
  RACING_SEG,
  RACING_SIGN_BELOW_KMH,
  RACING_STEER_K,
  RACING_V3_OFF_KEEP,
  RACING_V3_PACE_FULL,
  RACING_V3_RECOVER_MUL,
  RACING_V3_STD_SPEC,
  racingCornerAdvice,
  racingCornerLimit,
  racingKmh,
  racingPace10,
  racingPush,
  racingSegAt,
  racingV3OffFloor,
  type RacingState,
} from "../src/lib/arcade/racing";
import { encodeRacingRun, replayRacingRun } from "../src/lib/duel/racing";
import { RACING_DEAL, racingDealSeed } from "../src/lib/duel/racingDeal.server";
import { RACING_DEAL_V2, racingDealSeedV2 } from "../src/lib/duel/racingDealV2.server";
import { RACING_DEAL_V3, racingDealSeedV3 } from "../src/lib/duel/racingDealV3.server";
import { generateRacing } from "../src/lib/duel/sports.server";
import { RACING_TIME_MS } from "../src/lib/duel/types";
import { oracleRun, racingV2StickFor } from "./racing-oracle";
import { racingSubmission } from "./racing-deal";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const full = process.env.CHECKS_FULL === "1";
const quiet = console.error;
const quietWarn = console.warn;

function play(seed: number, events: readonly ArcadeInputEvent[]): RacingState {
  const map = new Map(events.map((e) => [e.t, e]));
  let s = racingGame.init(seed);
  while (!racingGame.isOver(s)) s = racingGame.step(s, map.get(s.tick + 1) ?? null);
  return s;
}

/* 1. Deterministic. */
const seed0 = RACING_DEAL[0]!;
const log0 = oracleRun(seed0);
const a = play(seed0, log0);
const b = play(seed0, log0);
ok(JSON.stringify(a) === JSON.stringify(b) && racingChecksum(a) === racingChecksum(b), "the same log replays to the same state twice");
const r0 = replayRacingRun(seed0, racingSubmission(seed0, log0), 1);
ok(r0.score === racingGame.score(a) && !r0.flagged && r0.desyncTick === null, `the server replay agrees with the phone's run (${r0.score}, flagged ${r0.flagged})`);
ok(r0.std === true && r0.parts.length === 4 && r0.finished, "the result carries std, the four parts and the finish");

/* 2. The deal. */
ok(RACING_DEAL.length === 300, `the deal holds 300 seeds (${RACING_DEAL.length})`);
ok(new Set(RACING_DEAL).size === RACING_DEAL.length, "the deal's seeds are distinct");
ok(RACING_DEAL.every((s) => Number.isInteger(s) && s > 0 && s < 2 ** 31), "every deal entry is a valid seed");
ok([0, 1, 299, 300, 12345, 2 ** 31 - 2].every((r) => RACING_DEAL.includes(racingDealSeed(r))), "racingDealSeed picks from the deal");
const proveList = full ? RACING_DEAL : RACING_DEAL.filter((_, i) => i % Math.floor(RACING_DEAL.length / 24) === 0).slice(0, 24);
let proved = 0;
for (const seed of proveList) {
  const r = replayRacingRun(seed, racingSubmission(seed, oracleRun(seed)), 1);
  const good = r.score === 200 && !r.flagged && r.clean === 8 && r.finished && r.finishTick <= RACING_PAR_TICKS;
  ok(good, `deal seed ${seed}: the oracle reaches 200 through the server (${r.score}, clean ${r.clean}, finish ${r.finishTick})`);
  if (good) proved++;
}

/* 3. No input 0; one wasted input 1+. */
const idle = play(seed0, []);
ok(racingGame.score(idle) === 0 && idle.acted === 0, `no input scores 0 (${racingGame.score(idle)})`);
const wasted = play(seed0, [{ t: 30, k: RACING_INPUT_STICK, a: 0, b: 0, c: 0, d: 0 }]);
ok(racingGame.score(wasted) >= 1, `one wasted input scores at least 1 (${racingGame.score(wasted)})`);
console.error = () => {};
const r3 = replayRacingRun(seed0, encodeRacingRun({ seed: seed0, claimedScore: 0, events: [], endTick: RACING_RUN_TICKS, checkpoints: [] }), 1);
console.error = quiet;
ok(r3.score === 0, "the server scores an empty log 0");

/* 4. The parts. */
ok(stdSpecMax(RACING_STD_SPEC) === 200, `the parts' maximums sum to 200 (${stdSpecMax(RACING_STD_SPEC)})`);
const base = { ...racingInit(seed0), acted: 1 };
const partsOf = (st: Partial<RacingState>) => racingStdParts({ ...base, ...st })!.map((p) => p.points);
ok(JSON.stringify(partsOf({ s: RACING_TOTAL, clean: 8, finishTick: RACING_PAR_TICKS })) === "[140,30,10,20]", "a clean finish at par: 140 + 30 + 10 + 20");
ok(JSON.stringify(partsOf({ s: RACING_TOTAL / 2 })) === "[70,0,0,0]", "half the race: core 70, nothing else");
ok(partsOf({ s: RACING_TOTAL / 4 })[0] === 35 && partsOf({ s: Math.floor((RACING_TOTAL * 3) / 4) })[0] === 105, "the core is a straight line in distance");
for (let c = 0; c <= 8; c++) ok(partsOf({ s: RACING_TOTAL, clean: c, finishTick: 5000 })[1] === Math.floor((30 * c) / 8), `${c} clean sectors pay floor(30 × ${c} ÷ 8)`);
ok(partsOf({ s: RACING_TOTAL, finishTick: RACING_RUN_TICKS })[3] === 0, "speed is 0 at the buzzer");
ok(partsOf({ s: RACING_TOTAL, finishTick: RACING_PAR_TICKS - 300 })[3] === 20, "speed is full under par");
const mid = Math.round((RACING_PAR_TICKS + RACING_RUN_TICKS) / 2);
ok(partsOf({ s: RACING_TOTAL, finishTick: mid })[3] === 10, `speed halfway between par and the buzzer pays 10 (${partsOf({ s: RACING_TOTAL, finishTick: mid })[3]})`);
ok(partsOf({ s: RACING_TOTAL - 1, clean: 7 })[2] === 0 && partsOf({ s: RACING_TOTAL - 1, clean: 7 })[3] === 0, "finish and speed pay only on a finish");

/* 5. The rules. */
const fast = { ...racingInit(seed0), s: 4096 * 5, v: RACING_VMAX, acted: 1 };
const onGrass = racingStep({ ...fast, x: RACING_CLEAN_X + 2000 }, null);
const onRoad = racingStep({ ...fast, x: 0 }, null);
ok(onGrass.v < onRoad.v - 100 && onGrass.off === 1, `grass slows the car hard (${onGrass.v} vs ${onRoad.v})`);
let g = { ...fast, x: RACING_CLEAN_X + 2000, pedal: 100 };
for (let i = 0; i < 240; i++) g = racingStep(g, null);
ok(g.v <= RACING_OFF_CAP + 40, `on the grass the throttle cannot hold speed above the cap (${g.v})`);
const wall = racingStep({ ...fast, x: RACING_WALL_LIMIT - 10, steer: 100 }, null);
ok(wall.x === RACING_WALL_LIMIT && wall.wall === 1 && wall.wallHits === 1 && wall.v <= Math.floor((RACING_VMAX * 3) / 4), "the tyre wall stops the car sideways and costs a quarter of its speed");
const track0 = racingTrack(seed0);
const bend = track0.sections.find((s) => s.kind === RACING_SEC_HAIRPIN)!;
const inBend = racingStep({ ...fast, s: (bend.start + (bend.len >> 1)) * 4096, v: 1600 }, null);
ok(Math.sign(inBend.x) === -bend.dir && inBend.x !== 0, "a curve pushes the car outwards");
// A touch dirties only its own sector.
{
  let st = { ...racingInit(seed0), acted: 1, v: 2000 };
  let touched = false;
  while (st.sector < 3 && st.tick < 6000) {
    const inSector1 = st.sector === 1 && !touched && st.s > RACING_SECTOR_LEN * 1.5;
    if (inSector1) touched = true;
    st = racingStep({ ...st, x: inSector1 ? RACING_CLEAN_X + 100 : 0, v: Math.max(st.v, 2000) }, null);
  }
  ok(st.cleanMask === 0b101 && st.clean === 2, `a touch in sector 2 leaves sectors 1 and 3 clean (mask ${st.cleanMask.toString(2)})`);
}

/* 6. Tampering and clamping. */
console.error = () => {};
console.warn = () => {};
const raw = racingSubmission(seed0, log0);
const parts = raw.split("|");
parts[1] = String(Number(parts[1]) - 5);
const tampered = replayRacingRun(seed0, parts.join("|"), 1);
ok(tampered.flagged && tampered.score === 200, "a tampered claimed score is flagged; the server keeps its own");
const wild = [{ t: 10, k: RACING_INPUT_STICK, a: 900, b: -700, c: 3, d: 0 }];
const fixed = checkInputEvents(wild, RACING_RUN_TICKS, RACING_INPUT_RANGES);
ok(!fixed.ok && fixed.events[0]!.a === 100 && fixed.events[0]!.b === -100 && fixed.events[0]!.c === 0, "out-of-range payloads are clamped to ±100");
const wildRun = replayRacingRun(seed0, encodeRacingRun({ seed: seed0, claimedScore: 0, events: wild, endTick: RACING_RUN_TICKS, checkpoints: [] }), 1);
ok(wildRun.flagged && wildRun.state.steer === 100 && wildRun.state.pedal === -100, "a clamped log still replays");
console.error = quiet;
console.warn = quietWarn;

/* 7. Circuits. */
for (let i = 0; i < 200; i++) {
  const t = buildRacingTrack(i * 7919 + 13);
  const total = t.sections.reduce((acc, s) => acc + s.len, 0);
  const hairpins = t.sections.filter((s) => s.kind === RACING_SEC_HAIRPIN).length;
  const chicanes = t.sections.filter((s) => s.kind === RACING_SEC_CHICANE).length;
  const contiguous = t.sections.every((s, k) => k === 0 || s.start === t.sections[k - 1]!.start + t.sections[k - 1]!.len);
  if (!(total === RACING_LAP_SEGS && t.curve.length === RACING_LAP_SEGS && hairpins === 2 && chicanes === 1 && contiguous && t.sections[0]!.start === 0)) {
    ok(false, `circuit ${i}: ${total} segments, ${hairpins} hairpins, ${chicanes} chicanes`);
    break;
  }
}
ok(JSON.stringify(Array.from(buildRacingTrack(seed0).curve)) === JSON.stringify(Array.from(racingTrack(seed0).curve)), "a circuit builds the same every time");

/* 8. Legacy: racingRev 1 replays exactly as recorded on main before racingRev 2. */
{
  const fx = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/racing-v1-legacy.json.gz", import.meta.url))).toString()) as {
    runs: { seed: number; who: string; raw: string; score: number; checksum: number; tick: number }[];
  };
  let same = 0;
  for (const run of fx.runs) {
    const r = replayRacingRun(run.seed, run.raw, 1);
    const u = replayRacingRun(run.seed, run.raw, undefined);
    const good = r.score === run.score && racingChecksum(r.state) === run.checksum && r.state.tick === run.tick && u.score === run.score && racingChecksum(u.state) === run.checksum;
    if (good) same++;
    else ok(false, `legacy ${run.who} on ${run.seed}: ${r.score}/${run.score}, tick ${r.state.tick}/${run.tick}`);
  }
  ok(fx.runs.length === 36 && same === 36, `36 racingRev 1 runs recorded on main replay to the same score, tick and checksum (${same})`);
  ok(racingGameFor(1).runTicks === RACING_RUN_TICKS && racingGameFor(undefined).init(seed0).rev === 1 && racingGoTick(1) === 0, "unstamped and racingRev 1 rounds play racingRev 1 (no lights, 90 s)");
}

/* 9. racingRev 2's start. */
const G2 = racingGameFor(RACING_REV_2);
const play2 = (seed: number, events: readonly ArcadeInputEvent[]): RacingState[] => {
  const map = new Map(events.map((e) => [e.t, e]));
  const states: RacingState[] = [];
  let st = G2.init(seed);
  states.push(st);
  while (!G2.isOver(st)) {
    st = G2.step(st, map.get(st.tick + 1) ?? null);
    states.push(st);
  }
  return states;
};
{
  // Since 3 Nov 2026 rooms deal racingRev 3 (section 14 proves it); racingRev 2's own rules are unchanged.
  ok(G2.init(seed0).rev === 2 && G2.runTicks === RACING_V2_GO + RACING_RUN_TICKS && RACING_V2_RUN_TICKS === G2.runTicks, "racingRev 2's run is the lights then the 90-second race");
  ok(RACING_V2_GO === 330 && RACING_V2_LIGHT0 === 30, `lights from tick 30, out at tick 330 (${RACING_V2_GO})`);
  const lights = [0, 29, 30, 89, 90, 150, 210, 269, 270, 329, 330, 400].map((t) => racingLightsOn(2, t));
  ok(JSON.stringify(lights) === "[0,0,1,1,2,3,4,4,5,5,0,0]", `the lights come on one a second, five, then all out (${lights})`);
  ok([0, 30, 270, 329].every((t) => racingLightsOn(1, t) === 0), "racingRev 1 has no lights");
  ok(RACING_TIME_MS >= Math.ceil((RACING_V2_RUN_TICKS / 60) * 1000) + 3000, `the round's clock (${RACING_TIME_MS} ms) fits the lights, the race and the usual slack`);
  // Full throttle and full lock held from the first tick: nothing moves until lights out.
  const states = play2(seed0, [{ t: 1, k: RACING_INPUT_STICK, a: 100, b: 100, c: 0, d: 0 }]);
  const before = states.filter((st) => st.tick <= RACING_V2_GO);
  ok(before.length === RACING_V2_GO + 1 && before.every((st) => st.s === 0 && st.v === 0 && st.x === 0 && st.offTicks === 0), "the car stays on its grid spot until lights out (full throttle and full lock held)");
  const leave = states.find((st) => st.tick === RACING_V2_GO + 1)!;
  ok(leave.v > 0 && leave.s > 0, `the throttle held through the lights leaves on the first tick after lights out (v ${leave.v})`);
  ok(states.every((st) => st.tick <= RACING_V2_GO || racingRaceTicks(st) === st.tick - RACING_V2_GO) && racingRaceTicks(before[100]!) === 0, "the race clock starts at lights out");
  const early = play2(seed0, [{ t: 40, k: RACING_INPUT_STICK, a: 0, b: -100, c: 0, d: 0 }]);
  ok(G2.score(early.at(-1)!) === 1, `an input during the lights alone scores 1 (${G2.score(early.at(-1)!)})`);
  ok(G2.score(play2(seed0, []).at(-1)!) === 0, "no input scores 0 on racingRev 2");
  const end = states.at(-1)!;
  ok(end.tick <= RACING_V2_GO + RACING_RUN_TICKS && G2.isOver(end), "the run ends 90 s after lights out at the latest");
  const b2 = { ...G2.init(seed0), acted: 1 };
  const sp = (finishTick: number) => racingStdParts({ ...b2, s: RACING_TOTAL, clean: 8, finishTick })!.find((p) => p.key === "speed")!.points;
  ok(sp(RACING_V2_GO + RACING_V2_PAR_TICKS) === 20 && sp(RACING_V2_GO + RACING_V2_PAR_TICKS + 1) < 20 && sp(RACING_V2_GO + RACING_RUN_TICKS) === 0, "speed: full at par from lights out, 0 at the buzzer");
  ok(sp(RACING_V2_GO + Math.round((RACING_V2_PAR_TICKS + RACING_RUN_TICKS) / 2)) === 10, "speed halfway between par and the buzzer (race clock) pays 10");
  ok(racingStdParts({ ...b2, s: RACING_TOTAL, clean: 8, finishTick: RACING_V2_GO + RACING_V2_PAR_TICKS })!.reduce((a, p) => a + p.points, 0) === 200, "a clean finish at par on racingRev 2: 200");
}

/* 10. racingRev 2's joystick. */
{
  let dead = true;
  for (let a = -RACING_V2_DEAD; a <= RACING_V2_DEAD; a++) if (racingV2SteerTarget(a) !== 0) dead = false;
  ok(dead && racingV2SteerTarget(RACING_V2_DEAD + 2) > 0, `a dead zone of ±${RACING_V2_DEAD} round the centre, steering from just past it`);
  ok(racingV2SteerTarget(100) === 100 && racingV2SteerTarget(-100) === -100 && racingV2SteerTarget(250) === 100, "full lock is unchanged at the stick's end");
  const mid = racingV2SteerTarget(55);
  ok(mid >= 35 && mid <= 40, `half the gain at mid-stick (55 → ${mid}, linear would be 55)`);
  let mono = true;
  let odd = true;
  for (let a = -RACING_STICK_MAX; a <= RACING_STICK_MAX; a++) {
    if (a > -RACING_STICK_MAX && racingV2SteerTarget(a) < racingV2SteerTarget(a - 1)) mono = false;
    if (racingV2SteerTarget(-a) !== -racingV2SteerTarget(a)) odd = false;
  }
  ok(mono && odd, "the curve rises steadily and is the same both ways");
  // The wheels follow the stick at the smoothing rate.
  const map = [{ t: 1, k: RACING_INPUT_STICK, a: 100, b: 0, c: 0, d: 0 }, { t: 40, k: RACING_INPUT_STICK, a: -100, b: 0, c: 0, d: 0 }];
  const st = play2(seed0, map);
  const wheels = st.slice(0, 80).map((x) => x.wheel);
  ok(wheels[1] === RACING_V2_WHEEL_RATE && wheels[13] === 100 && wheels[12]! < 100, `centre to full lock at ${RACING_V2_WHEEL_RATE} a tick (${wheels.slice(0, 14)})`);
  let rate = true;
  for (let i = 1; i < st.length; i++) if (Math.abs(st[i]!.wheel - st[i - 1]!.wheel) > RACING_V2_WHEEL_RATE) rate = false;
  ok(rate && wheels[40]! === 100 - RACING_V2_WHEEL_RATE, "the wheels never move more than the rate a tick, lock to lock as well");
  // The steering moves the car by the wheel (not the raw stick).
  const moving = { ...G2.init(seed0), tick: RACING_V2_GO + 10, s: 4096 * 5, v: 2000, acted: 1, steer: 100, wheel: 0 };
  const one = racingStep(moving, null);
  ok(one.wheel === RACING_V2_WHEEL_RATE && Math.abs(one.x) < Math.abs(racingStep({ ...moving, rev: 1 }, null).x), "on the move the car steers by the smoothed wheel (less than racingRev 1's instant lock)");
  const r1 = racingStep({ ...moving, rev: 1 }, null);
  ok(r1.wheel === 0, "racingRev 1 never moves the wheel field");
}

/* 11. racingRev 2's deal. */
{
  ok(RACING_DEAL_V2.length === 300 && new Set(RACING_DEAL_V2).size === 300, `the rev-2 deal holds 300 distinct seeds (${RACING_DEAL_V2.length})`);
  ok(RACING_DEAL_V2.every((s) => Number.isInteger(s) && s > 0 && s < 2 ** 31), "every rev-2 deal entry is a valid seed");
  ok([0, 1, 299, 300, 12345, 2 ** 31 - 2].every((r) => RACING_DEAL_V2.includes(racingDealSeedV2(r))), "racingDealSeedV2 picks from the rev-2 deal");
  const list2 = full ? RACING_DEAL_V2 : RACING_DEAL_V2.filter((_, i) => i % Math.floor(RACING_DEAL_V2.length / 24) === 0).slice(0, 24);
  let proved2 = 0;
  for (const seed of list2) {
    const r = replayRacingRun(seed, racingSubmission(seed, oracleRun(seed, 2), 2), 2);
    const good = r.score === 200 && !r.flagged && r.clean === 8 && r.finished && r.raceTicks <= RACING_V2_PAR_TICKS && r.state.rev === 2;
    ok(good, `rev-2 deal seed ${seed}: the oracle reaches 200 through the server (${r.score}, clean ${r.clean}, race ${r.raceTicks})`);
    if (good) proved2++;
  }
  ok(proved2 === list2.length, `the oracle takes ${proved2} of ${list2.length} rev-2 deal seeds to exactly 200`);
}

/* 12. racingRev 2's replay. */
{
  const seed = RACING_DEAL_V2[0]!;
  const log = oracleRun(seed, 2);
  const x1 = play2(seed, log).at(-1)!;
  const x2 = play2(seed, log).at(-1)!;
  ok(JSON.stringify(x1) === JSON.stringify(x2), "racingRev 2: the same log replays to the same state twice");
  const raw2 = racingSubmission(seed, log, 2);
  const r = replayRacingRun(seed, raw2, 2);
  ok(r.score === G2.score(x1) && !r.flagged && r.desyncTick === null && r.raceTicks === x1.finishTick - RACING_V2_GO, `racingRev 2: the server replay agrees with the phone's run (${r.score})`);
  console.error = () => {};
  const bits = raw2.split("|");
  bits[1] = String(Number(bits[1]) - 3);
  const t2 = replayRacingRun(seed, bits.join("|"), 2);
  const asV1 = replayRacingRun(seed, raw2, 1);
  console.error = quiet;
  ok(t2.flagged && t2.score === 200, "racingRev 2: a tampered claimed score is flagged; the server keeps its own");
  ok(asV1.flagged, "a racingRev 2 run replayed as racingRev 1 does not pass (the stamp decides the rules)");
  ok(racingChecksum({ ...x1, wheel: x1.wheel + 1 }) !== racingChecksum(x1) && racingChecksum({ ...a, wheel: 5 }) === racingChecksum(a), "racingRev 2's checksum covers the wheel; racingRev 1's is unchanged");
}

/* 13. racingRev 2's legacy runs. */
{
  const fx = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/racing-v2-legacy.json.gz", import.meta.url))).toString()) as {
    runs: { seed: number; who: string; raw: string; score: number; checksum: number; tick: number }[];
  };
  let same = 0;
  for (const run of fx.runs) {
    const r = replayRacingRun(run.seed, run.raw, 2);
    if (r.score === run.score && racingChecksum(r.state) === run.checksum && r.state.tick === run.tick && r.state.rev === 2) same++;
    else ok(false, `legacy rev-2 ${run.who} on ${run.seed}: ${r.score}/${run.score}, tick ${r.state.tick}/${run.tick}`);
  }
  ok(fx.runs.length === 36 && same === 36, `36 racingRev 2 runs recorded on main replay to the same score, tick and checksum (${same})`);
}

/* 14. racingRev 3 is dealt. */
const G3 = racingGameFor(RACING_REV_3);
let proved3 = 0;
{
  ok(RACING_REV_DEALT === 3 && G3.init(seed0).rev === 3 && G3.runTicks === RACING_V2_RUN_TICKS, "racingRev 3 is dealt; its run is racingRev 2's (the lights, then the 90-second race)");
  ok(RACING_DEAL_V3.length === 300 && new Set(RACING_DEAL_V3).size === 300, `the rev-3 deal holds 300 distinct seeds (${RACING_DEAL_V3.length})`);
  ok(RACING_DEAL_V3.every((s) => Number.isInteger(s) && s > 0 && s < 2 ** 31), "every rev-3 deal entry is a valid seed");
  ok([0, 1, 299, 300, 12345, 2 ** 31 - 2].every((r) => RACING_DEAL_V3.includes(racingDealSeedV3(r))), "racingDealSeedV3 picks from the rev-3 deal");
  let dealt = true;
  for (let i = 0; i < 40; i++) {
    const p = generateRacing();
    if (p.racingRev !== 3 || !RACING_DEAL_V3.includes(p.seed)) dealt = false;
  }
  ok(dealt, "rooms and practice deal racingRev 3 from the rev-3 deal");
  const list3 = full ? RACING_DEAL_V3 : RACING_DEAL_V3.filter((_, i) => i % Math.floor(RACING_DEAL_V3.length / 24) === 0).slice(0, 24);
  for (const seed of list3) {
    const r = replayRacingRun(seed, racingSubmission(seed, oracleRun(seed, 3), 3), 3);
    const good = r.score === 200 && !r.flagged && r.clean === 8 && r.finished && racingPace10(r.state) >= RACING_V3_PACE_FULL && r.state.rev === 3;
    ok(good, `rev-3 deal seed ${seed}: the oracle reaches 200 through the server (${r.score}, clean ${r.clean}, pace ${racingPace10(r.state)})`);
    if (good) proved3++;
  }
  ok(proved3 === list3.length, `the oracle takes ${proved3} of ${list3.length} rev-3 deal seeds to exactly 200`);
}

/* 15. racingRev 3's gravel and the corner speed signs. */
{
  const seed = RACING_DEAL_V3[0]!;
  // At 270 km/h on the start straight, steered hard right off the tarmac, full throttle held.
  const v0 = Math.round((270 * RACING_VMAX) / 300);
  const start = (rev: number, lock: number): RacingState => ({ ...racingGameFor(rev).init(seed), tick: RACING_V2_GO + 10, s: RACING_SEG * 2, v: v0, x: RACING_CLEAN_X - 200, steer: lock, wheel: lock, pedal: 100, acted: 1 });
  /** Steps `ticks` ticks from a steer of `lock`; from tick `back` on, full lock the other way (back to the tarmac). */
  const run = (rev: number, ticks: number, back: number, lock = 100): RacingState[] => {
    let st = start(rev, lock);
    const out = [st];
    for (let t = 0; t < ticks; t++) {
      if (t === back) st = { ...st, steer: -100, wheel: -100 };
      if (t === back + 60) st = { ...st, steer: 0, wheel: 0 };
      st = racingStep(st, null);
      out.push(st);
    }
    return out;
  };
  // A gentle steer over the kerb (no wall): the car runs on the gravel with the throttle held.
  const off3 = run(3, 60, 1e9, 20);
  const off2 = run(2, 60, 1e9, 20);
  const k3 = off3.at(-1)!;
  const k2 = off2.at(-1)!;
  const left = off3.find((st) => st.off)!;
  const floor = racingV3OffFloor(left.offFrom!);
  ok(off3.every((st) => st.wall === 0) && k3.off === 1 && k3.v === floor && floor === Math.floor((left.offFrom! * RACING_V3_OFF_KEEP) / 100), `racingRev 3: on the gravel the car slows to ${RACING_V3_OFF_KEEP}% of its speed and holds there under throttle (${racingKmh(k3.v)} km/h from ${racingKmh(left.offFrom!)})`);
  ok(k2.off === 1 && k2.v <= RACING_OFF_CAP + 40, `racingRev 2: on the gravel the car still drops to about 105 km/h (${racingKmh(k2.v)})`);
  ok(racingV3OffFloor(800) === 800 && racingV3OffFloor(1200) === RACING_OFF_CAP && racingV3OffFloor(3000) === 1950, "the gravel floor: 65 % of the speed, never below racingRev 1's cap or the speed itself");
  // Back on: full lock the other way after 20 ticks, then straight with the throttle held.
  const ret3 = run(3, 300, 20);
  const ret2 = run(2, 300, 20);
  const on3 = ret3.findIndex((st, i) => i > 21 && !st.off && ret3[i - 1]!.off === 1);
  const on2 = ret2.findIndex((st, i) => i > 21 && !st.off && ret2[i - 1]!.off === 1);
  ok(on3 > 0 && on2 > 0, `the car comes back onto the tarmac (ticks ${on3}, ${on2})`);
  const v3on = ret3[on3]!.v;
  const twice = Math.floor((RACING_V3_RECOVER_MUL * RACING_ACCEL * (RACING_VMAX - v3on)) / RACING_VMAX);
  ok((ret3[on3]!.rec ?? 0) > 0 && ret3[on3 + 1]!.v - v3on >= twice - 1, `racingRev 3: back on the tarmac the throttle pulls ${RACING_V3_RECOVER_MUL}× (a tick: +${ret3[on3 + 1]!.v - v3on}, at least ${twice - 1})`);
  ok(v3on > ret2[on2]!.v, `racingRev 3 rejoins faster than racingRev 2 (${racingKmh(v3on)} vs ${racingKmh(ret2[on2]!.v)} km/h)`);
  const back = ret3.slice(on3).find((st) => (st.rec ?? 0) === 0);
  ok(!!back && back.v >= left.offFrom!, `the recovery ends once the speed the car left the tarmac at is regained (${back ? racingKmh(back.v) : "never"})`);
  // The signs.
  let signsOk = true;
  let held = true;
  let wide = true;
  let count = 0;
  for (const s of RACING_DEAL_V3.slice(0, 40)) {
    const track = racingTrack(s);
    const advice = racingCornerAdvice(track);
    for (const c of track.corners) {
      const a = advice.find((x) => x.corner === c);
      const lim = racingCornerLimit(track, c);
      const kmh = Math.floor((lim * 300) / (RACING_VMAX * 10)) * 10;
      if (kmh < RACING_SIGN_BELOW_KMH ? !a || a.kmh !== kmh || a.limit !== lim : !!a) signsOk = false;
      if (!a) continue;
      count++;
      // Held at a speed from the centre, steering just enough (at most full lock), through the real sim's step.
      const through = (v: number): boolean => {
        let st: RacingState = { ...G3.init(s), tick: RACING_V2_GO + 10, s: (c.start - 2) * RACING_SEG, v, x: 0, acted: 1, pedal: 0, wheel: 0 };
        while (st.s < (c.start + c.len + 2) * RACING_SEG) {
          const cc = track.curve[racingSegAt(st.s)]!;
          const want = Math.max(-100, Math.min(100, Math.round((racingPush(cc, v) * 100 * RACING_VMAX) / (RACING_STEER_K * v))));
          // The stick whose dead zone and expo give that steer, the wheels already there; the coast's 5 a tick put back.
          st = racingStep({ ...st, v: v + 5, steer: racingV2StickFor(want), wheel: want, pedal: 0 }, null);
          if (st.off) return false;
        }
        return true;
      };
      if (!through(Math.ceil((a.kmh * RACING_VMAX) / 300))) held = false;
      if (through(Math.min(RACING_VMAX, lim + 60))) wide = false;
    }
  }
  ok(signsOk && count > 100, `every corner slower than flat out has a sign at its limit rounded down to 10 km/h (${count} signs on 40 circuits)`);
  ok(held, "every sign's speed holds its corner from the centre with full lock through the sim's step");
  ok(wide, "a little over a sign's limit, full lock runs wide");
  const kinds = new Set(RACING_DEAL_V3.slice(0, 40).flatMap((s) => racingCornerAdvice(racingTrack(s)).map((a) => a.corner.kind)));
  ok(kinds.has(RACING_SEC_HAIRPIN) && kinds.has(RACING_SEC_CHICANE), "hairpins and chicanes carry signs");
}

/* 16. racingRev 3's parts and replay. */
{
  ok(stdSpecMax(RACING_V3_STD_SPEC) === 200 && RACING_V3_STD_SPEC.rev === 3, "racingRev 3's parts' maximums sum to 200");
  const b3 = { ...G3.init(seed0), acted: 1 };
  const pts = (over: Partial<RacingState>) => racingStdParts({ ...b3, ...over })!.map((p) => p.points);
  const fin = (race: number) => ({ s: RACING_TOTAL, tick: RACING_V2_GO + race, finishTick: RACING_V2_GO + race });
  ok(JSON.stringify(pts({ ...fin(4500), clean: 8 })) === "[160,40]", "a clean finish at full pace: 160 + 40");
  ok(pts({ s: RACING_TOTAL >> 1, tick: RACING_V2_GO + RACING_RUN_TICKS })[0] === 0, "half the race in 90 s is under the zero pace: no pace points");
  ok(pts({ clean: 3 })[1] === 15 && pts({ clean: 8 })[1] === 40, "clean sectors pay 5 each");
  const lineA = pts(fin(5000))[0]!;
  const lineB = pts(fin(5200))[0]!;
  ok(lineA > lineB && lineB > 0 && lineA < 160, `a quicker finish scores a higher pace (${lineA} vs ${lineB})`);
  const seed = RACING_DEAL_V3[0]!;
  const log = oracleRun(seed, 3);
  const raw3 = racingSubmission(seed, log, 3);
  const r = replayRacingRun(seed, raw3, 3);
  const r2 = replayRacingRun(seed, raw3, 3);
  ok(r.score === 200 && !r.flagged && r.desyncTick === null && racingChecksum(r.state) === racingChecksum(r2.state) && r.parts.length === 2, `racingRev 3: the server replay is deterministic and agrees with the phone's run (${r.score})`);
  console.error = () => {};
  const bits = raw3.split("|");
  bits[1] = String(Number(bits[1]) - 3);
  const t3 = replayRacingRun(seed, bits.join("|"), 3);
  console.error = quiet;
  ok(t3.flagged && t3.score === 200, "racingRev 3: a tampered claimed score is flagged; the server keeps its own");
  ok(racingChecksum({ ...r.state, offFrom: 5 }) !== racingChecksum(r.state) && racingChecksum({ ...r.state, rec: 5 }) !== racingChecksum(r.state), "racingRev 3's checksum covers the gravel speed and recovery target");
  const x2 = play2(RACING_DEAL_V2[0]!, oracleRun(RACING_DEAL_V2[0]!, 2)).at(-1)!;
  ok(racingChecksum({ ...x2, offFrom: 5, rec: 9 }) === racingChecksum(x2), "racingRev 2's checksum is unchanged");
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL racing-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS racing-check: ${checks} checks (oracle 200 on ${proved} rev-1, the sampled rev-2 and ${proved3} rev-3 deal seeds${full ? ", the whole deals" : ", quick depth"}; 36 legacy rev-1 and 36 legacy rev-2 runs identical)`);
