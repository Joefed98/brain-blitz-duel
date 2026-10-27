/**
 * Matchmaker, Depth to 200 (25 Oct 2026, `pairRev: 1`; docs/depth/d3-speed-attention.md).
 *
 *   1. Legacy: every round recorded on main before the change (scripts/fixtures/depth-chain-pair-legacy.json.gz)
 *      grades to the same score, verdict, time and detail.
 *   2. Dealt: new boards carry pairRev 1 and a gold pair that is one of their fifteen, the same cards as before
 *      (the gold is drawn after the deal); older demos stay stopped.
 *   3. Rules: the base is puzzleScoreRev 3's score (at most 150); the streak and gold bonuses are walked from the
 *      flips exactly as replayPairs walks them; without either feature no flip list scores above 150.
 *   4. Bots: the kit players, an elite one and a feature-perfect one (perfect memory: cashes the gold pair the
 *      moment both cards are seen and every other pair in one run at the end), old vs new.
 *
 *   bun scripts/depth-matchmaker-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { generatePairMatch } from "../src/lib/duel/pairmatch.server";
import { encodePairFlips, sameCard } from "../src/lib/duel/pairmatch";
import { withSeededRandom } from "../src/lib/duel/random";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { PAIR_PAIRS, PAIR_TIME_MS, type PairPuzzleData, type PuzzleData } from "../src/lib/duel/types";
import {
  PAIR_DEPTH_REV,
  PAIR_GOLD_FULL_TRY,
  PAIR_GOLD_MAX,
  PAIR_GOLD_ZERO_TRY,
  PAIR_STREAK_FREE,
  PAIR_STREAK_MAX,
  pairDepthReplay,
  pairGoldBonus,
  pairStreakBonus,
  pairUsesDepth,
} from "../src/lib/duel/depth/matchmaker";
import { hashText, makeRng, type Play, type Rng } from "./puzzle-fairness/kit";
import { pinPrePhoneNotes } from "../src/lib/duel/phoneNotes";

// Written for the stamps before Joe's phone notes (27 Oct 2026): new deals stay on them here; phone-notes-check proves
// the stamps rooms deal now.
pinPrePhoneNotes(true);
import { BOT_LEVELS, ELITE, botRuns, levelRow, printTable } from "./depth/chain-pair-bots";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

/* ------------------------------------------------------------------ 1. legacy */
interface Recorded { type: string; seed: number; label: string; puzzle: PuzzleData; answer: string; ms: number; score: number; isCorrect: boolean; extra: unknown; storedMs: number }
const recorded = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth-chain-pair-legacy.json.gz")).toString()) as Recorded[]).filter((r) => r.type === "pairmatch");
let same = 0;
for (const r of recorded) {
  const g = gradeAnswer(r.puzzle, r.answer, r.ms);
  const match = g.score === r.score && g.isCorrect === r.isCorrect && g.storedMs === r.storedMs && JSON.stringify(g.extra) === JSON.stringify(r.extra);
  if (match) same++;
  else ok(false, `legacy ${r.seed} ${r.label}: ${r.score} → ${g.score}`);
}
ok(recorded.length >= 200 && same === recorded.length, `legacy rounds regrade identically (${same}/${recorded.length})`);
ok(recorded.every((r) => !pairUsesDepth(r.puzzle as PairPuzzleData) && r.score <= 150), "legacy rounds are unstamped and at most 150");

/* ------------------------------------------------------------------ 2. dealt */
for (let seed = 1; seed <= 60; seed++) {
  const p = withSeededRandom(seed, () => generatePuzzle("pairmatch")) as PairPuzzleData;
  ok(p.pairRev === PAIR_DEPTH_REV && pairUsesDepth(p), `seed ${seed}: pairRev 1`);
  ok(!!p.gold && p.cards.filter((c) => sameCard(c, p.gold)).length === 2, `seed ${seed}: the gold pair is one of the board's pairs`);
}
ok(roundMaxFor("pairmatch") === 200, "Matchmaker's maximum is 200");
ok(pairStreakBonus(PAIR_STREAK_FREE) === 0 && pairStreakBonus(PAIR_STREAK_FREE + 100) === PAIR_STREAK_MAX, "streak bonus: free points, then capped");
ok(pairGoldBonus(1) === PAIR_GOLD_MAX && pairGoldBonus(PAIR_GOLD_FULL_TRY) === PAIR_GOLD_MAX && pairGoldBonus(PAIR_GOLD_ZERO_TRY) === 0 && pairGoldBonus(null) === 0, "gold bonus: early full, late none");

