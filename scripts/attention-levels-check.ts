/**
 * attention-levels-check (15 Nov 2026, the Attention overhaul's stage 3; docs/design/attention-overhaul.md "Levels"):
 * every Attention game's Easy, Hard and Expert, as the level registry (gameLevels.ts) names this check for each
 * level's one-answer proof. No browser.
 *
 *   1. The registry: all six games offer Easy, Normal, Hard and Expert, each level's settings are the data's row, and
 *      a Normal deal is byte for byte the deal without a level (rated play and the Daily stay Normal).
 *   2. The clock: every level's dealt clock is its row's, never over 120 s.
 *   3. One answer, every level's boards (generator or bank):
 *        Labyrinth: a perfect maze (cells − 1 corridors, every cell reachable), so exactly one route, the stored one;
 *          its size, route length, false trails and Expert's exit on the far edges (never the corner);
 *        Double Take: each picture's panels differ in exactly the level's count of ways, at the stored cells, of the
 *          level's kinds, with the hidden seventh only where the level has one;
 *        Eagle Eye: the grids' sizes, the stored targets exactly the eagles facing a target, the two-facing grids;
 *        Tally: the trays' sizes (none over 110), each stored count the tray's own truth, Expert's two-colour questions;
 *        Matchmaker: the level's pairs, every face exactly twice, from the level's share of shapes;
 *        Bomb Defusal: banked panels re-proved by search (one sequence, the stored one, every clue needed, the
 *          wording, the card's size and caps; all of Easy and samples of Hard and Expert, every entry with CHECKS_FULL=1),
 *          and every bank holds the level's count.
 *   4. Legibility at every level: colour changes at least MIN_LIGHTNESS_GAP apart (Hard's the nearest legible one),
 *      turns at least 30°, the hidden seventh at least 15 % smaller, Eagle Eye's look-alikes exactly 45°, Tally's
 *      uncounted colours clear of the counted ones, Matchmaker's colours lightness-apart.
 *   5. Grading: a flawless run scores 200 at every level through the server's grader (the phone's answer with its
 *      draft timeline); nothing scores 0; Normal's grading is untouched for a puzzle without a level.
 *   6. Expert's instant bomb: the live check says only whether the steps are still right and how many (never the
 *      answer), the first wrong step ends it, and Hard has no live check.
 *   7. Human-possible Expert: a person-like solver finishes each Expert (Bomb Defusal: a deduction by trying orders a
 *      step at a time within a person's patience; Labyrinth: heading for the far edges with the exit unseen, at a
 *      person's pace), and the elite kit finishes most Expert boards of every game.
 *
 *   bun scripts/attention-levels-check.ts        (CHECKS_FULL=1: more seeds and every bank entry)
 */
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { GAME_LEVELS, levelsOf } from "../src/lib/levels/gameLevels";
import { BOMB_LEVELS, MAZE_LEVELS, PAIR_LEVELS, SCAN_LEVELS, SPOT_LEVELS, TALLY_LEVELS, SCAN_MINUTE_MS } from "../src/lib/levels/attentionLevels.data";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import * as P from "../src/lib/duel/attentionPalette.data";
import * as O from "../src/lib/duel/attentionOverhaul";
import { countUpStageTruth, countUpCounts, scanStageMatches } from "../src/lib/duel/attentionRev";
import { mazeCorridorNeighbours, mazeRoute } from "../src/lib/duel/maze";
import { encodeMazeTrail } from "../src/lib/duel/depth/labyrinth";
import { mazeFalseTrailLengths } from "../src/lib/duel/maze.server";
import { differenceGroups } from "../src/puzzles/spotTheDifference";
import { SPOT_BONUS_SCALE } from "../src/lib/duel/depth/doubleTake";
import { EAGLE_ANGLES } from "../src/components/puzzles/refreshIcons";
import { encodePairFlips, sameCard } from "../src/lib/duel/pairmatch";
import { joinPairGoldTime, pairGoldTimed } from "../src/lib/duel/depth/matchmaker";
import { joinStages } from "../src/lib/duel/stagedRounds";
import { usesScanDepth } from "../src/lib/duel/depth/eagleEye";
import { decodeBombActions } from "../src/lib/duel/bomb";
import { inspectBombLevel, bombActionsOf } from "../src/lib/duel/bombLevels.server";
import { BOMB_EASY_BANK, BOMB_EXPERT_BANK, BOMB_HARD_BANK } from "../src/lib/duel/bombLevelsBank.server";
import { checkPuzzleMoves } from "../src/lib/duel/moves.server";
import { KITS } from "./puzzle-fairness/kits";
import { personBombTries, personMazeSeconds } from "./attention-levels-lib";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import type { BombPuzzleData, CountUpPuzzleData, MazePuzzleData, PairPuzzleData, PuzzleData, PuzzleType, SpotPuzzleData, SymbolScanPuzzleData } from "../src/lib/duel/types";

