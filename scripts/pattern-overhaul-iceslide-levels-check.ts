/**
 * pattern-overhaul-iceslide-levels-check (16 Nov 2026, the Pattern overhaul stage 3; src/lib/levels/pattern/
 * iceslide.levels.ts, docs/design/difficulty/README.md): Skid's Easy, Hard and Expert. No browser (happy-dom for the
 * stage).
 *
 *   1. Settings: the four levels, each level's settings as agreed (Easy 8 × 8, 8–12 slides, no holes or thin ice;
 *      Hard 12 × 12, 24–30, more holes; Expert 12 × 14, 28–36, every hazard, 120 s), `oneSolution` open (any route to
 *      the exit counts), every clock at most 120 s.
 *   2. The level banks (iceSlideLevelBank.server.ts): each level's size and SHA-256 build stamp, no copies, every
 *      entry re-proved by a fresh breadth-first search (verifyIceSlideLevelPuzzle: the stored fewest slides is the
 *      board's minimum, in the band, the stored route reaches the exit in it, hazards on the route where asked) and
 *      sampled entries rebuilt from their fixed seeds (all of them with CHECKS_FULL=1; `bun
 *      scripts/iceslide-levels-bank.ts --check` rebuilds the file byte for byte).
 *   3. Deals: every level deals a bank board with the level stamp, today's stamps (slideRev 5, par = the proved
 *      minimum), its own size and clock, no gems; the same seed deals the same board.
 *   4. Normal is byte for byte the deal before levels and older stamps grade exactly as before: 40 live and 10
 *      pre-overhaul deals and their 150 grades against scripts/fixtures/pattern-overhaul-iceslide-levels-normal.json
 *      (recorded on the tree before levels by scripts/pattern-overhaul-iceslide-levels-record.ts); asking for "normal"
 *      deals the same.
 *   5. The grid rule: no level is wider than Normal's 12 squares; Expert grows downwards to more squares than 12 × 12.
 *      The slide rules on a non-square board (a slide down runs to the bottom row of 14; the 12 × 12 default unchanged).
 *   6. A flawless solve (the stored route by the level's speed time) scores 200 at every level; grading reads the
 *      level from the stored puzzle (the same finish at Hard's 38 s scores 200 as Hard, less with the level taken off);
 *      a half-done route gets credit between 1 and 130.
 *   7. Bots: the kit's near-perfect play finishes every level's boards, and the person-like player
 *      (scripts/iceslide-human.ts: a few slides ahead and back, no full search) finishes Expert boards and scores 150+
 *      on some (Expert is humanly possible to score well on).
 *   8. The stage and reveal draw a level board: Expert's 12 × 14 grid, tall shape and 168 squares, Easy's 8 × 8; Normal
 *      keeps its square markup; the help names the level speed times from the settings.
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "PointerEvent", "MouseEvent", "getComputedStyle", "MutationObserver"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");
const { pinPrePatternNov15 } = await import("../src/lib/duel/patternNov15");
const { gameLevelSettings, levelsOf, levelProof } = await import("../src/lib/levels/gameLevels");
const { puzzleLevel, MAX_ROUND_CLOCK_MS } = await import("../src/lib/levels/levels");
const { ICESLIDE_LEVEL_BANKS, ICESLIDE_LEVEL_BANK_BUILD, ICESLIDE_LEVEL_BANK_RETRIES } = await import("../src/lib/duel/iceSlideLevelBank.server");
const { ICESLIDE_BANK_LEVELS, buildIceSlideLevelEntry, iceSlideLevelKey } = await import("../src/lib/duel/iceSlideLevels.server");
const { verifyIceSlideLevelPuzzle } = await import("../src/lib/duel/slide.server");
const { replaySlide, slideBoard, slideOutcome, slideSearch, slideStep } = await import("../src/lib/duel/slide");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { iceSlidePuzzle } = await import("../src/puzzles/iceSlide");
const { KITS } = await import("./puzzle-fairness/kits");
const { SKILLS, hashText, makeRng } = await import("./puzzle-fairness/kit");
const { gradeSteps } = await import("./standard-lib");
const { SKID_ELITE_PERSON, playSkidLikeAPerson } = await import("./iceslide-human");
const { levelEntriesHash } = await import("./iceslide-levels-bank");
const { ICESLIDE_LEVELS_NORMAL_FIXTURE, ICESLIDE_LEVELS_NORMAL_SEEDS, dealNormal, gradeAll } = await import("./pattern-overhaul-iceslide-levels-record");
import type { IceSlideLevelsNormalFixture } from "./pattern-overhaul-iceslide-levels-record";
import type { IceSlideLevelSettings } from "../src/lib/levels/pattern/iceslide.levels";
import type { SlidePuzzleData } from "../src/lib/duel/types";

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else if (failures.length < 60) failures.push(message);
};
const LEVELS = ["easy", "hard", "expert"] as const;
type L = (typeof LEVELS)[number];
const WANT: Record<L, Partial<IceSlideLevelSettings>> = {
  easy: { cols: 8, rows: 8, minMoves: [8, 12], holes: [0, 0], thin: [0, 0], timeLimitMs: 90_000 },
  hard: { cols: 12, rows: 12, minMoves: [24, 30], holes: [5, 8], timeLimitMs: 90_000 },
  expert: { cols: 12, rows: 14, minMoves: [28, 36], timeLimitMs: 120_000 },
};
const deal = (seed: number, level?: string) =>
  withSeededRandom(seed, () => generatePuzzle("iceslide", { bankSeed: seed, ...(level ? { level: level as never } : {}) })) as SlidePuzzleData;
const settingsOf = (level: L) => gameLevelSettings<IceSlideLevelSettings>("iceslide", level)!;

/* 1. Settings. */
check(JSON.stringify(levelsOf("iceslide")) === JSON.stringify(["easy", "normal", "hard", "expert"]), `levels: iceslide offers ${levelsOf("iceslide").join(", ")}`);
for (const level of LEVELS) {
  const s = settingsOf(level);
  for (const [k, v] of Object.entries(WANT[level])) check(JSON.stringify((s as Record<string, unknown>)[k]) === JSON.stringify(v), `${level}: ${k} ${JSON.stringify((s as Record<string, unknown>)[k])}, want ${JSON.stringify(v)}`);
  check(s.timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level}: clock ${s.timeLimitMs}`);
  check(s.minMoves[0] <= s.minMoves[1] && s.fullByS > 0 && s.fullByS * 1000 < s.timeLimitMs, `${level}: band or speed time`);
  check(s.holes[0] <= s.holes[1] && s.walls[0] <= s.walls[1] && s.arrows[0] <= s.arrows[1] && s.portals[0] <= s.portals[1] && s.thin[0] <= s.thin[1], `${level}: a count range is upside down`);
  const proof = levelProof("iceslide", level);
  check(!!proof && "open" in proof && /any route/.test(proof.open), `${level}: oneSolution isn't open (any route counts)`);
}
// "More holes" on Hard than Normal's 2–4; every hazard on Hard and Expert; none of holes or thin ice on Easy.
check(settingsOf("hard").holes[0] > 4, "hard: not more holes than Normal");
for (const level of ["hard", "expert"] as const) {
  const s = settingsOf(level);
  check(s.holes[0] > 0 && s.arrows[0] > 0 && s.portals[0] > 0 && s.thin[0] > 0 && s.routeUsesHazards, `${level}: not every hazard`);
}

