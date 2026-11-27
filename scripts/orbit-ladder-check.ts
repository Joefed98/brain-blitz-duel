/**
 * orbit-ladder-check (D5, 23 Nov 2026; Joe's decisions of 23 Nov 2026; docs/arcade-standard/orbit.md "orbitRev 17:
 * lines, belts and levels"): Orbit's Normal scoring refit and its levels, folded into the unshipped orbitRev 17.
 *
 *  1. Older rounds unchanged: the 144 orbitRev 16 runs recorded at every level before orbitRev 17
 *     (scripts/fixtures/orbit-lost-legacy.json.gz) regrade to the same score, verdict, extra and final checkpoint;
 *     ORBIT_STD (orbitRev 13–16's parts) is as it was;
 *  2. the stamp, the deal and the pin: Normal and every level deal orbitRev 17 on the course its own ladder bank holds for
 *     the seed (a Normal deal byte for byte the deal with no level asked); orbitPreLost deals orbitRev 16 from the fuel
 *     banks; the start carries the level's tank and checkpoint rule (as orbitRev 16's) and `lvl` for its lines;
 *  3. the level rules as dealt: the tanks and checkpoint rules are orbitRev 16's; every dealt course's belts follow the
 *     level's rule (Easy none, Normal only from planet 31, Hard every fourth planet from the second, Expert every third
 *     from the first); the registry (GAME_LEVELS.orbit's `belts`, `minWindow` and the zigzag) mirrors LADDER_COURSES;
 *     Normal's lines are the refit's (each about three quarters of orbitRev 16's) and each level's are its own, the six
 *     parts summing to 200; the registry's `lines` mirror the sim's;
 *  4. the proof: every bank entry (a sample of 3 a level, CHECKS_FULL=1 all) keeps the human limits, checked here on its
 *     own (every release 24 ticks or more after the rocket settles into its orbit, every input 9 or more after the one
 *     before) and its witness scores exactly 200 through the server's grade on the puzzle as dealt, every feature taken;
 *     no level's line is above its bank's least pace or perfect orbits; the first Easy entry rebuilds byte for byte
 *     (`bun scripts/orbit-ladder-bank.ts --check 1 --level=easy`; CHECKS_FULL=1: one entry of every level);
 *  5. the recorded 96-deal ladder (scripts/fixtures/d5-ladder-orbit.json.gz) and a live re-play
 *     sample (one run a level and player) scoring exactly as recorded;
 *  6. the practice challenges count the things themselves (all four slingshots, all the stardust on Hard).
 *
 *   bun scripts/orbit-ladder-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { ORBIT_HAZARD_FROM, ORBIT_INPUT_TAP, ORBIT_REV_BIG, ORBIT_REV_LOST, ORBIT_TOTAL } from "../src/lib/arcade/orbit";
import {
  decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, orbitStartForPuzzle, orbitXpCounts, ORBIT_LEVEL_RULES, ORBIT_REV3_RUN_TICKS, ORBIT_STD, ORBIT_STD_V17,
  ORBIT_V17_LEVEL_LINES, ORBIT_V17_LINES, orbitStdSpecOf, orbitRev3Game, ORBIT_REV3_WORLD_W, type OrbitLevelName, type OrbitLines, type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { ORBIT_LADDER_BANKS } from "../src/lib/duel/orbitRev3Course.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { pinOrbitPreLost } from "../src/lib/duel/arcade.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { challengesFor, goalMet } from "../src/lib/duel/practiceChallenges";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
import { OrbitPicture, orbitPictureBelted, orbitWords } from "../src/lib/levels/pictures/retro-action/orbit";
import type { PuzzleData } from "../src/lib/duel/types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { roomSeed } from "./arcade-skill-bands/games";
import { dealAt } from "./level-tune";
import { replaySample } from "./d5-ladder-lib";
import { LADDER_COURSES, ladderPuzzle, ladderServerScore, ladderStart, ORBIT_HUMAN_READY_TICKS } from "./orbit-ladder-lib";
import { ORBIT_LOST_LEGACY, orbitFinalCheckpoint, stableExtra, type OrbitLegacyFixture } from "./orbit-lost-legacy-record";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
const VERBOSE = process.argv.includes("--verbose");
function ok(cond: boolean, label: string): void {
  checks++;
  if (VERBOSE) console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures.push(label);
}
const json = (v: unknown) => JSON.stringify(v);
const FULL = process.env.CHECKS_FULL === "1";
type Lv = "normal" | OrbitLevelName;
const LEVELS: Lv[] = ["normal", "easy", "hard", "expert"];
const asLevel = (l: Lv): OrbitLevelName | null => (l === "normal" ? null : l);
const linesOf = (l: Lv): Readonly<OrbitLines> => (l === "normal" ? ORBIT_V17_LINES : ORBIT_V17_LEVEL_LINES[l]);

/* 1. Older rounds unchanged. */
{
  const fixture = JSON.parse(gunzipSync(readFileSync(ORBIT_LOST_LEGACY)).toString()) as OrbitLegacyFixture;
  let same = 0;
  for (const r of fixture.runs) {
    const puzzle = JSON.parse(fixture.puzzles[r.p]!) as PuzzleData;
    const g = gradeAnswer(puzzle, r.raw, 0);
    if (g.score === r.score && g.isCorrect === r.isCorrect && stableExtra(g.extra) === r.extra && json(orbitFinalCheckpoint(puzzle, r.raw)) === json(r.checkpoint)) same++;
  }
  ok(fixture.runs.length === 144 && same === 144, `1a: the 144 orbitRev 16 runs recorded at every level before orbitRev 17 regrade to the same score, verdict, extra and checkpoint (${same})`);
  ok(ORBIT_STD.rev === ORBIT_REV_BIG && json(ORBIT_STD.parts.map((p) => [p.key, p.max, p.of])) === json([["core", 130, 640], ["speed", 20, 1], ["dust", 15, 30], ["slings", 12, 4], ["fields", 12, 3], ["perfect", 11, 21]]), "1b: ORBIT_STD is orbitRev 13–16's parts exactly (orbitRev 16 the last stamp dealt on them)");
}

