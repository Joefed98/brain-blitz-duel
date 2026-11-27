/**
 * Grappler's difficulty levels (the Action overhaul, 15 Nov 2026; docs/arcade-standard/swing.md "Levels"):
 *
 *  1. Normal is today's game: Normal courses identical to those recorded before the levels and the recorded runs
 *     replaying through the server path to the same score and checkpoints (scripts/fixtures/action-levels-legacy.json.gz,
 *     recorded on de3bec96 by scripts/action-levels-legacy-record.ts); a Normal deal carries no level and is byte for
 *     byte the deal with no level asked for; swingRev 17 and earlier ignore any level; junk reads as Normal;
 *  2. each level's rules and stamped settings: the deal stamps `level` on swingRev 18 and deals from the level's own
 *     proved deal (exactly its witnessed seeds); the state carries it; the registry's settings are the sim's; the reach
 *     in play, the sliding hooks a quarter, the stall limit, the pterodactyl (none on Easy, faster on Hard and Expert),
 *     every stretch lit on Easy, seven dark ledge runs on Expert, Easy's course part full at half the course;
 *     the vine's swing (16 Nov 2026, Joe: levers that test human timing): Normal's and Easy's swing exactly as before,
 *     Hard's and Expert's faster (more gravity on a held vine), so a release a tick off flies a plainly different line;
 *  3. the 120 s rule (the run 90 s at every level);
 *  4. grace: a slip restarts the stretch and never ends the run at any level;
 *  5. 200 reachable at every level: each sampled dealt course's stored witness (scripts/fixtures/swing-level-<level>-
 *     witness.json.gz) scores exactly 200 through the server's grade on the dealt puzzle, unflagged;
 *  6. identical worlds for every player: the same seed and level build the same course and deal the same puzzle; a
 *     level's courses are its own;
 *  7. "King of the swingers" ("Get 70 % of the way on Expert") is possible: its goal is met on every sampled Expert
 *     course's witness.
 *
 *   bun scripts/swing-levels-check.ts [--verbose]   (CHECKS_FULL=1: every dealt course's witness, else 4 a level)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  SWING_CHECKPOINT_INTERVAL, SWING_INPUT_HOLD, SWING_KIND_SWING, SWING_LEVELS, SWING_NO_DARK, SWING_REV_BIG, SWING_REV_SLIDE, SWING_V14_CHASE_PACE,
  SWING_V16_RUN_TICKS, SWING_V16_RUNS, SWING_V17_FULL, SWING_V17_STALL, swingBotKit, swingCheckpoint, swingDarkFrom, swingGameFor,
  swingSlideParts, swingStall, type SwingLevel, type SwingState,
} from "../src/lib/arcade/swing";
import { replaySwingRun } from "../src/lib/duel/swing";
import { SWING_LEVEL_DEAL } from "../src/lib/duel/swingLevelDeal.server";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { challengesFor, goalMet } from "../src/lib/duel/practiceChallenges";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { swingLevelWitness, swingSlideSubmission, type SwingWitness } from "./swing-slide-deal";
import { pinSwingPreLadder } from "../src/lib/duel/arcade.server";
pinSwingPreLadder(true); // Changed with Joe's approval, 26 Nov 2026 (routine consequence of D5's swingRev 19): this check proves swingRev 18's levels.

console.error = () => {};
let checks = 0;
const failures: string[] = [];
const VERBOSE = process.argv.includes("--verbose");
function ok(cond: boolean, label: string): void {
  checks++;
  if (VERBOSE) console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures.push(label);
}
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
const json = (v: unknown) => JSON.stringify(v);
const FULL = process.env.CHECKS_FULL === "1";
const LEVELS: SwingLevel[] = ["easy", "hard", "expert"];
const dealAt = (n: number, level?: string) => withSeededRandom(roomSeed(n), () => generatePuzzle("swing", { bankSeed: roomSeed(n), ...(level ? { level: level as never } : {}) })) as any;
const hold = (t: number, a: number): ArcadeInputEvent => ({ t, k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });

/* 1. Normal is today's game. */
{
  const L = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/action-levels-legacy.json.gz", import.meta.url))).toString()) as {
    swing: { seed: number; course: string; runs: { level: string; events: ArcadeInputEvent[]; score: number; sums: number[] }[] }[];
  };
  const game = swingGameFor(SWING_REV_BIG);
  const courseBad = L.swing.filter((c) => digest(game.init(c.seed)) !== c.course);
  ok(L.swing.length === 6 && courseBad.length === 0, `1a: 6 Normal courses as recorded before the levels${courseBad.length ? ` (differ: ${courseBad.map((c) => c.seed).join(", ")})` : ""}`);
  const runs = L.swing.flatMap((c) => c.runs.map((r) => ({ seed: c.seed, ...r })));
  const runBad = runs.filter((r) => {
    const raw = swingSlideSubmission(r.seed, r.events as never, SWING_REV_BIG);
    const out = replaySwingRun(r.seed, raw, SWING_REV_BIG);
    const normal = replaySwingRun(r.seed, raw, SWING_REV_BIG, undefined, "normal");
    const at = new Map(r.events.map((e) => [e.t, e]));
    let s = game.init(r.seed) as SwingState;
    const sums: number[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, at.get(s.tick + 1) ?? null) as SwingState;
      if (s.tick % SWING_CHECKPOINT_INTERVAL === 0) sums.push(swingCheckpoint(s).checksum);
    }
    return out.flagged || out.score !== r.score || normal.score !== r.score || json(sums) !== json(r.sums);
  });
  ok(runs.length === 18 && runBad.length === 0, `1b: 18 Normal runs (average, great, elite on 6 courses) recorded before the levels replay to the same score and checkpoints${runBad.length ? ` (differ: ${runBad.map((r) => `${r.seed}/${r.level}`).join(", ")})` : ""}`);
  const plain = [0, 1, 2].map((n) => dealAt(n));
  ok(plain.every((p, n) => json(p) === json(dealAt(n, "normal")) && !("level" in p) && p.swingRev === SWING_REV_BIG), "1c: a Normal deal is byte for byte the deal with no level asked for, with no level field");
  ok(swingGameFor(SWING_REV_SLIDE, "hard") === swingGameFor(SWING_REV_SLIDE) && swingGameFor(SWING_REV_BIG, "junk") === swingGameFor(SWING_REV_BIG) && swingGameFor(SWING_REV_BIG, "normal") === swingGameFor(SWING_REV_BIG), "1d: swingRev 17 has no levels; Normal or junk on swingRev 18 is today's game");
  ok(!("lvl" in (game.init(L.swing[0]!.seed) as object)), "1e: a Normal state carries no level");
}

