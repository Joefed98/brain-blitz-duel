/**
 * Expansion E3 (25 Oct 2026, docs/expansions/e3.md): Breaker brkRev 9, raised to 200.
 *
 *  1. Stored rounds: 36 skill-band runs recorded on main before the change, on every older revision of Breaker
 *     (scripts/fixtures/expansion-e3-legacy.json, scripts/expansion-e3-legacy.ts), replay on today's code
 *     to the same score and the same final state; 8 runs on the new stamp (expansion-e3-runs.json) the same.
 *  2. New rounds: rooms deal the new stamp, the game's maximum is 200, the 420 × 784 court, start states,
 *     input ranges and checksums; older stamps keep their worlds and score at most 150.
 *  3. Breaker: the 9 × 12 wall, gold bricks (placed with armour; only a direct hit breaks one; Fireball, laser
 *     and ×3 shots never do), the no-touch combo (built only by ball breaks, ended by a paddle touch or a lost
 *     ball), the skill cap and the 200 cap.
 *  4. 200 is reachable through the server replay: a near-perfect skill-band run
 *     (scripts/fixtures/expansion-e3-runs.json's `top` run).
 *
 *   bun scripts/expansion-e3-check.ts      (~5 s)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { E3Record } from "./expansion-e3-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { ARCADE_INPUT_BUTTON, ARCADE_INPUT_DRAG } from "../src/lib/arcade/engine";
import {
  breakerGameFor,
  breakerWorldHFor,
  breakerWorldWFor,
  brkCheckpoint,
  brkComboMultiplier,
  brkComboPoints,
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
import { generateBreaker } from "../src/lib/duel/arcade.server";
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
  ok(fixture.runs.length === (label === "before" ? 36 : 8), `${label}: ${fixture.runs.length} stored runs`);
  console.log(`  ${label}: ${fixture.runs.length + (fixture.top?.length ?? 0)} runs (${[...per].map(([k, v]) => `${k}: ${v}`).join(", ")})`);
}

/* ====== 1b. The live effect specs read older rounds exactly as before (replay moments, moment cues) ====== */
section("The live effect specs count older rounds' moments as before");
{
  const { BREAKER_FX, BREAKER_FX_DEEP, ARCADE_FX_SPECS } = await import("../src/lib/arcade/arcadeFxGames.renderer");
  ok(ARCADE_FX_SPECS.breaker === BREAKER_FX_DEEP, "the live spec is the expansion's");
  ok(BREAKER_FX_DEEP.events.length === BREAKER_FX.events.length + 2, "the expansion's moments come after the original events");
  const fixture = JSON.parse(read("scripts/fixtures/expansion-e3-legacy.json")) as { runs: E3Record[] };
  let compared = 0;
  for (const run of fixture.runs) {
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const state = spec.replay(run.seed, gunzipSync(Buffer.from(run.raw, "base64")).toString(), run.rev).state;
    const [old, live] = [BREAKER_FX, BREAKER_FX_DEEP];
    (old.events as readonly any[]).forEach((e, i) => {
      const l = (live.events as readonly any[])[i];
      ok(l.kind === e.kind && l.count(state) === e.count(state), `${run.type} rev ${run.rev}: event ${i} counts ${l.count(state)}, was ${e.count(state)}`);
      compared++;
    });
    (live.events as readonly any[]).slice(old.events.length).forEach((e, i) => ok(e.count(state) === 0, `${run.type} rev ${run.rev}: expansion moment ${i} fires on an old round`));
  }
  console.log(`  ${compared} event counts on ${fixture.runs.length} older runs`);
}

