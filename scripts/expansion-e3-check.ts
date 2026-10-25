/**
 * Expansion E3 (25 Oct 2026, docs/expansions/e3.md): Rally rallyRev 9 and Breaker brkRev 9, each raised to 200.
 *
 *  1. Stored rounds: 72 skill-band runs recorded on main before the change, on every older revision of both
 *     games (scripts/fixtures/expansion-e3-legacy.json, scripts/expansion-e3-legacy.ts), replay on today's code
 *     to the same score and the same final state; 16 runs on the new stamps (expansion-e3-runs.json) the same.
 *  2. New rounds: rooms deal the new stamps, both games' maximum is 200, the 420 × 784 courts, start states,
 *     input ranges and checksums; older stamps keep their worlds and score at most 150.
 *  3. Breaker: the 9 × 12 wall, gold bricks (placed with armour; only a direct hit breaks one; Fireball, laser
 *     and ×3 shots never do), the no-touch combo (built only by ball breaks, ended by a paddle touch or a lost
 *     ball), the skill cap and the 200 cap.
 *  4. Rally: gliding pads that stay in their halves, the multi-ball pad and its twin (cost-free), doubled
 *     returns, spin (none from a still paddle, a bonus only for a spun gold ball on a pad), milestones (reset by
 *     a missed gold ball, never by the twin), the skill cap and the 200 cap.
 *  5. 200 is reachable through the server replay: a tracking run reaches 200 in Rally, a skill-band run in
 *     Breaker (scripts/fixtures/expansion-e3-runs.json's `top` runs).
 *
 *   bun scripts/expansion-e3-check.ts      (~5 s)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { E3Record } from "./expansion-e3-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { ARCADE_INPUT_BUTTON, ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  breakerGameFor,
  breakerWorldHFor,
  breakerWorldWFor,
  brkCheckpoint,
  brkComboMultiplier,
  brkDeepBrickXY,
  brkIsGold,
  brkSkillPoints,
  brkWallSize,
  BRK_BALL_R,
  BRK_BRICK_H,
  BRK_BRICK_W,
  BRK_POWER_LASER,
  BRK_REV_DEEP,
  BRK_REV_STRICT,
  BRK_V9_COLS,
  BRK_V9_COMBO_MAX,
  BRK_V9_COMBO_X2,
  BRK_V9_COMBO_X3,
  BRK_V9_GOLD,
  BRK_V9_GOLD_POINTS,
  BRK_V9_H,
  BRK_V9_ROWS,
  BRK_V9_SKILL_MAX,
  BRK_V9_W,
  type BrkState,
} from "../src/lib/arcade/breaker";
import {
  rallyCheckpoint,
  rallyDeepPadLeft,
  rallyDeepPadRange,
  rallyGameFor,
  rallySkillPoints,
  rallyWorldHFor,
  rallyWorldWFor,
  RALLY_BALL_R,
  RALLY_HUD_H,
  RALLY_PADDLE_LIFT,
  RALLY_REV_DEEP,
  RALLY_REV_STRICT,
  RALLY_TARGET_W,
  RALLY_V9_H,
  RALLY_V9_MILESTONE_PTS,
  RALLY_V9_MULTI_FROM,
  RALLY_V9_SKILL_MAX,
  RALLY_V9_SPIN_PTS,
  RALLY_V9_TWIN_TICKS,
  RALLY_V9_W,
  RALLY_WALL,
  type RallyState,
} from "../src/lib/arcade/rally";
import { encodeRallyRun, replayRallyRun } from "../src/lib/duel/rally";
import { generateBreaker, generateRally } from "../src/lib/duel/arcade.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const section = (name: string) => console.log(`\n== ${name}`);
const read = (path: string) => readFileSync(path, "utf8");
const drag = (t: number, a: number): ArcadeInputEvent => ({ t, k: ARCADE_INPUT_DRAG, a, b: 0, c: 0, d: 0 });

/* ============================== 1. Stored rounds ============================== */
section("Stored rounds replay and score exactly as before");
for (const [file, label] of [["scripts/fixtures/expansion-e3-legacy.json", "before"], ["scripts/fixtures/expansion-e3-runs.json", "expansion"]] as const) {
  const fixture = JSON.parse(read(file)) as { runs: E3Record[]; top?: E3Record[] };
  const per = new Map<string, number>();
  for (const run of [...fixture.runs, ...(fixture.top ?? [])]) {
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    ok(result.score === run.score && !result.flagged, `${label} ${run.type} rev ${run.rev} ${run.level}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${label} ${run.type} rev ${run.rev} ${run.level}: the replayed final state differs`);
    if (label === "before") ok(result.state.deep === undefined && result.score <= 150, `${run.type} rev ${run.rev}: an old state carries the expansion or scores over 150`);
    else ok(result.state.deep === 1 && result.score <= 200, `${run.type} rev ${run.rev}: an expansion state without its marker or over 200`);
    per.set(`${run.type} ${run.rev ?? "-"}`, (per.get(`${run.type} ${run.rev ?? "-"}`) ?? 0) + 1);
  }
  ok(fixture.runs.length === (label === "before" ? 72 : 16), `${label}: ${fixture.runs.length} stored runs`);
  console.log(`  ${label}: ${fixture.runs.length + (fixture.top?.length ?? 0)} runs (${[...per].map(([k, v]) => `${k}: ${v}`).join(", ")})`);
}

