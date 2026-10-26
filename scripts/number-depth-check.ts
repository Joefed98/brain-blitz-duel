/**
 * Number depth to 200 (25 Oct 2026, depthRev 1; docs/depth/d2-number.md, numberDepth.ts).
 *
 *   1. Legacy identity: every answer in scripts/fixtures/number-depth-legacy.json.gz (recorded on main before the
 *      stamp: ladders, finishes at 0 / 50 / 90 % of the clock, mistakes, spam and every kit level, for the eight
 *      Number puzzles) grades to its stored score, verdict, breakdown and progress.
 *   1b. depthRev 1 identity: every answer in scripts/fixtures/number-depth-rev1.json.gz (Exact, Brimful and Checkout
 *      rounds dealt on depthRev 1, recorded on main before depthRev 2 by scripts/number-depth-rev1-record.ts) grades
 *      to its stored score, verdict, breakdown, progress and depth figures.
 *   2. The stamp: rooms deal depthRev 1 on puzzleScoreRev 3 for these eight games only (Exact, Brimful and Checkout
 *      depthRev 2, the feature's gentler curve); a check pinned before it
 *      (pinNumberDepth, or an older puzzleScoreRev) gets the old boards (Checkout rev 1, Exact's old targets).
 *   3. The layer: on depth rounds an unfinished run scores exactly as before (≤ 110); a finish never scores less
 *      than the same answer without the stamp, never above 200, the breakdown adds up, and more time left never
 *      scores less. Stretch games: today's 150 pace stays 150–165 and the elite share with no mistakes is 200.
 *   4. Each feature: Exact's elegance (five numbers, generation guarantees both answers), Brimful's par pours,
 *      Checkout's big finish (rules and bonus), Ballpark's bullseye streak and speed stretch. depthRev 2 pays the
 *      feature's base part at the fast share and the full bonus only at the game's elite share; the same boards
 *      stamped depthRev 1 still pay in full at the fast share.
 *   5. Texts: the intro and help state 200 through the game's maximum, the feature lines are in the help.
 *
 *   bun scripts/number-depth-check.ts      (~20 s)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { CHECKOUT_BULL, CHECKOUT_REV_BIG_FINISH, checkoutValid, encodeCheckoutDarts, joinCheckoutRound, searchCheckout } from "../src/lib/duel/checkout";
import { encodeMeasureRound, measureActions, measureApply, measureSolved, type MeasureAction } from "../src/lib/duel/measure";
import { encodeNumline, numlineShare, numlineValue, NUMLINE_SCALE, NUMLINE_TOTAL } from "../src/lib/duel/numline";
import {
  ballparkStreak,
  ballparkStreakPoints,
  dealtDepthRev,
  depthFeaturePointsRev2,
  depthStretchPoints,
  NUMBER_DEPTH_FEATURE_REV,
  NUMBER_DEPTH_GAMES,
  pinNumberDepth,
  usesNumberDepth,
} from "../src/lib/duel/numberDepth";
import { exactTilesUsed } from "../src/lib/duel/numberDepth.server";
import { pinDealtPuzzleScoreRev, storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import { rev3Game } from "../src/lib/duel/puzzleScoreRev3";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { encodeSteps, hasSolutionWithAtMostFourTiles, solveWithAllSixTiles } from "../src/lib/duel/target";
import type { CheckoutPuzzleData, MeasurePuzzleData, NumlinePuzzleData, PuzzleData, PuzzleType, TargetNumberPuzzleData } from "../src/lib/duel/types";
import { hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { gradeEntry, type Rev3Game } from "./scoring-rev3-record";
import { NUMBER_DEPTH_FIXTURE, NUMBER_DEPTH_GAMES as GAMES } from "./number-depth-record";
import { gradeRev1Entry, NUMBER_DEPTH_REV1_FIXTURE, type Rev1Game } from "./number-depth-rev1-record";

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 80) failures.push(message);
}

/* 1. Legacy identity. */
const legacy = JSON.parse(gunzipSync(readFileSync(NUMBER_DEPTH_FIXTURE)).toString()) as { games: Rev3Game[] };
let legacyEntries = 0;
for (const g of legacy.games) {
  ok(!usesNumberDepth(g.puzzle), `${g.type} ${g.seed}: the stored puzzle carries no depth stamp`);
  for (const e of g.entries) {
    legacyEntries++;
    const now = gradeEntry(g.puzzle, e.answer, e.ms);
    ok(JSON.stringify(now) === JSON.stringify(e.graded), `${g.type} ${g.seed} ${e.level}: grades as stored (${JSON.stringify(e.graded)} → ${JSON.stringify(now)})`);
  }
}
ok(legacy.games.length >= 30 && legacyEntries >= 900, `the legacy fixture holds the eight games (${legacy.games.length} seeds, ${legacyEntries} answers)`);

