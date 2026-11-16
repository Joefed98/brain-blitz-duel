/**
 * Iron Wall's difficulty levels (bastionRev 4, 15 Nov 2026; docs/arcade-standard/bastion.md "bastionRev 4: levels").
 * Joe's approved exception: bastionRev 3's game (dealt in every room before) became Expert, and Easy, Normal and Hard
 * are bastionRev 4's gentler game.
 *
 *  1. older stamps: 80 bastionRev 2 and 3 runs recorded before rev 4 (scripts/fixtures/bastion-levels-legacy.json,
 *     scripts/bastion-levels-legacy-record.ts) replay and grade exactly as before (score, parts, flag, end tick, final
 *     checksum, the graded score and correctness), and a rev-3 puzzle stamped `level: "expert"` grades the same;
 *  2. the deal: Normal deals bastionRev 4 with no `level` (Normal is never stamped), Easy and Hard bastionRev 4 stamped
 *     with their level, Expert bastionRev 3 stamped "expert"; rated play and the Daily take Normal; the bastionPreLevels
 *     pin deals rev 3; every level's clock is the same 60 s run (63 s round) and at most 120 s;
 *  3. each level's rules as the sim plays them: wave paces, heavy tanks kept (the rest roll on as mediums), weak-spot
 *     opening and size, the green zone, the base, drone speed and size, read from the run's own states; the levels step
 *     down from Expert (rev 3) to Hard, Normal and Easy on every lever;
 *  4. grace: with no input the base takes the level's hits (Easy 5, Normal 4, Hard 3, Expert 3) and the run ends only on
 *     the last; the first hit never ends a run;
 *  5. the parts sum to 200 at every level (Armour 110 of the level's hit points, Weak spots 30, Fast reloads 20, Drones
 *     30, Base intact 10 of the level's base), no input scores 0 and one input at least 1;
 *  6. the oracle (scripts/bastion-oracle.ts) takes every tuning seed (0–59) and fresh seed (10000–10199) to exactly 200
 *     at every level, graded by gradeAnswer on the dealt puzzle (the server replay);
 *  7. identical worlds: the plan and drones come from the seed and the level alone (two deals, two inits, any input);
 *     a run's grade follows the stored level (the same log graded at another level replays that level's world).
 *
 *   bun scripts/bastion-levels-check.ts
 */
import { readFileSync } from "node:fs";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  bastionBaseMax,
  bastionDroneRect,
  bastionDronesOf,
  bastionPlan,
  bastionPlanOf,
  bastionStdParts,
  bastionTankCheckpoint,
  bastionTankGameFor,
  bastionTankRects,
  bastionTotalHp,
  bastionWeakPctOf,
  bastionZoneW,
  BASTION_LEVELS,
  BASTION_REV_IRON,
  BASTION_REV_LEVELS,
  BT2_CHECKPOINT_INTERVAL,
  BT2_HEAVY,
  BT2_HEAVIES,
  BT2_INPUT_AIM,
  BT2_INPUT_RANGES,
  BT2_RUN_TICKS,
  BT2_SPEED,
  BT3_WAVE_PACE,
  BT3_ZONE_W,
  BT2_WEAK_OPEN,
  BT4_LEVELS,
  type BastionLevel,
  type BastionTankState,
} from "../src/lib/arcade/bastionTank";
import { encodeBastionTankRun, replayBastionTankRun } from "../src/lib/duel/bastion";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { withSeededRandom } from "../src/lib/duel/random";
import { modeLevel } from "../src/lib/levels/modes";
import { levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";
import type { PuzzleData } from "../src/lib/duel/types";
import { bastionOracleRun } from "./bastion-oracle";

let checks = 0;
const failed: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) {
    failed.push(label);
    console.log(`FAIL ${label}`);
  }
}

/** A log played through `level`'s game and encoded as the phone sends it. */
function encode(seed: number, events: ArcadeInputEvent[], rev: number, level?: string): string {
  const game = bastionTankGameFor(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  let s = game.init(seed);
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(s));
  }
  return encodeBastionTankRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
}

