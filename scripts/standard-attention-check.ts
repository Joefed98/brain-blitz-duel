/**
 * The scoring standard's Speed and Attention games (docs/scoring-standard.md, "Speed and Attention decisions"):
 * Ascend tapRev 6, Don't Break the Chain chainDepthRev 3, Mixed Signals clashRev 10, Eagle Eye scanRev 4, Double Take
 * spotRev 3, Tally countRev 5, Labyrinth mazeRev 3 and Matchmaker pairRev 3. Proves, for every game:
 *   1. new deals carry the new stamp, and pinPreStandard(true) still deals the live one (Flash and Bang On keep theirs);
 *   2. worked examples (finished fast, finished slow, half done; scores worked out by hand in the comments) through the
 *      real gradeAnswer, with the answer a phone sends (the draft timeline for the timed games);
 *   3. a blank answer scores 0;
 *   4. kit play on room seeds: medians nothing ≤ spam (≤ 10) < average < good < great < near-perfect, and every finish
 *      beats every unfinished score;
 *   5. the rule changes: Eagle Eye's finish (every eagle found, at most 3 wrong left marked a grid), its clean grids from
 *      the round's history, the Chain's milestones gone, Labyrinth's stars counting unfinished, Mixed Signals' play
 *      identical to clashRev 9 (only the score differs) and its integer score.
 *
 *   bun scripts/standard-attention-check.ts [--seeds=8]
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPreStandard, STANDARD_STAMPS, usesStandard } from "../src/lib/duel/standard/stamps";
import { withSeededRandom } from "../src/lib/duel/random";
import { ascendLayoutAt, encodeNumberTaps, type NumberTap } from "../src/lib/duel/tapLog";
import { chainBoardIndex, chainRequiredAt, chainRules, encodeChainAnswer, type ChainTap } from "../src/lib/duel/chain";
import { countUpStageTruth, scanStageMatches, spotScenes } from "../src/lib/duel/attentionRev";
import { joinStages } from "../src/lib/duel/stagedRounds";
import { encodeMazeTrail, mazeStarsTaken } from "../src/lib/duel/depth/labyrinth";
import { mazeColsOf, mazeCorridorNeighbours } from "../src/lib/duel/maze";
import { encodePairFlips, sameCard } from "../src/lib/duel/pairmatch";
import { joinPairGoldTime } from "../src/lib/duel/depth/matchmaker";
import { wasteFactor } from "../src/lib/duel/puzzleScoreRev";
import { MAZE_REV1_DEAD_ZONE } from "../src/lib/duel/scoring";
import { pinPrePuzzleNotes } from "../src/lib/duel/puzzleNotes";
import { CLASH_QUEUE, CLASH_REV_STANDARD, CLASH_REV_TOPUP, clashCheckpoint, clashStandardScoreOf, colourClashGameFor, type ClashState } from "../src/lib/arcade/colourClash";
import { replayColourClashRun } from "../src/lib/duel/colourClash";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng, LEVELS, SKILLS } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { gradeSteps, kitBands, median, sentAnswer } from "./standard-lib";
import type { ChainPuzzleData, CountUpPuzzleData, MazePuzzleData, NumberHuntPuzzleData, PairPuzzleData, PuzzleData, PuzzleType, SpotPuzzleData, SymbolScanPuzzleData } from "../src/lib/duel/types";

// Written for the standard's stamps: Joe's puzzle notes (28 Oct 2026, puzzleNotes.ts) deal Slider and Tally one above,
// so new deals here keep the standard's (puzzle-notes-check proves the new stamps).
pinPrePuzzleNotes(true);

const args = process.argv.slice(2);
const SEEDS = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 8);
const GAMES: PuzzleType[] = ["numhunt", "chain", "stroop", "symscan", "spotdiff", "countup", "maze", "pairmatch"];

let fails = 0;
let passes = 0;
function ok(cond: boolean, what: string): void {
  if (cond) passes++;
  else {
    fails++;
    console.log(`FAIL ${what}`);
  }
}
function eq(got: number, want: number, what: string): void {
  ok(got === want, `${what}: got ${got}, want ${want}`);
}

const deal = (type: PuzzleType, seed: number): PuzzleData => roomPuzzle(type, seed);
const stampOf = (p: PuzzleData, key: string) => (p as unknown as Record<string, unknown>)[key];

/* ------------------------------------------------------------------ 1. deals */

