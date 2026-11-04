/**
 * The scoring standard's Number games (docs/scoring-standard.md, "Number decisions"): Exact, Operator, Counterweight,
 * Integer Pyramid, Trail, Brimful, Checkout and Ballpark on their `depthRev` one above the live one, Tenfall on
 * tenRev 5 (scored in its sim).
 *
 *  1. Deals: rooms deal the new stamps; pinPreStandard(true) deals the live ones.
 *  2. Worked examples (room seed 5000, worked by hand below) through the real gradeAnswer with the phone's answer and
 *     draft timeline (sentAnswer): a fast finish, a slow finish, half done, blank = 0; the history-based clean bonuses
 *     (a wrong pyramid number, a trail tile undone, Operator's wrong try) and no timeline = no clean bonus.
 *  3. Kit play on room seeds: medians nothing ≤ spam < average < good ≤ great ≤ near (equal only at 200), spam near
 *     0, every finish above every unfinished credit (Ballpark: a finish never below the same answer's unfinished
 *     credit), whole scores 0–200.
 *  4. Tenfall: the formula's anchors, the sim's early sum, a scripted run graded by the server, kit bands.
 *  5. Texts: the help and intro state the standard's numbers.
 *
 *   bun scripts/standard-number-check.ts
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { encodeBalance, type Placement } from "../src/lib/duel/balance";
import { joinCheckoutRound } from "../src/lib/duel/checkout";
import { joinCountSuffix } from "../src/lib/duel/moveLimits";
import { encodeMeasureRound, decodeMeasureActions } from "../src/lib/duel/measure";
import { npEncodeRound, type NpPlacements } from "../src/lib/duel/numberPyramid";
import { encodeNumline, gradeNumlineItems, NUMLINE_SCALE } from "../src/lib/duel/numline";
import { joinStages } from "../src/lib/duel/stagedRounds";
import { encodeSteps, solveWithAllSixTiles } from "../src/lib/duel/target";
import { trEncode, trSlots } from "../src/lib/duel/trail";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { STANDARD_STAMPS, pinPreStandard, usesStandard } from "../src/lib/duel/standard/stamps";
import { standardNumberHelp, standardNumberIntro } from "../src/lib/duel/standard/numberText";
import { checkoutBigBoards, exactCloseCredit } from "../src/lib/duel/standard/number";
import { exactMinTiles } from "../src/lib/duel/standard/number.server";
import { fillMax } from "../src/lib/duel/roundMax";
import { TEN_DROP_STANDARD_REV, TD_RUN_TICKS, tenDropInit, tenDropScore } from "../src/lib/arcade/tenDrop";
import type {
  BalancePuzzleData,
  CheckoutPuzzleData,
  EquationPuzzleData,
  MeasurePuzzleData,
  NumberPyramidPuzzleData,
  NumlinePuzzleData,
  PuzzleData,
  PuzzleType,
  TargetNumberPuzzleData,
  TrailPuzzleData,
} from "../src/lib/duel/types";
import { roomPuzzle } from "./puzzle-fairness/run";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { kitBands, median, sentAnswer } from "./standard-lib";
import { playTenDropPerfect } from "./tendrop-depth-player";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, message: string): void {
  checks++;
  if (!cond) failures.push(message);
}
function eq(name: string, got: unknown, want: unknown): void {
  ok(JSON.stringify(got) === JSON.stringify(want), `${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
const quiet = <T>(fn: () => T): T => {
  const e = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = e;
  }
};

const PUZZLES = ["target", "equation", "balance", "numpyramid", "trail", "measure", "checkout", "numline"] as const;
const LIVE: Record<(typeof PUZZLES)[number] | "tendrop", number> = { target: 2, equation: 1, balance: 1, numpyramid: 1, trail: 1, measure: 2, checkout: 2, numline: 1, tendrop: 4 };

type Draft = { answer: string; atMs: number };
/** Grades the phone's answer after these drafts, submitted with `msLeft` on the clock. */
const send = (p: PuzzleData, drafts: Draft[], msLeft: number) => gradeAnswer(p, sentAnswer(p, drafts), msLeft);
const scoreOf = (p: PuzzleData, drafts: Draft[], msLeft: number) => send(p, drafts, msLeft).score;