/* 1b. depthRev 1 identity (the feature games before depthRev 2). */
const rev1 = JSON.parse(gunzipSync(readFileSync(NUMBER_DEPTH_REV1_FIXTURE)).toString()) as { games: Rev1Game[] };
let rev1Entries = 0;
for (const g of rev1.games) {
  ok((g.puzzle as { depthRev?: number }).depthRev === 1, `${g.type} ${g.seed}: the stored puzzle is depthRev 1`);
  for (const e of g.entries) {
    rev1Entries++;
    const now = gradeRev1Entry(g.puzzle, e.answer, e.ms);
    ok(JSON.stringify(now) === JSON.stringify(e.graded), `depthRev 1 ${g.type} ${g.seed} ${e.level}: grades as stored (${JSON.stringify(e.graded)} → ${JSON.stringify(now)})`);
  }
}
ok(new Set(rev1.games.map((g) => g.type)).size === 3 && rev1Entries >= 800, `the depthRev 1 fixture holds Exact, Brimful and Checkout (${rev1.games.length} seeds, ${rev1Entries} answers)`);
ok(rev1.games.some((g) => g.entries.some((e) => e.graded.score === 200)), "the depthRev 1 fixture holds finishes at 200 (the feature in full at the fast share)");

/* 2. The stamp. */
for (const type of GAMES) {
  const made = generatePuzzle(type, { bankSeed: 4242 }) as unknown as Record<string, unknown>;
  const want = ["target", "measure", "checkout"].includes(type) ? NUMBER_DEPTH_FEATURE_REV : 1;
  ok(dealtDepthRev(type) === want && made["depthRev"] === want && made["puzzleScoreRev"] === 3, `${type}: rooms deal depthRev ${want} on puzzleScoreRev 3 (${String(made["depthRev"])})`);
  ok(roundMaxFor(type) === 200, `${type}: its round maximum is 200`);
}
for (const other of ["tiles", "unblock", "wordslide", "numhunt", "tendrop"] as PuzzleType[])
  ok(!("depthRev" in (generatePuzzle(other, { bankSeed: 4242 }) as object)), `${other}: never carries the Number depth stamp`);
pinNumberDepth(true);
for (const type of GAMES) ok(!usesNumberDepth(generatePuzzle(type, { bankSeed: 4242 })), `${type}: pinned before the stamp, no depthRev`);
ok((generatePuzzle("checkout", { bankSeed: 4242 }) as CheckoutPuzzleData).checkoutRev === 1, "Checkout: pinned before the stamp, checkoutRev 1 with no big finish");
pinNumberDepth(false);
pinDealtPuzzleScoreRev(2);
for (const type of GAMES) ok(!usesNumberDepth(generatePuzzle(type, { bankSeed: 4242 })), `${type}: on puzzleScoreRev 2, no depthRev`);
pinDealtPuzzleScoreRev(null);
const co = generatePuzzle("checkout", { bankSeed: 4242 }) as CheckoutPuzzleData;
ok(co.checkoutRev === CHECKOUT_REV_BIG_FINISH && co.stages.every((s) => s.bigFinish === true), "Checkout: depth boards are checkoutRev 2 with the big finish");
const ms0 = generatePuzzle("measure", { bankSeed: 4242 }) as MeasurePuzzleData;
ok(JSON.stringify(ms0.par) === JSON.stringify(ms0.minMoves), "Brimful: the par pours are each puzzle's fewest moves");