const dealAt = (level: Level, seed: number): PuzzleData => withSeededRandom(seed, () => generatePuzzle("bastion", { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }));

/* 1. Older stamps replay and grade exactly as before. */
{
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/bastion-levels-legacy.json", import.meta.url), "utf8")) as {
    runs: { rev: number; seed: number; raw: string; score: number; parts: [string, number][]; flagged: boolean; checksum: number; tick: number; graded: [number, boolean] }[];
  };
  ok(fixture.runs.length === 80 && fixture.runs.some((r) => r.rev === 2) && fixture.runs.some((r) => r.rev === 3), "80 recorded rev-2 and rev-3 runs");
  let same = 0;
  for (const r of fixture.runs) {
    const out = replayBastionTankRun(r.seed, r.raw, r.rev);
    const puzzle = { type: "bastion", seed: r.seed, bastionRev: r.rev, puzzleScoreRev: 3, speedPar: 1 } as PuzzleData;
    const graded = gradeAnswer(puzzle, r.raw, 0);
    const parts = out.parts.map((p) => [p.key, p.points]);
    const match =
      out.score === r.score &&
      JSON.stringify(parts) === JSON.stringify(r.parts) &&
      out.flagged === r.flagged &&
      bastionTankCheckpoint(out.state).checksum === r.checksum &&
      out.state.tick === r.tick &&
      graded.score === r.graded[0] &&
      graded.isCorrect === r.graded[1];
    if (match) same++;
    else console.log(`  rev ${r.rev} seed ${r.seed}: ${out.score} (was ${r.score}), graded ${graded.score} (was ${r.graded[0]})`);
    if (r.rev === BASTION_REV_IRON) {
      const expert = gradeAnswer({ ...puzzle, level: "expert" } as PuzzleData, r.raw, 0);
      ok(expert.score === r.graded[0] && expert.isCorrect === r.graded[1], `rev 3 seed ${r.seed}: stamped Expert, it grades exactly as before (${expert.score})`);
    }
  }
  ok(same === fixture.runs.length, `every recorded rev-2 and rev-3 run replays and grades as before (${same} of ${fixture.runs.length})`);
}

/* 2. The deal. */
{
  ok(JSON.stringify(levelsOf("bastion")) === JSON.stringify(["easy", "normal", "hard", "expert"]), `Iron Wall offers Easy, Normal, Hard and Expert (${levelsOf("bastion").join(", ")})`);
  for (const seed of [1, 2, 3, 77, 90210]) {
    const normal = dealAt("normal", seed) as { bastionRev?: number; level?: string; seed: number };
    ok(normal.bastionRev === BASTION_REV_LEVELS && !("level" in normal), `seed ${seed}: Normal deals bastionRev 4 with no level field`);
    for (const level of ["easy", "hard"] as const) {
      const p = dealAt(level, seed) as { bastionRev?: number; level?: string; seed: number };
      ok(p.bastionRev === BASTION_REV_LEVELS && p.level === level && puzzleLevel(p) === level, `seed ${seed}: ${level} deals bastionRev 4 stamped "${level}"`);
      ok(p.seed === normal.seed, `seed ${seed}: ${level}'s deal draws the same seed as Normal's`);
    }
    const expert = dealAt("expert", seed) as { bastionRev?: number; level?: string };
    ok(expert.bastionRev === BASTION_REV_IRON && expert.level === "expert", `seed ${seed}: Expert deals bastionRev 3 (today's game before the levels) stamped "expert"`);
  }
  ok(modeLevel("rated", "expert") === "normal" && modeLevel("daily", "easy") === "normal", "rated play and the Daily are always Normal");
  const pinned = generatePuzzle("bastion", {}, { pins: ["bastionPreLevels"] }) as { bastionRev?: number };
  const pinnedHard = generatePuzzle("bastion", { level: "hard" }, { pins: ["bastionPreLevels"] }) as { bastionRev?: number };
  ok(pinned.bastionRev === BASTION_REV_IRON && pinnedHard.bastionRev === BASTION_REV_IRON, "the bastionPreLevels pin deals bastionRev 3 at every level");
  ok((generatePuzzle("bastion") as { bastionRev?: number }).bastionRev === BASTION_REV_LEVELS, "unpinned again, the live deal is bastionRev 4");
  for (const level of ["easy", "normal", "hard", "expert"] as const) {
    const p = dealAt(level, 5);
    const ms = puzzleTimeLimitMs(p);
    const game = bastionTankGameFor((p as { bastionRev?: number }).bastionRev, (p as { level?: unknown }).level);
    ok(ms <= MAX_ROUND_CLOCK_MS && game.runTicks === BT2_RUN_TICKS && ms === 63_000, `${level}: a 60 s run on a ${ms / 1000} s clock (at most 120 s)`);
  }
}

