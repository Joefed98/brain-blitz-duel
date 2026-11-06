/**
 * puzzle-polish-nov-check (3 Nov 2026, docs/puzzle-polish-nov-2026.md): the puzzle polish's scoring changes.
 *
 *  1. Deals: Operator deals gapsRev 1 (signs, numbers, then mixed), Labyrinth mazeRev 5, Topsy-Turvy gravityRev 7 and
 *     Skid slideRev 4 with their par stored; pinPreOperatorGaps / pinPreParStrict deal the stamps before, the same
 *     board for the par games (only the stamp and the par differ); the same seed deals the same puzzle.
 *  2. Legacy: every case of scripts/fixtures/puzzle-polish-nov-legacy.json.gz (recorded on main 2c19b253 by
 *     scripts/puzzle-polish-nov-record.ts: Operator's signs-only stamp and the puzzle batch's stamps) regrades exactly.
 *  3. Operator's gaps: each equation's kind and tray, one to three true fills (one on equation 1), the stored fill
 *     true, any other true fill counted, invalid fills (a number not in the tray, a tray number used twice, a sign in a
 *     number gap, a step that isn't whole) refused, the try limit, a clean fast solve at 200.
 *  4. The stricter par: a flawless solve 200, the par line falling to 0 at 1.5× par, speed full by the new times.
 *  5. Bands weak → flawless (before → after, `--seeds=N`, default 12; scripts/puzzle-polish-bands.ts runs 60):
 *     medians never fall with skill, flawless 200, random play under weak and never paid for par.
 *  6. Texts: the help and intro state the new rules; pinned, the old ones.
 *
 *   bun scripts/puzzle-polish-nov-check.ts [--seeds=12]
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import {
  GRAVITY_REV_STRICT,
  MAZE_REV_STRICT,
  PAR_MOVES_STAMPS,
  PAR_STRICT_FULL_BY_S,
  PAR_STRICT_STAMPS,
  SLIDE_REV_STRICT,
  parOfParMoves,
  pinPreParStrict,
  shownPar,
  usesParMoves,
  usesParStrict,
} from "../src/lib/duel/parMoves";
import {
  OPERATOR_GAPS_REV,
  equationVerdict,
  gapSlots,
  gapStageCorrect,
  joinGapSegment,
  pinPreOperatorGaps,
  splitGapSegment,
  usesOperatorGaps,
} from "../src/lib/duel/operatorGaps";
import { countGapAnswers } from "../src/lib/duel/operatorGaps.server";
import { evaluateLeftToRight, joinStages } from "../src/lib/duel/stagedRounds";
import { joinCountSuffix, splitCountSuffix } from "../src/lib/duel/moveLimits";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { encodeMazeTrail } from "../src/lib/duel/depth/labyrinth";
import { mazeColsOf } from "../src/lib/duel/maze";
import { BATCH_TYPES, dealBatch, flawlessSolve, spamBatch, type BatchType } from "./puzzle-batch-nov/players";
import { dealEquation, BAND_LEVELS } from "./puzzle-polish-nov/players";
import { formatRows, polishRows } from "./puzzle-polish-bands";
import { median } from "./standard-lib";
import type { EquationPuzzleData, MazePuzzleData, Operator, PuzzleData } from "../src/lib/duel/types";

let fails = 0;
let passes = 0;
function ok(cond: boolean, what: string): void {
  if (cond) passes++;
  else {
    fails++;
    console.log(`FAIL ${what}`);
  }
}

const args = process.argv.slice(2);
const SEEDS_N = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 12);
const SEEDS = Array.from({ length: SEEDS_N }, (_, i) => 52_000 + i * 41);
type Of<T extends PuzzleData["type"]> = Extract<PuzzleData, { type: T }>;
const STRICT_REV: Record<BatchType, number> = { maze: MAZE_REV_STRICT, gravity: GRAVITY_REV_STRICT, iceslide: SLIDE_REV_STRICT };
const stamp = (p: PuzzleData, key: string) => (p as unknown as Record<string, unknown>)[key];
function pinned<T>(pin: (on: boolean) => boolean, fn: () => T): T {
  const before = pin(true);
  try {
    return fn();
  } finally {
    pin(before);
  }
}
const parts = (g: ReturnType<typeof gradeAnswer>) => (g.extra as { parts?: { base?: number; speed?: number; efficiency?: number; measure?: string } } | undefined)?.parts;

/* 1. Deals */
for (const type of BATCH_TYPES) {
  const key = PAR_STRICT_STAMPS[type]!.key;
  for (const seed of SEEDS.slice(0, 4)) {
    const now = dealBatch(type, seed);
    const old = pinned(pinPreParStrict, () => dealBatch(type, seed));
    ok(stamp(now, key) === STRICT_REV[type] && usesParStrict(now) && usesParMoves(now), `${type} ${seed}: deals ${key} ${STRICT_REV[type]} (got ${String(stamp(now, key))})`);
    ok(stamp(old, key) === PAR_MOVES_STAMPS[type]!.rev && !usesParStrict(old), `${type} ${seed}: pinPreParStrict deals ${key} ${PAR_MOVES_STAMPS[type]!.rev}`);
    const par = (now as { par?: number }).par;
    ok(typeof par === "number" && par > 0 && par === parOfParMoves(old), `${type} ${seed}: par ${par} stored, the graded par ${parOfParMoves(old)}`);
    ok(shownPar(splitPuzzle(now).pub as PuzzleData) === par, `${type} ${seed}: the par is public (shown during play)`);
    ok(shownPar(old) === null, `${type} ${seed}: an older stamp shows no par`);
    const strip = (p: PuzzleData) => {
      const c = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
      delete c[key];
      delete c["par"];
      return JSON.stringify(c);
    };
    ok(strip(now) === strip(old), `${type} ${seed}: the same board as the puzzle batch's stamp`);
    ok(JSON.stringify(dealBatch(type, seed)) === JSON.stringify(now), `${type} ${seed}: the same seed deals the same puzzle`);
  }
}
for (const seed of SEEDS.slice(0, 6)) {
  const now = dealEquation(seed) as EquationPuzzleData;
  const old = pinned(pinPreOperatorGaps, () => dealEquation(seed)) as EquationPuzzleData;
  ok(now.gapsRev === OPERATOR_GAPS_REV && usesOperatorGaps(now) && !!now.gapAnswers && !now.operators, `equation ${seed}: deals gapsRev ${OPERATOR_GAPS_REV} with its answers, no operator sets`);
  ok(!usesOperatorGaps(old) && !!old.operators && old.stages.every((s) => !s.tray && !s.signs), `equation ${seed}: pinPreOperatorGaps deals the signs-only stamp`);
  ok(now.depthRev === old.depthRev && now.tryLimit === old.tryLimit && now.equationRev === old.equationRev, `equation ${seed}: the standard and try-limit stamps unchanged`);
  ok(!("gapAnswers" in splitPuzzle(now).pub), `equation ${seed}: the answers stay server-side`);
  ok(JSON.stringify(dealEquation(seed)) === JSON.stringify(now), `equation ${seed}: the same seed deals the same puzzle`);
}