/* 3. The layer on kit plays. */
const clean = (pace: number, err = 0): Skill => ({ level: "near", pace, err, reactionMs: 160, reactionSd: 20 });
const stripped = (p: PuzzleData): PuzzleData => {
  const { depthRev: _d, ...rest } = p as PuzzleData & { depthRev?: number };
  return rest as PuzzleData;
};
const partsAddUp = (score: number, extra: Record<string, unknown> | null) => {
  const parts = storedScoreParts(extra);
  if (!parts) return false;
  return parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) === score;
};
for (const type of GAMES) {
  const kit = KITS[type]!;
  for (let s = 1; s <= 6; s++) {
    const seed = 31_000 + s;
    const p = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(p);
    ok(usesNumberDepth(p), `${type} ${seed}: dealt on the depth stamp`);
    for (const [label, skill] of [["good", clean(1, 0.1)], ["near", clean(0.5, 0.015)], ["elite", clean(0.35, 0)], ["slips", clean(0.5, 0.25)]] as const) {
      const play = kit.play(p, makeRng(hashText(`${type}:depth:${seed}:${label}`)), skill, limit * 3);
      for (const step of play.steps.filter((_, i, all) => all.length <= 40 || i % Math.ceil(all.length / 40) === 0 || i === all.length - 1)) {
        const msLeft = Math.max(0, limit - step.atMs);
        const g = gradeAnswer(p, step.answer, msLeft);
        const old = gradeAnswer(stripped(p), step.answer, msLeft);
        ok(g.score >= 0 && g.score <= 200 && Number.isInteger(g.score), `${type} ${seed} ${label}: a whole score 0–200 (${g.score})`);
        ok(g.isCorrect === old.isCorrect, `${type} ${seed} ${label}: the verdict is the stamp-free one`);
        if (!g.isCorrect) ok(g.score === old.score && g.score <= 110, `${type} ${seed} ${label}: unfinished scores as before (${old.score} → ${g.score})`);
        else {
          ok(g.score >= old.score && old.score <= 150, `${type} ${seed} ${label}: a finish only gains (${old.score} → ${g.score})`);
          ok(type === "numline" || partsAddUp(g.score, g.extra), `${type} ${seed} ${label}: the breakdown adds up to ${g.score}`);
        }
      }
    }
    // More time left never scores less (the elite play's final answer at every 5 % of the clock).
    const elite = kit.play(p, makeRng(hashText(`${type}:mono:${seed}`)), clean(0.35, 0), limit * 3);
    const final = elite.steps.find((st) => gradeAnswer(p, st.answer, limit / 2).isCorrect)?.answer;
    ok(final !== undefined, `${type} ${seed}: the elite play finishes`);
    if (final !== undefined) {
      let prev = -1;
      for (let k = 0; k <= 20; k++) {
        const sc = gradeAnswer(p, final, Math.round((limit * k) / 20)).score;
        ok(sc >= prev, `${type} ${seed}: more time left never scores less (${k * 5} %: ${prev} → ${sc})`);
        prev = sc;
      }
      const game = NUMBER_DEPTH_GAMES[type]!;
      if (game.route === "stretch") {
        const fast = rev3Game(type).fastShare;
        const atFast = gradeAnswer(p, final, Math.ceil(limit * fast));
        ok(atFast.score >= 150 && atFast.score <= 151, `${type} ${seed}: a clean finish at today's 150 pace stays 150 (${atFast.score})`);
        const mid = gradeAnswer(p, final, Math.round(limit * (fast + (game.elite! - fast) * 0.5)));
        ok(mid.score >= 150 && mid.score <= 165, `${type} ${seed}: halfway to the elite share is 150–165 (${mid.score})`);
        ok(gradeAnswer(p, final, Math.ceil(limit * game.elite!)).score === 200, `${type} ${seed}: the elite share with no mistakes is 200`);
        ok(depthStretchPoints(0.99, fast, game.elite!, 0.5) <= 13, `${type}: mistakes cut the stretch (efficiency squared)`);
      }
    }
  }
}