for (const type of GAMES) {
  const st = STANDARD_STAMPS[type]!;
  const p = withSeededRandom(11, () => generatePuzzle(type, { bankSeed: 11 }));
  eq(stampOf(p, st.key) as number, st.rev, `${type}: new deals carry ${st.key} ${st.rev}`);
  ok(usesStandard(p), `${type}: a new deal is on the standard`);
  const before = pinPreStandard(true);
  const old = withSeededRandom(11, () => generatePuzzle(type, { bankSeed: 11 }));
  pinPreStandard(before);
  eq(stampOf(old, st.key) as number, st.live, `${type}: pinPreStandard deals the live ${st.key} ${st.live}`);
  ok(!usesStandard(old), `${type}: the pinned deal grades as before`);
  eq(gradeAnswer(p, "", 0).score, 0, `${type}: blank scores 0`);
}
for (const other of ["reaction", "stopwatch"] as PuzzleType[]) {
  const p = withSeededRandom(11, () => generatePuzzle(other, { bankSeed: 11 }));
  eq(stampOf(p, "tapRev") as number, 6, `${other}: keeps tapRev 6 (outside the standard)`);
  ok(!usesStandard(p), `${other}: not on the standard`);
}

/* ------------------------------------------------------------------ 2. worked examples */

/** Grades a phone answer `sent` with `msLeft` on the round clock left; returns the score. */
const score = (p: PuzzleData, sent: string, msLeft: number) => gradeAnswer(p, sent, msLeft).score;

// ---- Ascend (60 s; speed 40 full by 40 s, so full with 20 s or more left; flow 10 × best run ÷ 24).
{
  const p = deal("numhunt", 6100) as NumberHuntPuzzleData;
  const taps = (plan: { right: number; wrongAfter?: number[]; gap: number; from: number }) => {
    const out: NumberTap[] = [];
    let t = plan.from;
    for (let i = 0; i < plan.right; i++) {
      out.push({ n: ascendLayoutAt(p, t)[i]!.n, t });
      t += plan.gap;
      if (plan.wrongAfter?.includes(i + 1)) {
        out.push({ n: ascendLayoutAt(p, t)[i + 2]!.n, t });
        t += plan.gap;
      }
    }
    return out;
  };
  // Fast: 24 right taps 1 s apart from 1 s, the last at 24 s (36 s left): 150 + 40 speed + 10 flow (one run of 24) = 200.
  const fast = taps({ right: 24, gap: 1000, from: 1000 });
  eq(score(p, encodeNumberTaps(fast), 36_000), 200, "Ascend fast clean finish");
  // Slow: 24 right and 2 wrong (after the 12th and the 18th), 2 s apart from 0 → the last right tap at 50 s (10 s left).
  // Speed 40 × 10 ÷ 20 = 20, less a sixth a wrong tap: 20 × (1 − 10 ÷ 30) = 13.3 → 13; best run 12 → flow 10 × 12 ÷ 24
  // = 5. 150 + 5 + 13 = 168.
  const slow = taps({ right: 24, wrongAfter: [12, 18], gap: 2000, from: 0 });
  eq(slow[slow.length - 1]!.t, 50_000, "Ascend slow run's last tap");
  eq(score(p, encodeNumberTaps(slow), 10_000), 168, "Ascend slow finish, 2 wrong");
  // Half: 12 right taps at 1 … 12 s, then the buzzer. 120 × 12 ÷ 24 = 60; early (10 ÷ 24) × Σ(1 − t ÷ 60) =
  // 0.4167 × (12 − 78 ÷ 60) = 4.46; flow 10 × 12 ÷ 24 = 5. 69.46 → 69.
  eq(score(p, encodeNumberTaps(fast.slice(0, 12)), 0), 69, "Ascend half done");
  // The same half with 2 wrong taps costs 5 each (today's cost) and breaks the run: 60 + early + flow 10 × 6 ÷ 24 − 10.
  const halfWrong = taps({ right: 12, wrongAfter: [6, 9], gap: 1000, from: 1000 });
  ok(score(p, encodeNumberTaps(halfWrong), 0) < 60, "Ascend half done with wrong taps costs");
}

