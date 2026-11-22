/**
 * D3's proof that 200 is reachable on the Attention games' boards under Joe's human limits (0.25 s to react, 0.15 s to
 * move): a person-like flawless run at a person's pace, built from what the board shows, graded by the server. A
 * script library, not a check (d3-attention-ladder-check.ts runs it on every level's deals and asserts 200).
 *
 * The pace (each figure at or above the limits, plus the looking a person needs):
 *  - Eagle Eye: read the target 1.0 s (1.4 s with two facings), look the grid over at 30 ms an eagle, 0.4 s a tap,
 *    0.4 s to move on.
 *  - Double Take: 1.0 s to take each picture in, compare at 80 ms a shape (twice that on a mirrored panel), 0.4 s a tap,
 *    1.2 s to move to the next picture.
 *  - Tally: read the question 1 s, count 0.25 s a counted shape (the spec's limits run), 0.4 s a digit key and 0.4 s to
 *    submit.
 *  - Labyrinth: 3 s to look the maze over, 1 s to plan each key, 0.2 s a square drawn (the spec's person-like solver),
 *    along the shortest walk through every key to the exit.
 *  - Bomb Defusal: 2.5 s a clue read, 1 s an order tried in the head (attention-levels-lib.ts personBombTries), 0.4 s
 *    a step.
 *  - Matchmaker: a perfect memory sweeping the board in order at 0.4 s a flip (src/lib/duel/pairSweep.ts: a seen
 *    partner matched at once, the gold pair as soon as both are seen, the other found pairs kept for one long run at the
 *    end; a third flip skips the turn-back wait).
 */
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { personBombTries } from "./attention-levels-lib";
import { joinStages } from "../src/lib/duel/stagedRounds";
import { usesScanDepth } from "../src/lib/duel/depth/eagleEye";
import { countUpStageTruth, countUpCounts } from "../src/lib/duel/attentionRev";
import { encodeMazeTrail } from "../src/lib/duel/depth/labyrinth";
import { mazeColsOf } from "../src/lib/duel/maze";
import { mazeBestKeyOrder, mazeKeysOf, mazePathBetween } from "../src/lib/duel/mazeKeys";
import { decodeBombActions } from "../src/lib/duel/bomb";
import { encodePairFlips } from "../src/lib/duel/pairmatch";
import { PAIR_SWEEP_FLIP_MS, pairSweep } from "../src/lib/duel/pairSweep";
import { joinPairGoldTime, pairGoldTimed } from "../src/lib/duel/depth/matchmaker";
import { spotMirrored } from "../src/lib/duel/attentionLevels";
import type { Step } from "./puzzle-fairness/kit";
import type { PuzzleData } from "../src/lib/duel/types";

export const PROOF_GAMES = ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"] as const;

/** The person-like flawless run's steps (answer after each action, round-clock ms). */
export function limitsRun(p: PuzzleData): Step[] {
  const steps: Step[] = [];
  let t = 0;
  const at = (ms: number, answer: string) => {
    t += ms;
    steps.push({ answer, atMs: Math.round(t) });
  };
  if (p.type === "symscan") {
    const sel: number[][] = p.stages.map(() => []);
    const enc = () => joinStages(sel.map((x) => [...x].sort((a, b) => a - b).join(","))) + (usesScanDepth(p) ? "|0" : "");
    p.stages.forEach((stage, i) => {
      t += (stage.alsoTarget !== undefined ? 1400 : 1000) + 30 * stage.cells.length;
      for (const c of p.targets?.[i] ?? []) (sel[i]!.push(c), at(400, enc()));
      at(400, enc());
    });
  } else if (p.type === "spotdiff") {
    const taps: number[][] = [[], []];
    const enc = () => taps.map((x) => x.join(",")).join("|");
    const mirror = spotMirrored(p) ? 2 : 1;
    for (const scene of [0, 1]) {
      const panel = scene === 0 ? p.top : (p.reef?.top ?? []);
      if (scene === 1) t += 1200;
      t += 1000 + 80 * mirror * panel.length;
      if (p.bonus && (p.bonus.scene ?? 0) === scene) (taps[scene]!.push(p.bonus.cells[0]!), at(400, enc()));
      for (const d of (p.differences ?? []).filter((x) => (x.scene ?? 0) === scene)) (taps[scene]!.push(d.cells[0]!), at(400, enc()));
    }
  } else if (p.type === "countup") {
    const answers = p.stages.map(() => "");
    p.stages.forEach((st, i) => {
      const counted = st.shapes.filter((s) => countUpCounts(st, s)).length;
      const truth = String(countUpStageTruth(st));
      t += 1000 + 250 * counted + 400 * truth.length;
      answers[i] = truth;
      at(400, joinStages(answers, p.stages.length));
    });
  } else if (p.type === "maze") {
    const cols = mazeColsOf(p);
    const keys = mazeKeysOf(p);
    const order = keys.length ? mazeBestKeyOrder(p.cells, cols, p.start, keys, p.exit) : [];
    const trail = [p.start];
    let here = p.start;
    for (const target of [...order, p.exit]) {
      const leg = mazePathBetween(p.cells, cols, here, target);
      trail.push(...leg.slice(1));
      here = target;
    }
    t += 3000 + 1000 * keys.length;
    // A draft every eight squares and the whole trail last (a finish's score reads no drafts).
    for (let k = 1; k < trail.length; k++) {
      t += 200;
      if (k % 8 === 0 || k === trail.length - 1) steps.push({ answer: encodeMazeTrail(trail.slice(0, k + 1), cols), atMs: Math.round(t) });
    }
  } else if (p.type === "bomb") {
    const seq = decodeBombActions(p.sequence ?? "");
    t += 2500 * p.rules.length + 1000 * Math.max(0, Math.min(400, personBombTries(p, 400)));
    for (let k = 1; k <= seq.length; k++) at(400, seq.slice(0, k).join(","));
  } else if (p.type === "pairmatch") {
    // The perfect-memory sweep (src/lib/duel/pairSweep.ts), one flip each 0.4 s, the gold match's time sent with it.
    const sweep = pairSweep(p.cards, p.gold);
    const timed = pairGoldTimed(p);
    sweep.flips.forEach((_, k) => {
      const ms = (k + 1) * PAIR_SWEEP_FLIP_MS;
      const flips = encodePairFlips(sweep.flips.slice(0, k + 1));
      const gold = sweep.goldMs !== null && sweep.goldMs <= ms ? sweep.goldMs : null;
      steps.push({ answer: timed ? joinPairGoldTime(flips, gold) : flips, atMs: ms });
    });
  }
  return steps;
}

/** The run's score through the server's grader, its finish and how long it took (s). */
export function proveAt200(p: PuzzleData): { score: number; finished: boolean; seconds: number } {
  const steps = limitsRun(p);
  const run = gradeSteps(p, asPhoneSends(p, steps));
  return { score: run.score, finished: run.isCorrect, seconds: (steps[steps.length - 1]?.atMs ?? 0) / 1000 };
}