/* ============================== 2. New rounds ============================== */
section("New rounds: stamps, maximum, courts, start states");
{
  ok(generateRally().rallyRev === RALLY_REV_DEEP && generateBreaker().brkRev === BRK_REV_DEEP, "rooms deal rallyRev 9 and brkRev 9");
  ok(LIVE_BANDS.rally.rev === RALLY_REV_DEEP && LIVE_BANDS.breaker.rev === BRK_REV_DEEP, "the help reads the new stamps");
  ok(roundMaxFor("rally") === 200 && roundMaxFor("breaker") === 200, "both games' maximum is 200");
  ok(rallyWorldWFor(RALLY_REV_DEEP) === 420 && rallyWorldHFor(RALLY_REV_DEEP) === 784 && rallyWorldWFor(RALLY_REV_STRICT) === 390 && rallyWorldHFor(RALLY_REV_STRICT) === 730, "Rally courts by revision");
  ok(breakerWorldWFor(BRK_REV_DEEP) === 420 && breakerWorldHFor(BRK_REV_DEEP) === 784 && breakerWorldWFor(BRK_REV_STRICT) === 390 && breakerWorldHFor(BRK_REV_STRICT) === 730, "Breaker courts by revision");
  // The courts keep the iPhone 11 play box's shape (414 × 772), so the world fills it edge to edge.
  ok(Math.abs(784 / 420 - 772 / 414) < 0.01, "the 420 × 784 court has the iPhone 11 play box's shape");
  for (const [g, max] of [[rallyGameFor(RALLY_REV_DEEP), RALLY_V9_W], [breakerGameFor(BRK_REV_DEEP), BRK_V9_W]] as const) {
    const drag = (g.inputRanges ?? []).find((r) => r.k === ARCADE_INPUT_DRAG);
    ok(!!drag && JSON.stringify(drag).includes(String(max)), `${g.key}: the expansion's drag range runs to ${max}`);
  }
  for (const seed of [1, 77, 4242, 912345, 2_000_000_011]) {
    const r = rallyGameFor(RALLY_REV_DEEP).init(seed);
    const r2 = rallyGameFor(RALLY_REV_DEEP).init(seed);
    ok(JSON.stringify(r) === JSON.stringify(r2) && r.deep === 1 && r.worldW === 420 && r.worldH === 784 && r.band === 1 && r.acted === 0, `rally seed ${seed}: a stable stamped start`);
    ok(rallyCheckpoint(r).checksum !== rallyCheckpoint({ ...r, deep: undefined } as RallyState).checksum, `rally seed ${seed}: the checksum folds the expansion in`);
    const b = breakerGameFor(BRK_REV_DEEP).init(seed);
    ok(b.deep === 1 && b.worldW === 420 && b.worldH === 784 && b.cols === 9 && b.bricks.length === 108, `breaker seed ${seed}: a 9 × 12 wall in the 420 × 784 court`);
    ok(brkCheckpoint(b).checksum !== brkCheckpoint({ ...b, deep: undefined } as BrkState).checksum, `breaker seed ${seed}: the checksum folds the expansion in`);
    // Older stamps are untouched by the expansion: their starts carry none of its fields.
    for (const rev of [null, 2, 3, 4, 5, 6, 7, 8]) {
      ok(rallyGameFor(rev).init(seed).deep === undefined && breakerGameFor(rev).init(seed).deep === undefined, `seed ${seed} rev ${rev}: an older start has no expansion fields`);
    }
  }
}

