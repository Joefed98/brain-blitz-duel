/**
 * The partial-credit fixes of 7 Nov 2026 (src/lib/duel/partialCredit.ts, docs/partial-credit-nov-2026.md): Blackout,
 * Hanoi and Polypotions `depthRev 3`, Gridlock `unblockRev 3`, Turntable `ringsRev 4`, Exact `depthRev 4`, Gradient
 * `tilesRev 7`. Proves:
 *
 *   1. Older stamps: the stamps dealt before (pinPrePartialCredit) deal the puzzles recorded on main and grade 917
 *      answers (flawless-line prefixes, kit levels, spam, Gradient's route players) exactly as main did
 *      (scripts/fixtures/partial-credit-legacy.json.gz, scripts/partial-credit-record.ts).
 *   2. Deals: rooms deal the new stamps (Gradient with its swap limit, 1.5 × par rounded up); pinned, the old ones.
 *   3. The rules on the new stamps, on 12 room seeds a game: along the flawless line every unfinished prefix scores at
 *      least the one before it, at least 80 % of 130 × its share of the line, and the prefix nearest 45 % scores 45+;
 *      a quick flawless finish scores 200; every grade's parts add up to its score; better kit levels never score
 *      lower (medians) and spam stays near 0; Gradient's swap limit holds (swaps past it never count, a solve past it
 *      is no finish) and random swapping scores less than an average player.
 *   4. Texts: the help, intro and reveal note describe the stamps dealt.
 *
 *   bun scripts/partial-credit-check.ts   (~20 s)
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import {
  GRADIENT_LIMIT_PER_PAR,
  PARTIAL_CREDIT_STAMPS,
  PARTIAL_SHARE_POINTS,
  gradientSwapLimit,
  partialCreditDealt,
  partialProgressNote,
  pinPrePartialCredit,
  usesPartialCredit,
} from "../src/lib/duel/partialCredit";
import { STANDARD_STAMPS } from "../src/lib/duel/standard/stamps";
import { decodeGradient, encodeGradient, gradientLocked, replayGradientAnswer } from "../src/lib/duel/jumbled";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import type { PuzzleData, PuzzleType, TilesPuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { gradeSteps, median, sentAnswer } from "./standard-lib";
import { PARTIAL_CREDIT_SEEDS, PARTIAL_CREDIT_TYPES, casesFor, dealFor, gradientDrafts, type LegacyCase } from "./partial-credit-record";

const failures: string[] = [];
let checks = 0;
function ok(cond: boolean, msg: string): void {
  checks++;
  if (!cond) {
    failures.push(msg);
    console.log(`FAIL ${msg}`);
  }
}
const stampOf = (p: PuzzleData, key: string) => (p as unknown as Record<string, unknown>)[key];

/* ------------------------------------------------------------------ 1. older stamps, exactly as main */

{
  const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/partial-credit-legacy.json.gz")).toString()) as {
    puzzles: { type: PuzzleType; seed: number; puzzle: PuzzleData }[];
    cases: LegacyCase[];
  };
  const prev = pinPrePartialCredit(true);
  try {
    const stored = new Map(fixture.puzzles.map((e) => [`${e.type}:${e.seed}`, e.puzzle]));
    for (const { type, seed, puzzle } of fixture.puzzles) {
      const dealt = dealFor(type, seed);
      ok(JSON.stringify(dealt) === JSON.stringify(puzzle), `${type} ${seed}: pinned deal matches main's`);
      ok(!usesPartialCredit(puzzle), `${type} ${seed}: main's deal is not on the new stamp`);
      const rebuilt = casesFor(type, seed, puzzle);
      const recorded = fixture.cases.filter((c) => c.type === type && c.seed === seed);
      ok(rebuilt.length === recorded.length && rebuilt.every((c, i) => c.answer === recorded[i]!.answer && c.label === recorded[i]!.label), `${type} ${seed}: the recorded answers rebuild`);
    }
    let same = 0;
    for (const c of fixture.cases) {
      const g = gradeAnswer(stored.get(`${c.type}:${c.seed}`)!, c.answer, c.msLeft);
      if (g.score === c.score && g.isCorrect === c.isCorrect) same++;
      else ok(false, `${c.type} ${c.seed} ${c.label}: scored ${g.score}${g.isCorrect ? " (solved)" : ""}, main ${c.score}${c.isCorrect ? " (solved)" : ""}`);
    }
    ok(same === fixture.cases.length && fixture.cases.length > 900, `older stamps: ${same} of ${fixture.cases.length} recorded grades identical`);
  } finally {
    pinPrePartialCredit(prev);
  }
}