/* ------------------------------------------------------------------ 1. deals */
for (const type of [...PUZZLES, "tendrop"] as const) {
  const st = STANDARD_STAMPS[type]!;
  ok(st !== undefined && st.live === LIVE[type] && st.rev === LIVE[type] + 1, `${type}: stamp ${st?.key} ${st?.live} → ${st?.rev}`);
  const made = generatePuzzle(type as PuzzleType) as unknown as Record<string, unknown>;
  eq(`${type}: rooms deal ${st.key} ${st.rev}`, made[st.key], st.rev);
  ok(usesStandard(made as unknown as PuzzleData), `${type}: a new deal is on the standard`);
  ok(st.timed === (type !== "target" && type !== "tendrop"), `${type}: timed ${st.timed}`);
  pinPreStandard(true);
  const old = generatePuzzle(type as PuzzleType) as unknown as Record<string, unknown>;
  pinPreStandard(false);
  eq(`${type}: pinned before the standard, ${st.key} ${st.live}`, old[st.key], st.live);
  ok(!usesStandard(old as unknown as PuzzleData), `${type}: the pinned deal is graded as before`);
}

/* ------------------------------------------------------------------ 2. worked examples (room seed 5000) */
const SEED = 5000;
const P = Object.fromEntries(PUZZLES.map((t) => [t, roomPuzzle(t, SEED)])) as Record<(typeof PUZZLES)[number], PuzzleData>;
for (const t of PUZZLES) {
  ok(usesStandard(P[t]), `${t} ${SEED}: on the standard stamp`);
  eq(`${t}: blank scores 0`, gradeAnswer(P[t], KITS[t]!.nothing(P[t]), 0).score, 0);
}

// Exact: tiles 8 8 4 100 4 1, target 468; the stored answer 8+8=16, 100+16=116, 4×116=464, 4+464=468 uses five numbers,
// the fewest (a depth deal's target never has a four-number answer). 75 s clock, speed 35 full by 30 s (45 s window).
{
  const p = P.target as TargetNumberPuzzleData;
  eq("Exact: the seed's target", [p.tiles, p.target], [[8, 8, 4, 100, 4, 1], 468]);
  eq("Exact: fewest numbers", exactMinTiles(p.tiles, p.target), 5);
  const steps = (n: number) => encodeSteps(p.solution.slice(0, n));
  // Fast (20 s): 150 + 35 + 15 elegance = 200.
  eq("Exact fast", scoreOf(p, [{ answer: steps(4), atMs: 20_000 }], 55_000), 200);
  // Slow (57 s, 18 s left): speed 35 × 18 ÷ 45 = 14 → 150 + 14 + 15 = 179.
  eq("Exact slow", scoreOf(p, [{ answer: steps(4), atMs: 57_000 }], 18_000), 179);
  // All six numbers (20 s): elegance 15 − 5 = 10 → 195.
  const six = solveWithAllSixTiles(p.tiles, p.target)!;
  eq("Exact with six numbers", scoreOf(p, [{ answer: encodeSteps(six), atMs: 20_000 }], 55_000), 195);
  // Three steps made (best 464, 4 away): 129 × 0.93⁴ = 96.5 → 96.
  eq("Exact 4 away", scoreOf(p, [{ answer: steps(3), atMs: 74_000 }], 0), 96);
  eq("Exact curve: off by 1", Math.round(exactCloseCredit(1)), 120);
  // Two steps (best 116, 352 away): nothing.
  eq("Exact half way, far off", scoreOf(p, [{ answer: steps(2), atMs: 74_000 }], 0), 0);
}

