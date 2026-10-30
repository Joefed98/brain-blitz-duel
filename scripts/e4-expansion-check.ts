/**
 * Expansion E4 (25 Oct 2026, docs/expansions/e4.md): High Rise skylineRev 7 and Pinball pinRev 4, the
 * 200-point expansions (docs/scoring-200.md).
 *
 *  1. Old rounds are untouched: skill-band bot runs recorded on main before the change (skylineRev 6 and
 *     pinRev 3, the revisions rooms dealt; scripts/fixtures/e4-legacy-runs.json.gz) replay through the
 *     server's path with no desync (their own checkpoints, written by the old code) to their stored scores,
 *     and every older revision's game is still the one it was.
 *  2. The new revisions: rooms deal them; recorded runs (scripts/fixtures/e4-new-runs.json.gz, `--record`
 *     rebuilds it) replay unflagged to their stored scores, the phone's replay stepper agrees, a run reaches
 *     200 and none goes past it, no input scores 0, and the texts state the 200.
 *  3. High Rise rules: the block schedule, special widths, centred perfects, the streak multiplier tiers,
 *     milestones and the units.
 *  4. Pinball rules: the plunge lanes and skill shot, ramp shots, the combo, the lock and multiball, free
 *     drains while another ball is out, the one-sided jackpot and the gate.
 *
 *   bun scripts/e4-expansion-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { replaySkylineRun } from "../src/lib/duel/skyline";
import { replayPinballRun } from "../src/lib/duel/pinball";
import { makeStepper, replayToEnd } from "../src/lib/replay/steppers";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import {
  skylineGame,
  skylineGameFor,
  skylineKinds,
  skylineKindWidth,
  skylineStreakMult,
  skylineV7Units,
  skylineWorldHFor,
  SKYLINE_KIND_COUNT,
  SKYLINE_KIND_GOLD,
  SKYLINE_KIND_NARROW,
  SKYLINE_KIND_NORMAL,
  SKYLINE_KIND_WIDE,
  SKYLINE_NARROW_MIN,
  SKYLINE_PERFECT_TOL,
  SKYLINE_REV_EXPAND,
  SKYLINE_REV_LIFT,
  SKYLINE_REV_STRICT,
  SKYLINE_SKY_H,
  SKYLINE_SPECIAL_FROM,
  SKYLINE_START_W,
  SKYLINE_V7_BAND_CURVE,
  SKYLINE_V8_BAND_CURVE,
  SKYLINE_V9_BAND_CURVE,
  SKYLINE_REV_STD,
  SKYLINE_WIDE_GROW,
  SKYLINE_WORLD_RIGHT,
  type SkylineState,
} from "../src/lib/arcade/skyline";
import { pinballGame, pinballGameFor, PIN_BALLS, PIN_INPUT_FLIPPERS, PIN_REV_EXPAND, PIN_REV_LONG, PIN_REV_STD, PIN_REV_STRICT, pinIsExpanded } from "../src/lib/arcade/pinball";
import {
  p4PlungeLane,
  p4PlungeX,
  p4PowerAt,
  pinball4Game,
  pinballGameForAny,
  P4_COMBO_TICKS,
  P4_LANE_COUNT,
  P4_LANE_POSTS,
  P4_LOCK_RIDE_TICKS,
  P4_MB_STAGGER,
  P4_MB_TICKS,
  P4_POWER_MAX,
  P4_PTS_JACKPOT,
  P4_PTS_RAMP,
  P4_PTS_SKILL,
  P4_RAIL,
  P4_RAMPS,
  P4_RAMP_MIN,
  P4_RAMP_TICKS,
  P4_RAMP_Y,
  P4_RIDE_LOCK,
  P4_WORLD_H,
  PIN_V4_BAND_CURVE,
  PIN_V5_BAND_CURVE,
  type Pin4State,
} from "../src/lib/arcade/pinball4";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";

const RECORD = process.argv.includes("--record");
const NEW_FIXTURE = "scripts/fixtures/e4-new-runs.json.gz";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
}
function section(name: string): void {
  console.log(`— ${name}`);
}
const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};

interface Run {
  type: "skyline" | "pinball";
  rev: number;
  level: string;
  n: number;
  seed: number;
  score: number;
  raw: string;
}
const replay = (run: Pick<Run, "type" | "seed" | "raw" | "rev">) =>
  quiet(() => (run.type === "skyline" ? replaySkylineRun(run.seed, run.raw, run.rev) : replayPinballRun(run.seed, run.raw, run.rev)));

/* ============================== --record ============================== */

