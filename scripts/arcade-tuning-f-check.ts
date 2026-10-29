/**
 * Tuning F (Oct 2026): Breaker's Fireball cut to 2.5 s (brkRev 5), a second Rally
 * bumper for the final 15 s (rallyRev 5), a tenth fewer Tempo notes (beatRev 5),
 * more Meteor rocks on the taller grid (snakeRev 6), Orbit's swept black holes
 * (orbitRev 7, a bug fix), fainter Hover barrier lights and higher Fission
 * arrows (both display only).
 *
 *  1. Old rounds: 40 real runs recorded with the code on main before Tuning F on
 *     each game's then-live revision (scripts/fixtures/arcade-tuning-f-legacy.json,
 *     scripts/arcade-tuning-f-legacy.ts) replay through today's server path to
 *     the same score and the same final state, unflagged, and carry none of the
 *     new fields. 40 more runs recorded on the new stamps replay the same way.
 *  2. New rounds carry the new stamps and score on the bands.
 *  3. Per game: the rule itself, everything else unchanged from the revision
 *     before, and 150 reachable through the server replay.
 *  4. Orbit: a black hole the rocket touches always registers. Synthetic flights
 *     at 1–40 px a tick (up to nearly twice the swallowing disc's diameter in
 *     one tick) aimed through every hole of the checked courses, from the
 *     hole's own planet and the planet before, and every flight tick of real
 *     skill-band runs, against an independent closed-form distance oracle.
 *  5. Display only: Hover's arena border lights painted at a fraction of their old
 *     strength; Fission's arrows 8 px higher.
 *  6. Intro and "?" help say what changed.
 *
 *   bun scripts/arcade-tuning-f-check.ts          (TUNING_F_ONLY=orbit,beat,…; CHECKS_FULL=1 checks every bank course;
 *                                                  TUNING_F_VERBOSE=1 lists every check)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import { ARCADE_INPUT_DRAG } from "../src/lib/arcade/engine";
import { TUNING_F_GAMES, type TuningFRecord } from "./arcade-tuning-f-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel, type SkillProfile } from "./arcade-skill-bands/human";
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { bandPoints, bandTop, bandUnitsFor } from "../src/lib/arcade/scoreBands";
import {
  breakerGameFor,
  BRK_FIRE_TICKS_V4,
  BRK_FIRE_TICKS_V5,
  BRK_PADDLE_Y_FP,
  BRK_POWER_FIRE,
  BRK_REV_TUNED,
  BRK_REV_TUNEF,
} from "../src/lib/arcade/breaker";
import {
  rallyBumper2,
  rallyGameFor,
  RALLY_BALL_R,
  RALLY_BUMPER2_FROM,
  RALLY_BUMPER2_GAP,
  RALLY_BUMPER_FROM,
  RALLY_BUMPER_R,
  RALLY_BUMPER_X_MIN,
  RALLY_BUMPER_X_SPAN,
  RALLY_BUMPER_Y_MIN,
  RALLY_BUMPER_Y_SPAN,
  RALLY_REV_TUNED,
  RALLY_REV_TUNEF,
  RALLY_V5_BAND_CURVE,
  type RallyState,
  RALLY_V10_BAND_CURVE,
  RALLY_V10_BASE_TOP,
} from "../src/lib/arcade/rally";
import { beatGameFor, beatThinned, BEAT_LANE_GAP, BEAT_REV_TUNEC, BEAT_REV_TUNEF, BEAT_V5_BAND_CURVE, type BeatState } from "../src/lib/arcade/beat";
import { snakeGameFor, snakeRocksEarned, SNAKE_REV_ROCKS, SNAKE_REV_TALL, SNAKE_ROCK_MAX_V6, SNAKE_V6_BAND_CURVE, type SnakeState } from "../src/lib/arcade/snake";
import { FP, orbitFlightBeltK, ORBIT_REV_SWEPT, ORBIT_REV_TUNED, ORBIT_REV_XP, ORBIT_ROCKET_DIAMETER, ORBIT_TOTAL } from "../src/lib/arcade/orbit";
import {
  decodeOrbitHoles,
  decodeRev3Planets,
  initSweptFrom,
  initTunedFrom,
  orbitRev3Game,
  ORBIT_HOLE_R,
  ORBIT_HOLE_SWEPT_R,
  ORBIT_REV3_WORLD_W,
  type OrbitHole,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { generateBeat, generateBreaker, generateOrbit, generateRally, generateSnake } from "../src/lib/duel/arcade.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { playRevOf } from "./scoring-targets-revs";

/** A flawless player for best-score proofs: quick, never lapses, no timing, aim or judgement error. */
const PERFECT: SkillProfile = { reactionMs: [120, 0], lapse: 0, timingSdMs: 0, aimSdPx: 0, powerSd: 0, mistake: 0, thinkScale: 0.3, judgement: 0, trackLagMs: 30 };

