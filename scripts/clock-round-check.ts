/**
 * clock-round-check (19 Oct 2026, room flow only): the shared clock is measured again at every
 * round and on returning to the app (src/lib/duel/clock.ts, useDuel), #115's audit item 7.
 *
 *  1. A device clock that moves after the first measurement (an automatic time update, a phone asleep)
 *     leaves serverNow() ahead; measuring again brings it back within the round trip.
 *  2. End to end on Flash (tap logs) and Ascend: a phone reading 2 s ahead stamps its last taps past
 *     the room's receipt check (grade.ts latestTapMs), which drops them; measured again at the round's
 *     start, the same play grades in the room exactly as practice grades it.
 *  3. A failed measurement keeps the last good offset.
 *  4. The room re-measures when the round changes and when the page becomes visible.
 *
 *   bun scripts/clock-round-check.ts
 */
import { readFileSync } from "node:fs";

import { calibrateServerClock, serverNow, setClockSourcesForCheck } from "../src/lib/duel/clock";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzlePrepMs, puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { encodeNumberTaps, encodeTapTimes, usesTapLog } from "../src/lib/duel/tapLog";
import type { PuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

// calibrateServerClock only runs in a browser.
(globalThis as { window?: unknown }).window ??= globalThis;

/** The true (server) time, and the device's skew from it. */
let trueNow = 1_760_000_000_000;
let skew = 0;
let serverDown = false;
setClockSourcesForCheck({
  deviceNow: () => trueNow + skew,
  serverTime: async () => {
    if (serverDown) throw new Error("offline");
    trueNow += 20; // half of a 40 ms round trip
    const now = trueNow;
    trueNow += 20;
    return { now };
  },
});

/* ------------------------------------------------------------ 1. re-measuring brings the clock back */
await calibrateServerClock();
check(Math.abs(serverNow() - trueNow) <= 40, `first measurement off by ${serverNow() - trueNow} ms`);
skew = 2_000; // the device clock jumps after the measurement
check(serverNow() - trueNow >= 1_900, "setup: the jump did not move serverNow");
await calibrateServerClock();
check(Math.abs(serverNow() - trueNow) <= 40, `re-measured clock still ${serverNow() - trueNow} ms off`);

/* ------------------------------------------------------------ 3. a failed measurement keeps the offset */
serverDown = true;
await calibrateServerClock();
check(Math.abs(serverNow() - trueNow) <= 40, "a failed measurement threw away the last good offset");
serverDown = false;

/* ------------------------------------------------------------ 2. end to end: Flash and Ascend */
type Play = { puzzle: PuzzleData; answerAt: (stamp: (trueRoundMs: number) => number) => { answer: string; sentAt: number } };

function flashPlay(seed: number): Play | null {
  const puzzle = withSeededRandom(seed, () => generatePuzzle("reaction")) as PuzzleData;
  if (puzzle.type !== "reaction" || !usesTapLog(puzzle)) return null;
  return {
    puzzle,
    answerAt: (stamp) => {
      const taps = puzzle.flashes.map((f) => f + 260);
      const sentAt = taps[taps.length - 1]! + 300;
      return { answer: encodeTapTimes(taps.map(stamp)), sentAt };
    },
  };
}

function ascendPlay(seed: number): Play | null {
  const puzzle = withSeededRandom(seed, () => generatePuzzle("numhunt")) as PuzzleData;
  if (puzzle.type !== "numhunt" || !usesTapLog(puzzle)) return null;
  const limit = puzzleTimeLimitMs(puzzle);
  return {
    puzzle,
    answerAt: (stamp) => {
      // A steady player tapping through to the last seconds of the clock.
      const count = 24;
      const step = Math.floor((limit - 2_500) / count);
      const taps = Array.from({ length: count }, (_, i) => ({ n: i + 1, t: 1_000 + i * step }));
      const sentAt = taps[taps.length - 1]!.t + 300;
      return { answer: encodeNumberTaps(taps.map((tap) => ({ n: tap.n, t: stamp(tap.t) }))), sentAt };
    },
  };
}

let compared = 0;
let droppedBefore = 0;
for (const make of [flashPlay, ascendPlay]) {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const play = make(seed);
    if (!play) continue;
    const { puzzle } = play;
    const limit = puzzleTimeLimitMs(puzzle);
    const phaseStart = 1_760_000_000_000;
    const grade = (skewMs: number) => {
      // The phone stamps each tap on its round clock (serverNow() − the phase start).
      const { answer, sentAt } = play.answerAt((t) => t + skewMs);
      const received = phaseStart + puzzlePrepMs(puzzle) + sentAt;
      const msRemaining = Math.max(0, limit - sentAt - skewMs);
      return {
        room: gradeRoomAnswer(puzzle, { phase: "puzzle", phaseStartedAt: new Date(phaseStart).toISOString(), nowMs: received }, answer, msRemaining).graded,
        practice: gradeAnswer(puzzle, play.answerAt((t) => t).answer, Math.max(0, limit - sentAt)),
      };
    };
    // Before: the clock measured once, then 2 s ahead by the round.
    const ahead = grade(2_000);
    // After: measured again at the round's start (offset now within a round trip).
    const measured = grade(serverNow() - trueNow);
    if (ahead.room.score < ahead.practice.score) droppedBefore++;
    check(
      measured.room.score === measured.practice.score && measured.room.isCorrect === measured.practice.isCorrect,
      `${puzzle.type} seed ${seed}: room ${measured.room.score} vs practice ${measured.practice.score} after re-measuring`,
    );
    compared++;
  }
}
check(compared >= 8, `only ${compared} rounds compared`);
check(droppedBefore >= 4, `setup: a 2 s-ahead clock dropped taps in only ${droppedBefore} rounds (the bug this guards)`);

/* ------------------------------------------------------------ 4. when the room re-measures */
{
  const hook = readFileSync(new URL("../src/lib/duel/useDuel.ts", import.meta.url), "utf8");
  check(/void calibrateServerClock\(\);\n  \}, \[duel\?\.id, duel\?\.status, duel\?\.current_round\]\);/.test(hook), "the room does not re-measure at every round");
  check(/visibilitychange/.test(hook) && /document\.visibilityState === "visible"\) void calibrateServerClock\(\)/.test(hook), "the room does not re-measure on returning to the app");
}

if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`clock-round-check: FAIL (${failures.length} failed, ${passes} passed)`);
  process.exit(1);
}
console.log(`clock-round-check: PASS (${passes} checks; ${compared} rounds, ${droppedBefore} dropped taps with a 2 s-ahead clock)`);