/* 2. Legacy */
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-polish-nov-legacy.json.gz")).toString()) as {
    puzzles: PuzzleData[];
    cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; parts: unknown }[];
  };
  ok(fx.puzzles.length === 18 && fx.cases.length >= 500, `legacy fixture: ${fx.puzzles.length} puzzles, ${fx.cases.length} cases`);
  for (const [i, p] of fx.puzzles.entries()) ok(!usesParStrict(p) && !usesOperatorGaps(p), `legacy puzzle ${i} (${p.type}) is on an older stamp`);
  let same = 0;
  for (const c of fx.cases) {
    const g = gradeAnswer(fx.puzzles[c.p]!, c.answer, c.msLeft);
    const pt = (g.extra as Record<string, unknown> | undefined)?.["parts"] ?? null;
    if (g.score === c.score && g.isCorrect === c.correct && JSON.stringify(pt) === JSON.stringify(c.parts)) same++;
    else ok(false, `legacy ${fx.puzzles[c.p]!.type} case: ${c.score}/${c.correct} on main, ${g.score}/${g.isCorrect} now`);
  }
  ok(same === fx.cases.length, `legacy: ${same} of ${fx.cases.length} cases regrade exactly as on main`);
}

/* 3. Operator's gaps */
{
  const kinds = { signsOnly: 0, numbersOnly: 0, mixed: 0 };
  let divOk = 0;
  for (let i = 0; i < 60; i++) {
    const p = dealEquation(60_000 + i * 7) as EquationPuzzleData;
    ok(p.stages.length === 4, `equation ${i}: four equations`);
    p.stages.forEach((st, k) => {
      const slots = gapSlots(st);
      const signs = slots.filter((s) => s.kind === "sign").length;
      const nums = slots.filter((s) => s.kind === "number").length;
      const answers = countGapAnswers(st);
      if (k === 0) {
        ok(nums === 0 && signs === 2 && !st.tray && answers === 1, `equation ${i}.1: a sign equation, exactly one answer (${signs} signs, ${nums} numbers, ${answers})`);
        if (nums === 0) kinds.signsOnly++;
      } else if (k === 1) {
        ok(signs === 0 && nums === 3 && st.tray?.length === 5 && answers >= 1 && answers <= 3, `equation ${i}.2: a number equation, tray of 5, 1–3 answers (${answers})`);
        if (signs === 0) kinds.numbersOnly++;
      } else {
        ok(signs >= 2 && nums === 2 && st.tray?.length === 4 && answers >= 1 && answers <= 3, `equation ${i}.${k + 1}: mixed, tray of 4, 1–3 answers (${answers})`);
        if (signs > 0 && nums > 0) kinds.mixed++;
      }
      ok(gapStageCorrect(st, p.gapAnswers?.[k]), `equation ${i}.${k + 1}: the stored fill is true`);
      ok(st.numbers.every((n, j) => n > 0 || slots.some((s) => s.kind === "number" && s.index === j)), `equation ${i}.${k + 1}: every 0 is a number gap`);
      if (k === 3) {
        const fills = splitGapSegment(p.gapAnswers?.[k] ?? "", slots.length);
        const ops = st.signs!.map((o, j) => o ?? (fills[slots.findIndex((s) => s.kind === "sign" && s.index === j)] as Operator));
        if (ops.includes("÷") && ops.includes("×")) divOk++;
      }
    });
  }
  ok(kinds.signsOnly === 60 && kinds.numbersOnly === 60 && kinds.mixed === 120, `equation kinds: ${JSON.stringify(kinds)}`);
  ok(divOk === 60, `equation 4 keeps × and ÷ in its answer on ${divOk} of 60 deals`);

  // Any true fill counts, not only the stored one; invalid fills are refused.
  const fixed: EquationPuzzleData = {
    type: "equation",
    gapsRev: 1,
    stages: [
      { numbers: [6, 2, 3], target: 9, signs: [null, null] },
      { numbers: [0, 2, 0, 0], target: 15, signs: ["+", "×", "-"], tray: [3, 4, 5, 9, 9] },
      { numbers: [8, 0, 3, 0, 2], target: 0, signs: [null, "-", null, "×"], tray: [3, 2, 7, 4] },
      { numbers: [12, 0, 7, 0, 5], target: 55, signs: [null, null, "÷", null], tray: [3, 2, 9, 17] },
    ],
  };
  ok(gapStageCorrect(fixed.stages[0]!, "÷,×") && gapStageCorrect(fixed.stages[0]!, "+,+") === false, "a sign equation: 6 ÷ 2 × 3 = 9");
  ok(gapStageCorrect(fixed.stages[0]!, "+,+") === false && evaluateLeftToRight([6, 2, 3], ["+", "+"]) === 11, "a false fill is false");
  // 3 + 2 × 4 − 5 = 15 and 5 + 2 × 3 − 6? (no 6) — and 9 + 2 × ... : two different true fills both count.
  ok(gapStageCorrect(fixed.stages[1]!, "3,4,5"), "a number equation: 3 + 2 × 4 − 5 = 15");
  ok(gapStageCorrect(fixed.stages[1]!, "4,3,3") === false, "a tray number used more often than the tray holds it is refused");
  ok(gapStageCorrect(fixed.stages[1]!, "6,3,3") === false, "a number not in the tray is refused");
  ok(gapStageCorrect(fixed.stages[1]!, "+,4,5") === false, "a sign in a number gap is refused");
  ok(gapStageCorrect(fixed.stages[1]!, "3,4,") === false, "an empty gap is refused");
  // The duplicate 9 may be used twice: 9 + 2 × … (9+2)×9−… isn't 15, but the tray's two 9s are two chips.
  ok(countGapAnswers(fixed.stages[1]!) >= 1, "the fixed number equation has an answer");
  const alt = (() => {
    // Search a deal for a stage with two true fills and grade the one that isn't stored.
    for (let i = 0; i < 80; i++) {
      const p = dealEquation(70_000 + i * 11) as EquationPuzzleData;
      for (const [k, st] of p.stages.entries()) {
        if (countGapAnswers(st) < 2) continue;
        const slots = gapSlots(st);
        const stored = p.gapAnswers![k]!;
        const signsSet: Operator[] = ["+", "-", "×", "÷"];
        const tray = st.tray ?? [];
        const tryFills = (acc: string[]): string | null => {
          if (acc.length === slots.length) {
            const seg = joinGapSegment(acc);
            return seg !== stored && gapStageCorrect(st, seg) ? seg : null;
          }
          const slot = slots[acc.length]!;
          const options = slot.kind === "sign" ? signsSet : [...new Set(tray)].map(String);
          for (const o of options) {
            const r = tryFills([...acc, o]);
            if (r) return r;
          }
          return null;
        };
        const other = tryFills([]);
        if (other) return { p, k, other };
      }
    }
    return null;
  })();
  ok(!!alt, "a deal with a second true fill exists");
  if (alt) {
    const answers = alt.p.gapAnswers!.map((a, k) => (k === alt.k ? alt.other : a));
    const g = gradeAnswer(alt.p, joinCountSuffix(joinStages(answers, 4), [1, 1, 1, 1]), 60_000);
    ok(g.isCorrect && g.score === 200, `any true fill counts: equation ${alt.k + 1} filled "${alt.other}" (stored "${alt.p.gapAnswers![alt.k]}") scores ${g.score}`);
    ok(equationVerdict(alt.p, alt.k, alt.other), "equationVerdict agrees");
  }
  ok(!gapStageCorrect(fixed.stages[3]!, "+,2,+,9,×"), "a step that isn't whole (12 + 2 + 7 ÷ 9) is refused");
  ok(gapStageCorrect(fixed.stages[3]!, "+,3,+,2,×"), "12 + 3 + 7 ÷ 2 × 5 = 55, whole at every step");

  // Tries and the score: a clean fast solve 200; a solve with a wrong try first, less; over the limit, the equation lost.
  const p = dealEquation(SEEDS[0]!) as EquationPuzzleData;
  const limit = puzzleTimeLimitMs(p);
  const right = p.gapAnswers!;
  const clean = gradeAnswer(p, joinCountSuffix(joinStages(right, 4), [1, 1, 1, 1]), limit - 20_000);
  ok(clean.isCorrect && clean.score === 200 && parts(clean)?.base === 150, `Operator: four clean fills in 20 s score 200 (${clean.score})`);
  const retried = gradeAnswer(p, joinCountSuffix(joinStages(right, 4), [2, 1, 1, 1]), limit - 20_000);
  ok(retried.isCorrect && retried.score < 200 && retried.score >= 190, `Operator: one equation on its second try scores ${retried.score}`);
  const over = gradeAnswer(p, joinCountSuffix(joinStages(right, 4), [4, 1, 1, 1]), limit - 20_000);
  ok(!over.isCorrect && over.score < 150, `Operator: an equation tried past the limit doesn't count (${over.score})`);
  const blank = gradeAnswer(p, joinCountSuffix(joinStages(["", "", "", ""], 4), [0, 0, 0, 0]), 0);
  ok(blank.score === 0, `Operator: nothing scores 0 (${blank.score})`);
  const { tryLimit } = p;
  ok(tryLimit === 3 && splitCountSuffix(joinCountSuffix("a|b", [1, 2])).counts.join() === "1,2", "Operator: three tries an equation, as before");
}