const FULL = process.env["CHECKS_FULL"] === "1";
const SEEDS = Array.from({ length: FULL ? 40 : 10 }, (_, i) => 7_100 + i * 13);
const GAMES = ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"] as const;
const OFF = ["easy", "hard", "expert"] as const;
const ROWS = { symscan: SCAN_LEVELS, spotdiff: SPOT_LEVELS, countup: TALLY_LEVELS, maze: MAZE_LEVELS, bomb: BOMB_LEVELS, pairmatch: PAIR_LEVELS } as const;

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};

const deal = (type: string, level: Level, seed: number): PuzzleData =>
  withSeededRandom(seed, () => generatePuzzle(type as PuzzleType, { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }));
const L = (hex: string) => P.lightness(hex);

/* ------------------------------------------------------------------ 1. the registry and Normal */
for (const type of GAMES) {
  check(levelsOf(type).join(",") === "easy,normal,hard,expert", `${type}: offers ${levelsOf(type).join(",")}`);
  for (const level of OFF) {
    const entry = GAME_LEVELS[type]?.levels[level];
    check(JSON.stringify(entry?.settings) === JSON.stringify(ROWS[type][level]), `${type} ${level}: the registry's settings are not the data's row`);
    check((entry?.oneSolution as { proof?: string } | undefined)?.proof === "scripts/attention-levels-check.ts", `${type} ${level}: the proof isn't this check`);
  }
  for (const seed of SEEDS.slice(0, 3)) {
    const plain = withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
    const normal = withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, level: "normal" }));
    check(JSON.stringify(plain) === JSON.stringify(normal), `${type}: a Normal deal differs from the deal without a level`);
    check(!("level" in plain), `${type}: a Normal deal carries a level`);
  }
}

