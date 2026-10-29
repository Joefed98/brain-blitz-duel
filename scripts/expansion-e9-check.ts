/**
 * Expansion E9 (26 Oct 2026, docs/expansions/e9.md): Rally rallyRev 10, Fission burstRev 8 and Flightpath
 * bullRev 8, raised to 200.
 *
 *  1. Stored rounds: skill-band runs recorded on main before the change on every older revision of the three
 *     games (scripts/fixtures/expansion-e9-legacy.json.gz, scripts/expansion-e9-legacy.ts) replay on today's
 *     code to the same score and the same final state; the runs on the new stamps (expansion-e9-runs.json.gz)
 *     the same, and each game's stored 200 (`top`) reaches 200 through the server replay.
 *  2. New rounds: rooms deal the new stamps, ROUND_MAX is 200, LIVE_BANDS keeps the band-3 revision as
 *     strictRev; older stamps never carry the new fields and score at most 150.
 *  3. The same room for everyone: two (and more) different players on one seed, whatever they do, get
 *     identical Rally gold-target times and places and pink-pad spots (every pad move lands on the seed's own
 *     list), an identical Fission power-up and golden-atom schedule (every icon that falls is a scheduled one,
 *     at its tick and place), and identical Flightpath boards, winds, drift, shuffles and balloons.
 *  4. The rules: Rally's six targets (one per window, upper half, clear of the bumpers, 4 s each, any ball
 *     scores one, +6, a miss costs nothing, spin pays nothing); Fission's clean waves (one shot per tap, a
 *     double beam is one shot, a beam that hits nothing breaks the wave, the bonus only for a clean wave), the
 *     golden atoms and no chain reactions or random drops; Flightpath's dead-centre ring (a quarter of the bull's
 *     radius, only on a bull, counted and capped) and the streak cap.
 *  5. Ceilings: every feature's opportunities are in every run (Rally's 6 targets, Fission's 6 golden atoms
 *     and 7 power-ups, Flightpath's dead-centre on at least 6 darts), so the features' caps are reachable on
 *     every seed; Flightpath's perfect-play ceiling is at least 200 on every tuning and fresh seed (room seeds
 *     0–59 and 10000–10199), worked out dart by dart. Rally's and Fission's are measured by scripts/expansion-e9-ceiling.ts.
 *  7. Rally rallyRev 11 (Joe's phone notes, 27 Oct 2026, docs/phone-notes-oct-2026/rally.md): rooms deal it; it starts
 *     from rallyRev 10's exact draws (only the marker differs); targets stay up 5 s and still never overlap; a
 *     return off a moving paddle visibly curves the way the paddle moved (and rallyRev 10's bend is unchanged);
 *     the same-room identity above holds on it too. rallyRev 10's own runs (expansion-e9-runs.json.gz) prove it
 *     replays exactly as before.
 *  6. Never 0 for a run that hit anything (Rally's blue returns count, Fission's lives never take away more
 *     than three quarters of the atoms); doing nothing scores 0.
 *
 *   bun scripts/expansion-e9-check.ts      (~1 min)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { E9Record } from "./expansion-e9-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { E9_GAMES, FRESH_SEEDS, TUNE_SEEDS } from "./expansion-e9-bands";
import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  rallyBonusCount,
  rallyBonusInit,
  rallyBonusLive,
  rallyBonusParts,
  rallyGameFor,
  rallyPaddleY,
  rallyTargetLeft,
  rallyWorldHFor,
  rallyWorldWFor,
  RALLY_BALL_R,
  RALLY_BUMPER_R,
  RALLY_HUD_H,
  RALLY_REV_BONUS,
  RALLY_REV_CURVE,
  RALLY_REV_STRICT,
  RALLY_V11_BONUS_LIFE,
  RALLY_V11_EXP,
  RALLY_TARGET_SPOTS,
  RALLY_V10_BONUS_COUNT,
  RALLY_V10_BONUS_LIFE,
  RALLY_V10_BONUS_PTS,
  RALLY_V10_BONUS_R,
  RALLY_V10_H,
  RALLY_V10_W,
  RALLY_WALL,
  type RallyState,
} from "../src/lib/arcade/rally";
import {
  burstCleanBonus,
  burstCleanParts,
  burstCleanUnits,
  burstGameFor,
  burstGeometryV8,
  burstGoldenCount,
  burstScheduleV8,
  BURST_DOUBLE_GAP,
  BURST_GOLD_R,
  BURST_ICON_DOUBLE,
  BURST_ICON_FREEZE,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_RADIUS,
  BURST_REV_CLEAN,
  BURST_REV_CARRY,
  BURST_REV_STRICT,
  BURST_TALL_H,
  BURST_V8_CAPS,
  BURST_V8_CLEAN_PTS,
  BURST_V8_DROPS,
  BURST_V8_GOLDEN_LIFE,
  BURST_V8_GOLDEN_PTS,
  BURST_V8_GOLDENS,
  BURST_WORLD_W,
  type BurstState,
} from "../src/lib/arcade/burst";
import {
  bullseyeAimPointFor,
  bullseyeBoard,
  bullseyeDeadPoints,
  bullseyeGameFor,
  bullseyeInDeadCentre,
  bullseyeInitFor,
  bullseyeInitRev8,
  bullseyeRingValues,
  bullseyeStreakPoints,
  bullseyeWinds,
  BULLSEYE_ARROWS,
  BULLSEYE_CX,
  BULLSEYE_OUTER_R,
  BULLSEYE_REV_EXPAND,
  BULLSEYE_REV_STRICT,
  BULLSEYE_RINGS,
  BULLSEYE_SHUFFLE_FROM,
  BULLSEYE_V8_BAND_CURVE,
  BULLSEYE_V8_DEAD_CAP,
  BULLSEYE_V8_DEAD_DIV,
  BULLSEYE_V8_DEAD_PTS,
  BULLSEYE_V8_STREAK_CAP,
  BULLSEYE_V_MAX,
  type BullseyeState,
} from "../src/lib/arcade/bullseye";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { generateBullseye, generateBurst, generateRally } from "../src/lib/duel/arcade.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { playRevOf } from "./scoring-targets-revs";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const section = (name: string) => console.log(`\n== ${name}`);
const fixture = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: E9Record[]; top?: E9Record[] };
const MARK: Record<string, string> = { rally: "exp", burst: "exp", bullseye: "expand" };

/* ============================== 1. Stored rounds ============================== */
section("Stored rounds replay and score exactly as before");
for (const [file, label] of [["scripts/fixtures/expansion-e9-legacy.json.gz", "before"], ["scripts/fixtures/expansion-e9-runs.json.gz", "expansion"]] as const) {
  const fix = fixture(file);
  const per = new Map<string, number>();
  for (const run of [...fix.runs, ...(fix.top ?? [])]) {
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    ok(result.score === run.score && !result.flagged, `${label} ${run.type} rev ${run.rev} ${run.level}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${label} ${run.type} rev ${run.rev} ${run.level}: the replayed final state differs`);
    const marked = (result.state as any)[MARK[run.type]!] !== undefined;
    if (label === "before") ok(!marked && result.score <= 150, `${run.type} rev ${run.rev}: an old state carries the expansion or scores over 150`);
    else ok(marked && result.score <= 200, `${run.type} rev ${run.rev}: an expansion state without its marker or over 200`);
    per.set(`${run.type} ${run.rev ?? "-"}`, (per.get(`${run.type} ${run.rev ?? "-"}`) ?? 0) + 1);
  }
  for (const top of fix.top ?? []) ok(top.score === 200, `${top.type}: the stored top run reaches 200 (got ${top.score})`);
  if (label === "expansion") ok((fix.top ?? []).length === 3, "a stored 200 for each of the three games");
  console.log(`  ${label}: ${[...per].map(([k, v]) => `${k}×${v}`).join(", ")}`);
}

