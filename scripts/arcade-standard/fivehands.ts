/**
 * arcade-standard-check's entry for `fivehands` (Five Hands fiveHandsRev 1, Cards & Board;
 * docs/arcade-standard/fivehands.md): born on the standard. Perfect runs tap every card onto its witness row through
 * the server's replay; the core is hand points on a straight line, full at FH_CORE_FULL (the elite median), checked on
 * the partial rows of a witness.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { FH_CORE_FULL, FH_CORE_MAX, FH_HAND_EACH, fhDeal, fhTotals, fiveHandsGame, fiveHandsStdParts, type FhState } from "../../src/lib/arcade/cards/fiveHands";
import { replayFiveHandsRun } from "../../src/lib/duel/cards";
import { fiveHandsFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.fivehands!.spec!;
const rec = (s: FhState) => Object.fromEntries((fiveHandsStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: FhState) => Object.fromEntries((fiveHandsStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** Seed 9's witness filled a card at a time (rows' dealt cards first, then slot by slot): every partial set of rows. */
const SEED = 9;
const WITNESS = fhDeal(SEED).witness;
const PARTIALS: number[][][] = [];
for (let k = 1; k <= 5; k++) for (let r = 0; r <= 5; r++) PARTIALS.push(WITNESS.map((row, i) => row.slice(0, i < r ? k + 1 : k).slice(0, 5)));

export const entry: StdEntry = {
  type: "fivehands",
  field: "fiveHandsRev",
  rev: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 77, 10000, 123456789].map((seed) => {
      const { raw } = fiveHandsFlawless(seed);
      const r = replayFiveHandsRun(seed, raw);
      return { label: `seed ${seed}'s witness through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap that placed nothing", score: fiveHandsGame.score({ ...fiveHandsGame.init(4), acted: 1 }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: fiveHandsGame.score(fiveHandsGame.init(12)) }],
  help: { terms: ["hand points", "pair"] },
  extra(ok) {
    let straight = true;
    for (const rows of PARTIALS) {
      const { total, made } = fhTotals(rows);
      const parts = fiveHandsStdParts({ ...fiveHandsGame.init(SEED), rows, acted: 1 })!;
      if (parts[0]!.points !== Math.floor((FH_CORE_MAX * Math.min(total, FH_CORE_FULL)) / FH_CORE_FULL) || parts[1]!.points !== FH_HAND_EACH * made) straight = false;
    }
    ok(straight, `fivehands: the core is floor(160 × min(total, ${FH_CORE_FULL}) ÷ ${FH_CORE_FULL}) and made hands 8 a row on every partial witness`);
    ok(fhTotals(WITNESS).made === 5 && fhTotals(WITNESS).total >= FH_CORE_FULL, "fivehands: the witness makes all five hands and fills the core");
  },
};
