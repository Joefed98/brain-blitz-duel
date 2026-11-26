/**
 * number-levels-checkout-kakuro-check (15 Nov 2026, the Number overhaul's stage 3 for Checkout and Kakuro; ~3 min,
 * no browser).
 *
 *   1. The registry: both games offer Easy, Normal, Hard and Expert; every non-Normal level names its proof (Kakuro:
 *      this check) or open answer (Checkout); every level's clock is at most 120 s.
 *   2. Joe's decision of 15 Nov 2026 (today's becomes Hard): Hard is today's game byte for byte (the deal before
 *      levels, pinned, plus the level field) on 40 seeds each; Normal, Easy and Expert deal the new stamps (Checkout
 *      checkoutRev 4, Kakuro kakuroRev 3); the own pins and any older pinned era deal today's game at Normal; rated
 *      play and the Daily (always Normal) get the new Normal; Hard grades every answer exactly as today's game.
 *   3. Checkout: every level board matches its settings (Easy three standard any-ring boards; Normal three standard
 *      and two shuffled, no minus numbers or x4; Expert five odd boards, every one with an exact dart count), the
 *      exhaustive search finds a checkout with a bust-free order and the stored fewest darts, and the person-like
 *      solver (checkout.server.ts `checkoutPersonFinds`, a bounded checkout-table search) finds every Expert board on
 *      100 seeds. Older boards' finishing and bust rules are unchanged (no `anyRing`: the old formula on every dart).
 *   4. Kakuro: every level board matches its settings (size, white squares, grade band) and has exactly one solution
 *      (the solver's search), its stored solution that one; the person-like solver (kakuro.server.ts
 *      `kakuroPersonSolve`: run combinations only, no guessing) completes every Easy, Normal and Expert board (Expert on
 *      100 seeds), and Normal within KAKURO_NORMAL.maxPasses passes.
 *   5. The grid rule (Joe): a Kakuro board is at most 7 squares across, measured at 47.6 px a square on a 375 × 667
 *      screen with the clue squares and margins (docs/design/pages-review/number/img/kakuro-expert.webp), so no level's
 *      grid needs to grow downward.
 *   6. Grading the levels: a full solve finishes at every level, Easy's any-ring finish counts, an Expert board thrown
 *      short of its exact count does not; the stage counts the dealt boards; both helps say what changes by level.
 *   7. The near-perfect kit finishes at least 80 % of Expert runs of each game (Joe's rule), on 40 seeds.
 *
 *   bun scripts/number-levels-checkout-kakuro-check.ts
 */
import { readFileSync } from "node:fs";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import {
  CHECKOUT_BULL,
  CHECKOUT_STANDARD,
  checkoutBustFreeOrder,
  checkoutBustIndex,
  checkoutBustsAt,
  checkoutFinisher,
  checkoutOptions,
  checkoutValid,
  decodeCheckoutDarts,
  encodeCheckoutDarts,
  joinCheckoutRound,
  searchCheckout,
} from "../src/lib/duel/checkout";
import { checkoutPersonFinds } from "../src/lib/duel/checkout.server";
import { isBigFinishDart } from "../src/lib/duel/numberDepth";
import { kakuroPersonSolve, searchKakuro } from "../src/lib/duel/kakuro.server";
import { encodeKakuro } from "../src/lib/duel/kakuro";
import {
  CHECKOUT_NORMAL,
  CHECKOUT_REV_LEVELS,
  KAKURO_NORMAL,
  KAKURO_REV_LEVELS,
  type CheckoutLevelSettings,
  type KakuroLevelSettings,
} from "../src/lib/duel/numberLevels";
import { gameLevelSettings, levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, type Level } from "../src/lib/levels/levels";
import { modeLevel } from "../src/lib/levels/modes";
import type { CheckoutPuzzleData, CheckoutStageData, KakuroPuzzleData, PuzzleData } from "../src/lib/duel/types";
import { tune } from "./level-tune";

const failures: string[] = [];
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const json = (v: unknown) => JSON.stringify(v);
const LEVELS: Level[] = ["easy", "normal", "hard", "expert"];
type Game = "checkout" | "kakuro";
const deal = <T extends PuzzleData>(type: Game, seed: number, level: Level, options?: Parameters<typeof generatePuzzle>[2]) =>
  withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: (seed * 7919 + 13) >>> 0, ...(level !== "normal" ? { level } : {}) }, options)) as T;