/* ============================== 2. New rounds ============================== */
section("Rooms deal the new stamps at 200");
// Fission deals burstRev 9 since the phone-test notes (27 Oct 2026; fission-carry-check proves it); burstRev 8 is still checked here.
// Joe's phone notes (27 Oct 2026) moved Rally on to rallyRev 11 (section 7 below).
// The arcade scoring standard (29 Oct 2026) moved Flightpath on to bullRev 9, bullRev 8's play on the standard's parts
// (playRevOf; bullseye-standard-check proves it).
ok(generateRally().rallyRev === RALLY_REV_CURVE && generateBurst().burstRev === BURST_REV_CARRY && playRevOf("bullseye", generateBullseye().bullRev) === BULLSEYE_REV_EXPAND, "rooms deal rallyRev 11, burstRev 9 (was 8) and bullRev 8's play");
for (const type of ["rally", "burst", "bullseye"] as const) ok(roundMaxFor(type) === 200, `${type}: ROUND_MAX is 200`);
ok(LIVE_BANDS.rally.strictRev === RALLY_REV_STRICT && LIVE_BANDS.burst.strictRev === BURST_REV_STRICT && LIVE_BANDS.bullseye.strictRev === BULLSEYE_REV_STRICT, "LIVE_BANDS keeps the band-3 revisions rooms dealt before as strictRev");
ok(rallyWorldWFor(RALLY_REV_BONUS) === RALLY_V10_W && rallyWorldHFor(RALLY_REV_BONUS) === RALLY_V10_H && rallyWorldWFor(RALLY_REV_STRICT) === 390 && rallyWorldHFor(RALLY_REV_STRICT) === 730, "Rally's worlds by revision (420 × 784 on rallyRev 10)");
for (let n = 0; n < 6; n++) {
  const seed = GAME_BY_TYPE.get("rally")!.seedFor(n);
  ok(rallyGameFor(RALLY_REV_STRICT).init(seed).exp === undefined && burstGameFor(BURST_REV_STRICT).init(seed).exp === undefined && bullseyeInitFor(seed, bullseyeWinds(seed), BULLSEYE_REV_STRICT).expand === undefined, `seed ${seed}: older stamps start without the new fields`);
}