if (RECORD) {
  const { e4Run } = await import("./e4-bands");
  const runs: Run[] = [];
  for (const [type, rev] of [["skyline", SKYLINE_REV_EXPAND], ["pinball", PIN_REV_EXPAND]] as const) {
    for (const level of ["average", "good", "great", "near"] as const)
      for (let n = 0; n < 2; n++) {
        const r = await e4Run(type, rev, level, n, "new");
        runs.push({ type, rev, level, n, seed: r.seed, score: r.score, raw: r.raw });
      }
    // The first near-perfect run that reaches 200 (proof the top is reachable on the new revision).
    for (let n = 2; n < 80; n++) {
      const r = await e4Run(type, rev, "near", n, "new");
      if (r.score === 200) {
        runs.push({ type, rev, level: "near-top", n, seed: r.seed, score: r.score, raw: r.raw });
        break;
      }
    }
  }
  writeFileSync(NEW_FIXTURE, gzipSync(JSON.stringify({ recorded: "25 Oct 2026, E4: skylineRev 7 and pinRev 4 skill-band bot runs", runs })));
  console.log(`wrote ${NEW_FIXTURE} (${runs.length} runs)`);
}

/* ============================== 1. Old rounds ============================== */

section("Old rounds replay exactly as before (runs recorded on main before E4)");
{
  const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/e4-legacy-runs.json.gz")).toString()) as { runs: Run[] };
  ok(legacy.runs.length === 32, `32 legacy runs (${legacy.runs.length})`);
  for (const run of legacy.runs) {
    const tag = `${run.type} rev ${run.rev} ${run.level} #${run.n}`;
    ok(run.rev === (run.type === "skyline" ? SKYLINE_REV_STRICT : PIN_REV_STRICT), `${tag}: recorded on the revision rooms dealt before E4`);
    const r = replay(run);
    ok(!r.flagged && r.desyncTick === null, `${tag}: replays unflagged against the old code's checkpoints (${r.reason ?? ""}, desync ${r.desyncTick})`);
    ok(r.score === run.score, `${tag}: replays to its stored ${run.score} (got ${r.score})`);
    ok(r.score <= 150, `${tag}: an old round still tops out at 150`);
    ok(!("expandRev" in (r.state as object)) && !("rev4" in (r.state as object)), `${tag}: the old game carries no expansion state`);
  }
  for (let rev = 0; rev <= SKYLINE_REV_STRICT; rev++) {
    const g = skylineGameFor(rev === 0 ? undefined : rev);
    const s = g.init(77) as SkylineState;
    ok(s.expandRev === undefined && s.kinds === undefined, `skylineRev ${rev}: no expansion fields`);
  }
  for (let rev = 1; rev <= PIN_REV_STRICT; rev++) {
    ok(pinballGameForAny(rev) === pinballGameFor(rev), `pinRev ${rev}: pinball.ts's game`);
    ok(!("rev4" in pinballGameForAny(rev).init(5)), `pinRev ${rev}: no expansion state`);
  }
  ok(skylineGameFor(undefined) === skylineGame && pinballGameForAny(undefined) === pinballGame, "unstamped rounds keep the original games");
}

/* ============================== 2. The new revisions ============================== */

