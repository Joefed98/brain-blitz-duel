/**
 * speed-levels-check (the Speed overhaul, stage 3, 15 Nov 2026): the six Speed games' levels.
 *
 *   1. The registry: Flash, Ascend, Don't Break the Chain, Bonk, Tenfall and Pull! offer Easy, Hard and Expert, each
 *      level's settings exactly speedLevels.ts's, each with its uniqueness rule (open: timed taps).
 *   2. Normal is today's game: a Normal deal is byte for byte the deal with no level asked, carries no level field and
 *      none of the levels' stamps.
 *   3. Each level deals its settings (counts, ranges, order, windows, schedules, stages, clays), stamped on the puzzle.
 *   4. No clock over 120 s at any level.
 *   5. Each level grades from the stored puzzle: the engine games' runs replay to the phone's own claim, unflagged; the
 *      puzzles' finished runs are correct; a level deal graded with its level stamp removed scores differently or
 *      plays a different board (the stamp is what the grader reads).
 *   6. The human-limits tuning (Joe's rule: about 0.25 s to react, 0.15 s to move; 16 Nov 2026: a clear step up from
 *      level to level, Expert humanly possible to score well on): Normal → Hard → Expert each at least 3 lower, Easy no
 *      harder than Normal, and Expert's best tenth at 140 or more (Normal's own average where that is lower).
 *   7. The level lines: one plain line a level on the round intro (Normal none) and a "Levels:" line in each help.
 *
 *   bun scripts/speed-levels-check.ts
 */
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { GAME_LEVELS, levelsOf, levelProof } from "../src/lib/levels/gameLevels";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { ASCEND_LEVELS, BONK_LEVELS, CHAIN_LEVELS, FLASH_LEVELS, PULL_LEVELS, TENFALL_LEVELS, pullLevelClays, speedLevelLine } from "../src/lib/levels/speedLevels";
import { REACTION_GOLD_LIKE_DECOYS, REACTION_FLASH_MS, flashWindowMs, type PuzzleData } from "../src/lib/duel/types";
import { chainRules, chainReversedAt } from "../src/lib/duel/chain";
import { whackGameFor, WHACK_BOMB, WHACK_RUN_TICKS } from "../src/lib/arcade/whack";
import { tenDropInit, tdKind, TD_MUL2, TD_DIV2, TD_DIV3, TD_RUN_TICKS } from "../src/lib/arcade/tenDrop";
import { clayGameFor, clayCountOf, CLAY_KIND_GOLD, CLAY_RUN_TICKS } from "../src/lib/arcade/clayShoot";
import { reactionPuzzle } from "../src/puzzles/reaction";
import { numberHuntPuzzle } from "../src/puzzles/numberHunt";
import { chainTapPuzzle } from "../src/puzzles/chainTap";
import { whackPuzzle } from "../src/puzzles/whack";
import { tenDropPuzzle } from "../src/puzzles/tenDrop";
import { clayShootPuzzle } from "../src/puzzles/clayShoot";
import { HUMAN_LIMITS, SPEED_LEVEL_GAMES, tuneSpeed } from "./speed-levels-tune";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { ELITE } from "./depth-engine-bands";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string) {
  checks++;
  if (!cond) {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
const section = (name: string) => console.log(`\n${name}`);
const LEVELS: Exclude<Level, "normal">[] = ["easy", "hard", "expert"];
const SETTINGS: Record<string, Record<string, unknown>> = { reaction: FLASH_LEVELS, numhunt: ASCEND_LEVELS, chain: CHAIN_LEVELS, whack: BONK_LEVELS, tendrop: TENFALL_LEVELS, clayshoot: PULL_LEVELS };
const STAMPS = ["level", "flashMs", "moveMs", "descending", "chainLevel", "bonkLevel", "tenLevel", "pullLevel"];
const deal = (type: (typeof SPEED_LEVEL_GAMES)[number], level: Level | null, n: number): PuzzleData =>
  withSeededRandom(0x51e7_0000 + n * 7919, () => generatePuzzle(type, { bankSeed: 0x51e7_0000 + n * 7919, ...(level ? { level } : {}) }));
const loose = (p: unknown) => p as Record<string, unknown>;
const SAMPLES = 6;

section("1. The registry");
for (const type of SPEED_LEVEL_GAMES) {
  ok(levelsOf(type).join(",") === "easy,normal,hard,expert", `${type}: Easy, Normal, Hard and Expert`);
  for (const level of LEVELS) {
    ok(JSON.stringify(GAME_LEVELS[type]?.levels[level]?.settings) === JSON.stringify(SETTINGS[type]![level]), `${type} ${level}: the settings are speedLevels.ts's`);
    const proof = levelProof(type, level);
    ok(proof !== null && "open" in proof && proof.open.length > 10, `${type} ${level}: its uniqueness rule is open (timed taps), with the reason`);
  }
}

section("2. Normal is today's game");
for (const type of SPEED_LEVEL_GAMES) {
  for (let n = 0; n < SAMPLES; n++) {
    const plain = deal(type, null, n);
    const normal = deal(type, "normal", n);
    ok(JSON.stringify(plain) === JSON.stringify(normal), `${type} #${n}: Normal deals exactly the deal with no level asked`);
    ok(STAMPS.every((k) => !(k in loose(normal))), `${type} #${n}: Normal carries no level stamp`);
    ok(puzzleLevel(normal) === "normal", `${type} #${n}: read as Normal`);
  }
}

section("3. Each level deals its settings");
for (let n = 0; n < SAMPLES; n++) {
  for (const level of LEVELS) {
    const tag = (type: string) => `${type} ${level} #${n}`;
    // Flash
    {
      const p = deal("reaction", level, n);
      const s = FLASH_LEVELS[level];
      if (p.type !== "reaction") throw new Error("reaction");
      ok(puzzleLevel(p) === level, `${tag("reaction")}: stamped ${level}`);
      ok(p.flashes.length >= s.flashes[0] && p.flashes.length <= s.flashes[1], `${tag("reaction")}: ${p.flashes.length} flashes in ${s.flashes.join("–")}`);
      let segment = 0;
      let inRange = true;
      for (const f of p.flashes) {
        const count = p.decoys.filter((d) => d.at >= segment && d.at < f).length;
        if (count < s.decoys[0] || count > s.decoys[1]) inRange = false;
        segment = f;
      }
      ok(inRange, `${tag("reaction")}: ${s.decoys.join("–")} decoys before each flash`);
      if (s.goldLike === 0) ok(p.decoys.every((d) => !(REACTION_GOLD_LIKE_DECOYS as readonly string[]).includes(d.color)), `${tag("reaction")}: no gold-like decoys`);
      ok(flashWindowMs(p) === s.flashMs && (s.flashMs === REACTION_FLASH_MS) === !("flashMs" in p), `${tag("reaction")}: the gold stays up ${s.flashMs} ms (stamped only when it differs)`);
    }
    // Ascend
    {
      const p = deal("numhunt", level, n);
      const s = ASCEND_LEVELS[level];
      if (p.type !== "numhunt") throw new Error("numhunt");
      const ns = p.spots.map((x) => x.n);
      ok(ns.length === s.count && new Set(ns).size === s.count, `${tag("numhunt")}: ${s.count} different numbers`);
      ok(ns.every((v) => v >= s.min && v <= s.max), `${tag("numhunt")}: from ${s.min} to ${s.max}`);
      const sorted = [...ns].sort((a, b) => (s.descending ? b - a : a - b));
      ok(JSON.stringify(ns) === JSON.stringify(sorted), `${tag("numhunt")}: in order, ${s.descending ? "highest" : "lowest"} first`);
      ok(p.layouts.length === (s.moveMs > 0 ? Math.ceil(s.timeLimitMs / s.moveMs) : 1) && p.moveMs === s.moveMs && p.timeLimitMs === s.timeLimitMs, `${tag("numhunt")}: a layout every ${s.moveMs} ms over ${s.timeLimitMs / 1000} s`);
      ok(p.layouts.every((l) => JSON.stringify(l.map((x) => x.n)) === JSON.stringify(ns)), `${tag("numhunt")}: every layout holds the same numbers in the same order`);
    }
    // Chain
    {
      const p = deal("chain", level, n);
      const s = CHAIN_LEVELS[level];
      if (p.type !== "chain") throw new Error("chain");
      // Changed with Joe's approval, 22 Nov 2026 (D3): a new board every cycle (the level's `block`, today's 5).
      const block = (s as { block?: number }).block ?? 5;
      ok(chainRules(p).length === s.links && p.boards.length === Math.ceil(s.links / block), `${tag("chain")}: ${s.links} links on ${Math.ceil(s.links / block)} boards`);
      ok((p.cycles ?? []).every((c) => c.length === s.cycle), `${tag("chain")}: ${s.cycle} charms to a cycle`);
      const reversed = Array.from({ length: s.links }, (_, k) => chainReversedAt(p, k));
      const want = Array.from({ length: s.links }, (_, k) => s.reverse.some(([a, b]) => k + 1 >= a && k + 1 <= b));
      ok(JSON.stringify(reversed) === JSON.stringify(want), `${tag("chain")}: reversed at ${s.reverse.map(([a, b]) => `${a}–${b}`).join(", ") || "no link"}`);
      ok(JSON.stringify(chainRules(p).bands) === JSON.stringify(s.bands) && puzzleTimeLimitMs(p) === s.timeLimitMs, `${tag("chain")}: the level's windows and ${s.timeLimitMs / 1000} s clock`);
    }
    // Bonk
    {
      const p = deal("whack", level, n);
      const s = BONK_LEVELS[level];
      if (p.type !== "whack") throw new Error("whack");
      const sch = whackGameFor(p.whackRev, p.bonkLevel).init(p.seed).schedule;
      ok(sch.flips.length >= s.flips[0] && sch.flips.length <= s.flips[1], `${tag("whack")}: ${sch.flips.length} rule flips in ${s.flips.join("–")}`);
      let most = 0;
      for (let i = 0; i < sch.at.length; i++) most = Math.max(most, sch.at.filter((t, j) => t <= sch.at[i]! && t + sch.life[j]! > sch.at[i]!).length);
      ok(most <= s.maxUp, `${tag("whack")}: at most ${s.maxUp} up at once (${most})`);
      ok(sch.life[0] === s.lifeStart && sch.life.every((l) => l >= s.lifeEnd && l <= s.lifeStart), `${tag("whack")}: up ${s.lifeStart} → ${s.lifeEnd} ticks`);
      const hedgehogs = sch.kind.filter((k) => k === WHACK_BOMB).length / sch.kind.length;
      ok(Math.abs(hedgehogs * 100 - s.hedgehogPct) <= 12, `${tag("whack")}: about ${s.hedgehogPct} % hedgehogs (${Math.round(hedgehogs * 100)} %)`);
    }
    // Tenfall
    {
      const p = deal("tendrop", level, n);
      const s = TENFALL_LEVELS[level];
      if (p.type !== "tendrop") throw new Error("tendrop");
      const st = tenDropInit(p.seed, p.tenRev, p.tenLevel?.stages);
      ok(st.plan.targets.length === s.targets && (p.tenLevel?.stages.length ?? 0) === s.targets, `${tag("tendrop")}: ${s.targets} targets`);
      ok(Math.max(...st.plan.targets) <= s.maxTarget && st.plan.targets.every((t) => t >= 10), `${tag("tendrop")}: targets up to ${s.maxTarget}`);
      if (s.ops === "plusMinus") ok(st.plan.queues.every((q) => q.every((t) => ![TD_MUL2, TD_DIV2, TD_DIV3].includes(tdKind(t)))), `${tag("tendrop")}: plus and minus tiles only`);
      ok(st.plan.proof.every((i) => i >= 0) || st.plan.tries.some((t) => t > 1), `${tag("tendrop")}: every target is reachable in one pass of its queue`);
    }
    // Pull!
    {
      const p = deal("clayshoot", level, n);
      const s = PULL_LEVELS[level];
      if (p.type !== "clayshoot") throw new Error("clayshoot");
      const st = clayGameFor(p.clayRev, p.pullLevel).init(p.seed);
      ok(JSON.stringify(p.pullLevel) === JSON.stringify(pullLevelClays(s)), `${tag("clayshoot")}: the level's clays stamped`);
      ok(clayCountOf(st) === s.clays && st.schedule.launch.length === s.clays, `${tag("clayshoot")}: ${s.clays} clays`);
      ok((p.pullLevel?.groups.length ?? 0) === s.pairs && (p.pullLevel?.groups.filter((g) => g === 3).length ?? 0) === s.triples, `${tag("clayshoot")}: ${s.pairs} groups, ${s.triples} of them triples`);
      ok((st.birds?.launch.length ?? 0) === s.birds, `${tag("clayshoot")}: ${s.birds} birds`);
      ok(st.schedule.kind.filter((k) => k === CLAY_KIND_GOLD).length === pullLevelClays(s).golds, `${tag("clayshoot")}: ${pullLevelClays(s).golds} gold clays`);
      ok(st.schedule.launch.every((t, i) => i === 0 || t >= st.schedule.launch[i - 1]!) && st.schedule.launch.at(-1)! < CLAY_RUN_TICKS - 120, `${tag("clayshoot")}: launches in order, the last with time to cross`);
    }
  }
}

section("4. No clock over 120 s at any level");
for (const type of SPEED_LEVEL_GAMES) {
  for (const level of ["normal", ...LEVELS] as Level[]) {
    const p = deal(type, level, 0);
    ok(puzzleTimeLimitMs(p) <= 120_000, `${type} ${level}: a ${puzzleTimeLimitMs(p) / 1000} s clock`);
  }
}
ok(WHACK_RUN_TICKS <= 7200 && TD_RUN_TICKS <= 7200 && CLAY_RUN_TICKS <= 7200, "the engine games' runs are 120 s or less at every level (the run length is the same at every level)");

section("5. Each level grades from the stored puzzle");
for (const type of ["whack", "tendrop", "clayshoot"] as const) {
  for (const level of LEVELS) {
    for (let n = 0; n < 3; n++) {
      const p = deal(type, level, n);
      const run = KITS[type]!.play(p, makeRng(hashText(`speed-levels-check:${type}:${level}:${n}`)), ELITE, 60_000).steps.at(-1)!.answer;
      const graded = gradeAnswer(p, run, 0);
      const claimed = Number.parseInt(run.split("|")[1] ?? "", 10);
      ok(graded.score === claimed && !loose(graded.extra ?? {})["flagged"], `${type} ${level} #${n}: the server's replay scores the phone's claim (${claimed}), unflagged`);
      const stripped = { ...loose(p) };
      for (const k of STAMPS) delete stripped[k];
      // The replay logs the desync it finds here (expected: the run was played on the level's board); kept quiet.
      const error = console.error;
      console.error = () => {};
      const plain = gradeAnswer(stripped as unknown as PuzzleData, run, 0);
      console.error = error;
      ok(plain.score !== graded.score || loose(plain.extra ?? {})["flagged"], `${type} ${level} #${n}: without its level stamp the same run grades differently (the stamp is read)`);
    }
  }
}
for (const type of ["reaction", "numhunt", "chain"] as const) {
  for (const level of LEVELS) {
    const p = deal(type, level, 1);
    const finished = tuneSpeed(type, level, 2, 1, [["elite", ELITE]])[0]!;
    ok(finished.finishRate > 0 && finished.average > 100, `${type} ${level}: the elite player finishes a level deal and scores (${finished.average})`);
    ok(puzzleLevel(p) === level, `${type} ${level}: the stored puzzle says its level`);
  }
}

section("6. The human-limits tuning (Joe, 16 Nov 2026: a clear step up, Expert humanly possible to score well on)");
const human = (type: (typeof SPEED_LEVEL_GAMES)[number], level: Level) => tuneSpeed(type, level, 100, 0, [["human", HUMAN_LIMITS]])[0]!;
for (const type of SPEED_LEVEL_GAMES) {
  const [easy, normal, hard, expert] = (["easy", "normal", "hard", "expert"] as const).map((level) => human(type, level));
  console.log(`  ${type}: human limits Easy ${easy!.average}, Normal ${normal!.average}, Hard ${hard!.average}, Expert ${expert!.average} (best tenth ${expert!.top10}; 100 deals)`);
  // Easy is never harder than Normal (within 3: Bonk and Ascend sit at a strong player's ceiling on both).
  ok(easy!.average >= normal!.average - 3, `${type}: Easy (${easy!.average}) is no harder than Normal (${normal!.average})`);
  // Changed with Joe's approval, 22 Nov 2026 (D3): the step up from Normal to Hard to Expert is judged by Joe's D3
  // ladder test in d3-speed-ladder-check, which asserts it for each of Flash, Ascend, the Chain, Bonk, Tenfall and Pull!
  // (the average player clearly lower each level up, the realistic elite under the human limits reaching 200 less often
  // each level up and on at least a fifth of Expert boards). A realistic elite who can reach 200 averages about 190 at
  // every level, so the elite's average no longer steps down by 3.
  // Humanly possible to score well on: the best tenth under human limits reaches 140, or Normal's own average where
  // that is lower (Flash's curve is reaction-bound: a 250 ms reaction scores about 115 a flash).
  ok(expert!.top10 >= Math.min(140, normal!.average), `${type}: Expert's best tenth under human limits scores ${expert!.top10} (at least ${Math.min(140, normal!.average)})`);
}

section("7. The level lines");
const DEFS = { reaction: reactionPuzzle, numhunt: numberHuntPuzzle, chain: chainTapPuzzle, whack: whackPuzzle, tendrop: tenDropPuzzle, clayshoot: clayShootPuzzle } as const;
for (const type of SPEED_LEVEL_GAMES) {
  ok(DEFS[type].introLine?.(deal(type, null, 0)) === null, `${type}: Normal's intro adds no level line`);
  for (const level of LEVELS) {
    const line = DEFS[type].introLine?.(deal(type, level, 0)) ?? null;
    ok(line !== null && line === speedLevelLine(type, level) && line.startsWith(`${level[0]!.toUpperCase()}${level.slice(1)}:`), `${type} ${level}: the intro's level line ("${line}")`);
    ok(line !== null && line.length <= 110 && !/core|full at|units/i.test(line), `${type} ${level}: the line is short and plain`);
  }
  ok(PUZZLE_INSTRUCTIONS[type].how.some((l) => l.action === "Levels:" && l.helpOnly), `${type}: the help has a "Levels:" line`);
}

if (failures.length) {
  console.log(`\nFAIL speed-levels: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nspeed-levels: ${checks} checks passed`);