/* 2. The banks. */
for (const level of ICESLIDE_BANK_LEVELS) {
  const bank = ICESLIDE_LEVEL_BANKS[level];
  const s = settingsOf(level as L);
  check(bank.length === s.bank && ICESLIDE_LEVEL_BANK_BUILD[level].entries === bank.length, `${level} bank: ${bank.length} boards, want ${s.bank}`);
  check(levelEntriesHash(bank) === ICESLIDE_LEVEL_BANK_BUILD[level].sha256, `${level} bank: SHA-256 doesn't match its build stamp`);
  check(new Set(bank.map(iceSlideLevelKey)).size === bank.length, `${level} bank: copies`);
  const mins = new Set<number>();
  for (const [i, entry] of bank.entries()) {
    const why = verifyIceSlideLevelPuzzle(entry, s);
    check(why === null, `${level} bank ${i}: ${why}`);
    mins.add(entry.minMoves ?? -1);
    // The proof re-done by hand: the BFS minimum is the stored one and the stored route reaches the exit in exactly it.
    const board = slideBoard(entry);
    const found = slideSearch(board);
    check(found?.min === entry.minMoves, `${level} bank ${i}: BFS minimum ${found?.min}, stored ${entry.minMoves}`);
    check(replaySlide(board, (entry.solution ?? "").split("") as never).solved && entry.solution?.length === entry.minMoves, `${level} bank ${i}: the stored route isn't a shortest route to the exit`);
  }
  // The band is used, not bunched at its foot.
  check(mins.size >= Math.min(4, s.minMoves[1] - s.minMoves[0] + 1), `${level} bank: minimums ${[...mins].sort((a, b) => a - b).join(",")}`);
  const sample = FULL ? bank.map((_, i) => i) : [0, 1, 2, 3, Math.floor(bank.length / 2), bank.length - 1];
  for (const i of sample) {
    const rebuilt = buildIceSlideLevelEntry(level, i, ICESLIDE_LEVEL_BANK_RETRIES[level][i]!);
    check(JSON.stringify(rebuilt) === JSON.stringify(bank[i]), `${level} bank ${i}: doesn't rebuild from its seed`);
  }
}
for (const p of ICESLIDE_LEVEL_BANKS.easy) check(p.holes.length === 0 && (p.thin ?? []).length === 0, "easy bank: a hole or thin ice");
for (const p of ICESLIDE_LEVEL_BANKS.expert) check(p.cols === 12 && p.rows === 14, "expert bank: a board not 12 × 14");
for (const p of ICESLIDE_LEVEL_BANKS.hard) check(p.cols === undefined && p.rows === undefined, "hard bank: a 12 × 12 board carries a size");