// ---- Don't Break the Chain (45 s; speed 50 full by 30 s, so full with 15 s or more left; 40 links).
{
  const p = deal("chain", 6100) as ChainPuzzleData;
  const links = (count: number, gap: number, from: number): ChainTap[] => {
    const used: number[][] = [];
    const out: ChainTap[] = [];
    for (let k = 0; k < count; k++) {
      const board = chainBoardIndex(k, p);
      const need = chainRequiredAt(p, k)!;
      const node = (p.boards[board] ?? []).findIndex((n, i) => !(used[board] ?? []).includes(i) && n.shape === need.shape && n.colour === need.colour);
      (used[board] ??= []).push(node);
      out.push({ node, t: from + k * gap });
    }
    return out;
  };
  eq(chainRules(p).length, 40, "Chain is 40 links");
  // Fast: 40 links 0.6 s apart from 0.5 s, the last at 23.9 s (21.1 s left): 150 + 50 = 200.
  eq(score(p, encodeChainAnswer({ taps: links(40, 600, 500), reason: "complete" }), 21_100), 200, "Chain fast finish");
  // Slow: 40 links 1 s apart from 1 s, the last at 40 s (5 s left): 50 × 5 ÷ 15 = 16.7 → 17; 167.
  eq(score(p, encodeChainAnswer({ taps: links(40, 1000, 1000), reason: "complete" }), 5_000), 167, "Chain slow finish");
  // Half: 20 links at 1 … 20 s, then the buzzer: 120 × 20 ÷ 40 = 60; early (10 ÷ 40) × (20 − 210 ÷ 45) = 3.83; 63.83 → 64.
  const half = gradeAnswer(p, encodeChainAnswer({ taps: links(20, 1000, 1000), reason: "timer" }), 0);
  eq(half.score, 64, "Chain half done");
  ok(half.extra?.["milestonePoints"] === undefined, "Chain: the milestones are gone on the standard");
}

// ---- Mixed Signals (the sim's integer score on clashRev 10; the run is 75 s = 4,500 ticks, speed full by 50 s).
{
  const state = (o: Partial<ClashState> & { best: number; golds: number }): ClashState =>
    ({ tick: 0, rng: 1, items: [], gates: [], rules: [], lane: 0, itemY: 0, dropping: 0, correct: 0, wrong: 0, missed: 0, ended: 1, queue: CLASH_QUEUE, finishTick: 0, rev: 5, worldH: 650,
      depth: { skips: [], goldAt: [1, 2, 3, 4, 5], streak: 0, best: o.best, golds: o.golds, goldPts: 0, touched: 0, passed: 0, spoiled: 0, scoreRev: CLASH_REV_STANDARD }, ...o }) as ClashState;
  // Fast: all 52 right by 48.3 s, a streak of 52, all five golds: 150 + 15 + 20 + 15 = 200.
  eq(clashStandardScoreOf(state({ correct: 52, finishTick: 2900, best: 52, golds: 5 })).total, 200, "Mixed Signals fast finish");
  // Slow: 50 right, 2 wrong, the last word at 62.5 s (750 ticks before the end of the run): speed 15 × 750 ÷ 1,500 = 7.5,
  // less two sixths = 5; best streak 30 → 20 × (30 − 12) ÷ 40 = 9; three golds 9. 150 + 5 + 9 + 9 = 173.
  eq(clashStandardScoreOf(state({ correct: 50, wrong: 2, finishTick: 3750, best: 30, golds: 3 })).total, 173, "Mixed Signals slow finish");
  // Half: 26 right, 4 wrong, the run timed out: 130 × 22 ÷ 52 = 55; streak 14 → 20 × 2 ÷ 40 = 1; two golds 6. 62.
  eq(clashStandardScoreOf(state({ correct: 26, wrong: 4, best: 14, golds: 2 })).total, 62, "Mixed Signals half done");
  // Four wrong is never a finish, however many are sorted: 130 × 44 ÷ 52 = 110 + streak + gold, at most 130.
  const four = clashStandardScoreOf(state({ correct: 48, wrong: 4, finishTick: 2900, best: 52, golds: 5 }));
  ok(!four.finished && four.total === 130, `Mixed Signals: 4 wrong is unfinished, capped at 130 (got ${four.total})`);
}