/* ------------------------------------------------------------------ 3. rules */
const dealt = withSeededRandom(77, () => generatePuzzle("pairmatch")) as PairPuzzleData;
const unstamped = { ...dealt, pairRev: undefined, gold: undefined } as PairPuzzleData;
const pairsOf = (p: PairPuzzleData) => {
  const out: [number, number][] = [];
  const seen = new Set<number>();
  p.cards.forEach((c, i) => {
    if (seen.has(i)) return;
    const j = p.cards.findIndex((d, k) => k !== i && sameCard(c, d));
    seen.add(i).add(j);
    out.push([i, j]);
  });
  return out;
};
const pairs = pairsOf(dealt);
const goldIdx = pairs.findIndex(([a]) => sameCard(dealt.cards[a], dealt.gold));
// A perfect run: gold first, every pair in a row.
const perfect = [pairs[goldIdx]!, ...pairs.filter((_, i) => i !== goldIdx)].flat();
const gPerfect = gradeAnswer(dealt, encodePairFlips(perfect), PAIR_TIME_MS - 20_000);
const dPerfect = pairDepthReplay(dealt, perfect);
ok(dPerfect.bestStreak === PAIR_PAIRS && dPerfect.goldTry === 1 && gPerfect.score === 200, `every pair in a row, gold first: 200 (${gPerfect.score})`);
// Without the features: misses between every match and the gold last stay at the base.
const misses: number[] = [];
const order = [...pairs.filter((_, i) => i !== goldIdx), pairs[goldIdx]!];
for (let i = 0; i < order.length; i++) {
  const next = order[i + 1];
  misses.push(...order[i]!);
  if (next) misses.push(next[0], order[(i + 2) % order.length]![0]); // a miss: two cards of different pairs
}
const gPlain = gradeAnswer(dealt, encodePairFlips(misses), PAIR_TIME_MS - 20_000);
const gPlainOld = gradeAnswer(unstamped, encodePairFlips(misses), PAIR_TIME_MS - 20_000);
const dPlain = pairDepthReplay(dealt, misses);
ok(dPlain.streakBonus === 0 && dPlain.goldBonus === 0 && gPlain.score === gPlainOld.score && gPlain.score <= 150, `no streak and a late gold pair: the base only (${gPlain.score} = ${gPlainOld.score})`);
// The base never moves: for random flip lists the new score is the old one plus the two bonuses.
const rng = makeRng(hashText("pair-random"));
for (let k = 0; k < 300; k++) {
  const flips = Array.from({ length: rng.int(0, 120) }, () => rng.below(dealt.cards.length));
  const ms = rng.chance(0.5) ? 0 : rng.int(0, PAIR_TIME_MS);
  const g = gradeAnswer(dealt, encodePairFlips(flips), ms);
  const old = gradeAnswer(unstamped, encodePairFlips(flips), ms);
  const d = pairDepthReplay(dealt, flips);
  if (g.score !== Math.min(200, old.score + d.streakBonus + d.goldBonus) || g.isCorrect !== old.isCorrect || old.score > 150) {
    ok(false, `random flips ${k}: ${old.score} + ${d.streakBonus} + ${d.goldBonus} ≠ ${g.score}`);
    break;
  }
}
checks++;

