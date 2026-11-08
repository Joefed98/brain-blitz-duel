/**
 * The partial-credit fixes' report (7 Nov 2026, src/lib/duel/partialCredit.ts, docs/partial-credit-nov-2026.md), not a
 * check: for Blackout, Hanoi, Polypotions, Gridlock, Turntable, Exact and Gradient, on room seeds, before (the stamps
 * dealt until now, `pinPrePartialCredit`) and after (the new stamps):
 *
 * 1. The optimal line: each prefix of a flawless player's drafts graded as a buzzer draft (0 ms left). Reports the
 *    scores at a quarter, a half and three quarters of the way (min / median / max over seeds), the median at the
 *    prefix nearest 45 %, and how many seeds' lines ever dip (a prefix scoring less than the one before it).
 * 2. The bands: the kit players (nothing, spam, average, good, great, near-perfect) graded as phones send them;
 *    Gradient's own route players (standard-pattern-check's) plus random swapping, two a second.
 *
 *   bun scripts/partial-credit-bands.ts [types…] [--seeds=20] [--from=6100]
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPrePartialCredit, PARTIAL_CREDIT_STAMPS } from "../src/lib/duel/partialCredit";
import { encodeGradient, gradientLocked, gradientSwap, gradientSwapLimit, jumbledSolved, type GradientSwap } from "../src/lib/duel/jumbled";
import { gradientRoute } from "../src/lib/duel/jumbled.server";
import type { PuzzleData, PuzzleType, TilesPuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { LEVELS, SKILLS, hashText, makeRng, type Level, type Skill, type Step } from "./puzzle-fairness/kit";
import { gradeSteps, median, quantile, sentAnswer } from "./standard-lib";
import { JUMBLED_SKILLS } from "./d5-remodels/bots";

const args = process.argv.slice(2);
const n = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 20);
const from = Number(args.find((a) => a.startsWith("--from="))?.slice(7) ?? 6100);
const types = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const list = types.length ? types : (Object.keys(PARTIAL_CREDIT_STAMPS) as PuzzleType[]);
const seeds = Array.from({ length: n }, (_, i) => from + i * 7);

const FLAWLESS: Skill = { ...SKILLS.near, err: 0 };

/** Gradient boards are dealt live (the kit's roomPuzzle deals the older slide boards for the D5 remodels). */
function deal(type: PuzzleType, seed: number): PuzzleData {
  if (type === "tiles") return withSeededRandom(seed, () => generatePuzzle("tiles", { bankSeed: seed }));
  return roomPuzzle(type, seed);
}

/* ------------------------------------------------------------------ Gradient players (standard-pattern-check's) */

const GRADIENT_SWAP_S = 4.5;
const GRADIENT_READ_S = 10;
const GRADIENT_ERR: Record<Level, number> = { average: JUMBLED_SKILLS.average.err, good: JUMBLED_SKILLS.good.err, great: JUMBLED_SKILLS.great.err, near: JUMBLED_SKILLS.near.err };

function gradientSteps(p: TilesPuzzleData, skill: Skill, err: number, rngSeed: number): Step[] {
  const rng = makeRng(rngSeed);
  const limit = puzzleTimeLimitMs(p);
  const swapLimit = gradientSwapLimit(p);
  let frame = [...p.frame];
  const swaps: GradientSwap[] = [];
  const steps: Step[] = [];
  let at = Math.round(GRADIENT_READ_S * skill.pace * 1000);
  while (!jumbledSolved(frame) && at < limit + 10_000 && (swapLimit === null || swaps.length < swapLimit)) {
    let swap: GradientSwap;
    if (rng.chance(err)) {
      const free = frame.map((_, c) => c).filter((c) => !gradientLocked(frame, c));
      const a = rng.pick(free);
      swap = { a, b: rng.pick(free.filter((c) => c !== a)) };
    } else {
      const next = gradientRoute(frame)[0]!;
      swap = { a: Math.floor(next / 100), b: next % 100 };
    }
    at += Math.max(250, Math.round(GRADIENT_SWAP_S * skill.pace * Math.exp(rng.normal(0, 0.35)) * 1000));
    const next = gradientSwap(frame, swap);
    if (!next) continue;
    frame = next;
    swaps.push(swap);
    steps.push({ answer: encodeGradient(swaps), atMs: at });
  }
  return steps;
}

/** Random swaps of two unlocked tiles, two a second, until solved, out of swaps or the buzzer. */
function gradientSpam(p: TilesPuzzleData, rngSeed: number): { answer: string; atMs: number } {
  const rng = makeRng(rngSeed);
  const limit = puzzleTimeLimitMs(p);
  const swapLimit = gradientSwapLimit(p);
  let frame = [...p.frame];
  const swaps: GradientSwap[] = [];
  let at = 0;
  while (!jumbledSolved(frame) && at + 500 < limit && (swapLimit === null || swaps.length < swapLimit)) {
    at += 500;
    const free = frame.map((_, c) => c).filter((c) => !gradientLocked(frame, c));
    const a = rng.pick(free);
    const swap = { a, b: rng.pick(free.filter((c) => c !== a)) };
    frame = gradientSwap(frame, swap)!;
    swaps.push(swap);
  }
  return { answer: encodeGradient(swaps), atMs: at };
}

/* ------------------------------------------------------------------ the report */