// ---- Eagle Eye (30 s; speed 10 full by 20 s, so full with 10 s or more left; clean grids 40 ÷ 3 each).
{
  const p = deal("symscan", 6100) as SymbolScanPuzzleData;
  const targets = p.stages.map(scanStageMatches);
  const wrongCell = (g: number) => p.stages[g]!.cells.findIndex((_, i) => !targets[g]!.includes(i));
  const enc = (sel: number[][]) => joinStages(sel.map((x) => [...x].sort((a, b) => a - b).join(","))) + "|0";
  /** Drafts marking each grid's targets evenly so grid g completes at `ends[g]` ms. */
  const plan = (ends: number[], extra: (sel: number[][], drafts: { answer: string; atMs: number }[]) => void = () => undefined) => {
    const sel: number[][] = [[], [], []];
    const drafts: { answer: string; atMs: number }[] = [];
    let from = 0;
    ends.forEach((end, g) => {
      const list = targets[g]!;
      list.forEach((cell, i) => {
        sel[g]!.push(cell);
        drafts.push({ answer: enc(sel), atMs: Math.round(from + ((end - from) * (i + 1)) / list.length) });
      });
      from = end;
    });
    extra(sel, drafts);
    return drafts;
  };
  // Fast: all three grids by 10 s (20 s left), never a wrong eagle: 150 + 10 + 40 = 200.
  const fast = plan([3000, 6000, 10_000]);
  eq(score(p, sentAnswer(p, fast), 20_000), 200, "Eagle Eye fast clean finish");
  // Slow: one wrong eagle left marked in grid 1, finished at 25 s (5 s left): speed 10 × 5 ÷ 10 = 5; clean 2 grids of 3:
  // 40 × 2 ÷ 3 = 26.7 → 27. 150 + 27 + 5 = 182.
  const slow = plan([8000, 16_000, 25_000], (sel, drafts) => {
    sel[0]!.push(wrongCell(0));
    drafts.push({ answer: enc(sel), atMs: 25_000 });
  });
  eq(score(p, sentAnswer(p, slow), 5_000), 182, "Eagle Eye slow finish, a wrong eagle left in grid 1");
  // Half: grids 1 and 2 complete at 6 s and 12 s, grid 3 untouched: 40 + 40, early 3 × (1 − 6 ÷ 30) + 3 × (1 − 12 ÷ 30)
  // = 2.4 + 1.8 = 4.2. 84.2 → 84.
  const half = plan([6000, 12_000]);
  eq(score(p, sentAnswer(p, half), 0), 84, "Eagle Eye half done");
  // Clean grids come from the history: the fast run with a wrong eagle marked and taken back in grid 2 keeps its final
  // answer, but grid 2 is no longer clean: 150 + 10 + 27 = 187. Without a timeline no grid counts clean: 160.
  const undone = plan([3000, 6000, 10_000]);
  const last = undone[undone.length - 1]!.answer;
  const sel = last.split("|").slice(0, 3).map((x) => x.split(",").filter(Boolean).map(Number));
  const withWrong = sel.map((x, g) => (g === 1 ? [...x, wrongCell(1)] : x));
  undone.splice(undone.length - 1, 0, { answer: enc(withWrong), atMs: 9000 }, { answer: enc(sel), atMs: 9500 });
  eq(score(p, sentAnswer(p, undone), 20_000), 187, "Eagle Eye: a wrong eagle taken back costs that grid's clean share");
  eq(score(p, fast[fast.length - 1]!.answer, 20_000), 160, "Eagle Eye: no timeline, no clean grids");
  // The finish rule: every eagle found with up to 3 wrong left marked in each grid still finishes; 4 in one grid does not.
  const wrongs = (g: number, n: number) => p.stages[g]!.cells.map((_, i) => i).filter((i) => !targets[g]!.includes(i)).slice(0, n);
  const three = enc(targets.map((t, g) => [...t, ...wrongs(g, 3)]));
  ok(gradeAnswer(p, three, 20_000).isCorrect, "Eagle Eye: 3 wrong left in each grid is still a finish");
  const four = enc(targets.map((t, g) => [...t, ...wrongs(g, g === 2 ? 4 : 0)]));
  ok(!gradeAnswer(p, four, 20_000).isCorrect, "Eagle Eye: 4 wrong left in a grid is not a finish");
  const all = enc(p.stages.map((s) => s.cells.map((_, i) => i)));
  eq(score(p, all, 20_000), 0, "Eagle Eye: marking every eagle scores 0");
}