// Operator: four equations, 90 s clock, speed 40 full by 60 s (30 s window), 2.5 per equation right first time.
{
  const p = P.equation as EquationPuzzleData;
  // gapsRev 1 (puzzle polish, 3 Nov 2026): the stored fills; the signs-only stamp: the operator sets.
  const ops = p.gapAnswers ?? p.operators!.map((o) => o.join(","));
  const ans = (right: number, tries: number[]) => joinCountSuffix(joinStages(ops.map((o, i) => (i < right ? o : "")), 4), tries);
  const drafts = (times: number[], tries: number[][]) => times.map((t, i) => ({ answer: ans(i + 1, tries[i]!), atMs: t }));
  // Fast: each right on its first try, the last at 50 s → 150 + 40 + 10 = 200.
  eq("Operator fast", scoreOf(p, drafts([10_000, 25_000, 40_000, 50_000], [[1, 0, 0, 0], [1, 1, 0, 0], [1, 1, 1, 0], [1, 1, 1, 1]]), 40_000), 200);
  // Slow: the third took a second try, done at 75 s (15 s left): speed 40 × 15 ÷ 30 = 20, clean 3 × 2.5 = 7.5 → 8 → 178.
  eq("Operator slow", scoreOf(p, drafts([20_000, 40_000, 60_000, 75_000], [[1, 0, 0, 0], [1, 1, 0, 0], [1, 1, 2, 0], [1, 1, 2, 1]]), 15_000), 178);
  // Half: two right first time at 20 s and 40 s, a wrong try on the third: 60 + 2.5 × 70⁄90 + 2.5 × 50⁄90 + 5 = 68.3 → 68.
  const half = [...drafts([20_000, 40_000], [[1, 0, 0, 0], [1, 1, 0, 0]]), { answer: joinCountSuffix(joinStages([ops[0]!, ops[1]!, "-,-,-,-", ""], 4), [1, 1, 1, 0]), atMs: 50_000 }];
  eq("Operator half", scoreOf(p, half, 0), 68);
}

// Counterweight: four scales (2, 3, 4 and 5 weights: par 14 hangs), 120 s clock, speed 35 full by 60 s (60 s window).
{
  const p = P.balance as BalancePuzzleData;
  const sol = p.solutions!;
  const ans = (scales: number, hangs: number[]) => {
    const placements: Placement[] = p.scales.map((s, i) => (i < scales ? sol[i]!.map((x) => x) : s.tray.map(() => null)));
    return joinCountSuffix(encodeBalance(placements), hangs);
  };
  const tray = p.scales.map((s) => s.tray.length);
  eq("Counterweight: trays", tray, [2, 3, 4, 5]);
  const hangsAfter = (n: number, extra = 0) => tray.map((t, i) => (i < n ? t + (i === 3 ? extra : 0) : 0));
  const run = (times: number[], extra = 0) => times.map((t, i) => ({ answer: ans(i + 1, hangsAfter(i + 1, i === 3 ? extra : 0)), atMs: t }));
  // Fast: each weight hung once, done at 50 s → 150 + 35 + 15 = 200.
  eq("Counterweight fast", scoreOf(p, run([10_000, 20_000, 35_000, 50_000]), 70_000), 200);
  // Slow: 18 hangs (4 over par), done at 96 s (24 s left): speed 35 × 24 ÷ 60 = 14, par 15 × (28 − 18) ÷ 14 = 10.7 → 11 → 175.
  eq("Counterweight slow", scoreOf(p, run([20_000, 45_000, 70_000, 96_000], 4), 24_000), 175);
  // Half: two scales at 15 s and 40 s: 60 + 2.5 × 105⁄120 + 2.5 × 80⁄120 = 63.9 → 64.
  eq("Counterweight half", scoreOf(p, run([15_000, 40_000]), 0), 64);
}