const FULL = process.env.CHECKS_FULL === "1";
const ONLY = (process.env.TUNING_F_ONLY ?? "").split(",").filter(Boolean);
const want = (type: string) => ONLY.length === 0 || ONLY.includes(type);
const failures: string[] = [];
let checks = 0;
const VERBOSE = process.env.TUNING_F_VERBOSE === "1";
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
  if (VERBOSE) console.log(`  ${cond ? "✓" : "✗"} ${label}`);
};
const section = (name: string) => console.log(`— ${name}`);

/** A skill-band player's run on a revision, sent through the server's encode + replay. */
async function botRun(type: string, rev: number, level: SkillLevel, n: number, profile?: SkillProfile) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const { bot } = await import(`./arcade-skill-bands/bots/${type}.ts`);
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const human = new Human(spec.type, seed, level);
  if (profile) (human as unknown as { p: SkillProfile }).p = profile;
  const out = bot({ game, seed, rev, human });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const byTick = new Map((out.events ?? []).map((e: any) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  return { state, score, events: (out.events ?? []) as any[], seed, game, result: spec.replay(seed, raw, rev) };
}

/** Seeded integers for random play (script only). */
function lcg(seed: number) {
  let r = seed >>> 0 || 1;
  return () => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 2 ** 32;
  };
}

/* ============================== 1. Stored runs ============================== */
section("Old rounds replay and score exactly as before; Tuning F runs replay as recorded");
{
  const fixture = JSON.parse(readFileSync("scripts/fixtures/arcade-tuning-f-legacy.json", "utf8")) as { runs: TuningFRecord[] };
  const per = new Map<string, number>();
  for (const run of fixture.runs) {
    if (!want(run.type)) continue;
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    const tag = `${run.type} ${run.when} rev ${run.rev} ${run.level}`;
    ok(result.score === run.score && !result.flagged, `${tag}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${tag}: the replayed final state is byte-identical`);
    const s = result.state as any;
    if (run.when === "before") ok(s.tune !== 2 && s.bumper2 === undefined && s.bumped === undefined && s.tunef === undefined && s.swept === undefined, `${tag}: the old state carries no Tuning F field`);
    else ok(run.rev === spec.tunef, `${tag}: recorded on the Tuning F stamp`);
    per.set(`${run.type} ${run.when}`, (per.get(`${run.type} ${run.when}`) ?? 0) + 1);
  }
  for (const [type] of TUNING_F_GAMES)
    if (want(type)) for (const when of ["before", "after"]) ok((per.get(`${type} ${when}`) ?? 0) >= 8, `${type} ${when}: ${per.get(`${type} ${when}`) ?? 0} recorded runs`);
}

/* ============================== 2. Stamps ============================== */
section("New rounds carry the Tuning F stamps and score on the bands");
{
  const stamps: [string, string, number | undefined, number, number][] = [
    // Taller worlds batch 1 (16 Oct 2026) moved Breaker and Rally on to their taller courts (brkRev 6, rallyRev 6); arcade-tuning-g1-check covers them.
    ["breaker", "brkRev", playRevOf("breaker", generateBreaker().brkRev), BRK_REV_TUNEF + 1, 6],
    ["rally", "rallyRev", playRevOf("rally", generateRally().rallyRev), RALLY_REV_TUNEF + 1, 6],
    // Taller worlds batch 2 (16 Oct 2026) moved Tempo on to its taller lanes (beatRev 6); arcade-tuning-g2-check covers it.
    // Expansion E2 (25 Oct 2026) then moved Tempo and Meteor on to their 200-point revisions (beatRev 9, snakeRev 9); expansion-e2-check covers them.
    ["beat", "beatRev", playRevOf("beat", generateBeat().beatRev), BEAT_REV_TUNEF + 4, 9],
    ["snake", "snakeRev", playRevOf("snake", generateSnake().snakeRev), SNAKE_REV_ROCKS + 3, 9],
    // Taller worlds batch 3 (16 Oct 2026) moved Orbit on to its taller view (orbitRev 8); arcade-tuning-g3-check covers it.
    ["orbit", "orbitRev", playRevOf("orbit", generateOrbit().orbitRev), ORBIT_REV_SWEPT + 1, 8],
  ];
  // Expansion E3 (docs/expansions/e3.md) then moved Breaker on to brkRev 9; expansion-e3-check covers it. The expansion
  // to 200 (docs/expansions/x200-orbit.md) moved Orbit on to orbitRev 12; orbit-expand-check covers it.
  // Expansion E9 (docs/expansions/e9.md) then moved Rally on to rallyRev 10, and Joe's phone notes (27 Oct 2026) to
  // rallyRev 11; expansion-e9-check covers both. The phone notes also moved Breaker on again, to brkRev 10
  // (expansion-e3-check section 5), Meteor on to snakeRev 10 (snake-rev10-check) and Tempo on to beatRev 10 (tempo-ease-check).
  // The arcade scoring standard (29 Oct 2026) moved Orbit on again, to orbitRev 13, whose play (playRevOf) is orbitRev 12's.
  const movedOn: Record<string, number> = { breaker: BRK_REV_TUNEF + 5, orbit: ORBIT_REV_XP, rally: RALLY_REV_TUNEF + 6 };
  movedOn.snake = SNAKE_REV_ROCKS + 4;
  movedOn.beat = BEAT_REV_TUNEF + 5;
  for (const [type, field, got, rev, n] of stamps) {
    ok(got === (movedOn[type] ?? rev) && rev === n, `${type}: new rounds stamped ${field} ${movedOn[type] ?? n} (got ${got})`);
    ok(puzzleUsesBands({ type, [field]: rev } as never), `${type} ${rev} scores on the bands`);
  }
}