/* ============================== 3. Breaker ============================== */
section("Breaker brkRev 9: the wall, gold bricks, the no-touch combo");
const brk = breakerGameFor(BRK_REV_DEEP);
const noInput = (s: BrkState, n: number) => {
  for (let i = 0; i < n && !brk.isOver(s); i++) s = brk.step(s, null);
  return s;
};
{
  for (let seed = 1; seed <= 300; seed++) {
    const s = brk.init(seed * 7919);
    const golds = s.bricks.map((_, i) => i).filter((i) => brkIsGold(s, i));
    ok(golds.length === BRK_V9_GOLD && brkWallSize(s) === BRK_V9_COLS * BRK_V9_ROWS - BRK_V9_GOLD, `seed ${seed}: ${golds.length} gold bricks, a ${brkWallSize(s)}-brick wall`);
    ok(golds.every((i) => Math.trunc(i / BRK_V9_COLS) <= 2), `seed ${seed}: gold bricks in rows 0–2`);
    ok(new Set(golds.map((i) => Math.trunc((i % BRK_V9_COLS) / 3))).size === 3, `seed ${seed}: one gold brick in each third`);
    ok(golds.every((i) => s.bricks[i + BRK_V9_COLS] === 3 && (s.gold[i + BRK_V9_COLS] ?? 0) === 0), `seed ${seed}: each gold brick has a 3-hit armour brick under it`);
    ok(golds.every((i) => (s.gold[i] ?? 0) === 0 && s.maxHp[i] === 1), `seed ${seed}: no gold brick carries a power-up`);
    ok(s.gold.filter((g) => g > 0).length === 4, `seed ${seed}: four power-up bricks`);
  }
  // A ball under a gold brick, rising straight up, its lane clear.
  const setup = (d: number, extra: Partial<BrkState> = {}, spam = 0): { s: BrkState; gold: number } => {
    const s = brk.init(4242);
    const gold = s.bricks.findIndex((_, i) => brkIsGold(s, i));
    const bricks = s.bricks.slice();
    for (let i = gold + BRK_V9_COLS; i < bricks.length; i += BRK_V9_COLS) bricks[i] = 0;
    const at = brkDeepBrickXY(s, gold, 0);
    const ball = { x: (at.x + BRK_BRICK_W / 2) * 256, y: (at.y + BRK_BRICK_H + 120) * 256, vx: 0, vy: -1024, spam, d };
    return { s: { ...s, bricks, balls: [ball], ...extra }, gold };
  };
  {
    const { s, gold } = setup(1);
    const after = noInput(s, 60);
    ok((after.bricks[gold] ?? 1) === 0 && after.goldBroken === 1, "a direct hit breaks a gold brick");
    ok(brkSkillPoints(after) === BRK_V9_GOLD_POINTS, `a gold brick is worth ${BRK_V9_GOLD_POINTS} skill points`);
  }
  {
    const { s, gold } = setup(0);
    const after = noInput(s, 60);
    ok((after.bricks[gold] ?? 0) === 1 && (after.goldBroken ?? 0) === 0 && (after.clinks ?? 0) >= 1, "a ball that has touched a brick bounces off gold");
  }
  {
    const { s, gold } = setup(1, { fire: 200 });
    const after = noInput(s, 60);
    ok((after.bricks[gold] ?? 0) === 1 && (after.goldBroken ?? 0) === 0, "a Fireball ball never breaks gold");
  }
  {
    const { s, gold } = setup(0, {}, 1);
    const after = noInput({ ...s, balls: [{ ...s.balls[0]!, d: 1 }] }, 60);
    ok((after.bricks[gold] ?? 0) === 1 && (after.goldBroken ?? 0) === 0, "a ×3 shot never breaks gold");
  }
  {
    // The laser under a gold brick with its lane clear: the beam stops at the gold, which stays.
    const { s, gold } = setup(1);
    const at = brkDeepBrickXY(s, gold, 0);
    const laser = { ...s, held: BRK_POWER_LASER + 1, charges: 1, paddleX: at.x + BRK_BRICK_W / 2, aimX: at.x + BRK_BRICK_W / 2, balls: [{ x: 30 * 256, y: 600 * 256, vx: 0, vy: 1024, spam: 0, d: 0 }] };
    const after = brk.step(laser, { t: laser.tick + 1, k: ARCADE_INPUT_BUTTON, a: 1, b: 0, c: 0, d: 0 });
    ok((after.bricks[gold] ?? 0) === 1 && (after.beamTop ?? 0) === at.y + BRK_BRICK_H, "the laser stops at a gold brick and never breaks it");
  }
  ok(brkComboMultiplier(BRK_V9_COMBO_X2 - 1) === 1 && brkComboMultiplier(BRK_V9_COMBO_X2) === 2 && brkComboMultiplier(BRK_V9_COMBO_X3) === 3, "×2 from the 8th brick, ×3 from the 16th");
  ok(brkSkillPoints({ goldBroken: 3, comboPts: 100 }) === BRK_V9_SKILL_MAX && brkSkillPoints({ goldBroken: 0, comboPts: 100 }) === BRK_V9_COMBO_MAX, "skill tops out at 50, combos at 30");
  // Real play: the chain only ever grows by ball breaks and drops to 0 on a paddle touch or a lost ball.
  const spec = GAME_BY_TYPE.get("breaker" as never)!;
  const { bot } = await import("./arcade-skill-bands/bots/breaker.ts");
  const { Human } = await import("./arcade-skill-bands/human.ts");
  let chainsSeen = 0;
  for (let n = 0; n < 6; n++) {
    const seed = spec.seedFor(n);
    const res = bot({ game: brk, seed, rev: BRK_REV_DEEP, human: new Human("breaker", seed, n % 2 ? "near" : "good") });
    const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
    let s = brk.init(seed);
    while (!brk.isOver(s)) {
      const prev = s;
      s = brk.step(s, byTick.get(s.tick + 1) ?? null);
      const chain = s.chain ?? 0;
      const before = prev.chain ?? 0;
      if (chain > before) {
        chainsSeen++;
        ok(s.hits > prev.hits || (s.goldBroken ?? 0) > (prev.goldBroken ?? 0), `breaker seed ${seed} tick ${s.tick}: the chain grew without a break`);
        let pts = 0;
        for (let k = before + 1; k <= chain; k++) pts += brkComboMultiplier(k) - 1;
        ok((s.comboPts ?? 0) - (prev.comboPts ?? 0) <= pts, `breaker seed ${seed} tick ${s.tick}: combo points beyond the multiplier`);
      }
      if (s.losses > prev.losses) ok(chain === 0, `breaker seed ${seed}: a lost ball ends the chain`);
    }
    ok(brk.score(s) <= 200 && brk.score(s) === Math.min(200, s.acted ? brk.score(s) : 0), `breaker seed ${seed}: the score stays within 200`);
  }
  ok(chainsSeen > 50, `real play builds chains (${chainsSeen} steps)`);
  ok(brk.score({ ...brk.init(5), goldBroken: 3, comboPts: 99, acted: 0 }) === 0, "a run with no input scores 0");
}