/* ------------------------------------------------------------------ texts */
const intro = INTRO_SCORE.pairmatch;
ok(intro.length <= 90 && /\b200\b/.test(intro) && /gold pair/.test(intro), `intro: ${intro}`);
const help = PUZZLE_INSTRUCTIONS.pairmatch;
ok(/streak/.test(help.score) && /gold pair/.test(help.score) && /\b200 needs both/.test(help.score) && /120 to 150/.test(help.score), `help: ${help.score}`);
ok(help.how.some((h) => !h.helpOnly && /gold pair/.test(h.detail)), "the intro's how line names the features");

/* ------------------------------------------------------------------ 4. bots */
/** Feature-perfect play at the elite pace (see the header). */
function featurePlay(p: PuzzleData, seed: number): Play {
  const puzzle = p as PairPuzzleData;
  const r: Rng = makeRng(hashText(`depth:pairmatch:feature:${seed}`));
  const cards = puzzle.cards;
  const key = (i: number) => `${cards[i]!.shape}${cards[i]!.colour}`;
  const goldKey = `${puzzle.gold!.shape}${puzzle.gold!.colour}`;
  const known = new Map<string, number[]>();
  const matched = new Set<number>();
  const seen = new Set<number>();
  const flips: number[] = [];
  const steps: Play["steps"] = [];
  let t = 0;
  const flip = (i: number) => {
    t += Math.max(250, Math.round(800 * ELITE.pace * Math.exp(r.normal(0, 0.25))));
    flips.push(i);
    steps.push({ answer: encodePairFlips(flips), atMs: t });
  };
  const see = (i: number) => {
    seen.add(i);
    const l = known.get(key(i)) ?? [];
    if (!l.includes(i)) l.push(i);
    known.set(key(i), l);
  };
  const unknown = () => cards.map((_, i) => i).filter((i) => !seen.has(i));
  while (unknown().length) {
    const g = known.get(goldKey);
    if (g?.length === 2 && !matched.has(g[0]!)) {
      flip(g[0]!); flip(g[1]!); matched.add(g[0]!).add(g[1]!);
      continue;
    }
    const a = unknown()[0]!;
    flip(a); see(a);
    const twin = (known.get(key(a)) ?? []).find((j) => j !== a);
    if (twin !== undefined && key(a) === goldKey) { flip(twin); matched.add(a).add(twin); continue; }
    const b = unknown()[0] ?? cards.map((_, i) => i).find((i) => i !== a && !matched.has(i))!;
    flip(b); see(b);
    if (key(a) === key(b)) matched.add(a).add(b);
    else t += 600;
  }
  for (const [, l] of known) if (!matched.has(l[0]!)) { flip(l[0]!); flip(l[1]!); matched.add(l[0]!).add(l[1]!); }
  return { steps };
}
const strip = (p: PuzzleData) => ({ ...(p as PairPuzzleData), pairRev: undefined, gold: undefined }) as PuzzleData;
const SEEDS = 60;
const levels = [...BOT_LEVELS, ["feature-perfect", ELITE] as const];
const rows = levels.map(([level, skill]) => levelRow(level, botRuns("pairmatch", skill, level, SEEDS, strip, level === "feature-perfect" ? featurePlay : undefined)));
printTable(`Matchmaker, ${SEEDS} room seeds per bot (old = pairRev absent, new = pairRev 1)`, rows);
const row = (l: string) => rows.find((x) => x.level === l)!;
for (const l of ["average", "good", "great"]) {
  const x = row(l);
  ok(x.now.median - x.old.median <= Math.max(4, 0.1 * x.old.median), `${l}: median roughly where it was (${x.old.median} → ${x.now.median})`);
}
ok(row("near-perfect").now.median >= 150 && row("near-perfect").now.median <= 175, `near-perfect: ${row("near-perfect").now.median}`);
ok(row("feature-perfect").now.median >= 185 && row("feature-perfect").now.best >= 198, `feature-perfect play reaches the top (median ${row("feature-perfect").now.median}, best ${row("feature-perfect").now.best})`);
ok(rows.every((x) => x.old.best <= 150 && x.now.best <= 200), "old at most 150, new at most 200");

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: depth-matchmaker-check ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: depth-matchmaker-check ${checks} checks (${recorded.length} legacy rounds identical)`);