/* 2. Each level's rules and stamped settings. */
ok(json(levelsOf("swing")) === json(["easy", "normal", "hard", "expert"]), "2a: Grappler offers all four levels");
const witnesses = Object.fromEntries(LEVELS.map((lv) => [lv, (JSON.parse(gunzipSync(readFileSync(swingLevelWitness(lv))).toString()) as { witnesses: SwingWitness[] }).witnesses])) as Record<SwingLevel, SwingWitness[]>;
for (const lv of LEVELS) {
  const c = SWING_LEVELS[lv];
  const reg = gameLevelSettings<{ reachPx: number; slidingVines: number; stallTicks: number; pterodactyl: boolean; darkRuns: number; vineSwing: number }>("swing", lv)!;
  ok(reg.vineSwing === c.swing && reg.reachPx * 256 === c.reach && reg.slidingVines === c.sliders.reduce((a, b) => a + b, 0) && reg.stallTicks === c.stall && reg.pterodactyl === c.chasePace > 0 && reg.darkRuns === (c.dark ? c.runs.length : 0), `2b ${lv}: the registry's settings are the sim's`);
  ok(json(witnesses[lv].map((w) => w.seed)) === json(SWING_LEVEL_DEAL[lv]) && SWING_LEVEL_DEAL[lv].length >= 20, `2c ${lv}: the level's deal is exactly its ${SWING_LEVEL_DEAL[lv].length} witnessed courses`);
  const p = dealAt(4, lv);
  ok(puzzleLevel(p) === lv && p.swingRev === SWING_REV_BIG && SWING_LEVEL_DEAL[lv].includes(p.seed), `2d ${lv}: the deal stamps level "${lv}" on swingRev 18 and deals a course from the level's deal`);
  const s = swingGameFor(p.swingRev, p.level).init(p.seed) as SwingState;
  const sliders = s.sliders ?? [];
  const x0 = s.sections![0]!.x0!;
  const len = s.sections![s.sections!.length - 1]!.x1! - x0;
  const perQuarter = [0, 1, 2, 3].map((q) => sliders.filter((sl) => Math.min(3, Math.trunc((4 * (sl.x - x0)) / len)) === q).length);
  ok(s.lvl === lv && json(perQuarter) === json(c.sliders), `2e ${lv}: the state carries its level; sliding hooks a quarter ${json(perQuarter)}`);
  ok(swingStall(s) === c.stall && swingBotKit.reachOf(s) === c.reach, `2f ${lv}: stall limit ${c.stall} ticks, reach ${c.reach / 256} px`);
  ok(c.chasePace === 0 ? s.chaseFrom === s.sections!.length : s.chaseFrom! < s.sections!.length && s.chaseFrom! >= Math.trunc(s.sections!.length / 2), `2g ${lv}: ${c.chasePace === 0 ? "no pterodactyl" : `the pterodactyl over the last quarter at ${c.chasePace / 256} px a tick`}`);
  const ledgeRuns = s.sections!.reduce((n, sec, k) => n + (sec.kind !== SWING_KIND_SWING && (k === 0 || s.sections![k - 1]!.kind === SWING_KIND_SWING) ? 1 : 0), 0);
  ok(ledgeRuns === c.runs.length, `2h ${lv}: ${c.runs.length} ledge runs (${ledgeRuns})`);
  const darkAny = s.sections!.some((_, k) => swingDarkFrom({ ...s, sec: k, hangHook: -1 }) !== SWING_NO_DARK);
  ok(c.dark ? darkAny : !darkAny, `2i ${lv}: ${c.dark ? "the ledge runs go dark" : "every stretch lit"}`);
  // A run that has cleared just past the level's "full at" share: the course part full at the level (on Easy, not at Normal's).
  const k = s.sections!.findIndex((sec) => 1000 * (sec.x1! - x0) >= c.full * len) + 1;
  const at = { ...s, acted: 1, sec: k, secReach: s.sections![k]?.x0 ?? x0 } as SwingState;
  const { lvl: _l, ...asNormal } = at;
  const parts = swingSlideParts(at);
  ok(parts.core === 110 && parts.permille >= c.full && (c.full === SWING_V17_FULL || swingSlideParts(asNormal as SwingState).core < 110), `2j ${lv}: the course part full at ${c.full / 10} % of the way`);
}
ok(SWING_LEVELS.easy.reach > 220 * 256 && SWING_LEVELS.expert.reach < 220 * 256 && SWING_LEVELS.hard.reach === 220 * 256, "2k: Easy's reach longer, Expert's slightly shorter, Hard's Normal's");
ok(SWING_LEVELS.easy.stall > SWING_V17_STALL && SWING_LEVELS.hard.stall < SWING_V17_STALL && SWING_LEVELS.expert.stall < SWING_LEVELS.hard.stall, "2l: the stall limit relaxed on Easy, tighter on Hard, tighter still on Expert");
ok(SWING_LEVELS.hard.chasePace > SWING_V14_CHASE_PACE && SWING_LEVELS.expert.chasePace >= SWING_LEVELS.hard.chasePace && SWING_LEVELS.easy.chasePace === 0, "2m: the pterodactyl faster on Hard and Expert, none on Easy");
ok(SWING_LEVELS.expert.runs.length === 7 && SWING_V16_RUNS.length === 6 && !SWING_LEVELS.easy.dark && SWING_LEVELS.hard.dark, "2n: seven dark ledge runs on Expert (six on Normal and Hard), none on Easy");
ok(SWING_LEVELS.easy.sliders.reduce((a, b) => a + b, 0) < 18 && SWING_LEVELS.hard.sliders.reduce((a, b) => a + b, 0) > 18 && SWING_LEVELS.expert.sliders.reduce((a, b) => a + b, 0) > SWING_LEVELS.hard.sliders.reduce((a, b) => a + b, 0), "2o: few sliding hooks on Easy, more on Hard, a few more on Expert (Normal 18)");

