/**
 * bastion-ladder-check (D5's ladder, 23 Nov 2026; docs/arcade-standard/bastion.md "Levels (D5, 23 Nov 2026)"): Iron Wall
 * on bastionRev 5 at every level, the lever the tanks in each wave (a fourth lane from Hard).
 *
 *  1. Older stamps are untouched: the 144 runs recorded before bastionRev 5 at every level (bastionRev 4 at Easy, Normal
 *     and Hard, bastionRev 3 stamped "expert"; scripts/fixtures/bastion-rev5-legacy.json.gz,
 *     scripts/bastion-rev5-legacy-record.ts) regrade through gradeAnswer to the same score, verdict, count, stored extra
 *     and final checkpoint.
 *  2. The stamp and the deal: every level deals bastionRev 5 (Normal with no `level` field, byte for byte the deal with
 *     no level asked; Easy, Hard and Expert stamped), each from its own proved list; rated play and the Daily are Normal;
 *     the era pin bastionPreLadder deals exactly the recorded legacy puzzles (bastionRev 4, and 3 at Expert);
 *     bastionPreLevels still deals bastionRev 3; every level's clock is 63 s.
 *  3. Normal is bastionRev 4's Normal game: every recorded Normal log plays tick for tick to the same state on
 *     bastionRev 5 Normal (the same plan, drones and rules), and its parts are rev 4's but Weak spots, full at 28 hits; the
 *     checkpoint carries the stamp, so a bastionRev 4 log on a bastionRev 5 puzzle is flagged.
 *  4. The level rules as the sim plays them and the registry mirrors them: each level's lanes, tanks a wave, tanks, heavies,
 *     pace (from the run), green zone, weak spots, base and drones; the four-lane road's lane ids (3–6), never the same
 *     lane twice running, every lane used; each level a step on the lever and on every other lever (never an aid going up).
 *  5. The parts sum to 200 at every level, each part full exactly at its level's line and not before; no input scores 0,
 *     one input at least 1; the spec, LIVE_BANDS, the standard and the "?" help follow the stamp.
 *  6. The proof: the paced oracle (scripts/bastion-ladder-oracle.ts, held to HUMAN_LIMITS: 15 ticks to notice, 9 to
 *     move) never fires at a tank or drone before it could have seen and reached it, and scores exactly 200 through the
 *     server's grading of the dealt puzzle on a sample of every level's list (all of them with CHECKS_FULL=1); the deal
 *     file rebuilds byte for byte (every candidate re-played at every level).
 *  7. The ladder: the recorded 96-deal table (scripts/fixtures/d5-ladder-bastion.json.gz) and a live
 *     re-play of two recorded runs a level and player.
 *  8. The four-lane road is new art beside the old: every older stamp's frames draw pixel for pixel as before
 *     (scripts/fixtures/bastion-ladder-art.json, recorded on the renderer before bastionRev 5); a tank on each of the four
 *     lanes is drawn within 2 px of its rectangles, and through the view every drawn pixel maps to the matching side of
 *     its rectangle (the crosshair's inverse, as iron-wall-view-check proves for the three lanes); the four-lane road paints
 *     its own layer; the lever picture draws the level's lanes and tanks in design tokens.
 *  9. Practice bests start fresh: PRACTICE_STAMPS reads bastionRev=5.
 *
 *   bun scripts/bastion-ladder-check.ts            # ~1 min
 *   CHECKS_FULL=1 bun scripts/bastion-ladder-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  bastionBaseMax,
  bastionDronesOf,
  bastionLadderSettings,
  bastionLanesOf,
  bastionPlanFor,
  bastionPlanOf,
  bastionStdParts,
  bastionStdSpecFor,
  bastionTankCheckpoint,
  bastionTankCount,
  bastionTankGameFor,
  bastionTankRects,
  bastionTotalHp,
  bastionWeakPctOf,
  bastionZoneW,
  BASTION_LADDER_LEVELS,
  BASTION_REV_DEALT,
  BASTION_REV_IRON,
  BASTION_REV_LADDER,
  BASTION_REV_LEVELS,
  BASTION_STD_SPEC_V5,
  BT2_FAR,
  BT2_HP,
  BT2_INPUT_AIM,
  BT2_INPUT_FIRE,
  BT2_INPUT_RANGES,
  BT2_LANE_X,
  BT2_SPEED,
  BT2_WAVE_START,
  BT2_WAVE_WINDOW,
  BT2_WORLD_H,
  BT2_WORLD_W,
  BT5_LANE0,
  BT5_LANE_X,
  BT5_LEVELS,
  type BastionLadderLevel,
  type BastionTankState,
  type Bt2Rect,
} from "../src/lib/arcade/bastionTank";
import { BT2_PIP_BACK, BT2_PIP_EMPTY, BT2_PIP_FILL, paintTank } from "../src/lib/arcade/bastionTank.renderer";
import { btViewMatrix, btWorldX, btWorldY } from "../src/lib/arcade/bastionView";
import { LIVE_BANDS, liveStdHelp } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { decodeBastionTankRun, replayBastionTankRun } from "../src/lib/duel/bastion";
import { BASTION_DEAL_V5 } from "../src/lib/duel/bastionDealV5.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { DEAL_PINS } from "../src/lib/duel/dealEra";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { modeLevel } from "../src/lib/levels/modes";
import { BastionPicture, bastionWords } from "../src/lib/levels/pictures/retro-action/bastion";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { artDigests, BASTION_LADDER_ART, holdArtClock } from "./bastion-ladder-art-record";
import { bastionDealSource, BASTION_DEAL_FILE, BASTION_DEAL_KEEP, buildBastionDeal, proveBastionRun } from "./bastion-ladder-deal";
import { bastionPacedPlay, pacedTicks } from "./bastion-ladder-oracle";
import { BASTION_REV5_LEGACY, bastionFinalCheckpoint, encodeOn, stableExtra, type BastionLegacyFixture } from "./bastion-rev5-legacy-record";
import { replaySample } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
let passes = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
const section = (name: string) => console.log(name);
const t0 = Date.now();
const LADDER: readonly BastionLadderLevel[] = BASTION_LADDER_LEVELS;

/* 1. Older stamps are untouched. */
section("1. the recorded bastionRev 4 and 3 runs regrade exactly");
const legacy = JSON.parse(gunzipSync(readFileSync(BASTION_REV5_LEGACY)).toString()) as BastionLegacyFixture;
{
  ok(legacy.runs.length === 144 && (["normal", "easy", "hard", "expert"] as const).every((l) => legacy.runs.filter((r) => r.level === l).length === 36), `144 recorded runs, 36 a level (${legacy.runs.length})`);
  let same = 0;
  for (const r of legacy.runs) {
    const puzzle = JSON.parse(r.puzzle) as PuzzleData;
    const g = gradeAnswer(puzzle, r.raw, 0);
    const match = g.score === r.score && g.isCorrect === r.isCorrect && (g.correctCount ?? null) === r.correctCount && stableExtra(g.extra) === r.extra && JSON.stringify(bastionFinalCheckpoint(puzzle, r.raw)) === JSON.stringify(r.checkpoint);
    if (match) same++;
    else console.log(`    ${r.level} #${r.n} ${r.kind}: ${g.score} (was ${r.score})`);
  }
  ok(same === legacy.runs.length, `every recorded run regrades to the same score, verdict, count, stored extra and final checkpoint (${same} of ${legacy.runs.length})`);
  ok(legacy.runs.filter((r) => r.level === "expert").every((r) => (JSON.parse(r.puzzle) as { bastionRev: number }).bastionRev === BASTION_REV_IRON) && legacy.runs.filter((r) => r.level !== "expert").every((r) => (JSON.parse(r.puzzle) as { bastionRev: number }).bastionRev === BASTION_REV_LEVELS), "the recorded runs are bastionRev 4 (Easy, Normal, Hard) and 3 (Expert)");
}