/* 3. Each level's rules as the sim plays them. */
{
  const rev3 = { pace: BT3_WAVE_PACE, zoneW: BT3_ZONE_W, weakOpen: BT2_WEAK_OPEN, base: 3, heavies: BT2_HEAVIES, weakPct: 100, droneSpeed: 4, dronePct: 100 };
  const order: { name: string; set: typeof rev3 }[] = [{ name: "Expert", set: rev3 }, { name: "Hard", set: BT4_LEVELS.hard }, { name: "Normal", set: BT4_LEVELS.normal }, { name: "Easy", set: BT4_LEVELS.easy }];
  for (let i = 1; i < order.length; i++) {
    const [a, b] = [order[i - 1]!.set, order[i]!.set];
    const gentler = b.pace.every((p, w) => p <= a.pace[w]!) && b.zoneW >= a.zoneW && b.weakOpen >= a.weakOpen && b.base >= a.base && b.heavies <= a.heavies && b.weakPct >= a.weakPct && b.droneSpeed <= a.droneSpeed && b.dronePct >= a.dronePct;
    const step = b.pace.some((p, w) => p < a.pace[w]!) && (b.zoneW > a.zoneW || b.weakOpen > a.weakOpen || b.base > a.base || b.heavies < a.heavies);
    ok(gentler && step, `${order[i]!.name} is gentler than ${order[i - 1]!.name} on every lever, and a step down`);
  }
  ok(BT4_LEVELS.easy.base === 5 && BT4_LEVELS.normal.base === 4 && BT4_LEVELS.hard.base === 3, "base hits: Easy 5, Normal 4, Hard 3");
  ok(BT4_LEVELS.hard.heavies === BT2_HEAVIES && BT4_LEVELS.normal.heavies < BT4_LEVELS.hard.heavies && BT4_LEVELS.easy.heavies < BT4_LEVELS.normal.heavies, "heavies: Hard today's 8, Normal fewer, Easy fewest");
  ok(BT4_LEVELS.easy.weakOpen >= 80, "Easy's weak spots open most of the time");
  for (const level of BASTION_LEVELS) {
    const set = BT4_LEVELS[level];
    const game = bastionTankGameFor(BASTION_REV_LEVELS, level);
    for (const seed of [11, 4242, 999999]) {
      const s0 = game.init(seed);
      ok(s0.rev === BASTION_REV_LEVELS && s0.lvl === level && s0.base === set.base && bastionBaseMax(s0.rev, s0.lvl) === set.base, `${level} seed ${seed}: the run starts with ${set.base} base`);
      const plan = bastionPlanOf(s0);
      const base3 = bastionPlan(seed);
      const heavies = plan.filter((p) => p.kind === BT2_HEAVY).length;
      ok(heavies === set.heavies, `${level} seed ${seed}: ${set.heavies} heavy tanks (${heavies})`);
      ok(plan.every((p, i) => p.lane === base3[i]!.lane && p.spawn === base3[i]!.spawn && p.wphase === base3[i]!.wphase && p.open === set.weakOpen && (p.kind === base3[i]!.kind || (base3[i]!.kind === BT2_HEAVY && p.kind === 1))), `${level} seed ${seed}: rev 3's lanes, spawns and phases; only heavies past the first ${set.heavies} roll on as mediums; weak spots open ${set.weakOpen} of 90`);
      ok(bastionTotalHp(BASTION_REV_LEVELS, level) === plan.reduce((a, p) => a + [1, 2, 4][p.kind]!, 0), `${level} seed ${seed}: the level's hit points are its plan's (${bastionTotalHp(BASTION_REV_LEVELS, level)})`);
      // Speeds as they spawn, from the run itself.
      let s = s0;
      const v = new Map<number, number>();
      while (!game.isOver(s) && s.tick < 3000) {
        s = game.step(s, null);
        for (const t of s.tanks) if (!v.has(t.i)) v.set(t.i, t.v);
      }
      ok([...v].every(([i, sp]) => sp === Math.floor((BT2_SPEED[plan[i]!.kind]! * set.pace[plan[i]!.wave]!) / 100)), `${level} seed ${seed}: every tank rolls on at its wave's ${set.pace.join("/")} % pace`);
      ok(bastionDronesOf(s0).every((d) => d.speed === set.droneSpeed && d.size === set.dronePct), `${level} seed ${seed}: drones at ${set.droneSpeed} px a tick and ${set.dronePct} %`);
    }
    ok(bastionZoneW(BASTION_REV_LEVELS, level) === set.zoneW, `${level}: the green zone is ${set.zoneW} ‰`);
    const st = game.init(1);
    const r = bastionTankRects(0, 1, 0, bastionWeakPctOf(st));
    ok(r.weak[2] - r.weak[0] === Math.floor((14 * set.weakPct) / 100) && bastionWeakPctOf(st) === set.weakPct, `${level}: the weak spot is ${set.weakPct} % of 14 px at the wall`);
    const d = bastionDroneRect(100, 150, set.dronePct);
    ok(d.every((x) => Number.isInteger(x)) && d[2] - d[0] === Math.floor((24 * set.dronePct) / 100), `${level}: the drone's rectangle is whole px, ${set.dronePct} % of 24 × 10`);
  }
  ok(bastionDroneRect(100, 150).join() === "88,145,112,155" && bastionTankRects(1, 0, 0).weak.join() === bastionTankRects(1, 0, 0, 100).weak.join(), "rev 3's drone and weak-spot rectangles are unchanged");
}