// ---- Double Take (60 s; speed 20 full by 40 s, so full with 20 s or more left).
{
  const p = deal("spotdiff", 6100) as SpotPuzzleData;
  const diffs = p.differences ?? [];
  const scene = (d: { scene?: number }) => d.scene ?? 0;
  const bonus = p.bonus!;
  ok(!!bonus, "Double Take deals the hidden difference");
  const taken = new Set([...diffs.flatMap((d) => d.cells), ...bonus.cells]);
  const wrongCell = spotScenes(p)[0]!.top.map((s) => s.cell).find((c) => !taken.has(c))!;
  const enc = (taps: number[][]) => taps.map((x) => x.join(",")).join("|");
  const play = (gap: number, opts: { hidden?: boolean; wrong?: boolean; count?: number } = {}) => {
    const taps: number[][] = [[], []];
    const drafts: { answer: string; atMs: number }[] = [];
    let t = 0;
    const tap = (s: number, cell: number) => {
      t += gap;
      taps[s]!.push(cell);
      drafts.push({ answer: enc(taps), atMs: t });
    };
    if (opts.wrong) tap(0, wrongCell);
    // The phone takes the hidden one only before its picture's sixth; tapped first here.
    if (opts.hidden) tap(scene(bonus), bonus.cells[0]!);
    diffs.slice(0, opts.count ?? diffs.length).forEach((d) => tap(scene(d), d.cells[0]!));
    return { drafts, t };
  };
  eq(diffs.length, 12, "Double Take has 12 differences");
  // Fast: the hidden one and all 12 at 1.5 s each (19.5 s; 40.5 s left), no wrong tap: 150 + 20 + 20 hidden + 10 clean = 200.
  const fast = play(1500, { hidden: true });
  eq(score(p, sentAnswer(p, fast.drafts), 60_000 - fast.t), 200, "Double Take fast clean finish with the hidden one");
  // Slow: one wrong tap, then all 12 at 50 ÷ 13 s each, finished at 50 s (10 s left): speed 20 × 10 ÷ 20 = 10; no hidden,
  // not clean. 160.
  const slow = play(50_000 / 13, { wrong: true });
  eq(score(p, sentAnswer(p, slow.drafts), 10_000), 160, "Double Take slow finish, a wrong tap");
  // Half: 6 differences at 2 … 12 s, no wrong tap, no hidden: 60; early 0.8 × (6 − 42 ÷ 60) = 4.24. 64.24 → 64.
  const half = play(2000, { count: 6 });
  eq(score(p, sentAnswer(p, half.drafts), 0), 64, "Double Take half done");
  // The hidden difference counts unfinished too: +20.
  const halfHidden = play(2000, { count: 6, hidden: true });
  ok(score(p, sentAnswer(p, halfHidden.drafts), 0) >= 80, "Double Take: the hidden difference counts unfinished");
}

// ---- Tally (60 s; speed 50 full by 30 s, so full with 30 s or more left).
{
  const p = deal("countup", 6100) as CountUpPuzzleData;
  const truths = p.stages.map(countUpStageTruth);
  const drafts = (given: (number | null)[], times: number[]) => {
    const out: { answer: string; atMs: number }[] = [];
    const now: string[] = ["", "", "", ""];
    given.forEach((g, i) => {
      if (g === null) return;
      now[i] = String(g);
      out.push({ answer: joinStages(now, 4), atMs: times[i]! });
    });
    return out;
  };
  // Fast: all four exact at 5, 10, 15, 20 s (40 s left): 150 + 50 = 200.
  eq(score(p, sentAnswer(p, drafts(truths, [5000, 10_000, 15_000, 20_000])), 40_000), 200, "Tally fast finish");
  // Slow: all four exact, the last at 50 s (10 s left): 50 × 10 ÷ 30 = 16.7 → 17; 167.
  eq(score(p, sentAnswer(p, drafts(truths, [20_000, 30_000, 40_000, 50_000])), 10_000), 167, "Tally slow finish");
  // Half: trays 1 and 2 exact at 10 and 20 s, tray 3 one off, tray 4 blank: 30 + 30 + 30 × 0.15 = 64.5; early
  // 2.5 × (1 − 10 ÷ 60) + 2.5 × (1 − 20 ÷ 60) = 3.75. 68.25 → 68.
  eq(score(p, sentAnswer(p, drafts([truths[0]!, truths[1]!, truths[2]! + 1, null], [10_000, 20_000, 30_000, 0])), 0), 68, "Tally half done");
}

