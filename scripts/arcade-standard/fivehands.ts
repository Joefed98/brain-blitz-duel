/**
 * arcade-standard-check's entry for `fivehands` (Five Hands fiveHandsRev 2, Cards & Board;
 * docs/arcade-standard/fivehands.md): born on the standard at rev 1 (hand points 160 + made hands 40); rev 2 (1 Nov
 * 2026) is one part, hand points on the steep table (pair 5 … straight flush 75) to 200 on a straight line, full at
 * the deck's own best (fhDeckBest, stored as `fiveHandsBest`). Perfect runs tap every card onto its best arrangement's
 * row through the server's replay; the core is checked on the partial rows of that arrangement; rev 1's two parts are
 * kept for stored rounds.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  FH_CORE_FULL, FH_CORE_MAX, FH_CORE_MAX_V2, FH_HAND_EACH, fhDeal, fhTotals, fiveHandsGameFor, fiveHandsStdParts, type FhState,
} from "../../src/lib/arcade/cards/fiveHands";
import { replayFiveHandsRun } from "../../src/lib/duel/cards";
import { fiveHandsFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.fivehands!.spec!;
const game = fiveHandsGameFor(2);
const rec = (s: FhState) => Object.fromEntries((fiveHandsStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: FhState) => Object.fromEntries((fiveHandsStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** Seed 9's rev-2 witness filled a card at a time (rows' dealt cards first, then slot by slot): every partial set of rows. */
const SEED = 9;
const WITNESS = fhDeal(SEED, 2).witness;
const BEST = fhDeal(SEED, 2).target;
const PARTIALS: number[][][] = [];
for (let k = 1; k <= 5; k++) for (let r = 0; r <= 5; r++) PARTIALS.push(WITNESS.map((row, i) => row.slice(0, i < r ? k + 1 : k).slice(0, 5)));
const WITNESS_V1 = fhDeal(SEED, 1).witness;

export const entry: StdEntry = {
  type: "fivehands",
  field: "fiveHandsRev",
  rev: 2,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 77, 10000, 123456789].map((seed) => {
      const { raw } = fiveHandsFlawless(seed, 20, 2);
      const r = replayFiveHandsRun(seed, raw, 2);
      return { label: `seed ${seed}'s rev-2 witness through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap that placed nothing", score: game.score({ ...game.init(4), acted: 1 }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: game.score(game.init(12)) }],
  help: { terms: ["hand points", "best possible total", "straight flush 75"] },
  extra(ok) {
    let straight = true;
    for (const rows of PARTIALS) {
      const { total } = fhTotals(rows, 2);
      const parts = fiveHandsStdParts({ ...game.init(SEED), rows, acted: 1 })!;
      if (parts.length !== 1 || parts[0]!.points !== Math.floor((FH_CORE_MAX_V2 * Math.min(total, BEST)) / BEST)) straight = false;
    }
    ok(straight, `fivehands: the one part is floor(200 × min(total, ${BEST}) ÷ ${BEST}) on every partial best arrangement (seed ${SEED}'s best ${BEST})`);
    ok(fhTotals(WITNESS, 2).total === BEST, "fivehands: the best arrangement reaches the deck's best");
    // Rev 1 (stored rounds): its two parts exactly as before.
    const v1 = fiveHandsGameFor(1);
    const p1 = fiveHandsStdParts({ ...v1.init(SEED), rows: WITNESS_V1, acted: 1 })!;
    const t1 = fhTotals(WITNESS_V1, 1);
    ok(p1.length === 2 && p1[0]!.points === Math.floor((FH_CORE_MAX * Math.min(t1.total, FH_CORE_FULL)) / FH_CORE_FULL) && p1[1]!.points === FH_HAND_EACH * t1.made, "fivehands: rev 1 keeps hand points 160 (full at 23) and made hands 8 a row");
  },
};