/* ============================== 3. The same room for everyone ============================== */
section("Two different players in one room get the same features, whatever they do");
type Played<S> = { states: S[] };
function play<S extends { tick: number }>(type: string, rev: number, n: number, who: string): Played<S> {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  let events: ArcadeInputEvent[] = [];
  if (who === "random") {
    let a = (seed ^ 0x77) >>> 0;
    const r = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296);
    const k = type === "burst" ? [BURST_INPUT_FIRE, BURST_INPUT_MOVE] : type === "rally" ? [ARCADE_INPUT_DRAG] : [2];
    for (let t = 1; t < game.runTicks; t += 7 + Math.floor(r() * 50)) {
      const kind = k[Math.floor(r() * k.length)]!;
      events.push({ t, k: kind, a: type === "bullseye" ? Math.floor((r() * 2 - 1) * BULLSEYE_V_MAX) : Math.floor(r() * 420), b: type === "bullseye" ? -Math.floor(r() * BULLSEYE_V_MAX) : Math.floor(r() * 2), c: 0, d: 0 });
    }
  } else {
    const bot = (BOTS as Record<string, SkillBot>)[type]!;
    events = bot({ game, seed, rev, human: new Human(type, seed, who as SkillLevel) }).events ?? [];
  }
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const states = [s];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    states.push(s);
  }
  return { states };
}
const BOTS: Record<string, SkillBot> = {};
for (const g of E9_GAMES) BOTS[g.type] = (await import(new URL(`./arcade-skill-bands/bots/${g.type}.ts`, import.meta.url).href)).bot;
const PLAYERS = ["weak", "elite", "random"] as const;