// Integer Pyramid: four pyramids, 120 s clock, speed 40 full by 75 s (45 s window), 2.5 per pyramid with no wrong number.
{
  const p = P.numpyramid as NumberPyramidPuzzleData;
  const full = p.pyramids.map((board, b) => {
    const used = new Set<number>();
    const pl: NpPlacements = {};
    board.givens.forEach((g, cell) => {
      if (g != null) return;
      const t = board.tray.findIndex((v, i) => v === p.solutions![b]![cell] && !used.has(i));
      used.add(t);
      pl[cell] = t;
    });
    return pl;
  });
  const boards = (n: number): NpPlacements[] => p.pyramids.map((_, b) => (b < n ? full[b]! : {}));
  const run = (times: number[]) => times.map((t, i) => ({ answer: npEncodeRound(i + 1, boards(i + 1)), atMs: t }));
  // Fast: all four clean, done at 70 s (50 s left) → 150 + 40 + 10 = 200.
  eq("Pyramid fast", scoreOf(p, run([15_000, 35_000, 50_000, 70_000]), 50_000), 200);
  // Slow, one wrong number on pyramid 2 (a decoy dropped on a cell, then replaced), done at 105 s (15 s left):
  // speed 40 × 15 ÷ 45 = 13.3 → 13, clean 3 × 2.5 = 7.5 → 8 → 171.
  const b2 = p.pyramids[1]!;
  const decoy = b2.tray.findIndex((_, i) => !Object.values(full[1]!).includes(i));
  const wrongCell = Number(Object.keys(full[1]!)[0]);
  const slow = [...run([30_000]), { answer: npEncodeRound(1, [full[0]!, { [wrongCell]: decoy }, {}, {}]), atMs: 40_000 }, ...run([30_000, 60_000, 85_000, 105_000]).slice(1)];
  eq("Pyramid slow with a wrong number", scoreOf(p, slow, 15_000), 171);
  // Half: two pyramids, clean, at 30 s and 60 s, nothing on the third: 120 × 2⁄4 + 2.5 × 90⁄120 + 2.5 × 60⁄120 + 5 = 68.1 → 68.
  eq("Pyramid half", scoreOf(p, run([30_000, 60_000]), 0), 68);
  // No timeline, no history: the fast finish without its timeline keeps no clean bonus → 190.
  eq("Pyramid fast, no timeline", gradeAnswer(p, npEncodeRound(4, boards(4)), 50_000).score, 190);
}

// Trail: 26 squares to fill, 120 s clock, speed 40 full by 60 s (60 s window), 10 for a path with nothing undone.
{
  const p = P.trail as TrailPuzzleData;
  const g = p.givens;
  const sol = p.solution!;
  const toPlace = g.filter((x) => x === null).length;
  eq("Trail: squares to fill", toPlace, 26);
  const pathWith = (k: number) => {
    // The solution's path up to its k-th square to fill.
    let n = 0;
    let end = 0;
    while (end < sol.length && n < k) {
      if (g[sol[end]!] === null) n++;
      end++;
    }
    return sol.slice(0, end);
  };
  const finish = trEncode(trSlots(g, sol));
  // Fast: drawn by 55 s, never undone → 150 + 40 + 10 = 200.
  eq("Trail fast", scoreOf(p, [{ answer: trEncode(pathWith(13)), atMs: 30_000 }, { answer: finish, atMs: 55_000 }], 65_000), 200);
  // Slow with an undo (a square drawn off the solution, then taken back), done at 100 s (20 s left):
  // speed 40 × 20 ÷ 60 = 13.3 → 13, clean 0 → 163.
  const half = pathWith(13);
  const off = Array.from({ length: 36 }, (_, c) => c).find((c) => !half.includes(c) && c !== sol[half.length] && g[c] === null)!;
  const undone = [{ answer: trEncode(half), atMs: 40_000 }, { answer: trEncode([...half, off]), atMs: 45_000 }, { answer: trEncode(half), atMs: 50_000 }, { answer: finish, atMs: 100_000 }];
  eq("Trail slow with an undo", scoreOf(p, undone, 20_000), 163);
  // Half: 13 of 26 squares right by 60 s: 120 × 13⁄26 + 13 × 10⁄26 × (1 − 60⁄120) = 60 + 2.5 = 62.5 → 63.
  eq("Trail half", scoreOf(p, [{ answer: trEncode(half), atMs: 60_000 }], 0), 63);
  // No timeline: no clean bonus → 190.
  eq("Trail fast, no timeline", gradeAnswer(p, finish, 65_000).score, 190);
}

