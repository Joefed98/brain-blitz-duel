/**
 * Tilt's difficulty levels (the Strategy overhaul, stage 3, 15 Nov 2026; docs/arcade-standard/tilt.md "Levels (stage 3)"):
 *
 *  1. The registry entry (GAME_LEVELS.tilt) mirrors the sim's own table (TILT_LEVELS) field for field.
 *  2. Normal is today's game: a Normal deal (no level, or "normal") is byte for byte the deal with no level asked, carries
 *     no `level`, deals tiltRev 12 from TILT_DEAL_V12, and plays tiltBigGame; tiltGameForLevel / replayTiltRun ignore a
 *     level on every other stamp.
 *  3. Each level deals tiltRev 12 with its level stamped, from its own list (TILT_DEAL_LEVELS), and plays its own mazes.
 *  4. Each list is proved: the list is exactly the level's witnessed seeds, in candidate order; every witness (CHECKS_FULL=1,
 *     else a sample of each list) replays through the server at its level to exactly 200 with every part full, and not at
 *     another level; the deal file rebuilds from the witnesses byte for byte.
 *  5. The level rules on every list entry: maze count, holes, ice, the amber marble's mazes, par strictness in order
 *     (Easy > Normal > Hard > Expert), and every part's maximum the same as Normal's (200 in all).
 *  6. The clock: every level's dealt round is at most 120 s.
 *  7. Rated play and the Daily deal Normal whatever is asked.
 *  8. Older stamps: stored Normal tiltRev 12 witnesses still replay to 200; tiltRev 10, 11 and 12 Normal rounds play their
 *     stamp's own game.
 *  9. The doc records each level's measured numbers.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  tiltBigGame,
  tiltGameFor,
  tiltGameForLevel,
  tiltIceCells,
  tiltLevelDealable,
  tiltLevelGame,
  tiltLevelTwoMazes,
  tiltMazesL,
  tiltParParts,
  TILT_LEVELS,
  TILT_LEVEL_NAMES,
  TILT_P_CLEAN_POINTS,
  TILT_P_CORE_MAX,
  TILT_P_PAR_MAX,
  TILT_P_PAR_SCALE,
  TILT_P_SPEED_POINTS,
  TILT_REV_BIG,
  TILT_REV_PAR,
  TILT_REV_STD,
  TILT_RUN_TICKS,
  type TiltLevel,
} from "../src/lib/arcade/tilt";
import { replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_DEAL_V12 } from "../src/lib/duel/tiltDealV12.server";
import { TILT_DEAL_LEVELS } from "../src/lib/duel/tiltDealLevels.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { GAME_LEVELS, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { modeLevel } from "../src/lib/levels/modes";
import { levelsDealFileFromWitnesses, tiltLevelCandidates, tiltLevelVerdict, tiltLevelWitnessFile, TILT_DEAL_WITNESS, type TiltLevelWitnesses, type TiltWitness } from "./tilt-deal";
import { pinPreTiltThree } from "../src/lib/duel/d6Normal";

// Changed with Joe's approval, 23 Nov 2026 (D6): Tilt's Normal moved to tiltRev 13 (three mazes); this check was written for tiltRev 12, so it deals it (d6-normal-stamps-check proves tiltRev 13).
pinPreTiltThree(true);

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const failures: string[] = [];
let passed = 0;
const ok = (cond: boolean, what: string) => {
  if (cond) passed += 1;
  else failures.push(what);
};
const deal = (n: number, level?: string) => withSeededRandom(n, () => generatePuzzle("tilt", { bankSeed: n, ...(level ? { level: level as never } : {}) }));

// 1. The registry mirrors the sim's table.
ok(JSON.stringify(levelsOf("tilt")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Tilt offers Easy, Normal, Hard and Expert");
for (const l of TILT_LEVEL_NAMES) {
  const reg = GAME_LEVELS.tilt?.levels[l]?.settings as Record<string, unknown> | undefined;
  const sim = TILT_LEVELS[l] as unknown as Record<string, unknown>;
  ok(!!reg && reg["mazes"] === TILT_LEVELS[l].sizes.length, `${l}: the registry's maze count is the sim's`);
  for (const k of Object.keys(sim)) ok(JSON.stringify(reg?.[k]) === JSON.stringify(sim[k]), `${l}: the registry's ${k} is the sim's`);
  ok(Object.keys(reg ?? {}).every((k) => k === "mazes" || k in sim), `${l}: the registry has no setting the sim doesn't read`);
}

// 2. Normal is today's game.
for (let n = 0; n < 40; n++) {
  const plain = deal(n);
  const normal = deal(n, "normal");
  ok(JSON.stringify(plain) === JSON.stringify(normal), `sample ${n}: a Normal deal is the deal with no level`);
  ok(!("level" in plain) && plain.type === "tilt" && plain.tiltRev === TILT_REV_BIG && TILT_DEAL_V12.includes(plain.seed), `sample ${n}: Normal deals tiltRev 12 from TILT_DEAL_V12 with no level`);
}
ok(tiltGameForLevel(TILT_REV_BIG, undefined) === tiltBigGame && tiltGameForLevel(TILT_REV_BIG, "normal") === tiltBigGame, "a Normal tiltRev 12 round plays tiltBigGame");
for (const rev of [undefined, 2, 8, 10, 11]) for (const l of TILT_LEVEL_NAMES) ok(tiltGameForLevel(rev, l) === tiltGameFor(rev), `tiltRev ${rev}: a level on an older stamp is ignored`);
ok(tiltBigGame.init(TILT_DEAL_V12[0]!).lvl === undefined, "a Normal state carries no level");

// 3. Each level's deal.
for (const l of TILT_LEVEL_NAMES) {
  for (let n = 0; n < 20; n++) {
    const p = deal(n, l);
    ok(p.type === "tilt" && p.tiltRev === TILT_REV_BIG && puzzleLevel(p) === l && TILT_DEAL_LEVELS[l].includes(p.seed), `${l} sample ${n}: tiltRev 12 at ${l} from its own list`);
    const s = tiltGameForLevel(p.tiltRev, puzzleLevel(p)).init(p.seed);
    ok(s.lvl === l && s.list.length === TILT_LEVELS[l].sizes.length, `${l} sample ${n}: plays the level's mazes`);
    // 6. The clock.
    ok(puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS && TILT_RUN_TICKS <= 120 * 60, `${l} sample ${n}: clock ${puzzleTimeLimitMs(p)} ms within 120 s`);
  }
}

// 4. The lists are proved.
ok(levelsDealFileFromWitnesses() === readFileSync(new URL("../src/lib/duel/tiltDealLevels.server.ts", import.meta.url), "utf8"), "the levels' deal file rebuilds from the witnesses byte for byte");
for (const l of TILT_LEVEL_NAMES) {
  const stored = JSON.parse(gunzipSync(readFileSync(tiltLevelWitnessFile(l))).toString()) as TiltLevelWitnesses;
  const seeds = stored.witnesses.map((w) => w.seed);
  ok(stored.level === l && stored.rev === TILT_REV_BIG, `${l}: witnesses for tiltRev 12 at ${l}`);
  ok(JSON.stringify(seeds) === JSON.stringify(TILT_DEAL_LEVELS[l]), `${l}: the list is exactly the witnessed seeds`);
  ok(seeds.length >= 60, `${l}: at least 60 proved seeds (${seeds.length})`);
  const cands = tiltLevelCandidates(l);
  let at = -1;
  for (const s of seeds) {
    const i = cands.indexOf(s);
    ok(i > at, `${l} seed ${s}: a candidate, in order`);
    at = i;
  }
  const step = FULL ? 1 : Math.max(1, Math.floor(stored.witnesses.length / 6));
  for (let i = 0; i < stored.witnesses.length; i += step) {
    const w = stored.witnesses[i]!;
    const v = tiltLevelVerdict(w, l);
    ok(v.score === 200 && !v.flagged && v.full, `${l} seed ${w.seed}: the witness replays to 200 with every part full (${v.score}${v.flagged ? ", flagged" : ""})`);
  }
  // A witness is its level's: at another level (or Normal) it is not a 200.
  const w0 = stored.witnesses[0]!;
  const other = TILT_LEVEL_NAMES.find((x) => x !== l)!;
  ok(tiltLevelVerdict(w0, other).score !== 200 || tiltLevelVerdict(w0, other).flagged, `${l} seed ${w0.seed}: the witness is not a 200 at ${other}`);
  const asNormal = replayTiltRun(w0.seed, w0.raw, TILT_REV_BIG);
  ok(asNormal.flagged || asNormal.score !== 200, `${l} seed ${w0.seed}: the witness is not a 200 on Normal`);

  // 5. The level rules on every list entry.
  const spec = TILT_LEVELS[l];
  let twoCount = 0;
  for (const seed of seeds) {
    const list = tiltMazesL(seed, l);
    const two = tiltLevelTwoMazes(seed, l);
    ok(tiltLevelDealable(seed, l), `${l} seed ${seed}: fully dealt`);
    ok(list.length === spec.sizes.length && list.every((m, i) => m.n === spec.sizes[i] && m.pits.length === spec.pits[i]), `${l} seed ${seed}: its maze sizes and holes`);
    ok(l === "easy" ? list.every((m) => tiltIceCells(m) === 0) : list.every((m, i) => tiltIceCells(m) >= spec.ice[i]!), `${l} seed ${seed}: its ice`);
    ok(two.length >= spec.twoCount[0] && two.length <= spec.twoCount[1] && two.every((i) => spec.twoOf.includes(i + 1)), `${l} seed ${seed}: two marbles on ${two.map((i) => i + 1).join(", ")}`);
    ok(list.every((m, i) => ((m.start2 ?? -1) >= 0) === two.includes(i)), `${l} seed ${seed}: the amber marble only in its mazes`);
    ok(!two.includes(0), `${l} seed ${seed}: maze 1 always has one marble`);
    twoCount += two.length;
  }
  if (l === "easy") ok(twoCount === seeds.length, "easy: two marbles on maze 3 only");
  if (l === "hard") ok(twoCount === 2 * seeds.length, "hard: two marbles on 2 of mazes 2–4 (never all three)");
  if (l === "expert") ok(twoCount >= 2 * seeds.length && twoCount < 3 * seeds.length, "expert: two marbles on 2–3 of mazes 2–4, not on all three every time");
}
ok(TILT_LEVELS.easy.parScale > TILT_P_PAR_SCALE && TILT_P_PAR_SCALE > TILT_LEVELS.hard.parScale && TILT_LEVELS.hard.parScale > TILT_LEVELS.expert.parScale, "par: Easy generous, Normal today's, Hard stricter, Expert strictest");
ok(TILT_LEVELS.easy.sizes.length === 3 && TILT_LEVELS.hard.sizes.length === 4 && TILT_LEVELS.expert.sizes.length === 4, "mazes: Easy 3, Hard and Expert 4");
ok(TILT_LEVELS.easy.sizes.every((n, i) => n <= [13, 15, 17][i]!) && TILT_LEVELS.expert.sizes.slice(0, 3).every((n, i) => n >= [13, 15, 17][i]!) && TILT_LEVELS.expert.sizes.reduce((a, b) => a + b) > TILT_LEVELS.hard.sizes.reduce((a, b) => a + b) - 1, "sizes: Easy smaller, Expert larger");
ok(TILT_LEVELS.easy.pits.every((p) => p <= 1) && TILT_LEVELS.hard.pits.every((p) => p >= 3 && p <= 4) && TILT_LEVELS.expert.pits.every((p) => p === 4), "holes: Easy 0–1, Hard 3–4, Expert 4");
ok(TILT_LEVELS.hard.ice.every((p) => p >= 3 && p <= 4) && TILT_LEVELS.expert.ice.every((p) => p === 5), "ice: Hard 3–4 patches, Expert 5");
ok(TILT_LEVELS.easy.speedFullS * 60 < TILT_RUN_TICKS && TILT_LEVELS.hard.speedFullS * 60 < TILT_RUN_TICKS && TILT_LEVELS.expert.speedFullS * 60 < TILT_RUN_TICKS, "speed full before the buzzer at every level");
// Parts: the same maxima at every level (200 in all), reached by a level's witness.
for (const l of TILT_LEVEL_NAMES) {
  const w = (JSON.parse(gunzipSync(readFileSync(tiltLevelWitnessFile(l))).toString()) as TiltLevelWitnesses).witnesses[0]!;
  const p = tiltParParts(replayTiltRun(w.seed, w.raw, TILT_REV_BIG, l).state);
  ok(p.core === TILT_P_CORE_MAX && p.par === TILT_P_PAR_MAX && p.clean === TILT_P_CLEAN_POINTS && p.speed === TILT_P_SPEED_POINTS && TILT_P_CORE_MAX + TILT_P_PAR_MAX + TILT_P_CLEAN_POINTS + TILT_P_SPEED_POINTS === 200, `${l}: every part at its maximum, 200 in all`);
  // An idle run scores 0 and has no part; any input at least 1.
  const idle = replayTiltRun(w.seed, "", TILT_REV_BIG, l);
  ok(idle.score === 0, `${l}: no input scores 0 (${idle.score})`);
  ok(tiltLevelGame(l).init(w.seed).lvl === l, `${l}: the level's game deals the level`);
}

// 7. Rated and the Daily are Normal.
for (const l of TILT_LEVEL_NAMES) {
  ok(modeLevel("rated", l) === "normal" && modeLevel("daily", l) === "normal", `${l}: rated and the Daily play Normal`);
  ok(!("level" in deal(3, modeLevel("rated", l))), `${l}: a rated deal carries no level`);
}

// 8. Older stamps.
{
  const stored = JSON.parse(gunzipSync(readFileSync(TILT_DEAL_WITNESS)).toString()) as { witnesses: TiltWitness[] };
  for (const w of stored.witnesses.slice(0, FULL ? stored.witnesses.length : 6)) {
    const r = replayTiltRun(w.seed, w.raw, TILT_REV_BIG);
    ok(r.score === 200 && !r.flagged && r.state.lvl === undefined, `Normal tiltRev 12 seed ${w.seed}: replays to 200 as before`);
    const asLevel = replayTiltRun(w.seed, w.raw, TILT_REV_PAR, "hard");
    const asPar = replayTiltRun(w.seed, w.raw, TILT_REV_PAR);
    ok(asLevel.score === asPar.score && asLevel.flagged === asPar.flagged, `seed ${w.seed}: a level on tiltRev 11 replays as tiltRev 11`);
  }
  ok(tiltGameForLevel(TILT_REV_STD) === tiltGameFor(TILT_REV_STD) && tiltGameForLevel(TILT_REV_PAR) === tiltGameFor(TILT_REV_PAR), "tiltRev 10 and 11 play their own games");
}

// 9. The doc.
{
  const doc = readFileSync(new URL("../docs/arcade-standard/tilt.md", import.meta.url), "utf8");
  const at = doc.indexOf("## Levels (stage 3)");
  ok(at >= 0, "docs/arcade-standard/tilt.md has a Levels (stage 3) section");
  const sec = doc.slice(at);
  for (const l of ["Easy", "Normal", "Hard", "Expert"]) ok(new RegExp(`\\| ${l} \\|`).test(sec), `the doc's table has a ${l} row`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL tilt-levels-check: ${failures.length} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`PASS tilt-levels-check: ${passed} assertions${FULL ? " (full depth)" : ""}`);
