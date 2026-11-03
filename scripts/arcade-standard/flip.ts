/**
 * Roofbound on the arcade scoring standard (docs/arcade-standard/flip.md). Rooms deal flipRev 11 since 3 Nov 2026
 * ("flipRev 11": no star pickups, the flow streak): clean time 100 (the half seconds survived less 20 s for each crash a
 * checkpoint saved, full at the minute), perfect landings 60 (7.5 each of the 8 sweet spots), double flips 20 (2.5 each,
 * full at 8) and the flow streak 20 (the longest run of clean jumps, 0.4 each, full at 50). flipRev 10 (29 Oct 2026: time
 * survived 150, gold stars 15, star trails 15, sweet landings 10, double flips 10) stays proved by flip-rev11-check's
 * legacy runs and arcade-phone-notes-check.
 *
 * Perfect runs: the stored witness routes (scripts/fixtures/flip-x200-witness.json.gz, one per tuning and fresh room
 * seed, each proved to last the minute on flipRev 8's play, which flipRev 11 keeps) replayed through the server on
 * flipRev 11; every witness that lasts the minute with no crash saved, lands all eight sweet spots, makes at least eight
 * double flips and a flow streak of at least 50 must score 200 (nearly all do). One built state (a witness's end state)
 * is scored by the sim's own score function as well.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { flipGameFor, flipSweetsTaken, FLIP_REV_FLOW, FLIP_REV_STD, FLIP_V11, FLIP_V11_DOUBLES, FLIP_V11_STREAK_FULL, FLIP_V8_SWEETS, type FlipState } from "../../src/lib/arcade/flip";
import { replayFlipRun } from "../../src/lib/duel/flip";
import { encodeFlipLog, FLIP_WITNESS_FIXTURE, type FlipWitness } from "../flip-x200-record";
import { flipTap } from "../flip-x200-plan";
import type { StdEntry, StdRun } from "./entry";

const witnesses = (): FlipWitness[] => JSON.parse(gunzipSync(readFileSync(FLIP_WITNESS_FIXTURE)).toString()) as FlipWitness[];
/** A witness on flipRev 11 that takes every part's maximum. */
export const flipTakesAll = (s: FlipState) =>
  s.ended === 1 && !(s.saves ?? 0) && flipSweetsTaken(s) === FLIP_V8_SWEETS && (s.combos ?? 0) >= FLIP_V11_DOUBLES && (s.bestStreak ?? 0) >= FLIP_V11_STREAK_FULL;

export const entry: StdEntry = {
  type: "flip",
  field: "flipRev",
  rev: FLIP_REV_FLOW,
  before: FLIP_REV_STD,
  parts: FLIP_V11.parts,
  spec: FLIP_V11,
  perfect() {
    const out: StdRun[] = [];
    let every = 0;
    for (const w of witnesses()) {
      const { raw, state } = encodeFlipLog(FLIP_REV_FLOW, w.seed, w.taps.map(flipTap));
      if (!flipTakesAll(state)) continue;
      every++;
      const r = replayFlipRun(w.seed, raw, FLIP_REV_FLOW);
      out.push({ label: `witness seed ${w.seed} (server replay${r.flagged ? ", FLAGGED" : ""})`, score: r.flagged ? -1 : r.score });
      if (out.length === 1) out.push({ label: `witness seed ${w.seed}'s end state (the sim's score)`, score: flipGameFor(FLIP_REV_FLOW).score(state) });
    }
    console.log(`  flip: ${every} of ${witnesses().length} witness routes take every part's maximum on flipRev 11`);
    if (every < 200) out.push({ label: `at least 200 witnesses take every part's maximum (${every})`, score: 0 });
    return out;
  },
  played() {
    const seed = witnesses()[0]!.seed;
    // One flip at the start, then nothing: the runner rides the ceiling into the first hazard there.
    const one = encodeFlipLog(FLIP_REV_FLOW, seed, [flipTap(1)]);
    const r = replayFlipRun(seed, one.raw, FLIP_REV_FLOW);
    // A state that has acted and earned nothing at all (tick 0): stdTotal's floor of 1.
    const game = flipGameFor(FLIP_REV_FLOW);
    const bare = { ...game.init(seed), acted: 1 };
    return [
      { label: `one flip at tick 1 (seed ${seed}, ${r.survivedSeconds.toFixed(1)} s)`, score: r.flagged ? 0 : r.score },
      { label: "an acted state with nothing earned", score: game.score(bare) },
    ];
  },
  idle() {
    const seed = witnesses()[0]!.seed;
    const r = replayFlipRun(seed, encodeFlipLog(FLIP_REV_FLOW, seed, []).raw, FLIP_REV_FLOW);
    return [{ label: `no input (seed ${seed}, ${r.survivedSeconds.toFixed(1)} s)`, score: r.flagged ? -1 : r.score }];
  },
  help: { terms: ["Clean time", "half second", "up to 100", "120 clean half seconds", "Perfect landings", "Flow streak"] },
};