/* 4. Grace: the base takes the level's hits before the run ends. */
{
  for (const [name, rev, level, hits] of [["Easy", 4, "easy", 5], ["Normal", 4, "normal", 4], ["Hard", 4, "hard", 3], ["Expert", 3, undefined, 3]] as const) {
    const game = bastionTankGameFor(rev, level);
    let s = game.init(31337);
    let firstHitTick = 0;
    let survivedFirst = false;
    while (!game.isOver(s)) {
      s = game.step(s, null);
      if (s.breached === 1 && firstHitTick === 0) firstHitTick = s.tick;
      if (firstHitTick && s.tick === firstHitTick + 1 && !game.isOver(s)) survivedFirst = true;
    }
    ok(survivedFirst, `${name}: the first base hit doesn't end the run`);
    ok(s.ended === 2 && s.breached === hits && s.base === 0, `${name}: with no input the run ends on base hit ${hits} (${s.breached})`);
  }
}

/* 5. The parts. */
for (const level of BASTION_LEVELS) {
  const game = bastionTankGameFor(BASTION_REV_LEVELS, level);
  const s0 = game.init(9);
  const parts = bastionStdParts(s0)!;
  ok(parts.map((p) => `${p.key}:${p.max}`).join(" ") === "core:110 weak:30 fast:20 drone:30 base:10", `${level}: Armour 110, Weak spots 30, Fast reloads 20, Drones 30, Base intact 10`);
  const hp = bastionTotalHp(BASTION_REV_LEVELS, level);
  const full: BastionTankState = { ...s0, acted: 1, ended: 1, destroyedHp: hp, weak: 30, fast: 10, drones: 3 };
  ok(game.score(full) === 200, `${level}: everything in full → 200`);
  ok(game.score({ ...full, base: s0.base - 1 }) === 195 && game.score({ ...full, destroyedHp: hp - 1 }) < 200, `${level}: one base hit costs 5, one hit point short less than 200`);
  ok(game.score(s0) === 0, `${level}: no input scores 0`);
  const one: ArcadeInputEvent[] = [];
  recordInput(one, { t: 5, k: BT2_INPUT_AIM, a: 195, b: 400, c: 1, d: 0 }, BT2_INPUT_RANGES);
  const graded = gradeAnswer(dealAt(level, 8), encode((dealAt(level, 8) as { seed: number }).seed, one, BASTION_REV_LEVELS, level), 0);
  ok(graded.score >= 1, `${level}: one aim and nothing more scores at least 1 (${graded.score})`);
}