// Brimful: four puzzles, par 4 + 8 + 8 + 11 = 31 pours, 120 s clock, speed 35 full by 60 s (60 s window).
{
  const p = P.measure as MeasurePuzzleData;
  eq("Brimful: par", p.par, [4, 8, 8, 11]);
  const sol = p.solutions!.map((s, i) => decodeMeasureActions(s, p.boards[i]!.caps.length));
  const answer = (n: number, waste = 0) => encodeMeasureRound(sol.map((s, i) => (i < n ? (i < waste ? [{ kind: "fill", jug: 1 } as const, { kind: "empty", jug: 1 } as const, ...s] : s) : [])));
  const run = (times: number[], waste = 0) => times.map((t, i) => ({ answer: answer(i + 1, waste), atMs: t }));
  // Fast: every puzzle at par, done at 50 s → 150 + 35 + 15 = 200.
  eq("Brimful fast", scoreOf(p, run([10_000, 25_000, 38_000, 50_000]), 70_000), 200);
  // Slow: a wasted fill and empty on the first two puzzles (35 pours), done at 96 s (24 s left):
  // speed 35 × 24 ÷ 60 = 14, par 15 × (62 − 35) ÷ 31 = 13.1 → 13 → 177.
  eq("Brimful slow", scoreOf(p, run([20_000, 45_000, 70_000, 96_000], 2), 24_000), 177);
  // Half: two puzzles at 20 s and 50 s: 60 + 2.5 × 100⁄120 + 2.5 × 70⁄120 = 63.5 → 64.
  eq("Brimful half", scoreOf(p, run([20_000, 50_000]), 0), 64);
}

// Checkout: five boards (fewest darts 2 + 2 + 3 + 2 + 4 = 13), 90 s clock, speed 30 full by 60 s (30 s window). Boards 3
// (328), 4 (234) and 5 (103) are 100+ checkouts a big finish can end: 10 ÷ 3 each. The stored routes end boards 3 and 5
// on a treble (a big finish on a double board), board 4 on its own treble ring (not a big finish).
{
  const p = P.checkout as CheckoutPuzzleData;
  eq("Checkout: big-finish boards", checkoutBigBoards(p.stages), [false, false, true, true, true]);
  const routes = p.routes!;
  const run = (times: number[]) => times.map((t, i) => ({ answer: joinCheckoutRound(routes.map((r, k) => (k <= i ? r : ""))), atMs: t }));
  // Fast: fewest darts (10) and two big finishes (6.7), done at 50 s → 150 + 30 + 16.7 → 17 = 197.
  eq("Checkout fast", scoreOf(p, run([8_000, 16_000, 28_000, 40_000, 50_000]), 40_000), 197);
  // Slow: done at 75 s (15 s left): speed 30 × 15 ÷ 30 = 15 → 182.
  eq("Checkout slow", scoreOf(p, run([10_000, 25_000, 45_000, 60_000, 75_000]), 15_000), 182);
  // Half: boards 1–3 at 10, 20 and 40 s: 72 + 2 × (80 + 70 + 50)⁄90 + 10⁄3 (board 3's big finish) = 79.8 → 80.
  eq("Checkout half", scoreOf(p, run([10_000, 20_000, 40_000]), 0), 80);
}

// Ballpark: 15 numbers, 90 s clock, speed 20 full by 60 s (30 s window) × average accuracy, 2 per bullseye (within 1 %).
let joe: { before: number; after: number } | null = null;
{
  const p = P.numline as NumlinePuzzleData;
  const truth = gradeNumlineItems(p.stages, p.values!, "", p.numlineRev).map((r) => r.truth);
  const at = (offs: number[]) => truth.map((t, i) => {
    const o = offs[i] ?? 0;
    return t + o <= NUMLINE_SCALE ? t + o : t - o;
  });
  const placedOver = (spots: number[], times: number[]) => spots.map((_, i) => ({ answer: encodeNumline(spots.slice(0, i + 1)), atMs: times[i]! }));
  const every = (ms: number) => Array.from({ length: 15 }, (_, i) => Math.round((ms * (i + 1)) / 15));
  // Fast: every number on its spot (15 bullseyes), done at 25 s → 150 + 20 + 30 = 200.
  eq("Ballpark fast", scoreOf(p, placedOver(at([]), every(25_000)), 65_000), 200);
  // Slow: every number on its spot, done at 85 s (5 s left): speed 20 × 5 ÷ 30 = 3.3 → 3 → 183.
  eq("Ballpark slow", scoreOf(p, placedOver(at([]), every(85_000)), 5_000), 183);
  // Half: 8 on their spots at 4, 8, … 32 s: 8 × 8 + 10⁄15 × Σ(1 − t⁄90) + 16 = 64 + 10⁄15 × 6.4 + 16 = 84.3 → 84.
  const eight = at([]).slice(0, 8);
  eq("Ballpark half", scoreOf(p, placedOver(eight, [4, 8, 12, 16, 20, 24, 28, 32].map((s) => s * 1000)), 0), 84);
  // Joe's board: 12 numbers 1.5 % off (full accuracy, no bullseye) and 3 numbers 5 % off ((15 − 5) ⁄ 13 = 0.769 each),
  // done at 70 s (20 s left): accuracy (12 + 3 × 0.769) ⁄ 15 = 0.954 → 143; speed 20 × 20 ÷ 30 × 0.954 = 12.7 → 13 → 156.
  const offs = Array.from({ length: 15 }, (_, i) => (i % 5 === 4 ? 500 : 150));
  const joeDrafts = placedOver(at(offs), every(70_000));
  const after = scoreOf(p, joeDrafts, 20_000);
  eq("Ballpark: Joe's board after", after, 156);
  pinPreStandard(true);
  const live = roomPuzzle("numline", SEED);
  pinPreStandard(false);
  const before = gradeAnswer(live, joeDrafts[joeDrafts.length - 1]!.answer, 20_000).score;
  joe = { before, after };
  ok(before < after, `Ballpark: Joe's board scored ${before} before`);
}