/* 4. The features. */
// Exact: both answers exist on every depth board, none from four or fewer; five numbers earn elegance, six none.
for (let s = 1; s <= 12; s++) {
  const p = roomPuzzle("target", 32_000 + s) as TargetNumberPuzzleData;
  const limit = puzzleTimeLimitMs(p);
  const five = encodeSteps(p.solution);
  const sixSteps = solveWithAllSixTiles(p.tiles, p.target);
  ok(!hasSolutionWithAtMostFourTiles(p.tiles, p.target), `Exact ${s}: no answer from four or fewer numbers`);
  ok(exactTilesUsed(p, five) === 5, `Exact ${s}: the stored answer uses five numbers`);
  ok(sixSteps !== null, `Exact ${s}: a six-number answer exists too (elegance is a choice)`);
  const game = NUMBER_DEPTH_GAMES.target!;
  const fast = Math.ceil(limit * rev3Game("target").fastShare);
  const elite = Math.ceil(limit * game.featureElite!);
  const v1 = { ...p, depthRev: 1 } as TargetNumberPuzzleData;
  ok(p.depthRev === 2, `Exact ${s}: dealt on depthRev 2`);
  const g5 = gradeAnswer(p, five, fast);
  ok(g5.score === 150 + Math.round(50 * game.featureBase!) && (g5.extra?.["depth"] as { elegant?: boolean })?.elegant === true, `Exact ${s}: depthRev 2, five numbers at the fast share is 150 + the base part (${g5.score})`);
  ok(gradeAnswer(p, five, elite).score === 200, `Exact ${s}: depthRev 2, five numbers at the elite share is 200`);
  ok(gradeAnswer(v1, five, fast).score === 200, `Exact ${s}: depthRev 1, five numbers at the fast share is still 200`);
  if (sixSteps) {
    const six = encodeSteps(sixSteps);
    ok(exactTilesUsed(p, six) === 6, `Exact ${s}: the six-number answer uses six`);
    ok(gradeAnswer(p, six, fast).score === 150 && gradeAnswer(v1, six, fast).score === 150, `Exact ${s}: six numbers at the fast share is 150, no elegance (both revisions)`);
    ok(gradeAnswer(p, six, limit).score === 150 && gradeAnswer(p, five, limit).score === 200, `Exact ${s}: elegance needs the five`);
  }
  ok(gradeAnswer(p, five, 0).score === 120 && gradeAnswer(v1, five, 0).score === 120, `Exact ${s}: an elegant hit at the buzzer earns no bonus (it is paid with speed)`);
}
// Brimful: par on every puzzle at the fast share is 200; one extra move on one puzzle shares the bonus.
for (let s = 1; s <= 6; s++) {
  const p = roomPuzzle("measure", 33_000 + s) as MeasurePuzzleData;
  const limit = puzzleTimeLimitMs(p);
  const plans = p.boards.map((board) => bfs(board));
  const fast = Math.ceil(limit * rev3Game("measure").fastShare);
  const eliteMs = Math.ceil(limit * NUMBER_DEPTH_GAMES.measure!.featureElite!);
  const parAnswer = encodeMeasureRound(plans);
  ok(p.depthRev === 2, `Brimful ${s}: dealt on depthRev 2`);
  const atFast = gradeAnswer(p, parAnswer, fast);
  ok(atFast.score === 150 + Math.round(50 * NUMBER_DEPTH_GAMES.measure!.featureBase!), `Brimful ${s}: depthRev 2, par on all four at the fast share is 150 + the base part (${atFast.score})`);
  ok(gradeAnswer({ ...p, depthRev: 1 } as MeasurePuzzleData, parAnswer, fast).score === 200, `Brimful ${s}: depthRev 1, par on all four at the fast share is still 200`);
  const g = gradeAnswer(p, parAnswer, eliteMs);
  ok(g.score === 200 && (g.extra?.["depth"] as { parBoards?: number })?.parBoards === 4, `Brimful ${s}: depthRev 2, par on all four at the elite share is 200 (${g.score})`);
  // A wasted Fill-and-Empty on the first board (only where the board has a tap).
  const first = p.boards[0]!;
  if (first.tap) {
    const fill = measureActions(first).find((a) => a.kind === "fill" && measureApply(first, first.start, a));
    const empty = fill ? measureActions(first).find((a) => a.kind === "empty" && a.jug === (fill as { jug: number }).jug) : undefined;
    if (fill && empty) {
      const wasted = encodeMeasureRound([[fill, empty, ...plans[0]!], ...plans.slice(1)]);
      const w = gradeAnswer(p, wasted, eliteMs);
      ok(w.isCorrect && (w.extra?.["depth"] as { parBoards?: number })?.parBoards === 3, `Brimful ${s}: two wasted moves lose that puzzle's par`);
      ok(w.score < g.score && w.score > 150, `Brimful ${s}: three pars of four still earn some bonus (${w.score})`);
    }
  }
}
// Checkout: the big finish's rules, then its bonus.
{
  const double = { wedges: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5], target: 60, maxDarts: 3, finish: 2 as const };
  const t20 = { wedge: 0, ring: 3 };
  ok(!checkoutValid(double, [t20]), "Checkout rev 1: a treble cannot end a double board");
  ok(checkoutValid({ ...double, bigFinish: true }, [t20]), "Checkout rev 2: a treble ends a double board (a big finish)");
  const treble = { ...double, target: 50, finish: 3 as const, quad: true };
  const bull = { wedge: CHECKOUT_BULL, ring: 2 };
  ok(!checkoutValid(treble, [bull]) && checkoutValid({ ...treble, bigFinish: true }, [bull]), "Checkout: the Bull ends a treble board only with the big finish");
  ok(checkoutValid({ ...double, target: 50 }, [bull]), "Checkout: the Bull is still a double on a double board");
  ok(!checkoutValid({ ...double, target: 20, bigFinish: true }, [{ wedge: 0, ring: 1 }]), "Checkout rev 2: a single still never ends a board");
}
for (let s = 1; s <= 6; s++) {
  const p = roomPuzzle("checkout", 34_000 + s) as CheckoutPuzzleData;
  const limit = puzzleTimeLimitMs(p);
  const fast = Math.ceil(limit * rev3Game("checkout").fastShare);
  const ordinary = p.stages.map((stage) => encodeCheckoutDarts(searchCheckout({ ...stage, bigFinish: false }).route ?? []));
  const g = gradeAnswer(p, joinCheckoutRound(ordinary), fast);
  const bigCount = (g.extra?.["depth"] as { bigFinishes?: number })?.bigFinishes ?? -1;
  const expectBig = p.stages.filter((stage, i) => {
    const last = ordinary[i]!.split(",").pop() ?? "";
    return last === `${CHECKOUT_BULL}:2` || (last.endsWith(":3") && stage.finish === 2);
  }).length;
  ok(g.isCorrect && bigCount === expectBig, `Checkout ${s}: ordinary checkouts count only their own big finishes (${bigCount} vs ${expectBig})`);
  const plain = gradeAnswer(stripped(p), joinCheckoutRound(ordinary), fast).score;
  const game = NUMBER_DEPTH_GAMES.checkout!;
  ok(p.depthRev === 2, `Checkout ${s}: dealt on depthRev 2`);
  const rev2Bonus = depthFeaturePointsRev2(bigCount / 5, fast / limit, rev3Game("checkout").fastShare, game.featureElite!, game.featureBase!);
  ok(g.score === plain + rev2Bonus, `Checkout ${s}: depthRev 2, ordinary checkouts score their rev-3 ${plain} plus their big finishes' base part (${g.score})`);
  const g1 = gradeAnswer({ ...p, depthRev: 1 } as CheckoutPuzzleData, joinCheckoutRound(ordinary), fast);
  ok(g1.score === plain + Math.round((50 * bigCount) / 5), `Checkout ${s}: depthRev 1, ordinary checkouts score their rev-3 ${plain} plus their big finishes in full (${g1.score})`);
  if (p.routes?.length) {
    const big = joinCheckoutRound(p.routes);
    const all = gradeAnswer(p, big, Math.ceil(limit * game.featureElite!));
    const n = (all.extra?.["depth"] as { bigFinishes?: number })?.bigFinishes ?? 0;
    if (all.isCorrect && n === 5) ok(all.score === 200, `Checkout ${s}: depthRev 2, five big finishes at the elite share is 200 (${all.score})`);
  }
}
// Ballpark: the streak sum and points; exact placements at the elite share are 200; unfinished as before.
{
  const st = ballparkStreak([0.001, 0.002, 0.03, 0.004, 0.0049, 0.005, 0.0051, null]);
  ok(JSON.stringify(st.runs) === "[1,2,0,1,2,3,0,0]" && st.sum === 1 + 2 + 1 + 2 + 3 && st.best === 3, `Ballpark: the streak runs and sum (${JSON.stringify(st)})`);
  ok(ballparkStreakPoints(54) === 30 && ballparkStreakPoints(0) === 0 && ballparkStreakPoints(999) === 30, "Ballpark: fifteen bullseyes in a row are the full 30");
  for (let s = 1; s <= 6; s++) {
    const p = roomPuzzle("numline", 35_000 + s) as NumlinePuzzleData;
    const limit = puzzleTimeLimitMs(p);
    const exact = p.stages.flatMap((stage, i) => (p.values?.[i] ?? []).map((v) => Math.round(numlineShare(stage, numlineValue(v)) * NUMLINE_SCALE)));
    ok(exact.length === NUMLINE_TOTAL, `Ballpark ${s}: fifteen values`);
    const top = gradeAnswer(p, encodeNumline(exact), Math.ceil(limit * NUMBER_DEPTH_GAMES.numline!.elite!));
    ok(top.score === 200, `Ballpark ${s}: fifteen bullseyes at the elite share is 200 (${top.score})`);
    const slow = gradeAnswer(p, encodeNumline(exact), 0);
    const old = gradeAnswer(stripped(p), encodeNumline(exact), 0);
    ok(slow.score === Math.min(200, old.score + 30), `Ballpark ${s}: at the buzzer the streak alone adds 30 (${old.score} → ${slow.score})`);
    const off = exact.map((v, i) => (i % 2 ? Math.min(NUMLINE_SCALE, v + 70) : v));
    const alt = gradeAnswer(p, encodeNumline(off), 0);
    const altOld = gradeAnswer(stripped(p), encodeNumline(off), 0);
    ok(alt.score - altOld.score === ballparkStreakPoints(8), `Ballpark ${s}: broken streaks earn their own sum (${alt.score - altOld.score})`);
    const part = gradeAnswer(p, encodeNumline(exact.slice(0, 14)), 0);
    ok(part.score === gradeAnswer(stripped(p), encodeNumline(exact.slice(0, 14)), 0).score, `Ballpark ${s}: unfinished (14 placed) scores as before`);
  }
}