for (let n = 0; n < 16; n++) {
  // Rally: the target schedule and pad spots are in the state from init and never change; every pad move lands on the seed's list.
  // Seeds 0–7 on rallyRev 10, then the same eight seeds on rallyRev 11 (phone notes, 27 Oct 2026).
  const runs = PLAYERS.map((p) => play<RallyState>("rally", n < 8 ? RALLY_REV_BONUS : RALLY_REV_CURVE, n % 8, p));
  const first = runs[0]!.states[0]!;
  const moves = runs.map((r) => {
    const seq: [number, number][][] = [[], []];
    for (let i = 1; i < r.states.length; i++) {
      const a = r.states[i - 1]!;
      const b = r.states[i]!;
      ok(JSON.stringify(b.bonus) === JSON.stringify(first.bonus) && JSON.stringify(b.spots) === JSON.stringify(first.spots) && JSON.stringify(b.entries) === JSON.stringify(first.entries) && JSON.stringify(b.bumper) === JSON.stringify(first.bumper) && JSON.stringify(b.bumper2) === JSON.stringify(first.bumper2), `rally ${n}: the schedule never changes mid-run`);
      for (let k = 0; k < 2; k++) if ((b.live ?? [])[k] !== (a.live ?? [])[k]) seq[k]!.push([(b.live ?? [])[k]!, rallyTargetLeft(b.spots ?? [], (b.live ?? [])[k]!)]);
    }
    return seq;
  });
  // Pad k's j-th new spot is the same for every player who struck it j times (index k + 2j on the seed's list).
  for (let k = 0; k < 2; k++)
    for (const seq of moves)
      seq[k]!.forEach(([index, left], j) => ok(index === k + 2 * (j + 1) && left === rallyTargetLeft(first.spots ?? [], k + 2 * (j + 1)), `rally ${n}: pad ${k}'s move ${j + 1} goes to spot ${k + 2 * (j + 1)} of the seed's list`));
  ok(runs.every((r) => JSON.stringify(r.states[0]) === JSON.stringify(first)), `rally ${n}: every player starts from the same state`);
  ok(new Set(moves.map((m) => m[0]!.length + m[1]!.length)).size >= 1, `rally ${n}: pad moves recorded`);
}
for (let n = 0; n < 8; n++) {
  // Fission: the schedules are the seed's; every icon that appears is a scheduled power-up at its tick and x.
  const runs = PLAYERS.map((p) => play<BurstState>("burst", BURST_REV_CLEAN, n, p));
  const first = runs[0]!.states[0]!;
  const seed = GAME_BY_TYPE.get("burst")!.seedFor(n);
  ok(JSON.stringify({ drops: first.drops, goldens: first.goldens }) === JSON.stringify(burstScheduleV8(seed, BURST_TALL_H)), `burst ${n}: the schedules are the seed's own`);
  for (const r of runs) {
    const spawned: string[] = [];
    for (let i = 1; i < r.states.length; i++) {
      const a = r.states[i - 1]!;
      const b = r.states[i]!;
      ok(JSON.stringify(b.drops) === JSON.stringify(first.drops) && JSON.stringify(b.goldens) === JSON.stringify(first.goldens), `burst ${n}: the schedule never changes mid-run`);
      if (b.icons.length > a.icons.length || b.icons.some((ic) => !a.icons.some((o) => o.x === ic.x && o.kind === ic.kind))) {
        for (const ic of b.icons) if (!a.icons.some((o) => o.x === ic.x && o.kind === ic.kind)) spawned.push(`${b.tick}:${ic.x}:${ic.kind}`);
      }
    }
    const expected = (first.drops ?? []).filter((d) => d.tick <= r.states.at(-1)!.tick).map((d) => `${d.tick}:${d.x * 256}:${d.kind}`);
    ok(JSON.stringify(spawned) === JSON.stringify(expected), `burst ${n}: the icons that fell are exactly the scheduled ones (${spawned.length} of ${expected.length})`);
  }
}
for (let n = 0; n < 8; n++) {
  // Flightpath: the boards, winds, drift, ring values and balloons are fixed at init and the same for every player.
  const runs = PLAYERS.map((p) => play<BullseyeState>("bullseye", BULLSEYE_REV_EXPAND, n, p));
  const pick = (s: BullseyeState) => JSON.stringify({ t: s.targets, w: s.winds, p: s.driftPhase, d: s.driftDir, v: s.ringValues, b: s.balloons });
  const want = pick(runs[0]!.states[0]!);
  ok(runs.every((r) => r.states.every((s) => pick(s) === want)), `bullseye ${n}: identical boards, winds, drift, shuffles and balloons for every player, all run long`);
}

/* ============================== 4. The rules ============================== */
section("Rally rallyRev 10: the gold bonus target");
{
  for (let n = 0; n < 300; n++) {
    const s = rallyBonusInit(GAME_BY_TYPE.get("rally")!.seedFor(n));
    const b = s.bonus ?? [];
    const top = RALLY_HUD_H + RALLY_WALL;
    const mid = Math.trunc((top + rallyPaddleY(s)) / 2);
    ok(b.length === RALLY_V10_BONUS_COUNT, `rally seed ${n}: ${RALLY_V10_BONUS_COUNT} targets`);
    b.forEach((t, i) => {
      ok(i === 0 || t.tick >= b[i - 1]!.tick + RALLY_V10_BONUS_LIFE, `rally seed ${n}: target ${i} after the one before has gone`);
      ok(t.tick + RALLY_V10_BONUS_LIFE <= 60 * 60, `rally seed ${n}: target ${i} up for its whole 4 s inside the run`);
      ok(t.y - RALLY_V10_BONUS_R > top && t.y < mid && t.x - RALLY_V10_BONUS_R > RALLY_WALL && t.x + RALLY_V10_BONUS_R < RALLY_V10_W - RALLY_WALL, `rally seed ${n}: target ${i} in the upper half, inside the walls`);
      for (const p of [s.bumper!, s.bumper2!]) ok(Math.hypot(t.x - p.x, t.y - p.y) >= RALLY_BUMPER_R + RALLY_V10_BONUS_R + 2 * RALLY_BALL_R, `rally seed ${n}: target ${i} clear of the bumpers`);
    });
    ok((s.spots ?? []).length === RALLY_TARGET_SPOTS, `rally seed ${n}: the seeded pad list`);
  }
  // Any ball touching a live target scores it once; a miss costs nothing; spin pays nothing.
  const s0 = rallyBonusInit(GAME_BY_TYPE.get("rally")!.seedFor(1));
  const t0 = s0.bonus![0]!;
  const game = rallyGameFor(RALLY_REV_BONUS);
  const at = { ...s0, tick: t0.tick, x: t0.x * 256, y: (t0.y + 30) * 256, vx: 0, vy: -1024, acted: 1 } as RallyState;
  let s = at;
  for (let i = 0; i < 10; i++) s = game.step(s, null);
  ok(rallyBonusCount(s) === 1 && (s.bonusHit ?? 0) === 1 && rallyBonusParts(s).bonus === RALLY_V10_BONUS_PTS, "the blue ball touching the live target scores it (+6)");
  for (let i = 0; i < 30; i++) s = game.step(s, null);
  ok(rallyBonusCount(s) === 1, "a target scores once");
  const early = { ...at, tick: t0.tick - 20 } as RallyState;
  let e = early;
  for (let i = 0; i < 10; i++) e = game.step(e, null);
  ok(rallyBonusCount(e) === 0 && !rallyBonusLive(e, 0, t0.tick - 10), "not before it appears");
  ok(rallyBonusParts({ ...s0, spin: 24, spun: 1 } as RallyState).bonus === 0 && rallyBonusParts({ ...s0, spin: 24, spun: 1 } as RallyState).points === rallyBonusParts(s0).points, "spin pays nothing");
  ok(game.score({ ...s0, goldHits: 400, targetHits: 100, hits: 100, bonusHit: 63, acted: 1 } as RallyState) === 200, "the score caps at 200");
  ok(game.score({ ...s0, hits: 2, acted: 1 } as RallyState) > 0, "a run with two blue returns scores");
}