/* 2. The stamp, the deal and the pin. */
{
  for (const l of LEVELS) {
    const bank = ORBIT_LADDER_BANKS[l];
    let good = 0;
    for (let n = 0; n < 6; n++) {
      const p = dealAt("orbit", l, n) as any;
      const e = bank[((p.seed % bank.length) + bank.length) % bank.length]!;
      if (p.orbitRev === ORBIT_REV_LOST && json(p.planets) === json(e.planets) && json(p.holes) === json(e.holes) && json(p.extras) === json(e.extras) && (l === "normal" ? !("level" in p) : p.level === l)) good++;
    }
    ok(bank.length > 0 && good === 6, `2a ${l}: the deal is orbitRev 17 on the ladder bank's course for the seed, the level stamped only off Normal (${good} / 6)`);
    const s = orbitStartForPuzzle(dealAt("orbit", l, 1) as any)!();
    const rules = l === "normal" ? null : ORBIT_LEVEL_RULES[l];
    ok(s.lost === 1 && (rules ? s.tank === rules.tank && s.lvl === l && (s.cpAuto ?? 0) === (rules.checkpoints === "auto" ? 1 : 0) && (s.cpNone ?? 0) === (rules.checkpoints === "none" ? 1 : 0) : s.tank === undefined && s.lvl === undefined), `2b ${l}: the start carries the level's tank, checkpoint rule and lines (Normal none)`);
  }
  const plain = withSeededRandom(roomSeed(5), () => generatePuzzle("orbit", { bankSeed: roomSeed(5) })) as any;
  const normal = withSeededRandom(roomSeed(5), () => generatePuzzle("orbit", { bankSeed: roomSeed(5), level: "normal" as never })) as any;
  ok(json(plain) === json(normal) && !("level" in normal), "2c: a Normal deal is byte for byte the deal with no level asked");
  const was = pinOrbitPreLost(true);
  const pinned = dealAt("orbit", "hard", 2) as any;
  pinOrbitPreLost(was);
  ok(pinned.orbitRev === ORBIT_REV_BIG && !ORBIT_LADDER_BANKS.hard.some((e) => json(e.planets) === json(pinned.planets)), "2d: the orbitPreLost pin deals orbitRev 16 from the fuel banks (never a ladder course)");
}