/* ============================== 3a. Breaker ============================== */
if (want("breaker")) {
  section("Breaker brkRev 5: a 2.5 s Fireball");
  ok(BRK_FIRE_TICKS_V5 === 150 && BRK_FIRE_TICKS_V4 === 210, "Fireball 2.5 s (150 ticks); brkRev 4 keeps 3.5 s");
  for (const [rev, want] of [[BRK_REV_TUNEF, BRK_FIRE_TICKS_V5], [BRK_REV_TUNED, BRK_FIRE_TICKS_V4]] as const) {
    const game = breakerGameFor(rev);
    const s = game.init(4242);
    let lit = game.step({ ...s, capsules: [{ x: s.paddleX * 256, y: BRK_PADDLE_Y_FP - 512, kind: BRK_POWER_FIRE }] }, null);
    ok(lit.fire === want && lit.fireballs === 1, `brkRev ${rev}: a caught Fireball burns for ${want} ticks (${lit.fire})`);
    let burnt = 0;
    while ((lit.fire ?? 0) > 0 && burnt < 400) {
      lit = game.step(lit, null);
      burnt++;
    }
    ok(burnt === want, `brkRev ${rev}: it goes out after ${want} ticks (${burnt})`);
  }
  for (const seed of [1, 77, 4242, 99991]) {
    const a = breakerGameFor(BRK_REV_TUNEF).init(seed);
    const b = breakerGameFor(BRK_REV_TUNED).init(seed);
    ok(JSON.stringify({ ...a, tune: 1 }) === JSON.stringify(b), `seed ${seed}: same wall and draws as brkRev 4`);
  }
}