/* 4. The stricter par */
{
  for (const type of BATCH_TYPES) {
    let at200 = 0;
    for (let i = 0; i < 20; i++) {
      const p = dealBatch(type, 5000 + i * 17);
      const f = flawlessSolve(type, p);
      if (!f) continue;
      const g = gradeAnswer(p, f.answer, f.msLeft);
      if (g.isCorrect && g.score === 200 && parts(g)?.speed === 30 && parts(g)?.efficiency === 20) at200++;
      else ok(false, `${type} ${5000 + i * 17}: flawless ${g.score} (${JSON.stringify(parts(g))})`);
    }
    ok(at200 === 20, `${type}: a flawless solve scores 200 on ${at200} of 20 seeds`);
  }
  const expectPar = (used: number, par: number) => Math.round(20 * Math.max(0, Math.min(1, used <= par ? 1 : (1.5 * par - used) / (0.5 * par))));
  const m = dealBatch("maze", 9001) as MazePuzzleData;
  const route = m.solution!;
  const par = route.length - 1;
  const limit = puzzleTimeLimitMs(m);
  for (const extra of [0, 2, 10, Math.floor(par / 4) * 2, Math.floor(par / 2) * 2, par + 1]) {
    const reps = Math.ceil(extra / 2);
    const trail = [route[0]!, ...Array.from({ length: reps }, () => [route[1]!, route[0]!]).flat(), ...route.slice(1)];
    const g = gradeAnswer(m, encodeMazeTrail(trail, mazeColsOf(m)), limit - 10_000);
    const walked = trail.length - 1;
    ok(g.isCorrect && g.score === 180 + expectPar(walked, par), `Labyrinth: ${walked} steps for par ${par} scores ${g.score}, want ${180 + expectPar(walked, par)} (0 at 1.5× par)`);
  }
  const t = dealBatch("gravity", 9003) as Of<"gravity">;
  const f = flawlessSolve("gravity", t)!;
  ok(gradeAnswer(t, f.answer, 0).score === 170, "Topsy-Turvy: the fewest tilts at the buzzer is 150 + 0 + 20");
  for (const type of BATCH_TYPES) {
    const p = dealBatch(type, 9004);
    const s = flawlessSolve(type, p)!;
    const lim = puzzleTimeLimitMs(p);
    const fullBy = PAR_STRICT_FULL_BY_S[type];
    ok(gradeAnswer(p, s.answer, lim - fullBy * 1000).score === 200, `${type}: full speed at ${fullBy} s`);
    ok(gradeAnswer(p, s.answer, lim - fullBy * 1000 - 2000).score < 200, `${type}: less than full speed 2 s after ${fullBy} s`);
    const half = gradeAnswer(p, s.answer, Math.round((lim - fullBy * 1000) / 2));
    ok(half.score === 185, `${type}: half way through the speed window scores 185 (${half.score})`);
  }
}