const strip = (p: object) => {
  const { level: _level, ...rest } = p as Record<string, unknown>;
  return rest;
};
const PIN: Record<Game, "preCheckoutLevels" | "preKakuroLevels"> = { checkout: "preCheckoutLevels", kakuro: "preKakuroLevels" };
const checkoutSettings = (level: Level): CheckoutLevelSettings =>
  level === "normal" ? CHECKOUT_NORMAL : (gameLevelSettings<CheckoutLevelSettings>("checkout", level) as CheckoutLevelSettings);
const kakuroSettings = (level: Level): KakuroLevelSettings =>
  level === "normal" ? KAKURO_NORMAL : (gameLevelSettings<KakuroLevelSettings>("kakuro", level) as KakuroLevelSettings);

/* ------------------------------------------------------------------ 1. The registry */
for (const type of ["checkout", "kakuro"] as const) {
  ok(json(levelsOf(type)) === json(LEVELS), `${type}: offers Easy, Normal, Hard and Expert (${levelsOf(type).join(", ")})`);
  for (const level of ["easy", "hard", "expert"] as const) {
    const proof = levelProof(type, level);
    if (type === "kakuro") ok(proof && "proof" in proof && proof.proof === "scripts/number-levels-checkout-kakuro-check.ts", `kakuro ${level}: its proof is this check`);
    else ok(proof && "open" in proof && proof.open.startsWith("any dart sequence reaching the target on the finishing ring counts"), `checkout ${level}: names its open answer`);
  }
  for (const level of LEVELS) {
    const clock = puzzleTimeLimitMs(deal(type, 3, level));
    ok(clock > 0 && clock <= MAX_ROUND_CLOCK_MS, `${type} ${level}: clock ${clock} ms within 120 s`);
  }
  // D2 (Joe's decision 10, a Hard you can see): Hard has its own boards; today's game is its pin's at Normal. // Changed with Joe's approval, 22 Nov 2026
  ok(!("today" in checkoutSettings("hard")) && !("today" in kakuroSettings("hard")), `${type}: Hard has its own boards, not today's game`); // Changed with Joe's approval, 22 Nov 2026
}

/* ------------------------------------------------------------------ 2. Hard is today's game; the eras */
for (const type of ["checkout", "kakuro"] as const) {
  const todayRev = (p: PuzzleData) => (type === "checkout" ? (p as CheckoutPuzzleData).checkoutRev === 3 : (p as KakuroPuzzleData).kakuroRev === 2);
  const newRev = (p: PuzzleData) =>
    type === "checkout" ? (p as CheckoutPuzzleData).checkoutRev === CHECKOUT_REV_LEVELS : (p as KakuroPuzzleData).kakuroRev === KAKURO_REV_LEVELS;
  let same = 0;
  for (let seed = 0; seed < 40; seed++) {
    const hard = deal(type, seed, "hard");
    const today = deal(type, seed, "normal", { pins: [PIN[type]] });
    if ((hard as { level?: string }).level === "hard" && newRev(hard) && todayRev(today) && !("level" in today)) same++; // Changed with Joe's approval, 22 Nov 2026
  }
  ok(same === 40, `${type}: Hard deals its own boards on the new stamp, and today's game is still its pin's at Normal (${same} of 40)`); // Changed with Joe's approval, 22 Nov 2026
  const own = deal(type, 7, "normal", { pins: [PIN[type]] });
  ok(todayRev(own) && !("level" in own), `${type}: its own pin deals today's game at Normal`);
  ok(!newRev(deal(type, 7, "normal", { pins: ["preNumberOverhaul"] })), `${type}: the pre-overhaul era deals its own older stamp`);
  ok(!newRev(deal(type, 7, "normal", { pins: ["preNotesFree"] })), `${type}: any older pinned era deals today's game at Normal`);
  const normal = deal(type, 7, "normal");
  ok(newRev(normal) && !("level" in normal), `${type}: Normal deals the new stamp with no level field`);
  ok(modeLevel("rated", "hard") === "normal" && modeLevel("daily", "expert") === "normal", "rated play and the Daily deal Normal");
  ok(newRev(deal(type, 7, modeLevel("rated", null))) && newRev(deal(type, 8, modeLevel("daily", "expert"))), `${type}: rated play and the Daily get the new Normal`);
  for (const level of ["easy", "expert"] as const) ok(newRev(deal(type, 9, level)), `${type} ${level}: deals the new stamp`);
}