/* ============================== 2. New rounds ============================== */
section("New rounds: stamps, maximum, courts, start states");
{
  ok(generateBreaker().brkRev === BRK_REV_DEEP, "rooms deal brkRev 9");
  ok(LIVE_BANDS.breaker.rev === BRK_REV_DEEP && LIVE_BANDS.breaker.strictRev === BRK_REV_STRICT, "the help reads the new stamp; the score-bands revision is brkRev 8");
  ok(roundMaxFor("breaker") === 200, "Breaker's maximum is 200");
  ok(breakerWorldWFor(BRK_REV_DEEP) === 420 && breakerWorldHFor(BRK_REV_DEEP) === 784 && breakerWorldWFor(BRK_REV_STRICT) === 390 && breakerWorldHFor(BRK_REV_STRICT) === 730, "Breaker courts by revision");
  // The courts keep the iPhone 11 play box's shape (414 × 772), so the world fills it edge to edge.
  ok(Math.abs(784 / 420 - 772 / 414) < 0.01, "the 420 × 784 court has the iPhone 11 play box's shape");
  for (const [g, max] of [[breakerGameFor(BRK_REV_DEEP), BRK_V9_W]] as const) {
    const drag = (g.inputRanges ?? []).find((r) => r.k === ARCADE_INPUT_DRAG);
    ok(!!drag && JSON.stringify(drag).includes(String(max)), `${g.key}: the expansion's drag range runs to ${max}`);
  }
  for (const seed of [1, 77, 4242, 912345, 2_000_000_011]) {
    const b = breakerGameFor(BRK_REV_DEEP).init(seed);
    ok(JSON.stringify(b) === JSON.stringify(breakerGameFor(BRK_REV_DEEP).init(seed)) && b.deep === 1 && b.worldW === 420 && b.worldH === 784 && b.cols === 9 && b.bricks.length === 108, `breaker seed ${seed}: a 9 × 12 wall in the 420 × 784 court`);
    ok(brkCheckpoint(b).checksum !== brkCheckpoint({ ...b, deep: undefined } as BrkState).checksum, `breaker seed ${seed}: the checksum folds the expansion in`);
    // Older stamps are untouched by the expansion: their starts carry none of its fields.
    for (const rev of [null, 2, 3, 4, 5, 6, 7, 8]) {
      ok(breakerGameFor(rev).init(seed).deep === undefined, `seed ${seed} rev ${rev}: an older start has no expansion fields`);
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
  ok(brkComboMultiplier(BRK_V9_COMBO_X2 - 1) === 1 && brkComboMultiplier(BRK_V9_COMBO_X2) === 2 && brkComboMultiplier(BRK_V9_COMBO_X3) === 3 && brkComboPoints(2) === 1 && brkComboPoints(3) === 3 && brkComboPoints(1) === 0, "×2 from the 10th brick, ×3 from the 20th; ×2 pays 1 and ×3 pays 3");
  ok(brkSkillPoints({ goldBroken: 3, comboPts: 100 }) === BRK_V9_SKILL_MAX && brkSkillPoints({ goldBroken: 0, comboPts: 100 }) === BRK_V9_COMBO_MAX, `skill tops out at 50, combos at ${BRK_V9_COMBO_MAX}`);
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
        for (let k = before + 1; k <= chain; k++) pts += brkComboPoints(brkComboMultiplier(k));
        ok((s.comboPts ?? 0) - (prev.comboPts ?? 0) <= pts, `breaker seed ${seed} tick ${s.tick}: combo points beyond the multiplier`);
      }
      if (s.losses > prev.losses) ok(chain === 0, `breaker seed ${seed}: a lost ball ends the chain`);
    }
    ok(brk.score(s) <= 200 && brk.score(s) === Math.min(200, s.acted ? brk.score(s) : 0), `breaker seed ${seed}: the score stays within 200`);
  }
  ok(chainsSeen > 50, `real play builds chains (${chainsSeen} steps)`);
  ok(brk.score({ ...brk.init(5), goldBroken: 3, comboPts: 99, acted: 0 }) === 0, "a run with no input scores 0");
}

/* ============================== 4. 200 through the server ============================== */
section("200 is reachable");
{
  const fixture = JSON.parse(read("scripts/fixtures/expansion-e3-runs.json")) as { top?: E3Record[] };
  const top = new Map((fixture.top ?? []).map((r) => [r.type, r]));
  ok(top.get("breaker")?.score === 200, `a near-perfect skill-band run reaches 200 (${top.get("breaker")?.score})`);
  ok(GAME_BY_TYPE.get("breaker" as never)!.replay(top.get("breaker")!.seed, gunzipSync(Buffer.from(top.get("breaker")!.raw, "base64")).toString(), BRK_REV_DEEP).score === top.get("breaker")!.score, "it replays to the same score");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} expansion E3 checks`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} expansion E3 checks — old Breaker rounds replay exactly; brkRev 9 plays its features and reaches 200`);