section("Fission burstRev 8: clean waves, golden atoms, scheduled power-ups");
{
  const game = burstGameFor(BURST_REV_CLEAN);
  const seed = GAME_BY_TYPE.get("burst")!.seedFor(2);
  const s0 = game.init(seed) as BurstState;
  ok((s0.drops ?? []).length === BURST_V8_DROPS && (s0.goldens ?? []).length === BURST_V8_GOLDENS, "7 power-ups and 6 golden atoms a run");
  ok((s0.drops ?? []).every((d, i, all) => (d.kind === BURST_ICON_DOUBLE || d.kind === BURST_ICON_FREEZE) && (i === 0 || d.kind !== all[i - 1]!.kind)), "power-ups alternate DOUBLE and FREEZE");
  ok(!("rings" in s0) && !("chain" in s0), "no chain reactions");
  ok(BURST_DOUBLE_GAP < BURST_RADIUS[3] && BURST_DOUBLE_GAP < BURST_GOLD_R, "the double beam never straddles a centred atom or golden atom");
  for (let n = 0; n < 300; n++) {
    const sched = burstScheduleV8(GAME_BY_TYPE.get("burst")!.seedFor(n));
    const geo = burstGeometryV8(BURST_TALL_H);
    sched.goldens.forEach((g, i) => {
      ok(g.y - BURST_GOLD_R > geo.ceilMax && g.x - BURST_GOLD_R > 0 && g.x + BURST_GOLD_R < BURST_WORLD_W, `burst seed ${n}: golden ${i} always below the lowest ceiling, inside the walls`);
      ok(i === 0 || g.tick >= sched.goldens[i - 1]!.tick + BURST_V8_GOLDEN_LIFE, `burst seed ${n}: golden ${i} after the one before`);
      ok(g.tick + BURST_V8_GOLDEN_LIFE <= 90 * 60, `burst seed ${n}: golden ${i} up for its whole time inside the run`);
    });
  }
  // A shot that hits nothing breaks the wave; a double shot is one shot; the bonus only for a clean wave.
  let s = { ...s0, tick: 100, wave: 1, nextWaveAt: 99999, balls: [{ size: 1, x: 300 * 256, y: 200 * 256, vx: 0, vy: 0 }], x: 60 * 256, targetX: 60 * 256, acted: 1, freeze: 9999 } as BurstState;
  s = game.step(s, { t: 101, k: BURST_INPUT_FIRE, a: 0, b: 1, c: 0, d: 0 });
  ok(s.fired === 1 && s.shots.length === 1, "a tap fires one shot");
  for (let i = 0; i < 90; i++) s = game.step(s, null);
  ok(s.missed === 1 && s.landed === 0, "a beam reaching the ceiling without a hit is a miss");
  let d = { ...s0, tick: 100, wave: 1, nextWaveAt: 0, balls: [{ size: 3, x: 200 * 256, y: 300 * 256, vx: 0, vy: 0 }], x: 200 * 256, targetX: 200 * 256, acted: 1, freeze: 9999, double: 300 } as BurstState;
  d = game.step(d, { t: 101, k: BURST_INPUT_FIRE, a: 0, b: 1, c: 0, d: 0 });
  ok(d.fired === 1 && d.shots.length === 2, "a double shot: two beams, one shot");
  for (let i = 0; i < 90; i++) d = game.step(d, null);
  ok(d.missed === 0 && d.cleanWaves === 1 && d.cleared === 1 && burstCleanBonus(d).clean === BURST_V8_CLEAN_PTS, "the last atom popped by a double shot (one beam missing): a clean wave, +5");
  let m = { ...s, nextWaveAt: 0, balls: [{ size: 3, x: 60 * 256, y: 300 * 256, vx: 0, vy: 0 }] } as BurstState;
  m = game.step(m, { t: m.tick + 1, k: BURST_INPUT_FIRE, a: 0, b: 0, c: 0, d: 0 });
  for (let i = 0; i < 90; i++) m = game.step(m, null);
  ok(m.cleared === 1 && m.cleanWaves === 0, "a wave with a miss in it clears without the clean bonus");
  ok(BURST_V8_CAPS.gold === BURST_V8_GOLDENS * BURST_V8_GOLDEN_PTS, "the golden-atom cap is all six");
  // A beam reaching a live golden atom takes it.
  const g0 = s0.goldens![0]!;
  let gs = { ...s0, tick: g0.tick, wave: 1, nextWaveAt: 99999, balls: [{ size: 3, x: 10 * 256, y: 600 * 256, vx: 0, vy: 0 }], x: g0.x * 256, targetX: g0.x * 256, acted: 1, freeze: 9999 } as BurstState;
  gs = game.step(gs, { t: gs.tick + 1, k: BURST_INPUT_FIRE, a: 0, b: 1, c: 0, d: 0 });
  for (let i = 0; i < 60; i++) gs = game.step(gs, null);
  ok(burstGoldenCount(gs) === 1 && burstCleanBonus(gs).gold === BURST_V8_GOLDEN_PTS && gs.landed === 1, "a beam takes a live golden atom (+6, a hit for the clean count)");
  ok(burstCleanUnits({ hits: 10, lives: 0 }) === 3 && burstCleanUnits({ hits: 40, lives: 1 }) === 30, "lives lost never take more than three quarters of the atoms");
  ok(burstCleanParts({ ...s0, hits: 2, lives: 0, acted: 1 } as BurstState).points > 0, "two atoms and three lives lost still score");
}