/* ============================== 3b. Rally ============================== */
if (want("rally")) {
  section("Rally rallyRev 5: a second bumper from 45 s");
  ok(RALLY_BUMPER2_FROM === 2700 && RALLY_BUMPER_FROM === 1800, "first bumper from 30 s, second from 45 s");
  let fallbacks = 0;
  for (let seed = 1; seed <= 4000; seed++) {
    const first = rallyGameFor(RALLY_REV_TUNED).init(seed).bumper!;
    const second = rallyBumper2(seed, first);
    const inBand = second.x >= RALLY_BUMPER_X_MIN && second.x < RALLY_BUMPER_X_MIN + RALLY_BUMPER_X_SPAN && second.y >= RALLY_BUMPER_Y_MIN && second.y < RALLY_BUMPER_Y_MIN + RALLY_BUMPER_Y_SPAN;
    const d = Math.hypot(second.x - first.x, second.y - first.y);
    if (!inBand || d < RALLY_BUMPER2_GAP) ok(false, `seed ${seed}: second bumper at (${second.x}, ${second.y}) is outside the band or ${d.toFixed(0)} px from the first`);
    if (second.y === first.y && Math.abs(second.x - first.x) === 100) fallbacks++;
  }
  ok(RALLY_BUMPER2_GAP - 2 * RALLY_BUMPER_R >= 2 * RALLY_BALL_R + 20, "a ball always fits between the two bumpers");
  ok(true, `4,000 seeds: second bumper in the band and ≥ ${RALLY_BUMPER2_GAP} px from the first (${fallbacks} used the fixed fallback)`);
  // Same play as rallyRev 4 up to 45 s under the same random drags; the second bumper bounces balls after.
  let bounced2 = 0;
  let after45 = 0;
  for (let k = 0; k < 40; k++) {
    const seed = 1000 + k * 7919;
    const a = rallyGameFor(RALLY_REV_TUNEF);
    const b = rallyGameFor(RALLY_REV_TUNED);
    let sa = a.init(seed);
    let sb = b.init(seed);
    const rand = lcg(seed);
    let same = true;
    while (!a.isOver(sa) && sa.tick < RALLY_BUMPER2_FROM - 1) {
      // A paddle that follows the ball with a little lag, so rallies reach the bumpers.
      const input = sa.tick % 3 === 0 ? { t: sa.tick + 1, k: ARCADE_INPUT_DRAG, a: Math.round(sa.x / 256 + (rand() - 0.5) * 30), b: 0, c: 0, d: 0 } : null;
      sa = a.step(sa, input as any);
      sb = b.step(sb, input as any);
      const { bumper2: _b2, bumped: _bd, ...restA } = sa;
      if (JSON.stringify(restA) !== JSON.stringify(sb)) same = false;
    }
    ok(same, `seed ${seed}: plays exactly as rallyRev 4 until 45 s`);
    if (!a.isOver(sa)) after45++;
    while (!a.isOver(sa)) {
      const before = sa.bounces ?? 0;
      const input = sa.tick % 3 === 0 ? { t: sa.tick + 1, k: ARCADE_INPUT_DRAG, a: Math.round(sa.x / 256 + (rand() - 0.5) * 30), b: 0, c: 0, d: 0 } : null;
      sa = a.step(sa, input as any);
      if ((sa.bounces ?? 0) > before && sa.bumped === 1) bounced2++;
    }
  }
  ok(bounced2 > 0, `the second bumper bounces balls after 45 s (${bounced2} bounces in ${after45} runs alive at 45 s)`);
  // A ball sent straight at the second bumper bounces off it after 45 s, and passes through its spot before.
  {
    const game = rallyGameFor(RALLY_REV_TUNEF);
    const base = game.init(31337) as RallyState;
    const b2 = base.bumper2!;
    const aim = (tick: number): RallyState => ({ ...base, tick, x: b2.x * 256, y: (b2.y + 40) * 256, vx: 0, vy: -1024, golds: [], entries: [] });
    let s = aim(RALLY_BUMPER2_FROM + 10);
    for (let i = 0; i < 20; i++) s = game.step(s, null);
    ok((s.bounces ?? 0) === 1 && s.bumped === 1 && s.vy > 0, "a ball meeting the second bumper after 45 s bounces off it");
    s = aim(RALLY_BUMPER_FROM + 10);
    for (let i = 0; i < 20; i++) s = game.step(s, null);
    ok((s.bounces ?? 0) === 0, "before 45 s the second bumper is not there");
  }
  ok(bandTop(RALLY_V5_BAND_CURVE) === 250 && bandPoints(RALLY_V5_BAND_CURVE, 250) === 150, "rallyRev 5 curve: 150 at 250");
}