/* ============================== 4. Rally ============================== */
section("Rally rallyRev 9: gliding pads, the twin ball, spin, milestones");
const rally = rallyGameFor(RALLY_REV_DEEP);
{
  // Pads glide inside their own halves, never overlap, and do move.
  for (const seed of [1, 99, 5050, 777777]) {
    const s = rally.init(seed);
    let moved = 0;
    for (let tick = 0; tick <= 3600; tick += 7) {
      for (const k of [0, 1]) {
        const { lo, span } = rallyDeepPadRange(k);
        const left = rallyDeepPadLeft(s, k, tick);
        ok(left >= lo && left <= lo + span, `rally seed ${seed} tick ${tick}: pad ${k} left its half (${left})`);
        if (left !== rallyDeepPadLeft(s, k, Math.max(0, tick - 7))) moved++;
      }
      const a = rallyDeepPadLeft(s, 0, tick);
      const b = rallyDeepPadLeft(s, 1, tick);
      ok(a + RALLY_TARGET_W < b, `rally seed ${seed} tick ${tick}: pads overlap`);
    }
    ok(moved > 500, `rally seed ${seed}: the pads glide (${moved} moves)`);
  }
  // A perfect tracker: plays the whole run through the server's encode + replay.
  const track = (seed: number, flick: number) => {
    let s = rally.init(seed);
    const events: ArcadeInputEvent[] = [];
    const checkpoints: unknown[] = [];
    let lastA = -1;
    while (!rally.isOver(s)) {
      const balls = [{ x: s.x, y: s.y, vy: s.vy }, ...s.golds, ...(s.twin ? [s.twin] : [])].filter((b) => b.vy > 0);
      balls.sort((p, q) => q.y - p.y);
      let a = balls[0] ? Math.round(balls[0].x / 256) : 210;
      // A flick: sweep across the ball as it lands (spin).
      const low = balls[0];
      if (flick && low && low.y > (RALLY_V9_H - RALLY_PADDLE_LIFT - 40) * 256) a += ((s.tick >> 3) & 1 ? 1 : -1) * flick;
      a = Math.max(0, Math.min(RALLY_V9_W, a));
      const ev = a !== lastA ? drag(s.tick + 1, a) : null;
      if (ev) events.push(ev);
      lastA = a;
      s = rally.step(s, ev);
      if (s.tick % 300 === 0) checkpoints.push(rallyCheckpoint(s));
    }
    const raw = encodeRallyRun({ seed, claimedScore: rally.score(s), events, endTick: s.tick, checkpoints: checkpoints as never });
    return { s, result: replayRallyRun(seed, raw, RALLY_REV_DEEP) };
  };
  const still = track(777, 0);
  ok(still.result.score === rally.score(still.s) && !still.result.flagged, "a tracking run replays on the server to the same score");
  ok(still.result.score === 200, `a tracking run reaches 200 (${still.result.score})`);
  ok((still.s.multiUsed ?? 0) >= 1 && (still.s.twinHits ?? 0) >= 1 && (still.s.milestones ?? 0) >= 1, "the run used the twin ball and reached milestones");
  // Spin: a perfectly still paddle at contact gives none.
  let s = rally.init(31);
  const bounced = { ...s, x: 210 * 256, y: (RALLY_V9_H - RALLY_PADDLE_LIFT - RALLY_BALL_R - 2) * 256, vx: 0, vy: 900, pv: 0 };
  const hit = rally.step(bounced, null);
  ok(hit.hits === 1 && (hit.spin ?? 0) === 0 && (hit.spun ?? 0) === 0, "a return off a still paddle has no spin");
  const swept = rally.step({ ...bounced, pv: 20 * 256, paddleX: 205, aimX: 215 }, drag(1, 215));
  ok(swept.hits === 1 && (swept.spin ?? 0) !== 0 && swept.spun === 1, "a return off a moving paddle spins");
  // The spin bends the flight: the same return off a still and a moving paddle part ways.
  let a1 = hit;
  let a2 = swept;
  for (let i = 0; i < 40; i++) {
    a1 = rally.step(a1, null);
    a2 = rally.step(a2, null);
  }
  ok(Math.abs(a1.x - a2.x) > 20 * 256, "spin curves the ball");
  // The twin: a ball on the multi-ball pad releases it; it lasts 10 s and losing it costs nothing.
  s = rally.init(31);
  s = { ...s, tick: RALLY_V9_MULTI_FROM + 1 };
  const mleft = (s.mspots ?? [])[0]!;
  const up = { ...s, x: (mleft + 20) * 256, y: (RALLY_HUD_H + RALLY_WALL + RALLY_BALL_R + 3) * 256, vx: 0, vy: -1200 };
  const released = rally.step(up, null);
  ok(!!released.twin && released.twinLeft === RALLY_V9_TWIN_TICKS && released.multiUsed === 1 && released.multiAt === 0, "the multi-ball pad releases the twin for 10 s");
  const lost = rally.step({ ...released, streak: 7, twin: { ...released.twin!, y: (RALLY_V9_H + 20) * 256, vy: 600 } }, null);
  ok(!lost.twin && lost.streak === 7 && !lost.dead && (lost.multiAt ?? 0) > lost.tick, "losing the twin costs nothing; the pad comes back later");
  // A missed gold ball ends the streak.
  const goldOut = rally.step({ ...released, streak: 7, golds: [{ x: 100 * 256, y: (RALLY_V9_H + 20) * 256, vx: 0, vy: 600 }] }, null);
  ok(goldOut.streak === 0, "a missed gold ball ends the streak");
  // Doubled returns: with the twin up a return counts 2 towards the streak and 1 skill point.
  const dbl = rally.step({ ...released, ...{ x: 210 * 256, y: (RALLY_V9_H - RALLY_PADDLE_LIFT - RALLY_BALL_R - 2) * 256, vx: 0, vy: 900, streak: 9, milestones: 0 } }, null);
  ok(dbl.streak === 11 && dbl.milestones === 1 && (dbl.dblPts ?? 0) === 1, "a doubled return counts 2 and crosses a milestone");
  ok(rallySkillPoints({ milestones: 1 }) === RALLY_V9_MILESTONE_PTS && rallySkillPoints({ spinHits: 1 }) === RALLY_V9_SPIN_PTS && rallySkillPoints({ milestones: 99 }) === RALLY_V9_SKILL_MAX, "skill points and their 50 cap");
  // A spun gold ball on a pad scores the spin bonus; an unspun one does not.
  s = rally.init(31);
  const padLeft = rallyDeepPadLeft(s, 0, s.tick + 1);
  const goldUp = (spun: number) => rally.step({ ...s, golds: [{ x: (padLeft + RALLY_TARGET_W / 2) * 256, y: (RALLY_HUD_H + RALLY_WALL + RALLY_BALL_R + 3) * 256, vx: 0, vy: -1200, spin: 0, spun }] }, null);
  ok(goldUp(1).targetHits === 1 && goldUp(1).spinHits === 1, "a spun gold ball on a pad scores the spin bonus");
  ok(goldUp(0).targetHits === 1 && (goldUp(0).spinHits ?? 0) === 0, "an unspun gold ball on a pad does not");
  ok(rally.score({ ...rally.init(5), milestones: 20, acted: 0 }) === 0, "a run with no input scores 0");
  // Older stamps never see these rules and stay within 150.
  ok(rallyGameFor(RALLY_REV_STRICT).score({ ...rallyGameFor(RALLY_REV_STRICT).init(5), goldHits: 999, targetHits: 99, acted: 1 }) === 150, "rallyRev 8 still tops out at 150");
}

/* ============================== 5. 200 through the server ============================== */
section("200 is reachable");
{
  const fixture = JSON.parse(read("scripts/fixtures/expansion-e3-runs.json")) as { top?: E3Record[] };
  const top = new Map((fixture.top ?? []).map((r) => [r.type, r]));
  ok(top.has("breaker") && top.get("breaker")!.score >= 199, `a Breaker skill-band run at the top (${top.get("breaker")?.score})`);
  ok(GAME_BY_TYPE.get("breaker" as never)!.replay(top.get("breaker")!.seed, gunzipSync(Buffer.from(top.get("breaker")!.raw, "base64")).toString(), BRK_REV_DEEP).score === top.get("breaker")!.score, "it replays to the same score");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} expansion E3 checks`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} expansion E3 checks — old Rally and Breaker rounds replay exactly; rallyRev 9 and brkRev 9 play their features and reach 200`);