/* 6. The oracle at 200 on every level, through the server's grading of the dealt puzzle. */
{
  const seeds = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i)];
  for (const level of ["easy", "normal", "hard", "expert"] as const) {
    let at200 = 0;
    const off: string[] = [];
    for (const seed of seeds) {
      const p = { ...(dealAt(level, 1) as object), seed } as PuzzleData & { bastionRev: number; level?: string };
      const events = bastionOracleRun(seed, p.bastionRev, p.level);
      const graded = gradeAnswer(p, encode(seed, events, p.bastionRev, p.level), 0);
      if (graded.score === 200 && graded.isCorrect) at200++;
      else off.push(`${seed}:${graded.score}`);
    }
    ok(at200 === seeds.length, `${level}: the oracle scores 200 on all ${seeds.length} tuning and fresh seeds through the server (${at200}${off.length ? `; ${off.slice(0, 6).join(" ")}` : ""})`);
  }
}

/* 7. Identical worlds, and the grade follows the stored level. */
{
  for (const level of BASTION_LEVELS) {
    const a = bastionTankGameFor(BASTION_REV_LEVELS, level).init(555);
    const b = bastionTankGameFor(BASTION_REV_LEVELS, level).init(555);
    ok(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(bastionPlanOf(a)) === JSON.stringify(bastionPlanOf(b)) && JSON.stringify(bastionDronesOf(a)) === JSON.stringify(bastionDronesOf(b)), `${level}: two players on one seed start on the same field, plan and drones`);
  }
  const seed = 2024;
  const events = bastionOracleRun(seed, BASTION_REV_LEVELS, "hard");
  const raw = encode(seed, events, BASTION_REV_LEVELS, "hard");
  const hard = gradeAnswer({ type: "bastion", seed, bastionRev: 4, level: "hard", puzzleScoreRev: 3, speedPar: 1 } as PuzzleData, raw, 0);
  const asNormal = gradeAnswer({ type: "bastion", seed, bastionRev: 4, puzzleScoreRev: 3, speedPar: 1 } as PuzzleData, raw, 0);
  ok(hard.score === 200, `the Hard oracle's run graded on its Hard puzzle: 200 (${hard.score})`);
  ok(asNormal.score === replayBastionTankRun(seed, raw, 4).score && asNormal.extra?.["flagged"] === true, `the same log on a Normal puzzle replays Normal's world (flagged: its checkpoints are Hard's), never Hard's score`);
}

if (failed.length) {
  console.log(`FAIL bastion-levels-check: ${failed.length} of ${checks} checks failed`);
  for (const f of failed.slice(0, 20)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS bastion-levels-check: ${checks} checks — bastionRev 2 and 3 replay and grade as before (Expert is rev 3), Easy, Normal and Hard deal bastionRev 4 stamped with their level, each level's rules step down from Expert, grace 5 / 4 / 3 / 3, parts to 200, the oracle at 200 on 260 seeds at every level, identical worlds`);