/* ------------------------------------------------------------------ 2. the clock */
for (const type of GAMES) {
  for (const level of OFF) {
    const p = deal(type, level, SEEDS[0]!);
    check(puzzleLevel(p) === level, `${type} ${level}: dealt at ${puzzleLevel(p)}`);
    const want = type === "symscan" ? SCAN_MINUTE_MS : (ROWS[type][level] as { timeLimitMs: number }).timeLimitMs;
    check(puzzleTimeLimitMs(p) === want, `${type} ${level}: a ${puzzleTimeLimitMs(p)} ms clock, want ${want}`);
    check(puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${type} ${level}: over 120 s`);
  }
}
check(puzzleTimeLimitMs(deal("symscan", "normal", 5)) === SCAN_MINUTE_MS, "Eagle Eye Normal: not on the 60 s clock (scanRev 5)");
check((deal("symscan", "normal", 5) as SymbolScanPuzzleData).scanRev === O.SCAN_REV_MINUTE, "Eagle Eye Normal: not scanRev 5");

/* ------------------------------------------------------------------ 3 and 4. one answer, legibility */
const spotHex = (c: string) => (P.SPOT_ENAMEL as Record<string, string>)[c]!;
const tallyHex = (c: string) => (P.TALLY_ENAMEL as Record<string, string>)[c]!;
const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

for (const level of OFF) {
  for (const seed of SEEDS) {
    // Labyrinth
    {
      const p = deal("maze", level, seed) as MazePuzzleData;
      const row = MAZE_LEVELS[level];
      const cols = p.cols!;
      check(cols === row.cols && p.rows === row.rows && p.cells.length === cols * row.rows, `maze ${level} ${seed}: ${p.cols}×${p.rows}`);
      let edges = 0;
      for (let c = 0; c < p.cells.length; c++) edges += mazeCorridorNeighbours(p.cells, c, cols).length;
      const seen = new Set([0]);
      const queue = [0];
      while (queue.length) for (const n of mazeCorridorNeighbours(p.cells, queue.shift()!, cols)) if (!seen.has(n)) (seen.add(n), queue.push(n));
      check(edges / 2 === p.cells.length - 1 && seen.size === p.cells.length, `maze ${level} ${seed}: not a perfect maze (one route)`);
      check(JSON.stringify(mazeRoute(p.cells, p.start, p.exit, cols)) === JSON.stringify(p.solution), `maze ${level} ${seed}: the stored route isn't the one route`);
      const len = p.solution!.length;
      check(len >= row.routeMin && len <= row.routeMax, `maze ${level} ${seed}: a route of ${len}`);
      const trails = mazeFalseTrailLengths(p.cells, p.solution!, cols);
      check(trails.filter((t) => t >= 5).length >= row.deadEnds && trails.filter((t) => t >= 11).length >= row.longDeadEnds, `maze ${level} ${seed}: too few false trails`);
      check(p.par === len - 1, `maze ${level} ${seed}: par ${p.par}, route steps ${len - 1}`);
      if (row.exitHidden) {
        const r = Math.floor(p.exit / cols);
        const c = p.exit % cols;
        check(p.exit !== p.cells.length - 1 && (r === row.rows - 1 || c === cols - 1), `maze ${level} ${seed}: the hidden exit isn't on the far edges`);
      } else check(p.exit === p.cells.length - 1, `maze ${level} ${seed}: the exit moved`);
    }
    // Double Take
    {
      const p = deal("spotdiff", level, seed) as SpotPuzzleData;
      const row = SPOT_LEVELS[level];
      const pictures = [{ top: p.top, bottom: p.bottom, scene: 0 }, { ...p.reef!, scene: 1 }];
      check(!!p.bonus === row.hidden, `spotdiff ${level} ${seed}: hidden seventh ${!!p.bonus}`);
      for (const pic of pictures) {
        check(pic.top.length === row.cols * row.rows && pic.bottom.length === row.cols * row.rows, `spotdiff ${level} ${seed}: a picture isn't ${row.cols}×${row.rows}`);
        const own = (p.differences ?? []).filter((d) => (d.scene ?? 0) === pic.scene);
        const groups = differenceGroups(pic.top, pic.bottom).flat();
        const bonusCells = p.bonus && (p.bonus.scene ?? 0) === pic.scene ? p.bonus.cells : [];
        const counted = groups.filter((c) => !bonusCells.includes(c));
        check(own.length === row.differences && counted.length === row.differences, `spotdiff ${level} ${seed}: ${counted.length} differences, want ${row.differences}`);
        check(own.every((d) => counted.includes(d.cells[0]!)), `spotdiff ${level} ${seed}: a stored difference isn't where the panels differ`);
        check(own.every((d) => (row.kinds as readonly string[]).includes(d.kind)), `spotdiff ${level} ${seed}: a difference of a kind the level doesn't deal`);
        const bottom = new Map(pic.bottom.map((s) => [s.cell, s]));
        for (const t of pic.top) {
          const b = bottom.get(t.cell)!;
          if (t.kind === b.kind && t.colour !== b.colour) {
            const gap = Math.abs(L(spotHex(t.colour)) - L(spotHex(b.colour)));
            check(gap >= P.MIN_LIGHTNESS_GAP, `spotdiff ${level} ${seed}: a colour change only ${gap.toFixed(1)} L* apart`);
            if (row.subtleColours) {
              const nearest = Math.min(...O.spotColourSwaps(t.colour).map((c) => Math.abs(L(spotHex(c)) - L(spotHex(t.colour)))));
              check(Math.abs(gap - nearest) < 1e-9, `spotdiff ${level} ${seed}: Hard's colour change isn't the nearest legible one`);
            }
          }
          if (t.kind === b.kind && ((t.rot ?? 0) !== (b.rot ?? 0) || !!t.flip !== !!b.flip)) {
            check(Math.abs((t.rot ?? 0) - (b.rot ?? 0)) >= P.MIN_TURN_DEG || !!t.flip !== !!b.flip, `spotdiff ${level} ${seed}: a turn under 30°`);
          }
        }
      }
    }
    // Eagle Eye
    {
      const p = deal("symscan", level, seed) as SymbolScanPuzzleData;
      const row = SCAN_LEVELS[level];
      check(p.stages.map((s) => s.cols).join(",") === row.grids.join(","), `symscan ${level} ${seed}: grids ${p.stages.map((s) => s.cols)}`);
      p.stages.forEach((stage, i) => {
        const matches = scanStageMatches(stage);
        check(JSON.stringify([...matches].sort((a, b) => a - b)) === JSON.stringify([...(p.targets?.[i] ?? [])].sort((a, b) => a - b)), `symscan ${level} ${seed} grid ${i + 1}: the stored targets aren't the eagles facing a target`);
        check((stage.alsoTarget !== undefined) === i >= row.twoFrom, `symscan ${level} ${seed} grid ${i + 1}: two facings ${stage.alsoTarget !== undefined}`);
        const [lo, hi] = stage.alsoTarget !== undefined ? [2 * row.twoEach[0], 2 * row.twoEach[1]] : row.targets;
        check(matches.length >= lo && matches.length <= hi, `symscan ${level} ${seed} grid ${i + 1}: ${matches.length} targets`);
        const targets = [stage.target, ...(stage.alsoTarget ? [stage.alsoTarget] : [])];
        stage.cells.forEach((dir, k) => {
          if (matches.includes(k)) return;
          check(Math.min(...targets.map((t) => angleGap(EAGLE_ANGLES[dir], EAGLE_ANGLES[t]))) >= 45, `symscan ${level} ${seed}: an eagle under 45° off a target`);
        });
      });
    }
    // Tally
    {
      const p = deal("countup", level, seed) as CountUpPuzzleData;
      const row = TALLY_LEVELS[level];
      check(p.stages.map((s) => s.shapes.length).join(",") === row.trays.join(","), `countup ${level} ${seed}: trays ${p.stages.map((s) => s.shapes.length)}`);
      check(p.stages.every((s) => s.shapes.length <= 110), `countup ${level} ${seed}: a tray over 110`);
      p.stages.forEach((stage, i) => {
        check(p.counts?.[i] === countUpStageTruth(stage), `countup ${level} ${seed} tray ${i + 1}: the stored count isn't the tray's truth`);
        if (!stage.compare) check(!!stage.alsoColour === row.twoColours, `countup ${level} ${seed} tray ${i + 1}: two-colour ${!!stage.alsoColour}`);
        const counted = O.tallyCountedColours(stage);
        for (const s of stage.shapes) {
          if (counted.includes(s.colour)) continue;
          check(counted.every((c) => Math.abs(L(tallyHex(c)) - L(tallyHex(s.colour))) >= P.MIN_LIGHTNESS_GAP), `countup ${level} ${seed}: an uncounted colour too close to a counted one`);
        }
        const r = (s: { size: number }) => s.size / 2;
        for (let a = 0; a < stage.shapes.length; a++)
          for (let b = a + 1; b < stage.shapes.length; b++) {
            const sa = stage.shapes[a]!;
            const sb = stage.shapes[b]!;
            if (O.tallyCentreGap(stage, sa, sb) < r(sa) + r(sb) - 1e-6) check(false, `countup ${level} ${seed} tray ${i + 1}: two shapes overlap`);
          }
        void countUpCounts;
      });
    }
    // Matchmaker
    {
      const p = deal("pairmatch", level, seed) as PairPuzzleData;
      const row = PAIR_LEVELS[level];
      check(p.cards.length === row.pairs * 2, `pairmatch ${level} ${seed}: ${p.cards.length} cards`);
      check(p.cards.every((c) => p.cards.filter((d) => sameCard(c, d)).length === 2), `pairmatch ${level} ${seed}: a face not exactly twice`);
      check(new Set(p.cards.map((c) => c.shape)).size <= row.shapes, `pairmatch ${level} ${seed}: more than ${row.shapes} shapes`);
      check(!!p.gold && p.cards.some((c) => sameCard(c, p.gold)), `pairmatch ${level} ${seed}: no gold pair on the board`);
      const colours = [...new Set(p.cards.map((c) => c.colour))];
      for (const a of colours) for (const b of colours) if (a < b) check(P.lightnessApart((P.PAIR_ENAMEL as Record<string, string>)[a]!, (P.PAIR_ENAMEL as Record<string, string>)[b]!), `pairmatch ${level}: ${a} and ${b} too close`);
    }
    // Bomb Defusal (a deal draws its panel from the bank)
    {
      const p = deal("bomb", level, seed) as BombPuzzleData;
      const row = BOMB_LEVELS[level];
      check(p.wires.length === row.wires && p.stepCount === row.steps, `bomb ${level} ${seed}: ${p.wires.length} wires, ${p.stepCount} steps`);
      check(!!p.bombInstant === row.instant, `bomb ${level} ${seed}: instant ${!!p.bombInstant}`);
    }
  }
}
check(1 - SPOT_BONUS_SCALE >= P.MIN_SIZE_GAP, "Double Take's hidden seventh is under 15 % smaller");