/* 5. Bands */
console.log(`Medians weak → flawless on ${SEEDS_N} room seeds (random play = guessing), before → after:`);
for (const type of [...BATCH_TYPES, "equation"] as const) {
  const rows = polishRows(type, SEEDS);
  for (const line of formatRows(type, rows)) console.log(line);
  for (let i = 1; i < BAND_LEVELS.length; i++) {
    ok(median(rows.after[BAND_LEVELS[i]!]) >= median(rows.after[BAND_LEVELS[i - 1]!]), `${type}: the ${BAND_LEVELS[i]} median is no lower than ${BAND_LEVELS[i - 1]}'s`);
  }
  ok(median(rows.after.flawless) === 200, `${type}: flawless median 200 (${median(rows.after.flawless)})`);
  ok(median(rows.after.random) < median(rows.after.weak), `${type}: random play's median ${median(rows.after.random)} is under the weak median ${median(rows.after.weak)}`);
  if (type !== "equation") {
    for (const seed of SEEDS.slice(0, 4)) {
      const p = dealBatch(type, seed);
      for (const sp of spamBatch(type, p, seed)) {
        const g = gradeAnswer(p, sp.answer, sp.msLeft);
        if (g.isCorrect && !sp.label.startsWith("blind-dfs")) ok((parts(g)?.efficiency ?? 0) === 0, `${type} ${seed} ${sp.label}: a random finish earns no par points`);
      }
    }
  }
}

