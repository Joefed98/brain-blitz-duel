/**
 * Roofbound on the arcade scoring standard (flipRev 10, docs/arcade-standard/flip.md): time survived 150 (1.25 a half
 * second, full at the minute), gold stars 15, star trails 15, sweet landings 10, double flips 10.
 *
 * Perfect runs: the stored witness routes (scripts/fixtures/flip-x200-witness.json.gz, one per tuning and fresh room
 * seed, each proved to last the minute on flipRev 8's play) replayed through the server on flipRev 10; every witness
 * that takes all ten gold stars, all four trails, all eight sweet spots and at least ten double flips must score 200
 * (most do: they were planned for flipRev 8, where combos could stand in for a missed sweet spot). One built state
 * (a witness's end state) is scored by the sim's own score function as well.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { flipGameFor, flipStarsTaken, flipSweetsTaken, flipTrailStars, FLIP_REV_LIFT, FLIP_REV_STD, FLIP_STD, FLIP_STARS, FLIP_V8_SWEETS, FLIP_V8_TRAILS, type FlipState } from "../../src/lib/arcade/flip";
import { replayFlipRun } from "../../src/lib/duel/flip";
import { encodeFlipLog, FLIP_WITNESS_FIXTURE, type FlipWitness } from "../flip-x200-record";
import { flipTap } from "../flip-x200-plan";
import type { StdEntry, StdRun } from "./entry";

const witnesses = (): FlipWitness[] => JSON.parse(gunzipSync(readFileSync(FLIP_WITNESS_FIXTURE)).toString()) as FlipWitness[];
const takesAll = (s: FlipState) =>
  s.ended === 1 && flipStarsTaken(s) === FLIP_STARS && flipTrailStars(s).full === FLIP_V8_TRAILS && flipSweetsTaken(s) === FLIP_V8_SWEETS && (s.combos ?? 0) >= 10;

export const entry: StdEntry = {
  type: "flip",
  field: "flipRev",
  rev: FLIP_REV_STD,
  before: FLIP_REV_LIFT,
  parts: FLIP_STD.parts,
  spec: FLIP_STD,
  perfect() {
    const out: StdRun[] = [];
    let every = 0;
    for (const w of witnesses()) {
      const { raw, state } = encodeFlipLog(FLIP_REV_STD, w.seed, w.taps.map(flipTap));
      if (!takesAll(state)) continue;
      every++;
      const r = replayFlipRun(w.seed, raw, FLIP_REV_STD);
      out.push({ label: `witness seed ${w.seed} (server replay${r.flagged ? ", FLAGGED" : ""})`, score: r.flagged ? -1 : r.score });
      if (out.length === 1) out.push({ label: `witness seed ${w.seed}'s end state (the sim's score)`, score: flipGameFor(FLIP_REV_STD).score(state) });
    }
    console.log(`  flip: ${every} of ${witnesses().length} witness routes take every item and ten double flips`);
    if (every < 200) out.push({ label: `at least 200 witnesses take every item (${every})`, score: 0 });
    return out;
  },
  played() {
    const seed = witnesses()[0]!.seed;
    // One flip at the start, then nothing: the runner rides the ceiling into the first hazard there.
    const one = encodeFlipLog(FLIP_REV_STD, seed, [flipTap(1)]);
    const r = replayFlipRun(seed, one.raw, FLIP_REV_STD);
    // A state that has acted and earned nothing at all (tick 0): stdTotal's floor of 1.
    const game = flipGameFor(FLIP_REV_STD);
    const bare = { ...game.init(seed), acted: 1 };
    return [
      { label: `one flip at tick 1 (seed ${seed}, ${r.survivedSeconds.toFixed(1)} s)`, score: r.flagged ? 0 : r.score },
      { label: "an acted state with nothing earned", score: game.score(bare) },
    ];
  },
  idle() {
    const seed = witnesses()[0]!.seed;
    const r = replayFlipRun(seed, encodeFlipLog(FLIP_REV_STD, seed, []).raw, FLIP_REV_STD);
    return [{ label: `no input (seed ${seed}, ${r.survivedSeconds.toFixed(1)} s)`, score: r.flagged ? -1 : r.score }];
  },
  help: { terms: ["Time survived", "half second", "150 at 120"] },
};