// Bomb Defusal's banks, re-proved by search.
const BANKS = { easy: BOMB_EASY_BANK, hard: BOMB_HARD_BANK, expert: BOMB_EXPERT_BANK } as const;
for (const level of OFF) {
  const bank = BANKS[level];
  check(bank.length === BOMB_LEVELS[level].bank, `bomb ${level}: the bank holds ${bank.length}, want ${BOMB_LEVELS[level].bank}`);
  const sample = FULL || level === "easy" ? bank.map((_, i) => i) : Array.from({ length: level === "hard" ? 6 : 3 }, (_, k) => Math.floor((k * bank.length) / (level === "hard" ? 6 : 3)));
  for (const i of sample) {
    const r = inspectBombLevel(bank[i]!, BOMB_LEVELS[level]);
    check(r.unique && r.allNeeded && r.wordingOk && r.capsOk && r.size, `bomb ${level} bank ${i}: ${JSON.stringify(r)}`);
  }
  check(new Set(bank.map((b) => JSON.stringify(b.rules))).size === bank.length, `bomb ${level}: a card repeats in the bank`);
}

/* ------------------------------------------------------------------ 5. a flawless run scores 200 */
type Step = { answer: string; atMs: number };
function flawless(p: PuzzleData): Step[] {
  const steps: Step[] = [];
  let t = 0;
  const push = (answer: string) => steps.push({ answer, atMs: (t += 40) });
  if (p.type === "pairmatch") {
    const flips: number[] = [];
    let goldMs: number | null = null;
    const done = new Set<number>();
    p.cards.forEach((c, i) => {
      if (done.has(i)) return;
      const j = p.cards.findIndex((d, k) => k !== i && sameCard(c, d));
      done.add(i).add(j);
      flips.push(i, j);
      if (goldMs === null && sameCard(c, p.gold)) goldMs = t + 40;
      push(pairGoldTimed(p) ? joinPairGoldTime(encodePairFlips(flips), goldMs) : encodePairFlips(flips));
    });
  } else if (p.type === "maze") {
    const route = p.solution!;
    for (let k = 1; k <= route.length; k++) push(encodeMazeTrail(route.slice(0, k), p.cols));
  } else if (p.type === "spotdiff") {
    const taps: number[][] = [[], []];
    // The hidden seventh first in its picture: the runner grades the first finished step, as a phone that taps Done.
    for (const scene of [0, 1]) {
      if (p.bonus && (p.bonus.scene ?? 0) === scene) (taps[scene]!.push(p.bonus.cells[0]!), push(taps.map((x) => x.join(",")).join("|")));
      for (const d of (p.differences ?? []).filter((x) => (x.scene ?? 0) === scene)) (taps[scene]!.push(d.cells[0]!), push(taps.map((x) => x.join(",")).join("|")));
    }
  } else if (p.type === "symscan") {
    const sel: number[][] = p.stages.map(() => []);
    const enc = () => joinStages(sel.map((x) => [...x].sort((a, b) => a - b).join(","))) + (usesScanDepth(p) ? "|0" : "");
    p.stages.forEach((_, i) => {
      for (const c of p.targets?.[i] ?? []) (sel[i]!.push(c), push(enc()));
      push(enc());
    });
  } else if (p.type === "countup") {
    const answers = p.stages.map(() => "");
    p.stages.forEach((st, i) => {
      answers[i] = String(countUpStageTruth(st));
      push(joinStages(answers, p.stages.length));
    });
  } else if (p.type === "bomb") {
    const seq = decodeBombActions(p.sequence ?? "");
    for (let k = 1; k <= seq.length; k++) push(seq.slice(0, k).join(","));
  }
  return steps;
}
for (const type of GAMES) {
  for (const level of ["easy", "normal", "hard", "expert"] as const) {
    for (const seed of SEEDS.slice(0, FULL ? 12 : 4)) {
      const p = deal(type, level, seed);
      const run = gradeSteps(p, asPhoneSends(p, flawless(p)));
      check(run.isCorrect && run.score === 200, `${type} ${level} ${seed}: a flawless run scores ${run.score} (finished ${run.isCorrect})`);
      const nothing = gradeAnswer(p, "", 0);
      check(nothing.score >= 0 && !nothing.isCorrect, `${type} ${level}: doing nothing finishes or goes negative`);
    }
  }
}