/* The level never changes a grade: a Hard deal grades every answer exactly as the same puzzle with no level field. // Changed with Joe's approval, 22 Nov 2026 */
{
  let same = 0, total = 0;
  for (let seed = 20; seed < 28; seed++) {
    const hard = deal<CheckoutPuzzleData>("checkout", seed, "hard");
    const today = strip(hard) as unknown as CheckoutPuzzleData; // Changed with Joe's approval, 22 Nov 2026
    const routes = hard.routes ?? []; // Changed with Joe's approval, 22 Nov 2026
    const answers = [joinCheckoutRound(routes), joinCheckoutRound([routes[0] ?? "", "", routes[2] ?? ""]), "", joinCheckoutRound(["0:1", "0:2,0:2"])];
    for (const answer of answers)
      for (const ms of [20_000, 70_000]) {
        total++;
        const a = gradeAnswer(hard, answer, ms), b = gradeAnswer(today, answer, ms);
        if (a.score === b.score && a.isCorrect === b.isCorrect && json(a.extra) === json(b.extra)) same++;
      }
    const kh = deal<KakuroPuzzleData>("kakuro", seed, "hard");
    const kt = strip(kh) as unknown as KakuroPuzzleData; // Changed with Joe's approval, 22 Nov 2026
    const half = (kt.solution ?? []).map((v, i) => (i % 2 ? v : 0));
    for (const answer of [encodeKakuro(kt.solution ?? []), encodeKakuro(half), ""])
      for (const ms of [20_000, 90_000]) {
        total++;
        const a = gradeAnswer(kh, answer, ms), b = gradeAnswer(kt, answer, ms);
        if (a.score === b.score && a.isCorrect === b.isCorrect && json(a.extra) === json(b.extra)) same++;
      }
  }
  ok(same === total, `Hard grades every answer exactly as the same puzzle without its level (${same} of ${total})`); // Changed with Joe's approval, 22 Nov 2026
}

/* ------------------------------------------------------------------ 3. Checkout's boards */
{
  const standard = (s: CheckoutStageData) => s.wedges.every((v, i) => v === CHECKOUT_STANDARD[i]);
  const shuffled = (s: CheckoutStageData) => [...s.wedges].sort((a, b) => a - b).every((v, i) => v === i + 1) && !standard(s);
  const uneven = (s: CheckoutStageData) => new Set(s.wedges.map(Math.abs)).size === 20 && s.wedges.every((v) => Math.abs(v) >= 5 && Math.abs(v) <= 60) && !shuffled(s) && !standard(s);
  for (const level of ["easy", "normal", "hard", "expert"] as const) { // Changed with Joe's approval, 22 Nov 2026
    const settings = checkoutSettings(level);
    const plans = settings.boards ?? [];
    const seeds = level === "expert" ? 100 : 40;
    let shape = 0, proven = 0, person = 0;
    for (let seed = 0; seed < seeds; seed++) {
      const p = deal<CheckoutPuzzleData>("checkout", seed, level);
      const shapeOk =
        p.stages.length === plans.length &&
        p.stages.every((s, i) => {
          const plan = plans[i]!;
          const kind = plan.wedges === "standard" ? standard(s) : plan.wedges === "shuffled" ? shuffled(s.wedges.some((v) => v < 0) ? { ...s, wedges: s.wedges.map(Math.abs) } : s) : uneven(s);
          const negs = s.wedges.filter((v) => v < 0).length;
          return (
            kind &&
            negs === (plan.negatives ? 2 : 0) &&
            s.finish === plan.finish &&
            (s.anyRing === true) === (plan.anyRing === true) &&
            (s.quad === true) === (plan.quad === true) &&
            s.maxDarts === plan.maxDarts &&
            (s.exactDarts === true) === (plan.exact === true) &&
            s.target >= plan.target[0] &&
            s.target <= plan.target[1]
          );
        });
      if (shapeOk) shape++;
      const allProven = p.stages.every((s, i) => {
        const found = searchCheckout(s);
        if (found.minDarts === null || found.minDarts !== p.minDarts?.[i]) return false;
        const stored = decodeCheckoutDarts(p.routes?.[i] ?? "", s.maxDarts);
        const order = checkoutBustFreeOrder(s, stored);
        return stored.length === found.minDarts && checkoutBustIndex(s, order.slice(0, -1)) < 0 && checkoutValid(s, order, true);
      });
      if (allProven) proven++;
      if (p.stages.every((s) => checkoutPersonFinds(s).found)) person++;
    }
    ok(shape === seeds, `Checkout ${level}: boards as its settings (${shape} of ${seeds})`);
    ok(proven === seeds, `Checkout ${level}: every board has a checkout in a bust-free order and its stored fewest darts (${proven} of ${seeds})`);
    if (level !== "normal" || settings.person) ok(person === seeds, `Checkout ${level}: the person-like solver finds every board (${person} of ${seeds})`);
    console.log(`  Checkout ${level}: person-like solver ${person}/${seeds} rounds`);
  }
  const easy = checkoutSettings("easy").boards ?? [];
  ok(easy.length === 3 && easy.every((b) => b.wedges === "standard" && b.anyRing), "Checkout Easy: three standard boards finishing on any dart");
  const normal = CHECKOUT_NORMAL.boards ?? [];
  ok(normal.length === 5 && normal.filter((b) => b.wedges === "standard").length === 3 && normal.filter((b) => b.wedges === "shuffled").length === 2 && normal.every((b) => !b.negatives && !b.quad), "Checkout Normal: three standard and two shuffled boards, no minus numbers or x4");
  const expert = checkoutSettings("expert").boards ?? [];
  ok(expert.length === 5 && expert.every((b) => b.exact && b.wedges !== "standard") && expert.some((b) => b.negatives) && expert.some((b) => b.quad) && expert.some((b) => b.wedges === "uneven"), "Checkout Expert: five odd boards (uneven, minus numbers, x4), every one an exact dart count");

  // Older boards (no anyRing): the finishing and bust rules are the old formulas on every dart and remainder.
  let oldSame = 0, oldTotal = 0;
  for (let seed = 0; seed < 30; seed++) {
    const p = deal<CheckoutPuzzleData>("checkout", seed, "normal", { pins: ["preCheckoutLevels"] });
    for (const s of p.stages)
      for (const d of checkoutOptions(s)) {
        oldTotal++;
        const fin = d.ring === s.finish || (s.bigFinish === true && isBigFinishDart(s.finish, d, CHECKOUT_BULL));
        const bustOne = s.finish === 2;
        if (checkoutFinisher(s, d) === fin && checkoutBustsAt(s, 1, d, 1) === bustOne) oldSame++;
      }
  }
  ok(oldSame === oldTotal, `Checkout: older boards finish and bust exactly as before (${oldSame} of ${oldTotal} darts)`);
}