// depthRev 2's feature curve: the base part by the fast share, the full bonus only at the elite share, rising.
for (const type of ["target", "measure", "checkout"] as PuzzleType[]) {
  const game = NUMBER_DEPTH_GAMES[type]!;
  const fast = rev3Game(type).fastShare;
  ok(game.route === "feature" && game.featureElite! > fast && game.featureElite! < 1 && game.featureBase! > 0 && game.featureBase! < 1, `${type}: depthRev 2's elite share beyond the fast share, a base part under 1`);
  ok(depthFeaturePointsRev2(1, fast, fast, game.featureElite!, game.featureBase!) === Math.round(50 * game.featureBase!), `${type}: depthRev 2 pays the base part at the fast share`);
  ok(depthFeaturePointsRev2(1, game.featureElite!, fast, game.featureElite!, game.featureBase!) === 50, `${type}: depthRev 2 pays the full 50 at the elite share`);
  ok(depthFeaturePointsRev2(0, 1, fast, game.featureElite!, game.featureBase!) === 0, `${type}: depthRev 2 pays nothing without the feature`);
  let prev = -1;
  for (let k = 0; k <= 100; k++) {
    const pts = depthFeaturePointsRev2(1, k / 100, fast, game.featureElite!, game.featureBase!);
    ok(pts >= prev, `${type}: depthRev 2 never pays less for more time left (${k} %)`);
    prev = pts;
  }
}