/* ------------------------------------------------------------------ 6. Expert's instant bomb */
{
  const p = deal("bomb", "expert", SEEDS[0]!) as BombPuzzleData;
  const seq = decodeBombActions(p.sequence ?? "");
  const actions = bombActionsOf(p.wires.length);
  const wrong = actions.find((a) => a !== seq[1] && a !== seq[0])!;
  const right = await checkPuzzleMoves(p, seq.slice(0, 3).join(","));
  const bad = await checkPuzzleMoves(p, [seq[0], wrong].join(","));
  check(right?.type === "bomb" && right.live && right.steps === 3, `bomb expert: three right steps read as ${JSON.stringify(right)}`);
  check(bad?.type === "bomb" && !bad.live && bad.steps === 1, `bomb expert: a wrong second step reads as ${JSON.stringify(bad)}`);
  check(Object.keys(right ?? {}).sort().join(",") === "live,steps,type", "bomb expert: the live check says more than live and steps");
  const graded = gradeAnswer(p, [seq[0], wrong, ...seq.slice(1)].join(","), 30_000);
  check(!graded.isCorrect, "bomb expert: steps after a wrong one still defused it");
  const hard = deal("bomb", "hard", SEEDS[0]!) as BombPuzzleData;
  check((await checkPuzzleMoves(hard, decodeBombActions(hard.sequence ?? "").slice(0, 2).join(","))) === null, "bomb hard: has a live check");
}