/* 3. The level rules as dealt. */
{
  ok(ORBIT_LEVEL_RULES.easy.tank === 240 && ORBIT_LEVEL_RULES.easy.checkpoints === "auto" && ORBIT_LEVEL_RULES.hard.tank === 140 && ORBIT_LEVEL_RULES.hard.checkpoints === "one" && ORBIT_LEVEL_RULES.expert.tank === 120 && ORBIT_LEVEL_RULES.expert.checkpoints === "none", "3a: the tanks (240 / 140 / 120) and checkpoint rules (automatic / one / none) are orbitRev 16's");
  const beltRule = (l: Lv, i: number): boolean | null => {
    const b = LADDER_COURSES[l].belts;
    if (b === "none") return false;
    if (b === "normal") return i >= ORBIT_HAZARD_FROM ? null : false;
    return i >= b.from && (i - b.from) % b.every === 0;
  };
  ok(LADDER_COURSES.easy.belts === "none" && json(LADDER_COURSES.hard.belts) === json({ from: 1, every: 4 }) && json(LADDER_COURSES.expert.belts) === json({ from: 0, every: 3 }) && LADDER_COURSES.normal.belts === "normal", "3b: the lever: Easy no belts, Normal from planet 31, Hard every fourth planet from the second, Expert every third from the first");
  for (const l of LEVELS) {
    const bad: string[] = [];
    for (const e of ORBIT_LADDER_BANKS[l]) {
      const ps = decodeRev3Planets(e.planets);
      for (let i = 0; i < ORBIT_TOTAL; i++) {
        const want = beltRule(l, i);
        if (want !== null && (ps[i]!.hazard >= 0) !== want) bad.push(`${e.seed} planet ${i + 1}`);
      }
      if (ps[ORBIT_TOTAL]!.hazard >= 0) bad.push(`${e.seed}: the sun belted`);
    }
    ok(bad.length === 0, `3c ${l}: every bank course's belts follow the level's rule (${bad.slice(0, 4).join(", ") || "all"})`);
  }
  for (const l of ["easy", "hard", "expert"] as OrbitLevelName[]) {
    const c = LADDER_COURSES[l];
    const reg = gameLevelSettings<any>("orbit", l)!;
    const regBelts = reg.belts === "none" ? "none" : { from: reg.belts.from - 1, every: reg.belts.every };
    ok(json(regBelts) === json(c.belts) && reg.minWindow === c.window && reg.tank === c.tank && reg.latMin === c.latMin && reg.latMax === c.latMax && reg.liftMin === c.liftMin && reg.liftSpan === c.liftSpan && reg.checkpoints === ORBIT_LEVEL_RULES[l].checkpoints, `3d ${l}: GAME_LEVELS.orbit mirrors the course (belts, narrowest window, tank, zigzag)`);
    ok(json(reg.lines) === json(ORBIT_V17_LEVEL_LINES[l]), `3e ${l}: GAME_LEVELS.orbit's lines are the sim's`);
  }
  const N = ORBIT_V17_LINES;
  ok(N.speedFullLeft * 4 >= 2700 * 3 - 60 && N.speedFullLeft * 4 <= 2700 * 3 + 60 && N.dustFull >= 21 && N.dustFull <= 24 && N.slingsFull === 3 && N.fieldsFull === 3 && N.perfectFull >= 15 && N.perfectFull <= 17, `3f: Normal's lines are the refit's, about three quarters of orbitRev 16's (speed ${N.speedFullLeft} ticks left, stardust ${N.dustFull}, slingshots ${N.slingsFull}, perfect orbits ${N.perfectFull})`);
  for (const l of LEVELS) {
    const spec = l === "normal" ? ORBIT_STD_V17 : orbitStdSpecOf({ lost: 1, lvl: l });
    ok(spec.rev === ORBIT_REV_LOST && spec.parts.reduce((a, p) => a + p.max, 0) === 200 && json(spec.parts.map((p) => [p.key, p.max])) === json(ORBIT_STD.parts.map((p) => [p.key, p.max])), `3g ${l}: the six parts and their maxima are orbitRev 16's, summing to 200`);
  }
}