// ---- Labyrinth (60 s; speed 20 full by 40 s, so full with 20 s or more left; stars 30 ÷ 3 = 10 each, finished or not).
{
  // A seed whose three stars all lie off the route (each needs a detour).
  let p: MazePuzzleData | null = null;
  for (let seed = 6100; seed < 6400 && !p; seed += 7) {
    const m = deal("maze", seed) as MazePuzzleData;
    const route = new Set(m.solution ?? []);
    if ((m.stars ?? []).length === 3 && (m.stars ?? []).every((s) => !route.has(s))) p = m;
  }
  ok(p !== null, "Labyrinth: a maze with every star off the route");
  if (p) {
    const route = p.solution!;
    const cols = mazeColsOf(p);
    const branch = (star: number) => {
      const from = new Map<number, number>([[star, -1]]);
      const queue = [star];
      const on = new Set(route);
      while (queue.length) {
        const cell = queue.shift()!;
        if (on.has(cell)) {
          const cells: number[] = [];
          for (let c = from.get(cell)!; c !== -1; c = from.get(c)!) cells.push(c);
          return { root: cell, cells };
        }
        for (const n of mazeCorridorNeighbours(p!.cells, cell)) if (!from.has(n)) (from.set(n, cell), queue.push(n));
      }
      return { root: -1, cells: [] };
    };
    /**
     * The trail along the first `steps` route steps (detouring to every star when `stars`), one draft a step: `gap` ms
     * apart, or (gap < 0) spread evenly so the last step lands at −gap ms.
     */
    const walk = (steps: number, gap: number, stars: boolean) => {
      const cells: number[] = [];
      const branches = stars ? (p!.stars ?? []).map(branch) : [];
      for (let i = 1; i <= steps; i++) {
        for (const b of branches) {
          if (b.root !== route[i - 1]) continue;
          cells.push(...b.cells);
          for (let k = b.cells.length - 2; k >= 0; k--) cells.push(b.cells[k]!);
          cells.push(route[i - 1]!);
        }
        cells.push(route[i]!);
      }
      const each = gap >= 0 ? gap : -gap / cells.length;
      const trail = [route[0]!];
      const drafts = cells.map((cell, i) => {
        trail.push(cell);
        return { answer: encodeMazeTrail(trail, cols), atMs: Math.round(each * (i + 1)) };
      });
      return { drafts, t: Math.round(each * cells.length), trail };
    };
    const L = route.length;
    // Fast: the route and all three stars, the exit at 18 s (42 s left): 150 + 20 + 30 = 200.
    const fast = walk(L - 1, -18_000, true);
    eq(mazeStarsTaken(fast.trail, p.stars ?? []).length, 3, "Labyrinth fast run takes all three stars");
    eq(score(p, sentAnswer(p, fast.drafts), 42_000), 200, "Labyrinth fast finish with every star");
    // Slow: the route alone, the exit at 50 s (10 s left): 20 × 10 ÷ 20 = 10; no star. 160.
    const slow = walk(L - 1, -50_000, false);
    eq(score(p, sentAnswer(p, slow.drafts), 10_000), 160, "Labyrinth slow finish, no star");
    // Half: the first k = ⌊(L − 1) ÷ 2⌋ route steps, 0.2 s apart, then the buzzer. Progress k ÷ (L − 1) (no waste), less
    // the 5 % dead zone: share = (k ÷ (L − 1) − 0.05) ÷ 0.95; 120 × share, plus early (10 ÷ (L − 1)) × Σ(1 − t ÷ 60 s).
    const k = Math.floor((L - 1) / 2);
    const half = walk(k, 200, false);
    const share = (k / (L - 1) - MAZE_REV1_DEAD_ZONE) / (1 - MAZE_REV1_DEAD_ZONE);
    let early = 0;
    for (let i = 1; i <= k; i++) early += (10 / (L - 1)) * (1 - (200 * i) / 60_000);
    eq(score(p, sentAnswer(p, half.drafts), 0), Math.round(120 * share * wasteFactor(k + 1, L) + early), `Labyrinth half done (route ${L})`);
    // Stars count unfinished: the whole route but the last step, with every star, scores 10 a star on top of the route
    // (the cap of 130 aside): stored as starBonus 30.
    const short = walk(L - 2, -40_000, true);
    const g = gradeAnswer(p, sentAnswer(p, short.drafts), 0);
    ok(!g.isCorrect && g.extra?.["starBonus"] === 30, `Labyrinth: three stars count unfinished (starBonus ${String(g.extra?.["starBonus"])})`);
    ok(g.score === 130, `Labyrinth: one step short with every star reaches the cap of 130 (got ${g.score})`);
  }
}

