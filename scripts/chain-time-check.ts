/**
 * Don't Break the Chain's finish bonus (13 Oct 2026, `chainTimeRev: 1`).
 * Rounds stamped `chainTimeRev: 1` take time left as the claim (held to the
 * receipt check) but never more than the replayed last tap allows
 * (CHAIN_TIME_MS less its time). Proves, over 40 seeds on both score shapes
 * and both speed curves:
 *
 *  - new boards are stamped `chainTimeRev: 1`;
 *  - a claimed time beyond the last tap never raises the bonus or the stored
 *    time left: it scores exactly as a claim of the last tap's time left;
 *  - a claim below the last tap's time left still scores as claimed;
 *  - unfinished stamped runs grade exactly as unstamped ones;
 *  - unstamped rounds (stored before the stamp) score and store exactly as
 *    before, the claimed time included.
 *
 *   bun scripts/chain-time-check.ts
 */
import { generateChain } from "../src/lib/duel/chain.server";
import { chainRequiredAt, encodeChainAnswer, type ChainTap } from "../src/lib/duel/chain";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { scoreChain } from "../src/lib/duel/scoring";
import { withPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import { SPEED_PAR_VERSION, withSpeedCurve } from "../src/lib/duel/speedPar";
import {
  CHAIN_LENGTH,
  CHAIN_TIME_MS,
  CHAIN_TIME_REV,
  type ChainPuzzleData,
  type PuzzleData,
} from "../src/lib/duel/types";

let failures = 0;
let passes = 0;
function check(ok: boolean, message: string) {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}

/** A perfect 40-link run: first tap at `start`, then one every `gap` ms. */
function perfectTaps(puzzle: ChainPuzzleData, start: number, gap: number): ChainTap[] {
  const taps: ChainTap[] = [];
  const used: number[][] = [];
  for (let link = 0; link < CHAIN_LENGTH; link++) {
    const board = Math.floor(link / 5);
    const need = chainRequiredAt(puzzle, link)!;
    const node = puzzle.boards[board]!.findIndex(
      (n, i) => n.shape === need.shape && n.colour === need.colour && !(used[board] ?? []).includes(i),
    );
    (used[board] ??= []).push(node);
    taps.push({ node, t: start + link * gap });
  }
  return taps;
}

const grade = (puzzle: ChainPuzzleData, taps: ChainTap[], reason: "complete" | "timer", claimed: number) =>
  gradeAnswer(puzzle as unknown as PuzzleData, encodeChainAnswer({ taps, reason }), claimed);

let stampOk = true;
let capOk = true;
let belowOk = true;
let unfinishedOk = true;
let legacyOk = true;
let raisedBefore = 0;
for (let seed = 1; seed <= 40; seed++) {
  const fresh = generateChain(seed * 7919);
  if (fresh.chainTimeRev !== CHAIN_TIME_REV) stampOk = false;
  for (const [scoreRev, speedPar] of [[undefined, undefined], [undefined, SPEED_PAR_VERSION], [1, SPEED_PAR_VERSION]] as const) {
    const stamped = { ...fresh, puzzleScoreRev: scoreRev, speedPar } as ChainPuzzleData;
    /** The pre-change grader's chain score: the claim under the stored curve and score shape. */
    const scoreBefore = (links: number, claimed: number, puzzle: ChainPuzzleData) =>
      withSpeedCurve(speedPar === SPEED_PAR_VERSION, () =>
        withPuzzleScoreRev(scoreRev ?? 0, () => scoreChain(links, claimed, puzzle)));
    const unstamped = { ...stamped } as ChainPuzzleData;
    delete unstamped.chainTimeRev;
    // Taps 500–1,000 ms apart: the last lands between 20 s and 40 s.
    const gap = 500 + ((seed * 37) % 11) * 50;
    const taps = perfectTaps(fresh, 500, gap);
    const lastT = taps.at(-1)!.t;
    const leftAtLast = CHAIN_TIME_MS - lastT;
    const honest = grade(stamped, taps, "complete", leftAtLast);
    if (!honest.isCorrect || honest.storedMs !== leftAtLast) capOk = false;
    for (const claimed of [leftAtLast + 1, leftAtLast + 5_000, CHAIN_TIME_MS - 1, CHAIN_TIME_MS]) {
      const inflated = grade(stamped, taps, "complete", claimed);
      if (inflated.score !== honest.score || inflated.storedMs !== leftAtLast) {
        capOk = false;
        console.log(`  seed ${seed} rev ${scoreRev} par ${speedPar}: claim ${claimed} scored ${inflated.score} (stored ${inflated.storedMs}) vs ${honest.score} at the last tap`);
      }
      // Before the stamp the same claim raised the bonus.
      const before = grade(unstamped, taps, "complete", claimed);
      const want = scoreBefore(CHAIN_LENGTH, claimed, unstamped);
      if (before.score !== want || before.storedMs !== claimed) legacyOk = false;
      if (before.score > honest.score) raisedBefore++;
    }
    const slower = grade(stamped, taps, "complete", Math.max(0, leftAtLast - 3_000));
    const wantSlower = scoreBefore(CHAIN_LENGTH, Math.max(0, leftAtLast - 3_000), stamped);
    if (slower.score !== wantSlower || slower.storedMs !== Math.max(0, leftAtLast - 3_000)) belowOk = false;
    // Unfinished: 25 links, then the clock; stamped and unstamped grade alike.
    const part = taps.slice(0, 25);
    for (const claimed of [0, 10_000, CHAIN_TIME_MS]) {
      const a = grade(stamped, part, "timer", claimed);
      const b = grade(unstamped, part, "timer", claimed);
      if (a.score !== b.score || a.storedMs !== b.storedMs || a.isCorrect) unfinishedOk = false;
    }
  }
}
check(stampOk, "new Chain boards are stamped chainTimeRev 1");
check(capOk, "a claimed time beyond the last tap doesn't raise the bonus or the stored time left");
check(belowOk, "a claim below the last tap's time left scores as claimed");
check(unfinishedOk, "unfinished stamped runs grade exactly as unstamped ones");
check(legacyOk, "unstamped rounds score and store the claimed time exactly as before");
check(raisedBefore > 0, "the inflated claims did raise the bonus on unstamped rounds (the case being closed)");
console.log(`  unstamped rounds: ${raisedBefore} inflated claims scored above the last-tap bonus`);

console.log(`chain-time-check: ${passes} passed, ${failures} failed`);
if (failures) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