section("Rooms deal the expansions; recorded runs replay; 200 is the top");
{
  const sky = generatePuzzle("skyline") as any;
  const pin = generatePuzzle("pinball") as any;
  // skylineRev 8 (27 Oct 2026, Joe's phone notes): skylineRev 7's play on a gentler curve (section 3b).
  // skylineRev 9 (29 Oct 2026, the arcade scoring standard): rev 8's play on the standard (skyline-standard-check).
  ok(sky.skylineRev === SKYLINE_REV_STD && SKYLINE_REV_STD === 9 && SKYLINE_REV_LIFT === 8 && SKYLINE_REV_EXPAND === 7, `rooms deal skylineRev 9 (${sky.skylineRev})`);
  // Since 27 Oct 2026 rooms deal pinRev 5: this table for 90 s (scripts/pinball-90-check.ts proves it plays as pinRev 4).
  // Since 29 Oct 2026 rooms deal pinRev 6: pinRev 5's play on the arcade scoring standard (scripts/pinball-standard-check.ts).
  ok(pin.pinRev === PIN_REV_STD && PIN_REV_EXPAND === 4 && PIN_REV_LONG === 5 && pinIsExpanded(pin.pinRev), `rooms deal pinRev 6, pinRev 4's table for 90 s (${pin.pinRev})`);
  ok(roundMaxFor("skyline") === 200 && roundMaxFor("pinball") === 200, "both games' round maximum is 200");
  ok(LIVE_BANDS.skyline.rev === SKYLINE_REV_STD && LIVE_BANDS.skyline.curve === SKYLINE_V9_BAND_CURVE, "the High Rise help reads skylineRev 9's core line (the arcade scoring standard)");
  ok(LIVE_BANDS.pinball.rev === PIN_REV_STD && (LIVE_BANDS.pinball as { std?: unknown }).std !== undefined, "the Pinball help reads the dealt pinRev 6's standard");
  for (const curve of [SKYLINE_V7_BAND_CURVE, SKYLINE_V8_BAND_CURVE, PIN_V4_BAND_CURVE, PIN_V5_BAND_CURVE]) {
    ok(curve.points.at(-1) === 200 && curve.units[0] === 0 && curve.points[0] === 0, "the curve runs from (0, 0) to 200");
    for (let i = 1; i < curve.units.length; i++) ok(curve.units[i]! > curve.units[i - 1]! && curve.points[i]! > curve.points[i - 1]!, "the knots rise");
    ok(bandPoints(curve, 10_000_000) === 200, "nothing scores past 200");
  }
  for (const type of ["skyline", "pinball"] as const) {
    ok(/\b200\b/.test(INTRO_SCORE[type]) && /\b200\b/.test(PUZZLE_INSTRUCTIONS[type].score), `${type}: the intro and help state 200`);
    ok(PUZZLE_INSTRUCTIONS[type].how.filter((l) => !l.helpOnly).length <= 3, `${type}: at most three intro HOW lines`);
    for (const l of PUZZLE_INSTRUCTIONS[type].how.filter((x) => !x.helpOnly)) ok(`${l.action} ${l.detail}`.length <= 46, `${type}: intro line fits one line: ${l.action} ${l.detail}`);
  }
  ok(skylineWorldHFor(SKYLINE_REV_EXPAND) === SKYLINE_SKY_H && skylineWorldHFor(SKYLINE_REV_LIFT) === SKYLINE_SKY_H && SKYLINE_SKY_H === 735, "High Rise draws in the 390 × 735 view (the widest fill on the iPhone 11)");
  ok(P4_WORLD_H === 820, "Pinball's table is 390 × 820");

  const fixture = JSON.parse(gunzipSync(readFileSync(NEW_FIXTURE)).toString()) as { runs: Run[] };
  for (const type of ["skyline", "pinball"] as const) {
    const runs = fixture.runs.filter((r) => r.type === type);
    ok(runs.length === 9, `${type}: 9 recorded new-revision runs (${runs.length})`);
    ok(runs.some((r) => r.score === 200), `${type}: a recorded run reaches 200`);
    for (const run of runs) {
      const tag = `${type} rev ${run.rev} ${run.level} #${run.n}`;
      const r = replay(run);
      ok(!r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
      ok(r.score === run.score && r.score <= 200, `${tag}: replays to its stored ${run.score} (got ${r.score})`);
      const again = replay(run);
      ok(JSON.stringify(again.state) === JSON.stringify(r.state), `${tag}: a second replay ends in the identical state`);
      // The phone's replay stepper (results-screen replays, intro demos) reaches the server's state.
      const puzzle = { type, seed: run.seed, ...(type === "skyline" ? { skylineRev: run.rev } : { pinRev: run.rev }) } as any;
      const stepper = makeStepper(puzzle, run.raw);
      const end = stepper ? replayToEnd(stepper) : null;
      ok(end !== null && JSON.stringify(end.state) === JSON.stringify(r.state), `${tag}: the replay stepper reaches the server's final state`);
    }
  }
  // No input scores 0 on both.
  for (const game of [skylineGameFor(SKYLINE_REV_EXPAND), skylineGameFor(SKYLINE_REV_LIFT), pinball4Game] as any[]) {
    let s = game.init(99);
    while (!game.isOver(s)) s = game.step(s, game.key === "skyline" ? false : null);
    ok(game.score(s) === 0, `${game.key}: a run with no input scores 0`);
  }
}

/* ============================== 3. High Rise ============================== */

section("High Rise skylineRev 7: blocks, multiplier, milestones");
{
  const g = skylineGameFor(SKYLINE_REV_EXPAND);
  for (let seed = 1; seed <= 400; seed++) {
    const kinds = skylineKinds(seed);
    ok(kinds.length === SKYLINE_KIND_COUNT, "a kind for every block");
    ok(kinds.slice(0, SKYLINE_SPECIAL_FROM).every((k) => k === SKYLINE_KIND_NORMAL), "the first blocks are plain");
    ok(kinds.every((k, i) => i === 0 || k === SKYLINE_KIND_NORMAL || kinds[i - 1] === SKYLINE_KIND_NORMAL), "never two special blocks in a row");
    ok(JSON.stringify(kinds) === JSON.stringify(skylineKinds(seed)), "the schedule is the seed's alone");
  }
  const all = Array.from({ length: 400 }, (_, i) => skylineKinds(i + 1)).flat();
  for (const k of [SKYLINE_KIND_GOLD, SKYLINE_KIND_NARROW, SKYLINE_KIND_WIDE]) ok(all.filter((x) => x === k).length > 400, `special kind ${k} is dealt often enough`);
  ok(skylineKindWidth(SKYLINE_KIND_NARROW, 40_000) === 30_000 && skylineKindWidth(SKYLINE_KIND_NARROW, 6000) === 6000 && skylineKindWidth(SKYLINE_KIND_NARROW, 9000) === SKYLINE_NARROW_MIN, "narrow: three quarters, never under its floor (or the top)");
  ok(skylineKindWidth(SKYLINE_KIND_WIDE, 30_000) === 30_000 + SKYLINE_WIDE_GROW && skylineKindWidth(SKYLINE_KIND_WIDE, SKYLINE_START_W) === SKYLINE_START_W, "wide: wider, capped at the start width");
  ok(skylineKindWidth(SKYLINE_KIND_GOLD, 31_000) === 31_000 && skylineKindWidth(SKYLINE_KIND_NORMAL, 31_000) === 31_000, "gold and plain blocks keep the top's width");
  ok([0, 1, 2, 3, 5, 6, 9, 10, 20].map(skylineStreakMult).join(",") === "1,1,1,2,2,3,3,4,4", "the streak multiplier: ×2 from the 3rd, ×3 from the 6th, ×4 from the 10th");

  // A scripted perfect player: drop each block on the tick it lines up exactly (left edges, or centres for narrow and wide).
  const seed = 4242;
  let s = g.init(seed) as SkylineState;
  ok(s.expandRev === SKYLINE_REV_EXPAND && s.worldH === SKYLINE_SKY_H && s.band === 3, "rev 7 states carry the expansion, the sky and the bands");
  let guard = 0;
  let perfectUnits = 0;
  while (!g.isOver(s) && guard++ < 4000) {
    const below = s.blocks[s.blocks.length - 1]!;
    const kind = s.kinds![s.placed]!;
    const target = kind === SKYLINE_KIND_NARROW || kind === SKYLINE_KIND_WIDE ? below.x + (below.w >> 1) - (s.w >> 1) : below.x;
    let p = s;
    let best = Infinity;
    let at = 1;
    for (let k = 1; k < 300 && !g.isOver(p); k++) {
      const d = Math.abs(p.x - target);
      if (d < best) {
        best = d;
        at = k;
      }
      p = g.step(p, false);
    }
    for (let k = 1; k < at && !g.isOver(s); k++) s = g.step(s, false);
    if (!g.isOver(s)) {
      const before = s;
      s = g.step(s, true);
      if (s.perfects > before.perfects) perfectUnits += 5 * skylineStreakMult(s.streak ?? 0);
    }
  }
  ok(s.placed >= 30 && !s.missed, `the scripted player survives (${s.placed} blocks)`);
  // At top speed in a gust the block can step past the perfect window (as on every revision since rev 2).
  ok(s.perfects >= s.placed - 2, `(nearly) every drop perfect (${s.perfects}/${s.placed})`);
  ok((s.bestMult ?? 1) === 4 && (s.bestStreak ?? 0) >= 10, "the streak reaches ×4");
  ok((s.milestones ?? 0) === Math.floor(s.placed / 10), "a milestone every 10 floors");
  const golds = s.kinds!.slice(0, s.placed).filter((k) => k === SKYLINE_KIND_GOLD).length;
  ok((s.golds ?? 0) === golds, `every gold block landed perfectly counts (${s.golds}/${golds})`);
  const u = skylineV7Units(s);
  ok(u.perfects === perfectUnits && u.gold === 15 * golds && u.milestones === 20 * (s.milestones ?? 0), "units: streak-multiplied perfects, gold and milestones");
  ok(g.score(s) === 200, `a perfect run scores 200 (${g.score(s)})`);
  // Centred perfects keep a narrow block whole and a wide block whole (the tower widens).
  const widths = s.blocks.map((b) => b.w);
  ok(s.kinds!.slice(0, s.placed).every((k, i) => k !== SKYLINE_KIND_WIDE || widths[i + 1]! >= widths[i]!), "a centred wide block never narrows the tower");
  ok(s.blocks.every((b) => b.x >= 0 && b.x + b.w <= SKYLINE_WORLD_RIGHT), "every block inside the world");
  // Off-centre by more than the tolerance is not perfect, and the overhang is cut.
  const base = g.init(seed) as SkylineState;
  const near = { ...base, kinds: base.kinds!.map(() => SKYLINE_KIND_NARROW), w: skylineKindWidth(SKYLINE_KIND_NARROW, base.blocks[0]!.w) };
  const centre = base.blocks[0]!.x + (base.blocks[0]!.w >> 1);
  const off = g.step({ ...near, x: centre - (near.w >> 1) + SKYLINE_PERFECT_TOL + 256 }, true) as SkylineState;
  ok(off.perfects === 0 && off.blocks[1]!.w === near.w, "an off-centre narrow block inside the top: not perfect, kept whole (no overhang)");
  const on = g.step({ ...near, x: centre - (near.w >> 1) + SKYLINE_PERFECT_TOL }, true) as SkylineState;
  ok(on.perfects === 1 && on.blocks[1]!.x === centre - (near.w >> 1), "a centred narrow block is perfect and snaps to the centre");
}

/* ============================== 3b. High Rise skylineRev 8 ============================== */

section("High Rise skylineRev 8: skylineRev 7's play on a gentler curve");
{
  const g7 = skylineGameFor(SKYLINE_REV_EXPAND);
  const g8 = skylineGameFor(SKYLINE_REV_LIFT);
  ok(g8 !== g7 && g8.step === g7.step, "rev 8 steps with rev 7's step");
  // The same inputs give the same run, field for field, but the stamp (expandRev 8 against 7).
  const strip = (st: SkylineState) => JSON.stringify({ ...st, expandRev: 0 });
  let rng = 12345;
  const rand = (n: number) => {
    rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
    return (rng >>> 8) % n;
  };
  let lifted = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let a = g7.init(seed) as SkylineState;
    let b = g8.init(seed) as SkylineState;
    ok(a.expandRev === SKYLINE_REV_EXPAND && b.expandRev === SKYLINE_REV_LIFT, `seed ${seed}: each state carries its own stamp`);
    const gap = 12 + rand(40);
    for (let t = 0; t < 4000 && !g7.isOver(a); t++) {
      const tap = t % gap === gap - 1 || rand(90) === 0;
      a = g7.step(a, tap) as SkylineState;
      b = g8.step(b, tap) as SkylineState;
    }
    ok(g8.isOver(b) && strip(a) === strip(b), `seed ${seed}: rev 8 plays exactly as rev 7`);
    const s7 = g7.score(a);
    const s8 = g8.score(b);
    ok(s8 >= s7 && s8 <= 200, `seed ${seed}: rev 8 scores at least rev 7's (${s7} → ${s8})`);
    ok(s7 > 0 ? s8 > 0 : true, `seed ${seed}: a played run still scores`);
    if (s8 > s7) lifted++;
  }
  ok(lifted >= 30, `the gentler curve lifts most played runs (${lifted}/40)`);
  // Knot for knot: the same units, the points lifted (by at most 10 %), the top unchanged.
  ok(JSON.stringify(SKYLINE_V8_BAND_CURVE.units) === JSON.stringify(SKYLINE_V7_BAND_CURVE.units), "the same unit knots as rev 7");
  for (let i = 1; i < SKYLINE_V8_BAND_CURVE.points.length - 1; i++) {
    const p7 = SKYLINE_V7_BAND_CURVE.points[i]!;
    const p8 = SKYLINE_V8_BAND_CURVE.points[i]!;
    ok(p8 > p7 && p8 <= Math.ceil(p7 * 1.1), `knot ${i}: ${p7} → ${p8} (a little higher)`);
  }
  // The recorded rev-7 runs, scored on rev 8: the same units, never lower.
  const fixture = JSON.parse(gunzipSync(readFileSync(NEW_FIXTURE)).toString()) as { runs: Run[] };
  for (const run of fixture.runs.filter((r) => r.type === "skyline")) {
    const r = replay(run);
    const st = { ...(r.state as SkylineState), expandRev: SKYLINE_REV_LIFT };
    const s8 = g8.score(st);
    ok(s8 >= run.score && s8 <= 200, `rev 7 ${run.level} #${run.n}: ${run.score} on rev 7, ${s8} on rev 8`);
  }
  // The ceiling: 200 at rev 7's unit count, never past it.
  ok(bandPoints(SKYLINE_V8_BAND_CURVE, 1100) === 200 && bandPoints(SKYLINE_V8_BAND_CURVE, 5000) === 200, "the 200 ceiling at rev 7's unit count");
}