/* ------------------------------------------------------------------ 7. Expert is humanly possible */
/** Orders a person tries in their head before giving up on a bomb. */
const PERSON_PATIENCE = 400;

{
  const seeds = SEEDS.slice(0, FULL ? 30 : 8);
  // Every Expert panel in the bank, worked out within a person's patience (orders tried in the head, a few hundred).
  const tries = BOMB_EXPERT_BANK.map((b) => personBombTries(b, PERSON_PATIENCE));
  const solved = tries.filter((t) => Number.isFinite(t)).length;
  check(solved === BOMB_EXPERT_BANK.length, `bomb expert: a person-like solver works out ${solved} of ${BOMB_EXPERT_BANK.length} bank panels within ${PERSON_PATIENCE} orders`);
  const mazeTimes = seeds.map((s) => personMazeSeconds(deal("maze", "expert", s) as MazePuzzleData, MAZE_LEVELS.expert.exitRevealCells));
  const inTime = mazeTimes.filter((t) => t <= MAZE_LEVELS.expert.timeLimitMs / 1000).length;
  check(inTime >= Math.ceil(0.75 * seeds.length), `maze expert: a person-like solver reaches the hidden exit in time on ${inTime} of ${seeds.length} (${mazeTimes.map((t) => t.toFixed(0)).join(", ")} s)`);
  // The elite kit finishes most Expert boards of every game.
  for (const type of GAMES) {
    const kit = KITS[type];
    if (!kit) continue;
    let finished = 0;
    for (const seed of seeds) {
      const p = deal(type, "expert", seed);
      const play = kit.play(p, makeRng(hashText(`attention-levels:${type}:${seed}`)), SKILLS.near, puzzleTimeLimitMs(p));
      if (gradeSteps(p, asPhoneSends(p, play.steps), play.timed).isCorrect) finished++;
    }
    check(finished > seeds.length / 2, `${type} expert: the elite kit finishes ${finished} of ${seeds.length}`);
  }
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
  console.log(`FAIL attention-levels-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS attention-levels-check: ${passes} assertions`);