/* ------------------------------------------------------------------ 2. deals */

for (const type of PARTIAL_CREDIT_TYPES) {
  const st = PARTIAL_CREDIT_STAMPS[type]!;
  const std = STANDARD_STAMPS[type]!;
  for (const seed of PARTIAL_CREDIT_SEEDS.slice(0, 3)) {
    const now = dealFor(type, seed);
    ok(stampOf(now, st.key) === st.rev && usesPartialCredit(now), `${type} ${seed}: rooms deal ${st.key} ${st.rev} (got ${String(stampOf(now, st.key))})`);
    const prev = pinPrePartialCredit(true);
    const old = dealFor(type, seed);
    pinPrePartialCredit(prev);
    ok(stampOf(old, st.key) === (std.dealt ?? std.rev), `${type} ${seed}: pinned, ${st.key} ${std.dealt ?? std.rev}`);
    // The same board: only the stamp (and Gradient's limit) differ.
    const strip = (p: PuzzleData) => JSON.stringify({ ...p, [st.key]: 0, swapLimit: 0 });
    ok(strip(now) === strip(old), `${type} ${seed}: the new stamp deals the same board`);
    if (type === "tiles") {
      const t = now as TilesPuzzleData;
      ok(t.swapLimit === Math.ceil(GRADIENT_LIMIT_PER_PAR * (t.par ?? 0)) && gradientSwapLimit(t) === t.swapLimit, `Gradient ${seed}: swap limit ${t.swapLimit} = ceil(1.5 × par ${t.par})`);
      ok(gradientSwapLimit(old) === null && (old as TilesPuzzleData).swapLimit === undefined, `Gradient ${seed}: no limit on tilesRev 6`);
    }
  }
}

/* ------------------------------------------------------------------ 3. the rules on the new stamps */

const SEEDS = Array.from({ length: 12 }, (_, i) => 6100 + i * 7);

function partsAddUp(g: ReturnType<typeof gradeAnswer>): boolean {
  const parts = storedScoreParts(g.extra);
  if (!parts) return false;
  if (parts.kind === "partial") return parts.base === g.score;
  return parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) === g.score;
}

function lineDrafts(type: PuzzleType, p: PuzzleData, seed: number): string[] {
  if (type === "tiles") return gradientDrafts(p as TilesPuzzleData, 0, hashText(`pcc:${seed}:line`));
  const steps = KITS[type]!.play(p, makeRng(hashText(`pcc:${type}:${seed}:line`)), { ...SKILLS.near, err: 0 }, puzzleTimeLimitMs(p)).steps;
  return steps.map((_, i) => sentAnswer(p, steps.slice(0, i + 1).map((s) => ({ answer: s.answer, atMs: 0 }))));
}