/* ------------------------------------------------------------------ 3. kit play */
const KIT_SEEDS = Array.from({ length: 10 }, (_, i) => 6100 + i * 7);
const bandLines: string[] = [];
for (const type of [...PUZZLES, "tendrop"] as const) {
  const rows = quiet(() => kitBands(type as PuzzleType, KIT_SEEDS));
  const m = Object.fromEntries(rows.map((r) => [r.level, median(r.scores)])) as Record<string, number>;
  bandLines.push(`${type.padEnd(10)} ${["nothing", "spam", "average", "good", "great", "near"].map((l) => `${l} ${m[l]}`).join(" · ")}`);
  ok(m.nothing === 0, `${type}: nothing scores ${m.nothing}`);
  ok(m.spam! <= 10, `${type}: spam median ${m.spam}`);
  ok(m.spam! < m.average!, `${type}: spam ${m.spam} < average ${m.average}`);
  ok(m.average! < m.good!, `${type}: average ${m.average} < good ${m.good}`);
  ok(m.good! < m.great! || (m.good === 200 && m.great === 200), `${type}: good ${m.good} < great ${m.great}`);
  ok(m.great! < m.near! || (m.great === 200 && m.near === 200), `${type}: great ${m.great} < near ${m.near}`);
  for (const r of rows) for (const s of r.scores) ok(Number.isInteger(s) && s >= 0 && s <= 200, `${type} ${r.level}: score ${s}`);
}
// Every finish beats every unfinished credit (kit plays and their drafts at the buzzer): unfinished ≤ 130 < 150 ≤ finish.
for (const type of PUZZLES) {
  if (type === "numline") continue;
  const kit = KITS[type]!;
  let maxOpen = -1;
  let minDone = 999;
  for (const seed of KIT_SEEDS.slice(0, 5)) {
    const p = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(p);
    for (const level of ["average", "good", "near"] as const) {
      const play = kit.play(p, makeRng(hashText(`stdnum:${type}:${seed}:${level}`)), SKILLS[level], limit * 2);
      for (let i = 0; i < play.steps.length; i += Math.max(1, Math.floor(play.steps.length / 12))) {
        const g = gradeAnswer(p, sentAnswer(p, play.steps.slice(0, i + 1)), 0);
        if (g.isCorrect) minDone = Math.min(minDone, g.score);
        else maxOpen = Math.max(maxOpen, g.score);
      }
    }
  }
  ok(maxOpen <= 130 && (minDone === 999 || minDone >= 150), `${type}: unfinished at most ${maxOpen}, finishes from ${minDone}`);
}
// Ballpark: a finish never scores below the same answer's unfinished credit (120 A + early ≤ 10 A + bullseyes − wild).
{
  const kit = KITS.numline!;
  for (const seed of KIT_SEEDS) {
    const p = roomPuzzle("numline", seed);
    for (const sp of kit.spam(p, makeRng(hashText(`stdnum:numline:${seed}`)), 90_000)) {
      const g = gradeAnswer(p, sp.answer, 0);
      const x = g.extra as { accuracy: number; bullseyes: number; wild: number };
      const unfinished = 120 * x.accuracy + 10 * x.accuracy + Math.min(30, 2 * x.bullseyes) - x.wild;
      ok(!g.isCorrect || g.score >= Math.floor(unfinished), `Ballpark ${seed} ${sp.label}: finish ${g.score} below its unfinished credit ${unfinished}`);
    }
  }
}