/* ============================== 4. Pinball ============================== */

section("Pinball pinRev 4: plunge, skill shot, ramps, lock, multiball, jackpot");
{
  const g = pinball4Game;
  const ev = (t: number, mask: number) => ({ t, k: PIN_INPUT_FLIPPERS, a: mask, b: 0, c: 0, d: 0 });
  // The plunge lanes: five equal zones of the meter, soft to the right (Z), full to the left (J), each inside its lane.
  let prevLane = P4_LANE_COUNT - 1;
  for (let p = 0; p <= P4_POWER_MAX; p++) {
    const lane = p4PlungeLane(p);
    ok(lane <= prevLane, "harder plunges never land further right");
    prevLane = lane;
    const x = p4PlungeX(p);
    ok(x - 8 > P4_LANE_POSTS[lane]! + 3 && x + 8 < P4_LANE_POSTS[lane + 1]! - 3, `power ${p}: the drop clears its lane's posts`);
  }
  for (let lane = 0; lane < P4_LANE_COUNT; lane++) ok(Array.from({ length: P4_POWER_MAX + 1 }, (_, p) => p).filter((p) => p4PlungeLane(p) === lane).length >= 12, `lane ${lane}: a zone of at least 12 powers`);
  ok(p4PowerAt(0) === 0 && Math.max(...Array.from({ length: 200 }, (_, t) => p4PowerAt(t))) === P4_POWER_MAX && p4PowerAt(7) === p4PowerAt(23), "the meter rises and falls");

  // Plunge at every power: the ball rides the rail and drops into its lane; the flashing lane scores the skill shot.
  for (let power = 0; power <= P4_POWER_MAX; power += 4) {
    let s = g.init(7);
    let t = 0;
    while (s.charge < 0) s = g.step(s, null) as Pin4State;
    // Press on the tick the meter reads `power`.
    for (let k = 0; k < 200; k++) {
      t = s.tick + 1;
      if (p4PowerAt(s.charge + 1) === power) break;
      s = g.step(s, null) as Pin4State;
    }
    s = g.step(s, ev(t, 1)) as Pin4State;
    ok(s.live === 1 && s.power === power && s.launched === 1, `power ${power}: launched at that power`);
    s = g.step(s, ev(t + 1, 0)) as Pin4State;
    let rode = false;
    let lane = -1;
    for (let k = 0; k < 200 && lane < 0; k++) {
      const before = s;
      s = g.step(s, null) as Pin4State;
      if (s.ride === P4_RAIL) rode = true;
      if (s.joulz !== before.joulz) lane = Math.log2(s.joulz ^ before.joulz);
    }
    ok(rode, `power ${power}: the plunge rides the rail`);
    ok(lane === p4PlungeLane(power), `power ${power}: drops into lane ${p4PlungeLane(power)} (got ${lane})`);
    ok((s.skills === 1) === (lane === s.skillLane) && s.points >= (s.skills ? P4_PTS_SKILL : 0), `power ${power}: the skill shot scores only in the flashing lane`);
  }
  // No press: it launches itself.
  {
    let s = g.init(3);
    for (let k = 0; k < 400 && !s.live; k++) s = g.step(s, null) as Pin4State;
    ok(s.live === 1 && s.launched === 1, "the plunger launches by itself");
  }

  // Ramps: a fast ball up a mouth rides it; a slow one rolls back. The combo and the lock.
  const atMouth = (side: number, vy: number, extra: Partial<Pin4State> = {}): Pin4State => {
    const r = P4_RAMPS[side]!;
    const base = g.init(11);
    return { ...base, ...extra, live: 1, charge: -1, wait: 0, acted: 1, x: ((r.x0 + r.x1) >> 1) * 256, y: (P4_RAMP_Y + 3) * 256, vx: 0, vy: -vy, tick: 600 } as Pin4State;
  };
  {
    const fast = g.step(atMouth(0, P4_RAMP_MIN + 1024), null) as Pin4State;
    ok(fast.ride === 1 && fast.ramps === 1 && fast.combo === 1 && fast.points === P4_PTS_RAMP && fast.mult === 2 && fast.lockLit === 1, "a clean left ramp shot: rides, scores, the next multiplier, lights the lock");
    let slow = { ...atMouth(1, 400), y: P4_RAMP_Y * 256 + 64 } as Pin4State;
    let crossed = false;
    for (let k = 0; k < 6; k++) {
      slow = g.step(slow, null) as Pin4State;
      crossed ||= slow.vy > 0;
    }
    ok(slow.ride === 0 && slow.ramps === 0 && crossed && slow.y >= P4_RAMP_Y * 256, "a slow shot rolls back out of the mouth");
    let s = fast;
    for (let k = 0; k < P4_RAMP_TICKS; k++) s = g.step(s, null) as Pin4State;
    ok(s.ride === 0 && s.rampExitAt === s.tick && Math.abs(s.x / 256 - 186) < 1 && s.y < 120 * 256, "the left ramp drops the ball onto the U lane");
    const again = g.step({ ...atMouth(1, P4_RAMP_MIN + 1024, { ramps: 1, combo: 1, rampExitAt: 600 - P4_COMBO_TICKS + 2, mult: 2 }) }, null) as Pin4State;
    ok(again.combo === 2 && again.bestCombo === 2, "a ramp shot soon after the last builds the combo");
    const late = g.step({ ...atMouth(1, P4_RAMP_MIN + 1024, { ramps: 1, combo: 1, rampExitAt: 600 - P4_COMBO_TICKS - 30 }) }, null) as Pin4State;
    ok(late.combo === 1, "a late one starts a new combo");
  }
  {
    // The lock: lit, a ramp shot sinks the ball, a new ball comes up; the third releases multiball.
    let s = g.step(atMouth(1, P4_RAMP_MIN + 1024, { lockLit: 1 }), null) as Pin4State;
    ok(s.ride === 2 + P4_RIDE_LOCK, "with the lock lit, the ramp carries the ball to the lock");
    for (let k = 0; k < P4_LOCK_RIDE_TICKS; k++) s = g.step(s, null) as Pin4State;
    ok(s.live === 0 && s.locks === 1 && s.locked === 1 && s.locksMade === 1 && s.lost === 0 && s.lockLit === 1, "lock 1: the ball is held, none lost, the lock stays lit");
    for (let k = 0; k < 120 && s.charge < 0; k++) s = g.step(s, null) as Pin4State;
    ok(s.charge >= 0, "a new ball comes up on the plunger");
    let m = g.step(atMouth(0, P4_RAMP_MIN + 1024, { lockLit: 1, locks: 2, locked: 2, locksMade: 2 }), null) as Pin4State;
    for (let k = 0; k < P4_LOCK_RIDE_TICKS; k++) m = g.step(m, null) as Pin4State;
    ok(m.multiballs === 1 && m.locks === 0 && m.lockLit === 0 && m.live === 1 && m.mbUntil === m.tick + P4_MB_TICKS, "the third lock starts multiball for 20 s and puts the lock out");
    for (let k = 0; k < 2 * P4_MB_STAGGER + 1; k++) m = g.step(m, null) as Pin4State;
    ok(m.extras.length + (m.live ? 1 : 0) >= 2 && m.locked === 0, `the locked balls come out (${m.extras.length} extra)`);
    // A drain while another ball is out costs nothing.
    const drained = g.step({ ...m, y: (P4_WORLD_H + 20) * 256, vy: 512 }, null) as Pin4State;
    ok(drained.lost === m.lost && drained.live === 1, "a drain during multiball costs no ball");
    // The jackpot counts only from below, while lit.
    const below = g.step({ ...m, extras: [], x: 190 * 256, y: 452 * 256, vx: 0, vy: -1536, targets: 15 }, null) as Pin4State;
    ok(below.jackpots === 1 && below.points - m.points >= P4_PTS_JACKPOT, "a hit from below on the lit standup is a jackpot");
    const above = g.step({ ...m, extras: [], x: 190 * 256, y: 428 * 256, vx: 0, vy: 1536 }, null) as Pin4State;
    ok(above.jackpots === 0, "a hit from above is not");
    const unlit = g.step({ ...m, extras: [], mbUntil: 0, x: 190 * 256, y: 452 * 256, vx: 0, vy: -1536, targets: 15 }, null) as Pin4State;
    ok(unlit.jackpots === 0, "the standup scores no jackpot when unlit");
  }
  {
    // Lit letters carry over a drain; the multiplier does not.
    const s = g.init(5);
    const live = { ...s, live: 1, charge: -1, wait: 0, joulz: 0b10101, mult: 3, x: 181 * 256, y: (P4_WORLD_H + 20) * 256, vy: 512 } as Pin4State;
    const d = g.step(live, null) as Pin4State;
    ok(d.lost === 1 && d.joulz === 0b10101 && d.mult === 1, "a drain keeps the lit letters and resets the multiplier");
    // The flippers shift the lit letters.
    const shifted = g.step({ ...live, y: 600 * 256, vy: 0 }, ev(live.tick + 1, 1)) as Pin4State;
    ok(shifted.joulz === 0b11010, `a left press shifts the letters left (${shifted.joulz.toString(2)})`);
  }
  {
    // The gate: a ball resting on it rolls off into the playfield (it never holds a ball).
    let s = { ...g.init(1), live: 1, charge: -1, wait: 0, x: 368 * 256, y: 130 * 256, vx: 0, vy: 0 } as Pin4State;
    for (let k = 0; k < 240; k++) s = g.step(s, null) as Pin4State;
    ok(s.x < 352 * 256 || s.y > 200 * 256, `a ball on the gate does not stay there (${Math.round(s.x / 256)}, ${Math.round(s.y / 256)})`);
  }
  {
    // Balls in play never overlap after a tick (equal-mass contacts).
    const s = { ...g.init(1), live: 1, charge: -1, wait: 0, x: 200 * 256, y: 500 * 256, vx: 512, vy: 0, extras: [{ x: 214 * 256, y: 500 * 256, vx: -512, vy: 0, still: 0, ride: 0, rideT: 0 }] } as Pin4State;
    const n = g.step(s, null) as Pin4State;
    ok(Math.hypot(n.x - n.extras[0]!.x, n.y - n.extras[0]!.y) >= 15.5 * 256 && n.vx < 0 && n.extras[0]!.vx > 0, "two balls meeting bounce apart");
  }
  ok(PIN_BALLS === 3, "three balls a run");
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL e4-expansion-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS e4-expansion-check: ${checks} checks — old High Rise and Pinball rounds replay unchanged; skylineRev 7 and pinRev 4 are dealt, replay, reach 200 and no further; special blocks, the streak multiplier and milestones; the plunge, skill shot, ramps, lock, multiball and jackpot`);