/* ============================== 3c. Tempo ============================== */
if (want("beat")) {
  section("Tempo beatRev 5: a tenth fewer notes");
  let total4 = 0;
  let total5 = 0;
  for (let k = 0; k < 300; k++) {
    const seed = 1 + k * 104_729;
    const s4 = beatGameFor(BEAT_REV_TUNEC).init(seed) as BeatState;
    const s5 = beatGameFor(BEAT_REV_TUNEF).init(seed) as BeatState;
    const n4 = s4.chart.ticks.length;
    const n5 = s5.chart.ticks.length;
    total4 += n4;
    total5 += n5;
    const dropped = new Set(beatThinned(seed, s4.chart));
    const bad: string[] = [];
    if (n5 !== n4 - Math.round(n4 / 10)) bad.push(`${n5} notes of ${n4}`);
    if (s5.judged.length !== n5) bad.push("judged length");
    if (dropped.has(0)) bad.push("first note dropped");
    for (const i of dropped) if (s4.chart.holds[i]! > 0 || (s4.chart.swipes?.[i] ?? 0) !== 0) bad.push(`note ${i} is a hold or swipe`);
    // The kept notes are exactly beatRev 4's, in order, with their lanes, holds and swipes.
    const kept = s4.chart.ticks.map((_, i) => i).filter((i) => !dropped.has(i));
    const same = kept.every((i, j) => s5.chart.ticks[j] === s4.chart.ticks[i] && s5.chart.lanes[j] === s4.chart.lanes[i] && s5.chart.holds[j] === s4.chart.holds[i] && (s5.chart.swipes?.[j] ?? 0) === (s4.chart.swipes?.[i] ?? 0));
    if (!same) bad.push("kept notes differ from beatRev 4");
    const lastInLane = [-999, -999, -999, -999];
    for (let j = 0; j < n5; j++) {
      const t = s5.chart.ticks[j]!;
      if (j > 0 && t < s5.chart.ticks[j - 1]!) bad.push("unsorted");
      if (t - lastInLane[s5.chart.lanes[j]!]! < BEAT_LANE_GAP) bad.push(`lane gap at note ${j}`);
      lastInLane[s5.chart.lanes[j]!] = t;
      if ((s5.chart.swipes?.[j] ?? 0) !== 0 && (s5.chart.ticks[j - 1] === t || s5.chart.ticks[j + 1] === t)) bad.push(`swipe ${j} shares its tick`);
    }
    const { chart: _c, judged: _j, tunef: _t, ...rest5 } = s5;
    const { chart: _c4, judged: _j4, ...rest4 } = s4;
    if (JSON.stringify(rest5) !== JSON.stringify(rest4)) bad.push("other start fields differ");
    if (bad.length) ok(false, `seed ${seed}: ${bad.slice(0, 3).join("; ")}`);
  }
  const cut = 1 - total5 / total4;
  ok(cut > 0.09 && cut < 0.11, `300 charts: ${total4} notes on beatRev 4, ${total5} on beatRev 5 (${(cut * 100).toFixed(1)} % fewer)`);
  ok(bandTop(BEAT_V5_BAND_CURVE) === 1000 && bandPoints(BEAT_V5_BAND_CURVE, 1000) === 150, "every note Perfect is still 150");
}

/* ============================== 3d. Meteor ============================== */
if (want("snake")) {
  section("Meteor snakeRev 6: more rocks on the taller grid");
  const earned5 = [6, 7, 10, 11, 12, 22, 30, 500].map((e) => snakeRocksEarned(e));
  const earned6 = [5, 6, 9, 10, 11, 22, 30, 500].map((e) => snakeRocksEarned(e, 1));
  ok(JSON.stringify(earned5) === JSON.stringify([0, 1, 1, 1, 2, 4, 5, 8]), `snakeRev 5 pace unchanged (${earned5})`);
  ok(JSON.stringify(earned6) === JSON.stringify([0, 1, 1, 2, 2, 5, 7, SNAKE_ROCK_MAX_V6]) && SNAKE_ROCK_MAX_V6 === 11, `snakeRev 6: first rock at length 9, one every 4 stars, up to 11 (${earned6})`);
  for (const seed of [3, 77, 4242, 99991]) {
    const a = snakeGameFor(SNAKE_REV_ROCKS).init(seed) as SnakeState;
    const b = snakeGameFor(SNAKE_REV_TALL).init(seed) as SnakeState;
    const { tunef, ...rest } = a;
    ok(tunef === 1 && JSON.stringify(rest) === JSON.stringify(b), `seed ${seed}: same stars, rock slots and shower as snakeRev 5`);
  }
  // The same skill-band players see more rocks land.
  let rocks5 = 0;
  let rocks6 = 0;
  for (let n = 0; n < 10; n++)
    for (const level of ["good", "great"] as const) {
      rocks5 += ((await botRun("snake", SNAKE_REV_TALL, level, n)).state as SnakeState).rocks?.length ?? 0;
      rocks6 += ((await botRun("snake", SNAKE_REV_ROCKS, level, n)).state as SnakeState).rocks?.length ?? 0;
    }
  ok(rocks6 > rocks5 * 1.15, `20 good and great runs: ${rocks5} rocks landed on snakeRev 5, ${rocks6} on snakeRev 6`);
  ok(bandTop(SNAKE_V6_BAND_CURVE) === 33 && bandPoints(SNAKE_V6_BAND_CURVE, 33) === 150, "snakeRev 6 curve: 150 at 33 stars");
}