section("Flightpath bullRev 8: the dead-centre ring and the streak");
{
  // The ring: a quarter of the bull's radius, exactly, on any board size.
  for (const scale of [64, 72, 82, 92, 104]) {
    const r0 = (BULLSEYE_OUTER_R * scale) / (100 * BULLSEYE_RINGS);
    for (let dx = -20; dx <= 20; dx++)
      for (let dy = -20; dy <= 20; dy++) {
        const inside = (dx * dx + dy * dy) * 16 <= r0 * r0 + 1e-9;
        ok(bullseyeInDeadCentre(BULLSEYE_CX + dx, 200 + dy, scale, [10, 9, 8, 3, 2, 1], 200) === inside, `dead-centre at scale ${scale} (${dx}, ${dy})`);
      }
    ok(!bullseyeInDeadCentre(BULLSEYE_CX, 200, scale, [9, 10, 8, 3, 2, 1], 200), "no dead-centre when the 10 is not the centre ring");
  }
  ok(BULLSEYE_V8_DEAD_DIV === BULLSEYE_RINGS * 4, "a quarter of the bull's radius");
  ok(bullseyeDeadPoints({ dead: 99 }) === BULLSEYE_V8_DEAD_CAP && bullseyeDeadPoints({ dead: 2 }) === 2 * BULLSEYE_V8_DEAD_PTS, "dead-centre points, capped");
  ok(bullseyeStreakPoints({ streakPts: 999 }) === BULLSEYE_V8_STREAK_CAP, "streak points, capped");
}