/* 5. Texts. */
for (const type of GAMES) {
  const intro = INTRO_SCORE[type];
  const help = PUZZLE_INSTRUCTIONS[type].score;
  ok(/\b200\b/.test(intro) && intro.length <= 90, `${type}: the intro states 200 within two lines ("${intro}")`);
  ok(/\b200\b/.test(help), `${type}: the help states 200`);
}
ok(/Elegance bonus/.test(PUZZLE_INSTRUCTIONS.target.score) && PUZZLE_INSTRUCTIONS.target.how.some((h) => /Elegance/.test(h.action)), "Exact: the elegance bonus is explained");
ok(/Par pours/.test(PUZZLE_INSTRUCTIONS.measure.score) && PUZZLE_INSTRUCTIONS.measure.how.some((h) => /Par pours/.test(h.action)), "Brimful: par pours are explained");
ok(/Big finish/.test(PUZZLE_INSTRUCTIONS.checkout.score) && PUZZLE_INSTRUCTIONS.checkout.how.some((h) => /Big finish/.test(h.action)), "Checkout: the big finish is explained");
ok(/Bullseye streak/.test(PUZZLE_INSTRUCTIONS.numline.score) && PUZZLE_INSTRUCTIONS.numline.how.some((h) => /Bullseye/.test(h.action)), "Ballpark: the bullseye streak is explained");

