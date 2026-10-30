/**
 * Racing (racingRev 1, docs/arcade-standard/racing.md): the sim, the deal and the standard's parts.
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
 *  7. every circuit is exactly RACING_LAP_SEGS long with two hairpins and a chicane.
 *
 *   bun scripts/racing-check.ts      (CHECKS_FULL=1 for the whole deal)
 */
import { stdSpecMax } from "../src/lib/arcade/arcadeStandard";
import { checkInputEvents, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  buildRacingTrack,
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
  type RacingState,
} from "../src/lib/arcade/racing";
import { encodeRacingRun, replayRacingRun } from "../src/lib/duel/racing";
import { RACING_DEAL, racingDealSeed } from "../src/lib/duel/racingDeal.server";
import { oracleRun } from "./racing-oracle";
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

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL racing-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS racing-check: ${checks} checks (oracle 200 on ${proved} deal seeds${full ? ", the whole deal" : ", quick depth"})`);