/* ============================== 5. Ceilings ============================== */
section("Every run holds enough chances for 200; Flightpath's ceiling is 200 on every seed");
{
  let under = 0;
  let minCeil = 999;
  for (const n of [...TUNE_SEEDS, ...FRESH_SEEDS]) {
    const seed = GAME_BY_TYPE.get("bullseye")!.seedFor(n);
    const s = bullseyeInitRev8(seed, bullseyeWinds(seed));
    // Perfect play: every dart in the inner bull (12) when the 10 is the centre ring (and in the dead-centre ring),
    // else in the 10 (10); no balloon counted. Every board's centre is in reach of a legal launch.
    let total = 0;
    let dead = 0;
    for (let arrow = 0; arrow < BULLSEYE_ARROWS; arrow++) {
      const centre = bullseyeRingValues(s, arrow)[0] === 10;
      total += centre ? 12 : 10;
      if (centre) dead += 1;
      const board = bullseyeBoard(s, arrow);
      const far = bullseyeAimPointFor({ ...s, arrowIndex: arrow }, 0, 0, -BULLSEYE_V_MAX);
      const near = bullseyeAimPointFor({ ...s, arrowIndex: arrow }, 0, 0, -1);
      ok(far.y < board.cy - 30 && near.y > board.cy + 30, `bullseye seed ${n}: dart ${arrow + 1}'s board is in reach`);
    }
    ok(dead >= BULLSEYE_SHUFFLE_FROM, `bullseye seed ${n}: at least ${BULLSEYE_SHUFFLE_FROM} darts with the 10 in the centre`);
    const ceiling = Math.min(200, bandPoints(BULLSEYE_V8_BAND_CURVE, total) + BULLSEYE_V8_STREAK_CAP + Math.min(BULLSEYE_V8_DEAD_CAP, BULLSEYE_V8_DEAD_PTS * dead));
    minCeil = Math.min(minCeil, ceiling);
    if (ceiling < 200) under++;
  }
  ok(under === 0, `Flightpath: the perfect-play ceiling is 200 on all ${TUNE_SEEDS.length + FRESH_SEEDS.length} seeds (lowest ${minCeil})`);
  console.log(`  Flightpath: perfect-play ceiling 200 on all ${TUNE_SEEDS.length + FRESH_SEEDS.length} seeds`);
  ok(RALLY_V10_BONUS_COUNT * RALLY_V10_BONUS_PTS === 36 && BURST_V8_GOLDENS * BURST_V8_GOLDEN_PTS === BURST_V8_CAPS.gold, "every run holds all six Rally targets and all six Fission golden atoms");
}