// ---- Matchmaker (90 s; speed 30 full by 60 s, so full with 30 s or more left).
{
  const p = deal("pairmatch", 6100) as PairPuzzleData;
  const cards = p.cards;
  const pairs: [number, number][] = [];
  const seen = new Set<number>();
  cards.forEach((c, i) => {
    if (seen.has(i)) return;
    const j = cards.findIndex((d, k) => k !== i && !seen.has(k) && sameCard(c, d));
    seen.add(i).add(j);
    pairs.push([i, j]);
  });
  const goldIdx = pairs.findIndex(([a]) => sameCard(cards[a], p.gold));
  ok(goldIdx >= 0, "Matchmaker deals a gold pair");
  const order = (goldAt: number) => {
    const rest = pairs.filter((_, i) => i !== goldIdx);
    rest.splice(goldAt, 0, pairs[goldIdx]!);
    return rest;
  };
  /** Flips `list` (each pair, after a miss try when `miss`) `gap` apart; the gold match's time joins the answer. */
  const play = (list: [number, number][], gap: number, miss: boolean) => {
    const flips: number[] = [];
    const drafts: { answer: string; atMs: number }[] = [];
    let goldMs: number | null = null;
    let t = 0;
    const flip = (c: number) => {
      t += gap;
      flips.push(c);
    };
    list.forEach(([a, b], i) => {
      if (miss) {
        const other = list[(i + 1) % list.length]![0];
        flip(a);
        flip(other);
        drafts.push({ answer: joinPairGoldTime(encodePairFlips(flips), goldMs), atMs: t });
      }
      flip(a);
      flip(b);
      if (goldMs === null && sameCard(cards[a], p.gold)) goldMs = t;
      drafts.push({ answer: joinPairGoldTime(encodePairFlips(flips), goldMs), atMs: t });
    });
    return { drafts, t };
  };
  // Fast: every pair in a row, the gold pair first (matched at 2 s), a flip a second (30 s; 60 s left): 150 + 30 speed
  // + streak 15 → min(5, 15 − 3) = 5 + gold 15 = 200.
  const fast = play(order(0), 1000, false);
  eq(score(p, sentAnswer(p, fast.drafts), 60_000), 200, "Matchmaker fast finish");
  // Slow: a miss before every match (no streak beyond 1), the gold pair 10th (matched at 50 s), 60 flips 1.25 s apart:
  // the last at 75 s (15 s left): 30 × 15 ÷ 30 = 15; streak 0, gold 0. 165.
  const slow = play(order(9), 1250, true);
  eq(slow.t, 75_000, "Matchmaker slow run's last flip");
  eq(score(p, sentAnswer(p, slow.drafts), 15_000), 165, "Matchmaker slow finish");
  // Half: the first 7 pairs in a row, gold first, 2 s a flip (matches at 4 … 28 s), then the buzzer: 8 × 7 = 56; early
  // 0.6 × (7 − 112 ÷ 90) = 3.45; streak 7 → 4; gold at 4 s → 15. 78.45 → 78.
  const half = play(order(0).slice(0, 7), 2000, false);
  eq(score(p, sentAnswer(p, half.drafts), 0), 78, "Matchmaker half done");
}

/* ------------------------------------------------------------------ 5b. Mixed Signals: clashRev 9's play, the standard's score */