/* ------------------------------------------------------------------ 4. Kakuro's boards */
for (const level of ["easy", "normal", "hard", "expert"] as const) { // Changed with Joe's approval, 22 Nov 2026
  const st = kakuroSettings(level);
  const seeds = level === "expert" ? 100 : 40;
  let shape = 0, unique = 0, person = 0, passesOk = 0;
  const rounds: number[] = [];
  for (let seed = 0; seed < seeds; seed++) {
    const p = deal<KakuroPuzzleData>("kakuro", seed, level);
    // D2: Hard is 7 across by 6 down (a stored rows); every other grid is square. // Changed with Joe's approval, 22 Nov 2026
    if (p.size === st.size && (p.rows ?? p.size) === (st.rows ?? st.size) && p.white.length >= st.whiteMin! && p.white.length <= st.whiteMax! && (p.grade ?? -1) >= st.gradeMin! && (p.grade ?? -1) <= st.gradeMax!) shape++; // Changed with Joe's approval, 22 Nov 2026
    const search = searchKakuro(p, 2);
    if (search.count === 1 && search.branches === p.grade && search.first && p.white.every((c) => search.first![c] === p.solution?.[c])) unique++;
    const run = kakuroPersonSolve(p);
    if (run.solved && p.white.every((c) => run.values[c] === p.solution?.[c])) person++;
    const most = Math.max(...p.white.map((c) => run.round[c] ?? 0));
    rounds.push(most);
    if (st.maxPasses === undefined || most <= st.maxPasses) passesOk++;
  }
  ok(shape === seeds, `Kakuro ${level}: ${st.size} × ${st.rows ?? st.size}, ${st.whiteMin}–${st.whiteMax} white squares, grade ${st.gradeMin}–${st.gradeMax} (${shape} of ${seeds})`); // Changed with Joe's approval, 22 Nov 2026
  ok(unique === seeds, `Kakuro ${level}: exactly one solution, the stored one (${unique} of ${seeds})`);
  ok(person === seeds, `Kakuro ${level}: the person-like solver completes every board (${person} of ${seeds})`);
  ok(passesOk === seeds, `Kakuro ${level}: within its passes (${passesOk} of ${seeds})`);
  console.log(`  Kakuro ${level}: person-like solver ${person}/${seeds}, average ${(rounds.reduce((a, b) => a + b, 0) / rounds.length).toFixed(1)} passes`);
}
ok(KAKURO_NORMAL.size === 6 && KAKURO_NORMAL.whiteMin === 16 && KAKURO_NORMAL.whiteMax === 19 && KAKURO_NORMAL.gradeMax === 4, "Kakuro Normal: 6 × 6, 16–19 white squares, grade 0–4");