// The vine's swing (Changed with Joe's approval, 16 Nov 2026 (routine consequence of the Action overhaul): the timing lever).
ok(SWING_LEVELS.easy.swing === 100 && SWING_LEVELS.hard.swing > 100 && SWING_LEVELS.expert.swing > SWING_LEVELS.hard.swing, "2p: the vine swings as Normal's on Easy, faster on Hard, faster still on Expert");
{
  // The same body on the same held vine, stepped under each level's rules: the swing's speed after a quarter second, and
  // how far one tick's release apart moves the release point (the timing the level asks for).
  const base = swingGameFor(SWING_REV_BIG).init(dealAt(0).seed) as SwingState;
  const at = (lvl: SwingLevel | null) => {
    const s = { ...base, ...(lvl ? { lvl } : {}) } as SwingState;
    const b = { ...swingBotKit.body(s), rope: 0, len: 130 * 256, grabLen: 130 * 256, th: 55000 * 16, om: 0, reelLeft: 0 } as any;
    for (let t = 0; t < 15; t++) swingBotKit.move(b, s);
    return Math.abs(b.om);
  };
  const [n, e, h, x] = [at(null), at("easy"), at("hard"), at("expert")];
  ok(e === n && h > n && x > h, `2q: a held vine swings faster on Hard and Expert (|ω| after 0.25 s: Normal ${n}, Easy ${e}, Hard ${h}, Expert ${x})`);
}