/* ------------------------------------------------------------------ 4. Tenfall */
{
  const R = TEN_DROP_STANDARD_REV;
  // All ten with the last at 50 s (3000 ticks, 2400 left ≥ 1800): 150 + 30 + 3 gold × 2 = 186.
  eq("Tenfall fast", tenDropScore(10, 3000, R, 0, 3), 186);
  // All ten at 80 s (4800 ticks, 600 left): 150 + ⌊30 × 600 ÷ 1800⌋ = 160.
  eq("Tenfall slow", tenDropScore(10, 4800, R, 7, 0), 160);
  // Five at 10, 20, 30, 40 and 50 s (ticks left 4800 + 4200 + 3600 + 3000 + 2400 = 18000), two gold, six resets:
  // ⌊(12 × 5 × 5400 + 18000) ÷ 5400⌋ = 63, + 4 gold, − 5 × (6 − 4) = 57.
  eq("Tenfall half", tenDropScore(5, 3000, R, 6, 2, 18_000), 57);
  eq("Tenfall nothing", tenDropScore(0, TD_RUN_TICKS, R), 0);
  eq("Tenfall unfinished cap", tenDropScore(9, 600, R, 0, 9, 9 * 5000), 130);
  eq("Tenfall top", tenDropScore(10, 600, R, 0, 10), 200);
  eq("Tenfall: tenRev 4 unchanged", tenDropScore(10, 2700, 4, 0, 0), 175);
  ok("earlyTicks" in tenDropInit(1, R) && !("earlyTicks" in tenDropInit(1, 4)), "Tenfall: only tenRev 5 carries the early sum");
  // A scripted best run on a room seed, graded by the server: the score is the formula on the run's own state.
  const p = roomPuzzle("tendrop", SEED) as PuzzleData & { seed: number; tenRev: number };
  eq("Tenfall: rooms deal tenRev 5", p.tenRev, R);
  const run = playTenDropPerfect(p.seed, R);
  const g = quiet(() => gradeAnswer(p, run.raw, 0));
  const s = run.state;
  eq("Tenfall scripted run", g.score, tenDropScore(s.cleared, s.clearTick, R, s.resets, s.goldTens ?? 0, s.earlyTicks ?? 0));
  ok(g.isCorrect && g.score >= 150, `Tenfall scripted run finishes (${g.score})`);
}

/* ------------------------------------------------------------------ 5. texts */
for (const type of [...PUZZLES, "tendrop"] as const) {
  eq(`${type}: the "?" help is the standard's`, PUZZLE_INSTRUCTIONS[type].score, standardNumberHelp(type));
  ok(/\b150\b/.test(standardNumberHelp(type)) && /\b200\b/.test(standardNumberHelp(type)), `${type}: the help states 150 and 200`);
  if (type === "tendrop") continue;
  eq(`${type}: the intro is the standard's`, INTRO_SCORE[type], fillMax(standardNumberIntro(type), type));
  ok(INTRO_SCORE[type].length <= 90, `${type}: intro within two lines`);
}

console.log(`kit medians (${KIT_SEEDS.length} room seeds):\n  ${bandLines.join("\n  ")}`);
if (joe) console.log(`Ballpark, Joe's board (12 numbers 1.5 % off, 3 numbers 5 % off, done at 70 s): ${joe.before} before → ${joe.after} now`);
if (failures.length) {
  console.log(failures.slice(0, 60).map((f) => `FAIL ${f}`).join("\n"));
  console.log(`FAIL standard-number-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS standard-number-check: ${checks} checks`);