for (const type of PARTIAL_CREDIT_TYPES) {
  let dips = 0;
  let underShare = 0;
  let unbalanced = 0;
  const near45: number[] = [];
  const finishes: number[] = [];
  for (const seed of SEEDS) {
    const p = dealFor(type, seed);
    const limit = puzzleTimeLimitMs(p);
    const drafts = lineDrafts(type, p, seed);
    const n = drafts.length;
    let prev = 0;
    for (let i = 0; i < n - 1; i++) {
      const g = gradeAnswer(p, drafts[i]!, 0);
      if (g.isCorrect) continue;
      if (!partsAddUp(g)) unbalanced++;
      if (g.score < prev) dips++;
      prev = Math.max(prev, g.score);
      if (g.score < Math.floor(0.8 * PARTIAL_SHARE_POINTS * ((i + 1) / n))) underShare++;
    }
    if (n >= 3) near45.push(gradeAnswer(p, drafts[Math.max(0, Math.round(0.45 * n) - 1)]!, 0).score);
    const fin = gradeAnswer(p, drafts[n - 1]!, limit - 1000);
    if (!partsAddUp(fin)) unbalanced++;
    finishes.push(fin.isCorrect ? fin.score : -1);
  }
  ok(dips === 0, `${type}: the flawless line never dips (${dips} dips)`);
  ok(underShare === 0, `${type}: every prefix of the flawless line scores at least 80 % of 130 × its share (${underShare} under)`);
  ok(near45.length > 0 && Math.min(...near45) >= 45, `${type}: 45 % of the way scores 45+ (lowest ${Math.min(...near45)})`);
  ok(finishes.every((s) => s === 200), `${type}: a quick flawless finish scores 200 (${finishes.join(", ")})`);
  ok(unbalanced === 0, `${type}: every grade's parts add up (${unbalanced} don't)`);

  // Better kit levels never score lower; spam stays near 0.
  if (type !== "tiles") {
    const kit = KITS[type]!;
    const med: Record<string, number> = {};
    const spam: number[] = [];
    for (const level of LEVELS) {
      const scores = SEEDS.map((seed) => {
        const p = dealFor(type, seed);
        const play = kit.play(p, makeRng(hashText(`std:${type}:${seed}:${level}`)), SKILLS[level], puzzleTimeLimitMs(p));
        return gradeSteps(p, play.steps, play.timed).score;
      });
      med[level] = median(scores);
    }
    for (const seed of SEEDS) {
      const p = dealFor(type, seed);
      for (const sp of kit.spam(p, makeRng(hashText(`std:${type}:spam:${seed}`)), puzzleTimeLimitMs(p))) spam.push(gradeAnswer(p, sp.answer, 0).score);
    }
    ok(LEVELS.every((l, i) => i === 0 || med[l]! >= med[LEVELS[i - 1]!]!), `${type}: level medians rise (${LEVELS.map((l) => med[l]).join(" / ")})`);
    ok(median(spam) <= 5 && median(spam) < med.average!, `${type}: spam median ${median(spam)} near 0, under average ${med.average}`);
  }
}

// Gradient's swap limit.
{
  const random: number[] = [];
  const average: number[] = [];
  for (const seed of SEEDS) {
    const p = dealFor("tiles", seed) as TilesPuzzleData;
    const limit = gradientSwapLimit(p)!;
    // Random swapping (every swap counts until the limit).
    const rnd = gradientDrafts(p, 1, hashText(`pcc:rnd:${seed}`));
    const rg = gradeAnswer(p, rnd[rnd.length - 1]!, 60_000);
    random.push(rg.score);
    const avg = gradientDrafts(p, 0.25, hashText(`pcc:avg:${seed}`));
    average.push(gradeAnswer(p, avg[avg.length - 1]!, 0).score);
    // Swaps past the limit don't count: a run wasting the whole limit first, then the route, stays unsolved.
    const free = p.frame.map((_, c) => c).filter((c) => !gradientLocked(p.frame, c));
    const pair = free.flatMap((a) => free.map((b) => ({ a, b }))).find(({ a, b }) => a < b && p.frame[a] !== b && p.frame[b] !== a)!;
    const route = decodeGradient(gradientDrafts(p, 0, hashText(`pcc:${seed}:line`)).pop()!);
    // A pair swapped and swapped back (an even count leaves the board as it was).
    const even = (k: number) => k - (k % 2);
    const wasted = encodeGradient([...Array.from({ length: even(limit - route.length + 2) }, () => pair), ...route]);
    const replay = replayGradientAnswer(p, wasted);
    ok(replay.moves === limit && !replay.solved, `Gradient ${seed}: swaps stop at the limit ${limit} (counted ${replay.moves})`);
    ok(!gradeAnswer(p, wasted, 60_000).isCorrect, `Gradient ${seed}: a solve past the limit is no finish`);
    const fits = encodeGradient([...Array.from({ length: even(limit - route.length) }, () => pair), ...route]);
    const fit = gradeAnswer(p, fits, 60_000);
    ok(fit.isCorrect && fit.score >= 150, `Gradient ${seed}: a solve within the limit is a finish (${fit.score})`);
    // The same boards without the limit (tilesRev 6) keep every swap.
    const old = { ...p, tilesRev: 6 } as TilesPuzzleData;
    delete (old as { swapLimit?: number }).swapLimit;
    ok(gradeAnswer(old, wasted, 60_000).isCorrect, `Gradient ${seed}: tilesRev 6 has no limit`);
  }
  ok(median(random) <= 5 && median(random) < median(average), `Gradient: random swapping scores ${median(random)} (median) against a sloppy player's ${median(average)}`);
  ok(Math.max(...random) < 150, `Gradient: random swapping never finishes inside the limit (best ${Math.max(...random)})`);
}