/* 3. The 120 s rule, and 4. grace. */
for (const lv of [null, ...LEVELS] as (SwingLevel | null)[]) {
  const game = swingGameFor(SWING_REV_BIG, lv ?? undefined);
  const seed = lv ? SWING_LEVEL_DEAL[lv][0]! : dealAt(0).seed;
  ok(game.runTicks === SWING_V16_RUN_TICKS && game.runTicks <= MAX_ROUND_CLOCK_MS * 0.06, `3 ${lv ?? "normal"}: the run is ${game.runTicks / 60} s`);
  let s = game.init(seed) as SwingState;
  while (!game.isOver(s)) s = game.step(s, (s.tick + 1) % 40 === 0 ? hold(s.tick + 1, ((s.tick + 1) / 40) % 2) : null) as SwingState;
  ok((s.restarts ?? 0) >= 2 && s.tick === SWING_V16_RUN_TICKS, `4 ${lv ?? "normal"}: a careless run's ${s.restarts ?? 0} slips never end it (it lasts the 90 s)`);
}

/* 5. 200 reachable, 6. identical worlds, 7. King of the swingers. */
const king = challengesFor("swing").find((c) => c.name === "King of the swingers")!;
ok(king?.level === "expert", "7a: King of the swingers is the Expert challenge");
for (const lv of LEVELS) {
  const sample = FULL ? witnesses[lv] : witnesses[lv].filter((_, i) => i % Math.max(1, Math.trunc(witnesses[lv].length / 4)) === 0).slice(0, 4);
  const bad: string[] = [];
  const kings: string[] = [];
  for (const w of sample) {
    const p = { type: "swing", seed: w.seed, swingRev: SWING_REV_BIG, level: lv } as any;
    const graded = gradeAnswer(p, swingSlideSubmission(w.seed, w.events as never, SWING_REV_BIG, lv), 0);
    if (graded.score !== 200 || (graded.extra as any)?.flagged) bad.push(`${w.seed}: ${graded.score}`);
    if (lv === "expert" && !goalMet(king.goal, { score: graded.score, extra: graded.extra as never })) kings.push(String(w.seed));
  }
  ok(bad.length === 0 && sample.length >= 4, `5 ${lv}: each sampled dealt course's witness scores exactly 200 through the server's grade (${sample.length} courses)${bad.length ? `: ${bad.join(", ")}` : ""}`);
  if (lv === "expert") ok(kings.length === 0, `7b: King of the swingers' goal is met on every sampled Expert course (${sample.length})${kings.length ? `: not on ${kings.join(", ")}` : ""}`);
  const seed = SWING_LEVEL_DEAL[lv][1]!;
  const a = digest(swingGameFor(SWING_REV_BIG, lv).init(seed));
  ok(a === digest(swingGameFor(SWING_REV_BIG, lv).init(seed)) && json(dealAt(6, lv)) === json(dealAt(6, lv)), `6a ${lv}: the same seed and level build the same course and deal the same puzzle`);
  let normal = "";
  try {
    normal = digest(swingGameFor(SWING_REV_BIG).init(seed));
  } catch {
    normal = "no Normal course";
  }
  ok(a !== normal, `6b ${lv}: the level's course is its own (not Normal's for the seed)`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL swing-levels-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS swing-levels-check: ${checks} checks`);