/* 3. Deals. */
const dealt: Record<L, SlidePuzzleData[]> = { easy: [], hard: [], expert: [] };
for (const level of LEVELS) {
  const s = settingsOf(level);
  const keys = new Set(ICESLIDE_LEVEL_BANKS[level].map(iceSlideLevelKey));
  for (let i = 0; i < 40; i++) {
    const seed = 163_000 + 97 * i;
    const p = deal(seed, level);
    dealt[level].push(p);
    check(puzzleLevel(p) === level, `${level} ${seed}: stamped ${puzzleLevel(p)}`);
    check(p.slideRev === 5 && p.par === p.minMoves && p.gems === undefined, `${level} ${seed}: slideRev ${p.slideRev}, par ${p.par}, gems ${p.gems}`);
    check(keys.has(iceSlideLevelKey(p)) && verifyIceSlideLevelPuzzle(p, s) === null, `${level} ${seed}: not a proved bank board`);
    check((p.cols ?? 12) === s.cols && (p.rows ?? 12) === s.rows, `${level} ${seed}: ${p.cols}×${p.rows}`);
    check(puzzleTimeLimitMs(p) === s.timeLimitMs && puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${level} ${seed}: clock ${puzzleTimeLimitMs(p)}`);
    check((p.timeLimitMs === undefined) === (s.timeLimitMs === 90_000), `${level} ${seed}: timeLimitMs stamp ${p.timeLimitMs}`);
  }
  check(JSON.stringify(deal(163_000, level)) === JSON.stringify(dealt[level][0]), `${level}: the same seed deals another board`);
  check(new Set(dealt[level].map(iceSlideLevelKey)).size >= 30, `${level}: 40 seeds dealt few boards`);
}

/* 4. Normal byte for byte; older stamps grade as before. */
{
  const fx = JSON.parse(readFileSync(ICESLIDE_LEVELS_NORMAL_FIXTURE, "utf8")) as IceSlideLevelsNormalFixture;
  check(fx.live.length === ICESLIDE_LEVELS_NORMAL_SEEDS.length && fx.prePattern.length === 10, "normal: fixture size");
  for (const { seed, puzzle, grades } of fx.live) {
    check(JSON.stringify(dealNormal(seed)) === JSON.stringify(puzzle), `normal ${seed}: the live deal changed`);
    check(JSON.stringify(deal(seed, "normal")) === JSON.stringify(puzzle), `normal ${seed}: asking for Normal deals differently`);
    check(JSON.stringify(gradeAll(puzzle)) === JSON.stringify(grades), `normal ${seed}: a grade changed`);
  }
  const was = pinPrePatternNov15(true);
  try {
    for (const { seed, puzzle, grades } of fx.prePattern) {
      check(JSON.stringify(dealNormal(seed)) === JSON.stringify(puzzle), `normal ${seed}: the pre-overhaul deal changed`);
      check(JSON.stringify(gradeAll(puzzle)) === JSON.stringify(grades), `normal ${seed}: a pre-overhaul grade changed`);
    }
  } finally {
    pinPrePatternNov15(was);
  }
  const n = fx.live[0]!.puzzle as SlidePuzzleData;
  check(n.cols === undefined && n.rows === undefined && n.timeLimitMs === undefined && puzzleLevel(n) === "normal", "normal: carries level fields");
}

/* 5. The grid rule and the rules on a non-square board. */
for (const level of LEVELS) check(WANT[level].cols! <= 12, `${level}: wider than Normal's 12`);
check(WANT.expert.rows! > WANT.expert.cols! && WANT.expert.cols! * WANT.expert.rows! > 144, "expert: doesn't grow downwards past 144 squares");
check(slideStep(155, "D", 12, 14) === 167 && slideStep(167, "D", 12, 14) === null && slideStep(143, "D") === null && slideStep(131, "D") === 143, "rules: a step down on 12 × 14 or 12 × 12");
check(slideStep(7, "R", 8, 8) === null && slideStep(6, "R", 8, 8) === 7 && slideStep(63, "D", 8, 8) === null, "rules: a step on 8 × 8");
{
  const tall = slideBoard({ walls: [], holes: [], start: 0, exit: 167, cols: 12, rows: 14 });
  check(slideOutcome(tall, 0, 0, "D").cell === 156, "rules: a slide down a clear 12 × 14 column doesn't reach row 14");
  check(slideSearch(tall)?.min === 2, "rules: the fewest slides corner to corner on 12 × 14");
  const square = slideBoard({ walls: [], holes: [], start: 0, exit: 143 });
  check(slideOutcome(square, 0, 0, "D").cell === 132 && square.cols === undefined, "rules: the 12 × 12 default changed");
}

/* 6. Flawless 200, grading reads the level, unfinished credit. */
for (const level of LEVELS) {
  const s = settingsOf(level);
  for (const p of dealt[level].slice(0, 12)) {
    const route = p.solution!;
    const limit = puzzleTimeLimitMs(p);
    const g = gradeAnswer(p, route, limit - s.fullByS * 1000);
    check(g.isCorrect && g.score === 200, `${level}: a flawless solve by ${s.fullByS} s grades ${g.isCorrect} ${g.score}`);
    const late = gradeAnswer(p, route, limit - (s.fullByS + 15) * 1000);
    check(late.isCorrect && late.score < 200 && late.score >= 150, `${level}: a solve 15 s after the speed time grades ${late.score}`);
    const half = route.slice(0, Math.floor(route.length / 2));
    const gh = gradeAnswer(p, half, 0);
    check(!gh.isCorrect && gh.score > 0 && gh.score <= 130, `${level}: a half-done route scores ${gh.score}`);
  }
}
{
  // Hard's speed time (40 s) is read from the stored level: the same finish at 38 s is 200 as Hard, less as Normal (30 s).
  const p = dealt.hard[0]!;
  const asHard = gradeAnswer(p, p.solution!, 90_000 - 38_000).score;
  const { level: _level, ...plain } = p as SlidePuzzleData & { level?: string };
  const asNormal = gradeAnswer(plain as SlidePuzzleData, p.solution!, 90_000 - 38_000).score;
  check(asHard === 200 && asNormal < 200, `grading: a 38 s Hard finish scores ${asHard} as Hard, ${asNormal} without the level`);
  // Expert's 120 s clock is the puzzle's own: a finish at 100 s is in time.
  const e = dealt.expert[0]!;
  check(gradeAnswer(e, e.solution!, 20_000).isCorrect, "grading: Expert's clock isn't 120 s");
}

/* 7. Bots. */
for (const level of LEVELS) {
  let finished = 0;
  const sample = dealt[level].slice(0, 12);
  for (const [i, p] of sample.entries()) {
    const steps = KITS.iceslide!.play(p, makeRng(hashText(`iceslide-levels:${level}:${i}`)), SKILLS.near, puzzleTimeLimitMs(p)).steps;
    if (gradeSteps(p, steps).isCorrect) finished++;
  }
  check(finished >= 11, `${level}: the near-perfect kit finished ${finished} of ${sample.length}`);
}
{
  let finished = 0;
  let well = 0;
  const sample = ICESLIDE_LEVEL_BANKS.expert.slice(0, 30);
  for (const p0 of sample) {
    const p = { ...p0, timeLimitMs: 120_000, slideRev: 5, puzzleScoreRev: 3, speedPar: 1, par: p0.minMoves, level: "expert" } as SlidePuzzleData;
    const play = playSkidLikeAPerson(p, SKID_ELITE_PERSON, 120_000);
    const run = gradeSteps(p, play.steps);
    if (run.isCorrect) finished++;
    if (run.score >= 150) well++;
  }
  check(finished >= 6 && well >= 3, `expert: the person-like player finished ${finished} of 30 bank boards, 150+ on ${well}`);
}

/* 8. Stage, reveal, help. */
{
  const play = (p: SlidePuzzleData) =>
    renderToStaticMarkup(React.createElement(iceSlidePuzzle.Stage, { puzzle: p, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {}, onDraftAnswer: () => {} } as never));
  const cellsIn = (html: string) => (html.match(/class="ice-tile[^"]*"|class="ice-rock"/g) ?? []).length;
  const ex = play(dealt.expert[0]!);
  check(/repeat\(12, minmax\(0, 1fr\)\)/.test(ex) && /repeat\(14, minmax\(0, 1fr\)\)/.test(ex), "stage: Expert isn't drawn 12 × 14");
  check(ex.includes("data-ice-tall") && ex.includes(`--ice-ar:${12 / 14}`) && ex.includes("aspect-ratio:12 / 14"), "stage: Expert's rink isn't tall-shaped");
  check(cellsIn(ex) === 168, `stage: Expert draws ${cellsIn(ex)} squares`);
  const easy = play(dealt.easy[0]!);
  check(/repeat\(8, minmax\(0, 1fr\)\)/.test(easy) && !easy.includes("data-ice-tall") && cellsIn(easy) === 64, "stage: Easy isn't a square 8 × 8");
  const normal = play(dealNormal(161_000));
  check(!normal.includes("data-ice-tall") && /repeat\(12, minmax\(0, 1fr\)\)/.test(normal) && cellsIn(normal) === 144 && normal.includes("ice-stage-square relative aspect-square"), "stage: Normal's square rink changed");
  const rev = renderToStaticMarkup(
    React.createElement(iceSlidePuzzle.Reveal, { timeLimitMs: 120_000, puzzle: dealt.expert[0]!, myAnswer: "", myCorrect: false, myMsRemaining: 0, myExtra: null } as never),
  );
  check((rev.match(/data-reveal-board=""/g) ?? []).length === 2 && rev.includes("data-ice-tall") && cellsIn(rev) === 336, "reveal: Expert's two rinks aren't 12 × 14");
  const css = readFileSync("src/polish-pattern/iceslide.css", "utf8");
  check(/\[data-polish="iceslide"\]\[data-ice-tall\] \.ice-stage-square/.test(css) && /\.ice-reveal-board\[data-ice-tall\]/.test(css), "css: no tall rink rules");
  const line = PUZZLE_INSTRUCTIONS.iceslide.how.find((l) => /level/i.test(l.action));
  check(!!line && line.helpOnly === true, "help: no level line (help only)");
  for (const level of LEVELS) check(!!line && line.detail.includes(`${settingsOf(level).fullByS} s on ${level[0]!.toUpperCase()}${level.slice(1)}`), `help: ${level}'s speed time isn't named`);
  check(PUZZLE_INSTRUCTIONS.iceslide.how.filter((l) => !l.helpOnly).length <= 4, "help: more than four intro HOW lines");
}

console.log(`pattern-overhaul-iceslide-levels-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