/* ------------------------------------------------------------------ 4. texts */

{
  ok(partialCreditDealt(), "the help describes the new stamps by default");
  const help = (t: PuzzleType) => String(PUZZLE_INSTRUCTIONS[t]!.score);
  for (const t of ["lightsout", "tower", "tubes", "unblock", "rings", "tiles"] as PuzzleType[]) ok(/in proportion/.test(help(t)), `${t}: help says unfinished counts in proportion`);
  ok(/solution you built/.test(help("target")), "target: help names the solution built");
  ok(/swap limit/.test(help("tiles")) && PUZZLE_INSTRUCTIONS.tiles.how.some((h) => /Swaps are limited/.test(h.action)), "tiles: help and How name the swap limit");
  for (const t of ["lightsout", "tower", "tubes", "unblock", "rings", "target"] as PuzzleType[]) ok(/partway counts/.test(INTRO_SCORE[t]), `${t}: intro says partway counts`);
  ok(/swaps run out/.test(INTRO_SCORE.tiles), "tiles: intro names the swap limit");
  const prev = pinPrePartialCredit(true);
  try {
    for (const t of ["lightsout", "tower", "tubes", "unblock", "rings", "tiles"] as PuzzleType[]) ok(!/in proportion/.test(help(t)), `${t}: pinned, the help describes the older stamp`);
    ok(!/partway counts/.test(INTRO_SCORE.tower), "pinned, the intro describes the older stamp");
  } finally {
    pinPrePartialCredit(prev);
  }
  // The reveal's note, from what the server stored.
  const tower = dealFor("tower", 6100);
  const half = lineDrafts("tower", tower, 6100);
  const g = gradeAnswer(tower, half[Math.floor(half.length / 2)]!, 0);
  ok(partialProgressNote(tower, g.extra) === `${g.extra!.progress} % of the way`, `reveal note: "${partialProgressNote(tower, g.extra)}"`);
  const exact = dealFor("target", 6100);
  const ex = lineDrafts("target", exact, 6100);
  const eg = gradeAnswer(exact, ex[1]!, 0);
  ok(/% of a solution built|closest \d+ away/.test(partialProgressNote(exact, eg.extra) ?? ""), `Exact reveal note: "${partialProgressNote(exact, eg.extra)}"`);
  const prev2 = pinPrePartialCredit(true);
  const oldTower = dealFor("tower", 6100);
  pinPrePartialCredit(prev2);
  ok(partialProgressNote(oldTower, gradeAnswer(oldTower, half[1]!, 0).extra) === null, "no reveal note on the older stamp");
}

console.log(failures.length ? `FAIL: ${failures.length} of ${checks} checks failed` : `partial-credit-check: ${checks} passed`);
process.exit(failures.length ? 1 : 0);