/** Brimful: the shortest action list for a board (BFS). */
function bfs(board: MeasurePuzzleData["boards"][number]): MeasureAction[] {
  const key = (a: readonly number[]) => a.join(",");
  const parent = new Map<string, { prev: string; action: MeasureAction }>();
  const seen = new Set([key(board.start)]);
  let frontier = [board.start];
  while (frontier.length) {
    const next: number[][] = [];
    for (const amounts of frontier) {
      for (const action of measureActions(board)) {
        const after = measureApply(board, amounts, action);
        if (!after || seen.has(key(after))) continue;
        seen.add(key(after));
        parent.set(key(after), { prev: key(amounts), action });
        if (measureSolved(board, after)) {
          const plan: MeasureAction[] = [];
          for (let c = key(after); c !== key(board.start); c = parent.get(c)!.prev) plan.unshift(parent.get(c)!.action);
          return plan;
        }
        next.push(after);
      }
    }
    frontier = next;
  }
  return [];
}

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL number-depth-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS number-depth-check: ${passes} checks — ${legacyEntries} stored answers grade as before; ${rev1Entries} depthRev 1 feature answers grade as before; depthRev 2 for Exact, Brimful and Checkout (base part at the fast share, 200 at the elite share); depthRev 1 dealt on puzzleScoreRev 3 only; unfinished unchanged, finishes only gain, ≤ 200; stretch 150–165 at today's pace, 200 at the elite share; elegance, par pours, big finish and the bullseye streak`);