/* 6. Texts */
{
  const help = (type: string) => {
    const h = PUZZLE_INSTRUCTIONS[type as keyof typeof PUZZLE_INSTRUCTIONS];
    return `${h.score} ${h.how.map((x) => `${x.action} ${x.detail}`).join(" ")}`;
  };
  for (const type of BATCH_TYPES) {
    const t = help(type);
    ok(/shown on screen/.test(t) && /one and a half times par/.test(t) && t.includes(`${PAR_STRICT_FULL_BY_S[type]} s`), `${type}: the help states the shown par, 1.5× par and ${PAR_STRICT_FULL_BY_S[type]} s`);
    pinned(pinPreParStrict, () => ok(/twice par/.test(help(type)) && !/shown on screen/.test(help(type)), `${type}: pinned, the help states the puzzle batch's rules`));
  }
  const eq = help("equation");
  ok(/teal squares take a number/.test(eq) && /Any answer that’s true counts/.test(eq) && /full fill/.test(eq), "equation: the help states the gaps");
  pinned(pinPreOperatorGaps, () => ok(/choose its sign/.test(help("equation")) && /full set of signs/.test(help("equation")), "equation: pinned, the help states the signs-only rules"));
}

console.log(`${passes} passed, ${fails} failed`);
if (fails) {
  console.log("FAIL puzzle-polish-nov-check");
  process.exit(1);
}
console.log("PASS puzzle-polish-nov-check");