/* ============================== 4. Orbit ============================== */
if (want("orbit")) {
  section("Orbit orbitRev 7: a black hole the rocket touches always registers");
  const bankBySeed = new Map(ORBIT_REV3_BANK.map((e) => [e.seed, e]));
  const courses = ORBIT_HOLE_BANK.slice(0, FULL ? ORBIT_HOLE_BANK.length : 8);
  const R = ORBIT_HOLE_SWEPT_R;
  ok(R === ORBIT_HOLE_R + ORBIT_ROCKET_DIAMETER / 2, "the swallowing reach is the drawn disc plus the drawn rocket's radius (the size belts use)");
  /** Closed-form distance (px, floats) from the hole centre to the segment: the independent oracle. */
  const segDist = (h: OrbitHole, x0: number, y0: number, x1: number, y1: number) => {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((h.x - x0) * dx + (h.y - y0) * dy) / len2));
    return Math.hypot(x0 + t * dx - h.x, y0 + t * dy - h.y) / FP;
  };
  const deep = R / FP - 2;
  const clear = R / FP + 2;
  /** Steps one flight on a game; returns what the oracle saw and what the sim did. */
  const flight = (start: OrbitRev3State, h: OrbitHole) => {
    let s = start;
    for (let t = 0; t < 120 && s.flying > 0 && !s.ended; t++) {
      const before = s;
      s = orbitRev3Game.step(s, null) as OrbitRev3State;
      const x1 = before.x + before.vx, y1 = before.y + before.vy;
      const d = segDist(h, before.x, before.y, x1, y1);
      const jumped = (s.jumps ?? 0) > (before.jumps ?? 0);
      // A belt reached first along this tick's segment wins; the oracle only judges ticks with no belt on them.
      const belt = before.planets.some((p) => orbitFlightBeltK(p, before.x, before.y, x1, y1, s.tick) >= 0);
      if (d <= deep && !belt) return { reached: true, registered: jumped && s.cur === h.to, d };
      if (jumped) return { reached: false, registered: true, d, stray: d > clear && !before.holes?.some((o) => o !== h && segDist(o, before.x, before.y, x1, y1) <= clear) };
    }
    return { reached: false, registered: false, d: Infinity };
  };
  let flights = 0;
  let reached = 0;
  let missed = 0;
  let strays = 0;
  let oldMissed = 0;
  let oldReached = 0;
  let grazed = 0;
  let grazeHits = 0;
  const speeds = [1, 3, 6, 10, 16, 24, 32, 40];
  for (const entry of courses) {
    const course = bankBySeed.get(entry.seed)!;
    const planets = decodeRev3Planets(course.planets);
    const holes = decodeOrbitHoles(entry.holes);
    const base7 = initSweptFrom(planets, ORBIT_REV3_WORLD_W, holes);
    const base6 = initTunedFrom(planets, ORBIT_REV3_WORLD_W, holes);
    for (const h of holes)
      for (const cur of [h.from - 1, h.from])
        for (let dir = 0; dir < 16; dir++) {
          const a = (dir / 16) * Math.PI * 2;
          const ux = Math.cos(a), uy = Math.sin(a);
          for (const v of speeds)
            for (const off of [0, 0.5, 0.85, -0.85, 1.15]) {
              const back = 70 * FP;
              const px = Math.round(h.x - ux * back - uy * off * R);
              const py = Math.round(h.y - uy * back + ux * off * R);
              const vx = Math.round(ux * v * FP), vy = Math.round(uy * v * FP);
              const shot = { cur, flying: 1, x: px, y: py, vx, vy, releaseX: px, releaseY: py, releaseTick: 900, tick: 900, warp: 0, angle: 0 };
              const r7 = flight({ ...base7, ...shot }, h);
              flights++;
              if (Math.abs(off) <= 0.85) {
                if (r7.reached) {
                  reached++;
                  if (!r7.registered) {
                    missed++;
                    if (missed <= 5) ok(false, `course ${entry.seed} hole ${h.from}→${h.to} from planet ${cur}: a ${v} px/tick flight ${r7.d.toFixed(1)} px from its centre did not register`);
                  }
                }
                const r6 = flight({ ...base6, ...shot }, h);
                if (r6.reached) {
                  oldReached++;
                  if (!r6.registered) oldMissed++;
                }
              } else {
                // Just outside the reach (15 % past it): never swallowed by this hole.
                grazed++;
                if (r7.registered && r7.stray) grazeHits++;
              }
              if ((r7 as any).stray) strays++;
            }
        }
  }
  ok(missed === 0, `${courses.length} courses, ${flights} synthetic flights at ${speeds.join(", ")} px a tick: ${reached} reached a hole deep inside the reach, ${missed} did not register`);
  ok(reached > flights * 0.3, `most aimed flights reach their hole before anything else ends them (${reached} / ${flights})`);
  ok(grazeHits === 0 && strays === 0, `flights passing outside the reach never jump (${grazed} grazing flights, ${grazeHits + strays} strays)`);
  ok(oldMissed > 0, `the bug, shown on orbitRev 6: ${oldMissed} of ${oldReached} of the same flights flew through a drawn hole unregistered`);

  // Every flight tick of real skill-band runs on orbitRev 7: touching a live hole (with no belt first) is a jump.
  let unregistered = 0;
  let jumps = 0;
  for (const level of ["good", "great", "near"] as const)
    for (let n = 0; n < (FULL ? 30 : 6); n++) {
      const run = await botRun("orbit", ORBIT_REV_SWEPT, level, n);
      ok(run.result.score === run.score && !run.result.flagged, `orbit ${level} ${n}: the server replay agrees (${run.result.score})`);
      const byTick = new Map(run.events.map((e: any) => [e.t, e]));
      let s = run.game.init(run.seed) as OrbitRev3State;
      while (!run.game.isOver(s) && s.tick < run.game.runTicks) {
        const before = s;
        s = run.game.step(s, byTick.get(s.tick + 1) ?? null) as OrbitRev3State;
        if (before.flying === 0 || before.warp) continue;
        if ((s.jumps ?? 0) > (before.jumps ?? 0)) {
          jumps++;
          continue;
        }
        const x1 = before.x + before.vx, y1 = before.y + before.vy;
        const belt = before.planets.some((p) => orbitFlightBeltK(p, before.x, before.y, x1, y1, s.tick) >= 0);
        for (const h of before.holes ?? []) {
          if (h.to <= before.cur || belt) continue;
          if (segDist(h, before.x, before.y, x1, y1) <= deep) unregistered++;
        }
      }
    }
  ok(unregistered === 0, `skill-band runs on orbitRev 7: ${jumps} jumps; ${unregistered} flight ticks touched a live hole without one`);

  // Best score through the server replay.
  let best = 0;
  for (let n = 0; n < 6 && best < 150; n++) best = Math.max(best, (await botRun("orbit", ORBIT_REV_SWEPT, "near", n, PERFECT)).result.score);
  ok(best === 150, `150 reachable on orbitRev 7 through the server replay (best ${best})`);
  ok(ORBIT_TOTAL === 40 && ORBIT_REV_TUNED === 6, "same 40-planet courses as orbitRev 6");
}