/* 2. The stamp and the deal. */
section("2. the stamp and the deal");
{
  ok(BASTION_REV_DEALT === BASTION_REV_LADDER && BASTION_REV_LADDER === 5, "rooms deal bastionRev 5");
  ok(JSON.stringify(levelsOf("bastion")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Iron Wall offers Easy, Normal, Hard and Expert");
  ok(Object.keys(DEAL_PINS).includes("bastionPreLadder") && Object.keys(DEAL_PINS).includes("bastionPreLevels"), "the era pins bastionPreLadder and bastionPreLevels are DEAL_PINS entries");
  for (let n = 0; n < 8; n++) {
    for (const level of LADDER) {
      const p = dealAt("bastion", level, n) as PuzzleData & { bastionRev?: number; seed: number; level?: string };
      const stamped = level === "normal" ? !("level" in p) : p.level === level;
      ok(p.bastionRev === BASTION_REV_LADDER && stamped && puzzleLevel(p) === level, `deal ${n}: ${level} deals bastionRev 5${level === "normal" ? " with no level field" : ` stamped "${level}"`}`);
      ok(BASTION_DEAL_V5[level].includes(p.seed), `deal ${n}: ${level}'s seed is on its proved list`);
    }
    const seed = 7000 + n;
    const none = withSeededRandom(seed, () => generatePuzzle("bastion", { bankSeed: seed }));
    const asked = withSeededRandom(seed, () => generatePuzzle("bastion", { bankSeed: seed, level: "normal" }));
    ok(JSON.stringify(none) === JSON.stringify(asked), `seed ${seed}: a Normal deal is byte for byte the deal with no level asked`);
  }
  ok(modeLevel("rated", "expert") === "normal" && modeLevel("daily", "hard") === "normal", "rated play and the Daily deal Normal");
  // The pin deals exactly the recorded legacy puzzles (the same draw of Math.random, the same stamps and seeds).
  let pinnedSame = 0;
  const firsts = legacy.runs.filter((r) => r.kind === "weak");
  for (const r of firsts) {
    const pinned = withSeededRandom(Number(roomSeedOf(r.n)), () => generatePuzzle("bastion", { bankSeed: roomSeedOf(r.n), ...(r.level !== "normal" ? { level: r.level } : {}) }, { pins: ["bastionPreLadder"] }));
    if (JSON.stringify(pinned) === r.puzzle) pinnedSame++;
  }
  ok(pinnedSame === firsts.length, `bastionPreLadder deals exactly the recorded bastionRev 4 / 3 puzzles (${pinnedSame} of ${firsts.length})`);
  const pre = generatePuzzle("bastion", { level: "hard" }, { pins: ["bastionPreLevels"] }) as { bastionRev?: number };
  ok(pre.bastionRev === BASTION_REV_IRON, "bastionPreLevels still deals bastionRev 3");
  ok((generatePuzzle("bastion") as { bastionRev?: number }).bastionRev === BASTION_REV_LADDER, "unpinned again, the live deal is bastionRev 5");
  for (const level of LADDER) {
    const p = dealAt("bastion", level, 3);
    ok(puzzleTimeLimitMs(p) === 63_000 && bastionTankGameFor((p as { bastionRev: number }).bastionRev, puzzleLevel(p)).runTicks === 3600, `${level}: a 60 s run on a 63 s clock`);
  }
}

/** level-tune's room seed n (dealAt's Math.random seed and bankSeed). */
function roomSeedOf(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/* 3. Normal is bastionRev 4's Normal game. */
section("3. Normal plays bastionRev 4's Normal exactly; only Weak spots' line moved");
{
  const normals = legacy.runs.filter((r) => r.level === "normal");
  let samePlay = 0;
  let flagged = 0;
  let lines = 0;
  for (const r of normals) {
    const p = JSON.parse(r.puzzle) as { seed: number };
    const events = decodeBastionTankRun(r.raw).events;
    const at = new Map(events.map((e) => [e.t, e]));
    const g4 = bastionTankGameFor(BASTION_REV_LEVELS, "normal");
    const g5 = bastionTankGameFor(BASTION_REV_LADDER, "normal");
    let a = g4.init(p.seed);
    let b = g5.init(p.seed);
    let same = JSON.stringify(bastionPlanOf(a)) === JSON.stringify(bastionPlanOf(b)) && JSON.stringify(bastionDronesOf(a)) === JSON.stringify(bastionDronesOf(b));
    while (!g4.isOver(a) || !g5.isOver(b)) {
      const e = at.get(a.tick + 1) ?? null;
      if (!g4.isOver(a)) a = g4.step(a, e);
      if (!g5.isOver(b)) b = g5.step(b, e);
      if (JSON.stringify({ ...a, rev: 0 }) !== JSON.stringify({ ...b, rev: 0 })) {
        same = false;
        break;
      }
    }
    if (same) samePlay++;
    // The same log on the bastionRev 5 copy of its puzzle: the stamp is in the checkpoint, so a rev 4 client's log is flagged.
    // (The replay reports the desync on the console; it is the point here.)
    const quiet = console.error;
    console.error = () => {};
    const on5 = replayBastionTankRun(p.seed, r.raw, BASTION_REV_LADDER);
    console.error = quiet;
    if (on5.flagged) flagged++;
    // Scored on rev 5's lines: rev 4's parts with Weak spots on 28.
    const p4 = bastionStdParts(a)!;
    const p5 = bastionStdParts({ ...a, rev: BASTION_REV_LADDER, lvl: "normal" })!;
    const want = p4.map((x) => (x.key === "weak" ? Math.min(30, Math.floor((30 * Math.min(a.weak, 28)) / 28)) : x.points));
    if (JSON.stringify(p5.map((x) => x.points)) === JSON.stringify(want)) lines++;
  }
  ok(samePlay === normals.length, `every recorded Normal log plays tick for tick to the same state on bastionRev 5 Normal (${samePlay} of ${normals.length})`);
  ok(flagged === normals.filter((r) => decodeBastionTankRun(r.raw).checkpoints.length > 0).length, `a bastionRev 4 log on a bastionRev 5 puzzle is flagged (its checkpoints carry no stamp; ${flagged})`);
  ok(lines === normals.length, `scored on bastionRev 5: rev 4's parts, Weak spots on its 28-hit line (${lines} of ${normals.length})`);
  ok(BT5_LEVELS.normal.weakFull === 28 && BT5_LEVELS.normal.waves === null && BT5_LEVELS.normal.lanes === 3, "Normal: bastionRev 4's plan on three lanes, Weak spots full at 28 hits");
  for (const seed of [1, 99, 123456]) ok(JSON.stringify(bastionPlanFor(seed, 5, "normal")) === JSON.stringify(bastionPlanFor(seed, 4, "normal")), `seed ${seed}: Normal's plan is bastionRev 4's`);
}

/* 4. The level rules. */
section("4. the level rules, played and mirrored");
{
  for (const level of (["easy", "hard", "expert"] as const)) {
    const set = BT5_LEVELS[level];
    const row = gameLevelSettings<Record<string, unknown>>("bastion", level)!;
    const tanks = set.waves!.reduce((a, w) => a + w[0] + w[1] + w[2], 0);
    const heavies = set.waves!.reduce((a, w) => a + w[2], 0);
    const mirror = row["bastionRev"] === 5 && row["lanes"] === set.lanes && row["tanksAWave"] === tanks / 5 && row["tanks"] === tanks && row["heavies"] === heavies && JSON.stringify(row["pace"]) === JSON.stringify(set.pace) && row["zoneMs"] === set.zoneW * 2 && row["weakPct"] === set.weakPct && row["base"] === set.base;
    ok(mirror, `${level}: the registry's row mirrors the sim's BT5_LEVELS (${JSON.stringify(row)})`);
    ok(set.waves!.every((w) => w[0] + w[1] + w[2] === tanks / 5) && set.heavies === heavies, `${level}: ${tanks / 5} tanks every wave, ${heavies} heavies`);
  }
  const want: Record<BastionLadderLevel, { lanes: 3 | 4; tanks: number; heavies: number }> = { easy: { lanes: 3, tanks: 20, heavies: 1 }, normal: { lanes: 3, tanks: 30, heavies: 5 }, hard: { lanes: 4, tanks: 40, heavies: 10 }, expert: { lanes: 4, tanks: 45, heavies: 12 } };
  for (const level of LADDER) {
    const set = BT5_LEVELS[level];
    const game = bastionTankGameFor(BASTION_REV_LADDER, level);
    for (const seed of [11, 4242, 999999]) {
      const s0 = game.init(seed);
      const plan = bastionPlanOf(s0);
      const w = want[level];
      ok(s0.rev === 5 && s0.lvl === level && plan.length === w.tanks && bastionTankCount(5, level) === w.tanks && plan.filter((p) => p.kind === 2).length === w.heavies, `${level} seed ${seed}: ${w.tanks} tanks, ${w.heavies} heavies`);
      const ids = w.lanes === 4 ? [3, 4, 5, 6] : [0, 1, 2];
      ok(bastionLanesOf(s0) === w.lanes && plan.every((p) => ids.includes(p.lane)) && ids.every((id) => plan.some((p) => p.lane === id)), `${level} seed ${seed}: ${w.lanes} lanes (ids ${ids.join(", ")}), every one used`);
      ok(plan.every((p, i) => i === 0 || p.lane !== plan[i - 1]!.lane), `${level} seed ${seed}: never the same lane twice running`);
      ok(plan.every((p) => p.spawn >= BT2_WAVE_START[p.wave]! && p.spawn < BT2_WAVE_START[p.wave]! + BT2_WAVE_WINDOW && p.open === set.weakOpen), `${level} seed ${seed}: every tank rolls on inside its wave's window, its weak spot open ${set.weakOpen} of 90`);
      ok(bastionTotalHp(5, level) === plan.reduce((a, p) => a + BT2_HP[p.kind]!, 0), `${level} seed ${seed}: the level's hit points are its plan's (${bastionTotalHp(5, level)})`);
      ok(s0.base === set.base && bastionBaseMax(5, level) === set.base && bastionZoneW(5, level) === set.zoneW && bastionWeakPctOf(s0) === set.weakPct, `${level} seed ${seed}: base ${set.base}, green zone ${set.zoneW} ‰, weak spots ${set.weakPct} %`);
      ok(bastionDronesOf(s0).every((d) => d.speed === set.droneSpeed && d.size === set.dronePct), `${level} seed ${seed}: drones at ${set.droneSpeed} px a tick, ${set.dronePct} %`);
      let s = s0;
      const v = new Map<number, number>();
      while (!game.isOver(s) && s.tick < 3000) {
        s = game.step(s, null);
        for (const t of s.tanks) if (!v.has(t.i)) v.set(t.i, t.v);
      }
      ok([...v].every(([i, sp]) => sp === Math.floor((BT2_SPEED[plan[i]!.kind]! * set.pace[plan[i]!.wave]!) / 100)), `${level} seed ${seed}: every tank rolls on at its wave's ${set.pace.join("/")} % pace`);
    }
  }
  // Each level up is a step on the lever (more tanks a wave) and never an aid on any other lever.
  for (let i = 1; i < LADDER.length; i++) {
    const [a, b] = [BT5_LEVELS[LADDER[i - 1]!], BT5_LEVELS[LADDER[i]!]];
    const tanksA = bastionTankCount(5, LADDER[i - 1]);
    const tanksB = bastionTankCount(5, LADDER[i]);
    const harder = tanksB > tanksA && b.lanes >= a.lanes && b.pace.every((p, w) => p >= a.pace[w]!) && b.zoneW <= a.zoneW && b.weakOpen <= a.weakOpen && b.weakPct <= a.weakPct && b.base <= a.base && b.droneSpeed >= a.droneSpeed && b.dronePct <= a.dronePct && b.heavies >= a.heavies;
    ok(harder, `${LADDER[i]} is a step up from ${LADDER[i - 1]}: more tanks a wave (${tanksA} → ${tanksB}) and no lever gentler`);
  }
  ok(BT5_LANE0 === BT2_LANE_X.length && JSON.stringify(BT5_LANE_X) === "[-144,-48,48,144]" && BT5_LANE_X.every((x, i) => i === 0 || x - BT5_LANE_X[i - 1]! === 96), "the four-lane road: four 96 px lanes at the wall, lane ids 3–6");
  ok(BT5_LANE_X.every((x) => Math.abs(x) + 47 <= 192) && BT5_LANE_X.every((x, i) => i === 0 || x - 47 >= BT5_LANE_X[i - 1]! + 47), "a 94 px heavy fits every lane inside the road's 192 px half width, never touching the next lane's");
  ok(bastionTankRects(2, 1, 0).hull.join() === "148,558,242,600" && bastionTankRects(1, 0, 400 * 256).cx === bastionTankRects(1, 0, 400 * 256, 100).cx, "the three-lane road's rectangles are unchanged");
}

/* 5. The parts. */
section("5. the parts, the spec and the help");
{
  for (const level of LADDER) {
    const set = BT5_LEVELS[level];
    const game = bastionTankGameFor(BASTION_REV_LADDER, level);
    const s0 = game.init(9);
    const hp = bastionTotalHp(5, level);
    const hpFull = set.hpFull ?? hp;
    const parts = bastionStdParts(s0)!;
    ok(parts.map((p) => `${p.key}:${p.max}`).join(" ") === "core:110 weak:30 fast:20 drone:30 base:10", `${level}: Armour 110, Weak spots 30, Fast reloads 20, Drones 30, Base intact 10`);
    const full: BastionTankState = { ...s0, acted: 1, ended: 1, destroyedHp: hpFull, weak: set.weakFull, fast: set.fastFull, drones: set.droneFull, base: set.base - set.baseFree };
    ok(game.score(full) === 200, `${level}: every part at its line (${hpFull} HP, ${set.weakFull} weak-spot hits, ${set.fastFull} fast reloads, ${set.droneFull} drone${set.droneFull === 1 ? "" : "s"}, ${set.baseFree} base hit${set.baseFree === 1 ? "" : "s"}) → 200`);
    const short = [{ destroyedHp: hpFull - 1 }, { weak: set.weakFull - 1 }, { fast: set.fastFull - 1 }, { drones: set.droneFull - 1 }, { base: set.base - set.baseFree - 1 }];
    ok(short.every((o) => game.score({ ...full, ...o }) < 200), `${level}: one short on any part's line is under 200`);
    ok(game.score({ ...full, ended: 2, base: 0 }) < 200 && game.score({ ...full, destroyedHp: hp, weak: 60, fast: 30, drones: 3, base: set.base }) === 200, `${level}: the base falling costs the base part; going past every line stays 200`);
    ok(game.score(s0) === 0, `${level}: no input scores 0`);
    const one: ArcadeInputEvent[] = [];
    recordInput(one, { t: 5, k: BT2_INPUT_AIM, a: 195, b: 400, c: 1, d: 0 }, BT2_INPUT_RANGES);
    const p = dealAt("bastion", level, 2);
    ok(gradeAnswer(p, encodeOn(p, one).raw, 0).score >= 1, `${level}: one aim and nothing more scores at least 1`);
    ok(bastionStdSpecFor(5, level) === BASTION_STD_SPEC_V5[level] && BASTION_STD_SPEC_V5[level].parts.reduce((a, x) => a + x.max, 0) === 200, `${level}: the spec's parts sum to 200`);
  }
  ok(LIVE_BANDS.bastion.rev === 5 && LIVE_BANDS.bastion.std === BASTION_STD_SPEC_V5.normal && ARCADE_STANDARD.bastion?.spec === BASTION_STD_SPEC_V5.normal, "LIVE_BANDS and the standard follow bastionRev 5's Normal");
  const help = liveStdHelp("bastion", "Four hits on the base end the run.");
  ok(/all of it at 28 hits/.test(help) && !/full at/.test(help), `the "?" help states Normal's 28-hit line in plain words (${help.slice(0, 160)}…)`);
}

/* 6. The proof. */
section("6. the proof: the paced oracle under the human limits, at 200 on the dealt seeds");
{
  const { notice, move } = pacedTicks(HUMAN_LIMITS);
  ok(notice === 15 && move === 9 && HUMAN_LIMITS.reactMs === 250 && HUMAN_LIMITS.moveMs === 150, `the paced oracle reacts in 15 ticks (0.25 s) and moves in 9 (0.15 s)`);
  for (const level of LADDER) {
    const list = BASTION_DEAL_V5[level];
    ok(list.length === BASTION_DEAL_KEEP && new Set(list).size === list.length, `${level}: ${BASTION_DEAL_KEEP} distinct proved seeds`);
    const sample = FULL ? list : list.filter((_, i) => i % 15 === 0);
    let at200 = 0;
    let paced = true;
    for (const seed of sample) {
      const puzzle = { type: "bastion", seed, bastionRev: BASTION_REV_LADDER, puzzleScoreRev: 3, speedPar: 1, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
      const game = bastionTankGameFor(BASTION_REV_LADDER, level);
      const { events } = bastionPacedPlay(seed, game);
      const g = gradeAnswer(puzzle, proveBastionRun(seed, level, events).raw, 0);
      if (g.score === 200 && g.isCorrect && g.extra?.["flagged"] !== true) at200++;
      // No shell before the player could have seen and reached its target.
      const fires = events.filter((e) => e.k === BT2_INPUT_FIRE);
      const firstFire = fires[0]?.t ?? Infinity;
      if (firstFire < bastionPlanFor(seed, BASTION_REV_LADDER, level)[0]!.spawn + notice + move) paced = false;
      const drones = bastionDronesOf(game.init(seed));
      for (const e of fires) if (e.b < 240 && !drones.some((d) => e.t >= d.at + notice + move && e.t <= d.at + 200)) paced = false;
      for (let i = 1; i < events.length; i++) if (events[i]!.t <= events[i - 1]!.t) paced = false;
    }
    ok(at200 === sample.length, `${level}: the paced oracle scores 200 through the server on ${at200} of ${sample.length} dealt seeds${FULL ? " (all)" : " (a sample)"}`);
    ok(paced, `${level}: the paced oracle never fires before it could have noticed and reached its first target or a drone, one input a tick`);
  }
  // The deal file rebuilds byte for byte (bun scripts/bastion-ladder-deal.ts --check): every candidate re-played by the
  // paced oracle through the server replay at every level, the kept ones at 200.
  const lists = buildBastionDeal();
  ok(readFileSync(BASTION_DEAL_FILE, "utf8") === bastionDealSource(lists), `the deal file rebuilds byte for byte (${LADDER.map((l) => `${l} ${lists[l].kept.length} of ${lists[l].tried}`).join(", ")})`);
}

/* 7. The ladder. */
section("7. the recorded 96-deal table, and a live re-play");
{
  // The recorded 96-deal figures are reported, not targets (Joe, 27 Nov 2026: sessions don't decide difficulty), so this
  // check no longer holds them to the ladder test; it re-plays a sample to show the figures are today's game.
  for (const [cond, label] of await replaySample("bastion", 2)) ok(cond, label);
}

/* 8. The four-lane road's art. */
section("8. the four-lane road: new art beside the old, tanks on their rectangles, the view's inverse");
{
  // Older stamps' frames, pixel for pixel as the renderer drew them before bastionRev 5 (the art's clock held still).
  const realPerformance = globalThis.performance;
  holdArtClock();
  const art = await import("../src/lib/arcade/bastionTank.renderer");
  const recorded = (JSON.parse(readFileSync(BASTION_LADDER_ART, "utf8")) as { digests: Record<string, string> }).digests;
  const now = artDigests(art as never);
  const changed = Object.keys(recorded).filter((k) => recorded[k] !== now[k]);
  ok(Object.keys(recorded).length === 14 && changed.length === 0, `every older stamp's frame, the scenery and the intro still draw as before (${Object.keys(recorded).length - changed.length} of ${Object.keys(recorded).length}${changed.length ? `; changed: ${changed.join(", ")}` : ""})`);
  // The four-lane road paints its own layer: a Hard frame differs from a Normal frame on the same field where the road is.
  const roadPixels = (level: BastionLadderLevel) => {
    const c = createCanvas(BT2_WORLD_W, BT2_WORLD_H);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    const s = bastionTankGameFor(5, level).init(3);
    art.bastionTankArtGameFor(5, level).draw(ctx, { ...s, tick: 1 }, { width: BT2_WORLD_W, height: BT2_WORLD_H });
    return c.getContext("2d").getImageData(0, 560, BT2_WORLD_W, 30).data;
  };
  const three = roadPixels("normal");
  const four = roadPixels("hard");
  const sha = (d: Uint8ClampedArray) => createHash("sha256").update(Buffer.from(d)).digest("hex");
  ok(sha(three as unknown as Uint8ClampedArray) === sha(roadPixels("easy") as unknown as Uint8ClampedArray) && sha(three as unknown as Uint8ClampedArray) !== sha(four as unknown as Uint8ClampedArray) && sha(four as unknown as Uint8ClampedArray) === sha(roadPixels("expert") as unknown as Uint8ClampedArray), "Easy and Normal draw the three-lane road, Hard and Expert the four-lane road");
  Object.defineProperty(globalThis, "performance", { configurable: true, value: realPerformance });

  // Each tank on each of the four lanes: every rectangle and path point drawn within 2 px of its collision rectangles
  // (bastion-check's fake context; the pips above the turret are its HUD and the shadow lies inside the hull).
  let bad = 0;
  let drawn = 0;
  for (let kind = 0; kind < 3; kind++)
    for (let lane = BT5_LANE0; lane < BT5_LANE0 + 4; lane++)
      for (const z of [0, 120, 400, 900, BT2_FAR]) {
        for (const pct of [100, 120]) {
          const r = bastionTankRects(kind, lane, z * 256, pct);
          const pts: [number, number][] = [];
          let fill = "";
          const note = (x: number, y: number) => {
            if (fill !== BT2_PIP_BACK && fill !== BT2_PIP_FILL && fill !== BT2_PIP_EMPTY) pts.push([x, y]);
          };
          const ctx = new Proxy(
            {},
            {
              get(_, k) {
                if (k === "fillRect") return (x: number, y: number, w: number, h: number) => (note(x, y), note(x + w, y + h));
                if (k === "moveTo" || k === "lineTo") return (x: number, y: number) => note(x, y);
                if (k === "arc") return (x: number, y: number, rr: number) => (note(x - rr, y - rr), note(x + rr, y + rr));
                if (k === "ellipse") return (x: number, y: number, rx: number, ry: number) => (note(x - rx, y - ry), note(x + rx, y + ry));
                if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
                return () => {};
              },
              set(_, k, v) {
                if (k === "fillStyle") fill = String(v);
                return true;
              },
            },
          ) as unknown as CanvasRenderingContext2D;
          paintTank(ctx, kind, lane, z * 256, BT2_HP[kind]!, 0, 0, true, z % 3 === 0, true, 0, pct);
          const x0 = Math.min(r.hull[0], r.turret[0]) - 2;
          const x1 = Math.max(r.hull[2], r.turret[2]) + 2;
          const y0 = r.turret[1] - 2;
          const y1 = r.hull[3] + 2;
          drawn += pts.length;
          for (const [x, y] of pts) if (x < x0 || x > x1 || y < y0 || y > y1) bad++;
        }
      }
  ok(drawn > 0 && bad === 0, `every four-lane tank's drawn art sits within 2 px of its collision rectangles (${drawn} points, ${bad} outside)`);
  // Through the view: every drawn tank pixel more than 2 px from its edge maps (the stage's inverse) to the matching side.
  const inRect = (r: Bt2Rect, x: number, y: number) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
  let pixels = 0;
  let worst = "";
  for (const kind of [0, 1, 2])
    for (let lane = BT5_LANE0; lane < BT5_LANE0 + 4; lane++)
      for (const z of [BT2_FAR, 1000, 700, 400, 200, 80, 0]) {
        const r = bastionTankRects(kind, lane, z * 256);
        const [a, , c, d, e, f] = btViewMatrix(r.cx, (r.turret[1] + r.ground) / 2);
        for (const part of [r.hull, r.turret]) {
          const top = d * part[1] + f;
          const bottom = d * part[3] + f;
          const ext = [a * part[0] + c * part[1] + e, a * part[2] + c * part[3] + e];
          for (let vy = Math.floor(top) - 4; vy <= Math.ceil(bottom) + 4; vy++)
            for (let vx = Math.floor(Math.min(...ext)) - 8; vx <= Math.ceil(Math.max(...ext)) + 8; vx++) {
              const px = vx + 0.5;
              const py = vy + 0.5;
              const wy = (py - f) / d;
              const x0 = a * part[0] + c * wy + e;
              const x1 = a * part[2] + c * wy + e;
              const inside = px > x0 + 2 && px < x1 - 2 && py > top + 2 && py < bottom - 2;
              const outside = px < x0 - 2 || px > x1 + 2 || py < top - 2 || py > bottom + 2;
              if (!inside && !outside) continue;
              pixels++;
              const hit = inRect(part, btWorldX(px, py), btWorldY(py));
              if (inside !== hit && !worst) worst = `kind ${kind} lane ${lane} z ${z}: view (${px}, ${py})`;
            }
        }
      }
  ok(pixels > 50_000 && !worst, `through the view every four-lane tank pixel more than 2 px from its edge maps to the matching side of its rectangle (${pixels} pixels)${worst ? `: ${worst}` : ""}`);
  // The lever picture: drawn from the level's own settings, colours only through design tokens.
  for (const level of (["easy", "normal", "hard", "expert"] as Level[])) {
    const html = renderToStaticMarkup(createElement(BastionPicture, { level, size: "l" }));
    const lv = level === "normal" ? { lanes: 3, tanksAWave: 6 } : { lanes: BT5_LEVELS[level as BastionLadderLevel].lanes, tanksAWave: bastionTankCount(5, level) / 5 };
    ok(html.includes(`data-lanes="${lv.lanes}"`) && (html.match(/<rect /g) ?? []).length === lv.tanksAWave + 1 && (html.match(/stroke-dasharray/g) ?? []).length === lv.lanes - 1, `${level}: the picture draws ${lv.lanes} lanes and ${lv.tanksAWave} tanks (${bastionWords(level)})`);
    ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(html) && /var\(--jz-/.test(html), `${level}: the picture's colours are design tokens only`);
  }
}

/* 9. Practice bests. */
section("9. practice bests start fresh");
ok(/bastionRev=5\b/.test(PRACTICE_STAMPS["bastion"] ?? ""), `PRACTICE_STAMPS reads bastionRev=5 (${PRACTICE_STAMPS["bastion"]})`);
void bastionLadderSettings;

console.log(
  failures.length === 0
    ? `PASS bastion-ladder-check: ${passes} checks (${((Date.now() - t0) / 1000).toFixed(1)} s${FULL ? ", full depth" : ""})`
    : `FAIL bastion-ladder-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
process.exit(failures.length ? 1 : 0);