{
  const kit = KITS.stroop!;
  let same = 0;
  let scored = 0;
  for (let i = 0; i < 4; i++) {
    const seed = 6100 + 7 * i;
    const p = deal("stroop", seed);
    eq(stampOf(p, "clashRev") as number, CLASH_REV_STANDARD, "Mixed Signals deals clashRev 10");
    for (const level of LEVELS) {
      const play = kit.play(p, makeRng(hashText(`std-att:stroop:${seed}:${level}`)), SKILLS[level], puzzleTimeLimitMs(p));
      const answer = play.steps[play.steps.length - 1]?.answer ?? "";
      const seedOf = (p as unknown as { seed: number }).seed;
      const now = replayColourClashRun(seedOf, answer, CLASH_REV_STANDARD);
      const old = replayColourClashRun(seedOf, answer, CLASH_REV_TOPUP);
      const strip = (s: ClashState) => JSON.stringify({ ...s, depth: { ...s.depth, scoreRev: 0 } });
      if (strip(now.state) === strip(old.state) && JSON.stringify(clashCheckpoint(now.state)) === JSON.stringify(clashCheckpoint(old.state))) same++;
      if (gradeAnswer(p, answer, 0).score === clashStandardScoreOf(now.state).total) scored++;
    }
  }
  eq(same, 4 * LEVELS.length, "Mixed Signals clashRev 10 plays exactly as clashRev 9 (state and checkpoints)");
  eq(scored, 4 * LEVELS.length, "Mixed Signals: the round's score is the sim's standard score");
  ok(colourClashGameFor(10).init(5).depth?.scoreRev === CLASH_REV_STANDARD, "Mixed Signals clashRev 10 starts on the standard's score");
}

/* ------------------------------------------------------------------ 4. kit play */

const seeds = Array.from({ length: SEEDS }, (_, i) => 6100 + i * 7);
const extraSeeds = Array.from({ length: 16 }, (_, i) => 7100 + i * 13);
for (const type of GAMES) {
  // The Chain and Tally kits are lumpy (a slip ends the chain; a miscount costs the finish), so they get more seeds.
  const list = type === "chain" || type === "countup" ? [...seeds, ...extraSeeds] : seeds;
  const bands = kitBands(type, list);
  const med = Object.fromEntries(bands.map((b) => [b.level, median(b.scores)]));
  console.log(`${type.padEnd(10)} ${bands.map((b) => `${b.level} ${med[b.level]}`).join(" · ")}`);
  ok(med["nothing"]! === 0, `${type}: doing nothing scores 0`);
  ok(med["spam"]! <= 10, `${type}: spam median ${med["spam"]} ≤ 10`);
  ok(med["nothing"]! <= med["spam"]!, `${type}: nothing ≤ spam`);
  ok(med["spam"]! < med["average"]!, `${type}: spam < average`);
  ok(med["average"]! < med["good"]!, `${type}: average < good (${med["average"]} < ${med["good"]})`);
  ok(med["good"]! < med["great"]!, `${type}: good < great (${med["good"]} < ${med["great"]})`);
  // Near-perfect may tie great only at the top.
  ok(med["great"]! < med["near"]! || med["near"]! === 200, `${type}: great < near (${med["great"]} < ${med["near"]})`);
  // Every finish beats every unfinished score (graded again here to read the verdicts).
  let minFinish = Infinity;
  let maxOpen = -Infinity;
  const kit = KITS[type]!;
  for (const seed of list) {
    const p = deal(type, seed);
    for (const level of LEVELS) {
      const play = kit.play(p, makeRng(hashText(`std:${type}:${seed}:${level}`)), SKILLS[level], puzzleTimeLimitMs(p));
      const r = gradeSteps(p, play.steps, play.timed);
      if (r.isCorrect) minFinish = Math.min(minFinish, r.score);
      else maxOpen = Math.max(maxOpen, r.score);
    }
  }
  ok(minFinish > maxOpen, `${type}: every finish (lowest ${minFinish}) beats every unfinished score (highest ${maxOpen})`);
  ok(maxOpen <= 130, `${type}: unfinished at most 130 (${maxOpen})`);
}

console.log(`${passes} passed, ${fails} failed`);
if (fails > 0) {
  console.log("FAIL standard-attention-check");
  process.exit(1);
}
console.log("PASS standard-attention-check");