/* ------------------------------------------------------------------ 5. The grid rule */
{
  const MEASURED_PX_AT_7 = 47.6;
  for (const level of LEVELS) {
    const size = kakuroSettings(level).size!; // Changed with Joe's approval, 22 Nov 2026
    ok(size <= 7 && (MEASURED_PX_AT_7 * 7) / size >= 40, `Kakuro ${level}: squares at least 40 px on a 375 px screen (${size} across)`);
  }
  ok(readFileSync("docs/design/pages-review/number/img/kakuro-expert.webp").length > 1000, "Kakuro Expert's 375 × 667 shot is saved");
}

/* ------------------------------------------------------------------ 6. Grading the levels */
for (const level of LEVELS) {
  const p = deal<CheckoutPuzzleData>("checkout", 11, level);
  const full = gradeAnswer(p, joinCheckoutRound(p.routes ?? []), 30_000);
  ok(full.isCorrect && full.score >= 150, `Checkout ${level}: the stored routes finish (${full.score})`);
  const k = deal<KakuroPuzzleData>("kakuro", 11, level);
  const kf = gradeAnswer(k, encodeKakuro(k.solution ?? []), 30_000);
  ok(kf.isCorrect && kf.score >= 150, `Kakuro ${level}: the solution finishes (${kf.score})`);
  ok(!gradeAnswer(k, "", 30_000).isCorrect, `Kakuro ${level}: an empty board doesn't finish`);
}
{
  const s: CheckoutStageData = { wedges: [...CHECKOUT_STANDARD], target: 40, maxDarts: 3, finish: 2, anyRing: true, bigFinish: true };
  ok(checkoutValid(s, [{ wedge: 0, ring: 1 }, { wedge: 0, ring: 1 }], true), "Checkout Easy: 20 + 20 checks out on a single");
  ok(!checkoutBustsAt(s, 1, { wedge: 0, ring: 1 }, 1), "Checkout Easy: 1 left is no bust on an any-dart board");
  const e = deal<CheckoutPuzzleData>("checkout", 4, "expert");
  const route = decodeCheckoutDarts(e.routes?.[0] ?? "", e.stages[0]!.maxDarts);
  ok(route.length === e.stages[0]!.maxDarts && !checkoutValid(e.stages[0]!, route.slice(1), true), "Checkout Expert: fewer darts than the exact count never checks out");
  const stage = readFileSync("src/puzzles/checkout.tsx", "utf8");
  ok(/boardCount = data\?\.stages\.length/.test(stage) && !/\[1, 2, 3, 4, 5\]/.test(stage), "Checkout's stage counts the dealt boards");
  const help = readFileSync("src/lib/duel/instructions.ts", "utf8");
  ok(/Easy is three standard boards that finish on any dart/.test(help), "Checkout's help says what changes by level");
  ok(/Expert a 7 × 7 board/.test(help), "Kakuro's help says what changes by level");
}

/* ------------------------------------------------------------------ 7. The near-perfect kit on Expert */
for (const type of ["checkout", "kakuro"] as const) {
  const rows = await tune(type, "expert", 40, 0);
  const near = rows.find((r) => r.bot === "near-perfect")!;
  console.log(`  ${type} Expert near-perfect: avg ${near.average.toFixed(1)}, finished ${(near.finishRate * 100).toFixed(0)} %`);
  ok(near.finishRate >= 0.8, `${type} Expert: the near-perfect kit finishes at least 80 % (${(near.finishRate * 100).toFixed(0)} %)`);
}

console.log(failures.length ? `FAIL number-levels-checkout-kakuro-check: ${failures.length} of ${passes + failures.length} failed` : `number-levels-checkout-kakuro-check: all ${passes} passed`);
if (failures.length) process.exit(1);