function flawlessSteps(type: PuzzleType, p: PuzzleData, seed: number): Step[] {
  if (type === "tiles") return gradientSteps(p as TilesPuzzleData, FLAWLESS, 0, hashText(`pc:${type}:${seed}:line`));
  const kit = KITS[type]!;
  return kit.play(p, makeRng(hashText(`pc:${type}:${seed}:line`)), FLAWLESS, puzzleTimeLimitMs(p)).steps;
}

interface LineReport {
  at: Record<number, number[]>;
  near45: number[];
  dips: number;
  seeds: number;
  worstDip: number;
}

function optimalLine(type: PuzzleType): LineReport {
  const out: LineReport = { at: { 25: [], 50: [], 75: [] }, near45: [], dips: 0, seeds: 0, worstDip: 0 };
  for (const seed of seeds) {
    const p = deal(type, seed);
    const steps = flawlessSteps(type, p, seed);
    if (steps.length < 3) continue;
    out.seeds++;
    // The last step solves: grade every prefix before it as a buzzer draft.
    const scores: number[] = [];
    for (let i = 0; i < steps.length - 1; i++) {
      const drafts = steps.slice(0, i + 1).map((s) => ({ answer: s.answer, atMs: s.atMs }));
      scores.push(gradeAnswer(p, sentAnswer(p, drafts), 0).score);
    }
    const total = steps.length;
    for (const q of [25, 50, 75]) out.at[q]!.push(scores[Math.max(0, Math.round((q / 100) * total) - 1)] ?? 0);
    out.near45.push(scores[Math.max(0, Math.round(0.45 * total) - 1)] ?? 0);
    let dipped = false;
    for (let i = 1; i < scores.length; i++) if (scores[i]! < scores[i - 1]!) { dipped = true; out.worstDip = Math.max(out.worstDip, scores[i - 1]! - scores[i]!); }
    if (dipped) out.dips++;
  }
  return out;
}

function bands(type: PuzzleType): { label: string; scores: number[] }[] {
  const rows: { label: string; scores: number[] }[] = [];
  if (type === "tiles") {
    const spam: number[] = [];
    const lv = LEVELS.map((level) => ({ label: level as string, scores: [] as number[] }));
    for (const seed of seeds) {
      const p = deal(type, seed) as TilesPuzzleData;
      for (let k = 0; k < 3; k++) {
        // Graded when it stopped: a solve with its time left, else at the buzzer.
        const sp = gradientSpam(p, hashText(`pc:tiles:spam:${seed}:${k}`));
        const solved = gradeAnswer(p, sp.answer, Math.max(0, puzzleTimeLimitMs(p) - sp.atMs));
        spam.push(solved.isCorrect ? solved.score : gradeAnswer(p, sp.answer, 0).score);
      }
      LEVELS.forEach((level, i) => lv[i]!.scores.push(gradeSteps(p, gradientSteps(p, SKILLS[level], GRADIENT_ERR[level], hashText(`pc:tiles:${seed}:${level}`))).score));
    }
    rows.push({ label: "random", scores: spam }, ...lv);
    return rows;
  }
  const kit = KITS[type]!;
  const nothing: number[] = [];
  const spam: number[] = [];
  const lv = LEVELS.map((level) => ({ label: level as string, scores: [] as number[] }));
  for (const seed of seeds) {
    const p = deal(type, seed);
    const limit = puzzleTimeLimitMs(p);
    nothing.push(gradeAnswer(p, kit.nothing(p), 0).score);
    for (const sp of kit.spam(p, makeRng(hashText(`std:${type}:spam:${seed}`)), limit)) spam.push(gradeAnswer(p, sp.answer, 0).score);
    LEVELS.forEach((level, i) => {
      const play = kit.play(p, makeRng(hashText(`std:${type}:${seed}:${level}`)), SKILLS[level], limit);
      lv[i]!.scores.push(gradeSteps(p, play.steps, play.timed).score);
    });
  }
  rows.push({ label: "nothing", scores: nothing }, { label: "spam", scores: spam }, ...lv);
  return rows;
}

const span = (xs: number[]) => (xs.length ? `${Math.min(...xs)}–${median(xs)}–${Math.max(...xs)}` : "-");
const band = (xs: number[]) => `median ${String(median(xs)).padStart(3)}  p10 ${String(quantile(xs, 0.1)).padStart(3)}  p90 ${String(quantile(xs, 0.9)).padStart(3)}`;

for (const type of list) {
  console.log(`\n${type} (${seeds.length} seeds from ${from})`);
  for (const world of ["before", "after"] as const) {
    const prev = pinPrePartialCredit(world === "before");
    try {
      const stamp = PARTIAL_CREDIT_STAMPS[type]!;
      const sample = deal(type, seeds[0]!) as unknown as Record<string, unknown>;
      const line = optimalLine(type);
      console.log(`  ${world} (${stamp.key} ${sample[stamp.key]})`);
      console.log(`    optimal line, min–median–max: 25 % ${span(line.at[25]!)} · 50 % ${span(line.at[50]!)} · 75 % ${span(line.at[75]!)} · 45 % median ${median(line.near45)} · dips on ${line.dips} of ${line.seeds} lines (worst ${line.worstDip})`);
      for (const r of bands(type)) console.log(`    ${r.label.padEnd(8)} ${band(r.scores)}`);
    } finally {
      pinPrePartialCredit(prev);
    }
  }
}