/* ============================== 3e. Best scores ============================== */
section("150 is reachable on every Tuning F revision through the server replay");
for (const [type, rev] of [["breaker", BRK_REV_TUNEF], ["rally", RALLY_REV_TUNEF], ["beat", BEAT_REV_TUNEF], ["snake", SNAKE_REV_ROCKS]] as const) {
  if (!want(type)) continue;
  let best = 0;
  for (let n = 0; n < 12 && best < 150; n++) best = Math.max(best, (await botRun(type, rev, "near", n, PERFECT)).result.score);
  ok(best === 150, `${type} rev ${rev}: best ${best}`);
}

/* ============================== 5. Display only ============================== */
section("Hover's arena border lights are faint; Fission's arrows sit higher");
{
  let clock = 10_000;
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2 } });
  const { createCanvas } = await import("@napi-rs/canvas");
  const fx = await import("../src/lib/arcade/arcadeFx.renderer");
  const specs = await import("../src/lib/arcade/arcadeFxGames.renderer");
  const W = 390, H = 620;
  type S = { tick: number; n: number };
  /** Total alpha painted `ms` into a flash by a step-pattern event (as Hover's), at a given level and strength. */
  const light = (level: number | undefined, strong: boolean, ms: number) => {
    const spec: Parameters<typeof fx.arcadeFx<S>>[1] = {
      game: `hover-light-${level}-${strong}-${ms}`, world: "retro", width: W, height: H, fit: "world",
      events: [{ kind: "pop", count: (s) => s.n, label: () => null, textOnly: true, bulbs: { pattern: "step", colours: specs.HOVER_STEP_COLOURS, strong, level } }],
    };
    const c = createCanvas(W, H);
    const g = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    const start = clock;
    fx.arcadeFx(g, spec, { tick: 1, n: 0 }, () => {});
    clock += 1000 / 60;
    fx.arcadeFx(g, spec, { tick: 2, n: 1 }, () => {});
    clock = start + ms;
    g.clearRect(0, 0, W, H);
    fx.arcadeFx(g, spec, { tick: 3, n: 1 }, () => {});
    clock = start;
    const data = c.getContext("2d").getImageData(0, 0, W, H).data;
    let sum = 0;
    for (let i = 3; i < data.length; i += 4) sum += data[i]!;
    return sum;
  };
  const barrier = specs.HOVER_FX.events.find((e) => e.kind === "pop" && !e.every && e.bulbs?.pattern === "step")!;
  const zone = specs.HOVER_FX.events.find((e) => e.every === 7 && e.bulbs?.pattern === "step")!;
  ok(barrier.bulbs?.level === specs.HOVER_BARRIER_LIGHT && zone.bulbs?.level === specs.HOVER_ZONE_LIGHT && zone.bulbs?.strong === true, "Hover's border lights on each barrier and every 7th carry their Tuning F levels");
  // Light summed over the whole flash (every 30 ms), since a milestone blinks.
  const total = (level: number | undefined, strong: boolean) => {
    let sum = 0;
    for (let ms = 30; ms <= 960; ms += 30) sum += light(level, strong, ms);
    return sum;
  };
  const oldBarrier = total(undefined, false);
  const newBarrier = total(barrier.bulbs?.level, false);
  const oldZone = total(undefined, true);
  const newZone = total(zone.bulbs?.level, true);
  ok(newBarrier > 0 && newBarrier < oldBarrier * 0.3, `border lights on each barrier: a very faint flash (${Math.round((100 * newBarrier) / oldBarrier)} % of before)`);
  ok(newZone > newBarrier * 1.8, `border lights every 7th barrier: clearly stronger than a plain barrier (${(newZone / newBarrier).toFixed(1)}×)`);
  ok(newZone < oldZone * 0.5 && newZone < oldBarrier, `border lights every 7th barrier: still well below before (${Math.round((100 * newZone) / oldZone)} % of the old 7th, ${Math.round((100 * newZone) / oldBarrier)} % of an old plain barrier)`);
  const others = [specs.RALLY_FX, specs.BREAKER_FX, specs.PINBALL_FX].flatMap((spec: any) => spec.events).filter((e: any) => e.bulbs);
  ok(others.every((e: any) => e.bulbs.level === undefined), "Rally, Breaker and Pinball lights are unchanged");
  const burst = readFileSync("src/puzzles/burst.tsx", "utf8");
  // Superseded 15 Oct 2026 (arcade play screen): the 76 px arrows end exactly 16 px above the visible bottom.
  ok(/data-game-controls="pad" className="grid h-\[76px\][^"]*gap-4">/.test(burst) && !/pb-5/.test(burst), "Fission: the 76 px arrows' row ends 16 px above the bottom (no extra padding)");
  ok(/burst: 8 \+ 76/.test(readFileSync("scripts/presentation-geometry-check.tsx", "utf8")), "Fission: the arena geometry accounts for the arrows");
}