/* 4. The proof. */
{
  for (const l of LEVELS) {
    const bank = ORBIT_LADDER_BANKS[l];
    const L = linesOf(l);
    ok(bank.length >= 8, `4a ${l}: the bank holds ${bank.length} courses (8 or more; the builder keeps only courses whose human-limited witness scores 200)`);
    ok(bank.every((e) => e.left >= L.speedFullLeft && e.perfect >= L.perfectFull), `4b ${l}: no line above the bank's least pace (${Math.min(...bank.map((e) => e.left))} ticks left; line ${L.speedFullLeft}) or perfect orbits (${Math.min(...bank.map((e) => e.perfect))}; line ${L.perfectFull})`);
    const sample = FULL ? bank : [bank[0]!, bank[Math.trunc(bank.length / 2)]!, bank[bank.length - 1]!];
    const bad: string[] = [];
    for (const e of sample) {
      const lv = asLevel(l);
      const planets = decodeRev3Planets(e.planets), holes = decodeOrbitHoles(e.holes), extras = decodeOrbitExtras(e.extras);
      // The limits, on their own: every release 24 or more ticks after settling into its orbit, inputs 9 or more apart.
      const taps = new Set(e.taps);
      let s = ladderStart(lv)(planets, ORBIT_REV3_WORLD_W, holes, extras) as OrbitRev3State;
      let settled = 0, last = -1000, orbiting = true, human = true;
      while (!s.ended && s.tick < ORBIT_REV3_RUN_TICKS) {
        const t = s.tick + 1;
        const still = s.flying === 0 && !(s.warp ?? 0) && !(s.hold ?? 0);
        if (still && !orbiting) settled = s.tick;
        orbiting = still;
        if (taps.has(t)) {
          if (!still || t - settled < ORBIT_HUMAN_READY_TICKS || t - last < 9) human = false;
          last = t;
        }
        s = orbitRev3Game.step(s, taps.has(t) ? { t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null) as OrbitRev3State;
        if (s.flying !== 0) orbiting = false;
      }
      const c = orbitXpCounts(s);
      const p = ladderPuzzle(lv, e.seed, planets, holes, extras);
      const g = ladderServerScore(p, () => ladderStart(lv)(planets, ORBIT_REV3_WORLD_W, holes, extras), e.taps);
      const dealt = dealAt("orbit", l, 0) as any;
      if (!human || g.score !== 200 || g.flagged || s.finished !== 1 || c.dust !== c.dustTotal || c.slings !== c.slingsTotal || c.threads !== c.threadsTotal || dealt.orbitRev !== p.orbitRev) bad.push(`${e.seed}: ${g.score}${human ? "" : ", limits broken"}`);
      if (ORBIT_REV3_RUN_TICKS - s.endedTick !== e.left || c.perfect !== e.perfect) bad.push(`${e.seed}: the stored pace or perfect orbits differ`);
    }
    ok(bad.length === 0, `4c ${l}: every sampled bank witness keeps the human limits and scores exactly 200 through the server's grade, every feature taken (${sample.length}${bad.length ? `: ${bad.join("; ")}` : ""})`);
  }
  for (const l of (FULL ? LEVELS : ["easy"]) as Lv[]) {
    const p = Bun.spawnSync(["bun", "scripts/orbit-ladder-bank.ts", "--check", "1", `--level=${l}`], { stdout: "pipe", stderr: "pipe" });
    const out = p.stdout.toString();
    ok(p.exitCode === 0 && /PASS/.test(out), `4d ${l}: the bank's first entry rebuilds byte for byte (${out.trim().split("\n").pop()})`);
  }
}

/* 5. the recorded ladder, and a live re-play sample. */
{
  // The recorded 96-deal figures are reported, not targets (Joe, 27 Nov 2026: sessions don't decide difficulty), so this
  // check no longer holds them to the ladder test; it re-plays a sample to show the figures are today's game.
  for (const [cond, label] of await replaySample("orbit", 1)) ok(cond, `5b: ${label}`);
}

/* 6. The practice challenges count the things themselves. */
{
  const ch = Object.fromEntries(challengesFor("orbit").map((c) => [c.name, c]));
  const met = (n: string, extra: Record<string, number>) => goalMet(ch[n]!.goal, { score: 150, extra: { orbitRev: 17, ...extra } as never });
  ok(Boolean(ch["Slingshot"]) && met("Slingshot", { slings: 4, slingsTotal: 4 }) && !met("Slingshot", { slings: 3, slingsTotal: 4, dust: 30, dustTotal: 30 }), "6a: Slingshot needs all four slingshots (three fill the part on orbitRev 17)");
  ok(Boolean(ch["Stargazer"]) && met("Stargazer", { dust: 30, dustTotal: 30 }) && !met("Stargazer", { dust: 29, dustTotal: 30, slings: 4, slingsTotal: 4 }), "6b: Stargazer needs all the stardust (the part fills earlier)");
}

/* 7. The lever picture (the Games page's) rings the planets each level's courses belt. */
{
  const beltedOn = (b: (typeof LADDER_COURSES)["hard"]["belts"], i: number) => b !== "none" && b !== "normal" && i >= b.from && (i - b.from) % b.every === 0;
  for (const l of ["easy", "hard", "expert"] as OrbitLevelName[]) {
    const b = LADDER_COURSES[l].belts;
    const rule = b === "none" || b === "normal" ? "none" : { from: b.from + 1, every: b.every };
    let same = 0;
    for (let i = 0; i < ORBIT_TOTAL; i++) if (orbitPictureBelted(rule, i + 1) === beltedOn(b, i)) same++;
    const rings = (renderToStaticMarkup(createElement(OrbitPicture, { level: l, size: "l" })).match(/stroke-dasharray/g) ?? []).length;
    const want = Array.from({ length: ORBIT_TOTAL }, (_, i) => i).filter((i) => beltedOn(b, i)).length;
    ok(same === ORBIT_TOTAL && rings === want, `7a ${l}: the lever picture rings the planets the level's courses belt (${rings} drawn, ${want} on the course)`);
  }
  ok(orbitWords("easy") === "No asteroid belts" && orbitWords("hard") === "A belt round every fourth planet" && orbitWords("expert") === "A belt round every third planet" && orbitWords("normal") === "Belts near the sun", "7b: the lever's words follow the same settings");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL orbit-ladder-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS orbit-ladder-check: ${checks} checks`);