/* ============================== 7. Rally rallyRev 11 ============================== */
section("Rally rallyRev 11 (phone notes, 27 Oct 2026): curving spin, 5 s targets");
{
  ok(rallyWorldWFor(RALLY_REV_CURVE) === RALLY_V10_W && rallyWorldHFor(RALLY_REV_CURVE) === RALLY_V10_H, "rallyRev 11 plays on rallyRev 10's 420 × 784 court");
  ok(RALLY_V11_BONUS_LIFE === 5 * 60 && RALLY_V10_BONUS_LIFE === 4 * 60, "targets: 5 s on rallyRev 11, still 4 s on rallyRev 10");
  const g10 = rallyGameFor(RALLY_REV_BONUS);
  const g11 = rallyGameFor(RALLY_REV_CURVE);
  for (let n = 0; n < 300; n++) {
    const seed = GAME_BY_TYPE.get("rally")!.seedFor(n);
    const a = g10.init(seed);
    const b = g11.init(seed);
    ok(a.exp === 1 && b.exp === RALLY_V11_EXP && JSON.stringify({ ...b, exp: 1 }) === JSON.stringify(a), `rally seed ${n}: rallyRev 11 starts from rallyRev 10's exact draws`);
    (b.bonus ?? []).forEach((t, i, all) => {
      ok(i === 0 || t.tick >= all[i - 1]!.tick + RALLY_V11_BONUS_LIFE, `rally seed ${n}: rallyRev 11 target ${i} after the one before has gone`);
      ok(t.tick + RALLY_V11_BONUS_LIFE <= 60 * 60, `rally seed ${n}: rallyRev 11 target ${i} up for its whole 5 s inside the run`);
      const late = t.tick + RALLY_V11_BONUS_LIFE - 1;
      ok(rallyBonusLive(b, i, late) && !rallyBonusLive(b, i, late + 1) && !rallyBonusLive(a, i, t.tick + RALLY_V10_BONUS_LIFE), `rally seed ${n}: target ${i} up 5 s on rallyRev 11, 4 s on rallyRev 10`);
    });
  }
  // A ball touching a target 4.5 s after it appeared scores it on rallyRev 11 only.
  {
    const seed = GAME_BY_TYPE.get("rally")!.seedFor(1);
    const scored = (game: typeof g10) => {
      const s0 = game.init(seed);
      const t0 = s0.bonus![0]!;
      let s = { ...s0, tick: t0.tick + 270 - 4, x: t0.x * 256, y: (t0.y + 12) * 256, vx: 0, vy: -1024, acted: 1 } as RallyState;
      for (let i = 0; i < 4; i++) s = game.step(s, null);
      return rallyBonusCount(s);
    };
    ok(scored(g11) === 1 && scored(g10) === 0, "a touch 4.5 s after the target appeared scores on rallyRev 11 (and not on rallyRev 10)");
  }
  // A return off a moving paddle curves the way the paddle moved; off a still paddle it flies straight.
  const flight = (game: typeof g10, move: number): { dev: number; dev20: number; dev40: number; minVy: number; speed: number } => {
    const s0 = game.init(GAME_BY_TYPE.get("rally")!.seedFor(4));
    const py = rallyPaddleY(s0);
    // The ball comes straight down onto the paddle's centre at x 210; the paddle has been moving `move` px a tick.
    let s = { ...s0, tick: 60, x: 210 * 256, y: (py - RALLY_BALL_R - 3) * 256, vx: 0, vy: 1024, aimX: 210 - move, paddleX: 210 - move, pv: move * 256, acted: 1 } as RallyState;
    s = game.step(s, { t: 61, k: ARCADE_INPUT_DRAG, a: 210, b: 0, c: 0, d: 0 });
    ok(s.hits === 1 && s.vy < 0, `rally rev ${s.exp}: the scripted return is hit`);
    const x0 = s.x;
    const vx0 = s.vx;
    let minVy = Math.abs(s.vy);
    const devs: number[] = [];
    for (let i = 1; i <= 60; i++) {
      s = game.step(s, null);
      minVy = Math.min(minVy, Math.abs(s.vy));
      // Straight flight from the contact velocity, against where the ball went (no wall reached in 60 ticks).
      if (i % 20 === 0) devs.push((s.x - (x0 + vx0 * i)) / 256);
    }
    return { dev: devs[2]!, dev20: devs[0]!, dev40: devs[1]!, minVy, speed: s.speed };
  };
  const still11 = flight(g11, 0);
  const right11 = flight(g11, 8);
  const left11 = flight(g11, -8);
  const right10 = flight(g10, 8);
  console.log(`  curve after 60 ticks: rallyRev 11 ${right11.dev.toFixed(1)} px right / ${left11.dev.toFixed(1)} px left (still paddle ${still11.dev.toFixed(1)}); rallyRev 10 ${right10.dev.toFixed(1)} px`);
  ok(still11.dev === 0, "rallyRev 11: a return off a still paddle flies straight");
  ok(right11.dev >= 30 && left11.dev <= -30, "rallyRev 11: a return off a fast-moving paddle swerves at least 30 px the way it moved within a second");
  // rallyRev 10's bend is over in about 20 ticks (a kink, then straight); rallyRev 11's keeps bending through the flight.
  ok(right11.dev - right11.dev40 > right11.dev40 - right11.dev20 + 4 && Math.abs(right10.dev - right10.dev40 - (right10.dev40 - right10.dev20)) <= 1, "rallyRev 11 still bends a second after contact (rallyRev 10's bend is a short kink, unchanged)");
  ok(right11.dev > right10.dev && flight(g11, 3).dev >= 2 * flight(g10, 3).dev, "rallyRev 11 curves further than rallyRev 10, twice as far off an ordinary 3 px a tick paddle");
  ok(right11.minVy * 256 >= right11.speed * 100 && left11.minVy * 256 >= left11.speed * 100, "a bend never flattens the flight below 40 % of its speed");
  ok(rallyBonusParts({ ...g11.init(3), spin: 256, spun: 1 } as RallyState).points === rallyBonusParts(g11.init(3)).points, "rallyRev 11: spin pays nothing");
}

/* ============================== 6. Never 0 for a run that tried ============================== */
section("Doing nothing scores 0; trying always scores");
for (const [type, game] of [["rally", rallyGameFor(RALLY_REV_BONUS)], ["rally", rallyGameFor(RALLY_REV_CURVE)], ["burst", burstGameFor(BURST_REV_CLEAN)], ["bullseye", bullseyeGameFor(BULLSEYE_REV_EXPAND)]] as const) {
  const g = game as any;
  let s = type === "bullseye" ? bullseyeInitRev8(3) : g.init(3);
  while (!g.isOver(s) && s.tick < g.runTicks) s = g.step(s, null);
  ok(g.score(s) === 0, `${type}: doing nothing scores 0`);
}
{
  const fix = fixture("scripts/fixtures/expansion-e9-runs.json.gz");
  for (const run of fix.runs.filter((r) => r.level === "weak" || r.level === "average")) ok(run.score > 0, `${run.type} ${run.level} seed ${run.seed}: a run that tried scores (${run.score})`);
}

if (failures.length) {
  console.log(`\nFAIL expansion-e9-check: ${failures.length} of ${checks} checks failed`);
  for (const f of [...new Set(failures)].slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nPASS expansion-e9-check: ${checks} checks — older stamps replay as on main; rooms deal rallyRev 10, burstRev 9 and bullRev 8 at 200; the same targets, pads, power-ups, golden atoms and boards for every player; the new rules; Flightpath's ceiling 200 on ${TUNE_SEEDS.length + FRESH_SEEDS.length} seeds`);