/* ============================== 6. Help ============================== */
section("Intro and \"?\" help");
{
  const help = (type: keyof typeof PUZZLE_INSTRUCTIONS) => JSON.stringify(PUZZLE_INSTRUCTIONS[type]);
  if (want("breaker")) ok(help("breaker").includes("2.5 seconds") && !help("breaker").includes("3.5 seconds"), "Breaker: the Fireball lasts 2.5 seconds");
  // Expansion E9 (docs/expansions/e9.md) moved Rally on to rallyRev 10: its help reads that curve (a good run and the base top).
  if (want("rally")) ok(/second bumper/.test(help("rally")) && /45 s/.test(help("rally")) && PUZZLE_INSTRUCTIONS.rally.score.includes(`up to ${RALLY_V10_BASE_TOP}. A good run (100 points) counts ${bandUnitsFor(RALLY_V10_BAND_CURVE, 100)}`) && /5 a hit/.test(help("rally")) && /counts 6/.test(help("rally")) && !/\+3|scores 3/.test(help("rally")), "Rally: the second bumper from 45 s, the top and a good run new rooms score on (rallyRev 10 since expansion E9) and one value each for a gold hit (5) and a pink pad (6)");
  if (want("beat")) ok(PUZZLE_INSTRUCTIONS.beat.score.includes("A good run (100 points) reaches 824"), "Tempo: a good run on the curve rooms deal (beatRev 9 since expansion E2)");
  if (want("snake")) ok(/length 9/.test(help("snake")) && /every 4 stars, up to 11/.test(help("snake")) && /at most 14 rocks/.test(help("snake")) && PUZZLE_INSTRUCTIONS.snake.score.includes("150 at 31"), "Meteor: rocks from length 9, every 4 stars, up to 11 (14 with the shower), and the snakeRev 9 top (expansion E2)");
  if (want("orbit")) ok(/Any black hole ahead/.test(help("orbit")) && /any part of the rocket/.test(help("orbit")), "Orbit: any black hole ahead swallows any part of the rocket");
}

if (failures.length) {
  console.log(`\nFAIL ${failures.length} of ${checks} checks:`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nPASS ${checks} checks`);
