/**
 * arcade-standard-check's entry for `fivehands` (Five Hands fiveHandsRev 4 since D6, 22 Nov 2026: rev 3's game, 200 at
 * 128 hand points; Cards & Board;
 * docs/arcade-standard/fivehands.md): born on the standard at rev 1 (hand points 160 + made hands 40); rev 2 (1 Nov
 * 2026) one part, hand points on the steep table to 200, full at FH_CORE_FULL_V2; rev 3 (3 Nov 2026) one part, the
 * flat table's hand points (pair 15 … straight flush 50) of the five rows plus a bonus column picked once they are
 * complete, summed, times 1.4 (floor of × 7 ÷ 5), capped at 200, at least 1 for a played run.
 *
 * Five Hands is the standard's one named exception to "a perfect run scores 200 on every deal"
 * (NOT_200_ON_EVERY_DEAL in arcade-standard-check): the deck is the seed's first shuffle and some decks can't reach 200
 * even placed perfectly. Its perfect runs are each deck's exact best arrangement (scripts/cards/fiveHandsBest.ts)
 * through the server's replay, each scoring exactly min(200, floor(its hand points × 1.4)); the core's straight line is 1.4 points a
 * hand point to the cap (full at 143).
 *
 * Changed with Joe's approval, 23 Nov 2026 (D6's Normal scoring stamps): the entry moved to the new stamp; the older stamp's lines kept.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  FH_CORE_FULL, FH_CORE_FULL_V2, FH_CORE_MAX, FH_CORE_MAX_V2, FH_HAND_EACH, fhDeal, fhTotals, fiveHandsGameFor, fiveHandsStdParts, type FhState,
} from "../../src/lib/arcade/cards/fiveHands";
import { replayFiveHandsRun } from "../../src/lib/duel/cards";
import { fhBest } from "../cards/fiveHandsBest";
import { fiveHandsFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.fivehands!.spec!;
/** Rev 3's points for a hand-point total, written out here (not the sim's helper): floor(total × 7 ÷ 5), capped at 200. */
const x14 = (total: number) => Math.min(200, Math.floor((total * 7) / 5));
/** Rev 4's, written out here: floor(total × 200 ÷ 112), capped at 200. */
// Changed with Joe's approval, 23 Nov 2026 (D6: fiveHandsRev 4 tuned to 200 at 112 hand points before it shipped).
const at128 = (total: number) => Math.min(200, Math.floor((total * 200) / 112));
const game = fiveHandsGameFor(3);
const game4 = fiveHandsGameFor(4);
const rec = (s: FhState) => Object.fromEntries((fiveHandsStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: FhState) => Object.fromEntries((fiveHandsStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** Seed 9's rev-3 best filled a card at a time (rows' dealt cards first, then slot by slot): every partial set of rows. */
const SEED = 9;
const BEST = fhBest(SEED, 3).rows;
const PARTIALS: number[][][] = [];
for (let k = 1; k <= 5; k++) for (let r = 0; r <= 5; r++) PARTIALS.push(BEST.map((row, i) => row.slice(0, i < r ? k + 1 : k).slice(0, 5)));

export const entry: StdEntry = {
  type: "fivehands",
  field: "fiveHandsRev",
  // Changed with Joe's approval, 23 Nov 2026 (D6): fiveHandsRev 4 (rev 3 before it).
  rev: 4,
  before: 3,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 77].map((seed) => {
      const best = fhBest(seed, 3);
      // Changed with Joe's approval, 23 Nov 2026 (D6): rev 3's exact best played on rev 4, scored on the 128 line.
      const r = replayFiveHandsRun(seed, fiveHandsFlawless(seed, 20, 3).raw, 4);
      const want = Math.max(1, at128(best.total));
      return { label: `seed ${seed}'s exact best (${best.total} hand points) through the server replay`, score: r.score, want, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  // Changed with Joe's approval, 23 Nov 2026 (D6): played, idle and the help on rev 4.
  played: () => [{ label: "a tap that placed nothing", score: game4.score({ ...game4.init(4), acted: 1 }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: game4.score(game4.init(12)) }],
  // Changed with Joe's approval, 23 Nov 2026 (D6: fiveHandsRev 4 tuned to 200 at 112 hand points before it shipped).
  help: { terms: ["hands", "pair 15", "straight flush 50", "200 at 112 hand points"] },
  extra(ok) {
    let straight = true;
    for (const rows of PARTIALS) {
      const { total } = fhTotals(rows, 3);
      const parts = fiveHandsStdParts({ ...game.init(SEED), rows, acted: 1 })!;
      if (parts.length !== 1 || parts[0]!.points !== x14(total)) straight = false;
    }
    ok(straight, "fivehands: the one part is min(200, floor(hand points × 1.4)) on every partial rev-3 best");
    ok(x14(100) === 140 && x14(142) === 198 && x14(143) === 200 && x14(160) === 200, "fivehands: × 1.4 anchors (100 → 140, 142 → 198, 143 → 200, 160 → 200)");
    // Rev 4 (D6, 22 Nov 2026): the same rows and column on a straight line to 200 at 128.
    let line4 = true;
    for (const rows of PARTIALS) {
      const { total } = fhTotals(rows, 4);
      const parts = fiveHandsStdParts({ ...game4.init(SEED), rows, acted: 1 })!;
      if (parts.length !== 1 || parts[0]!.points !== at128(total)) line4 = false;
    }
    // Changed with Joe's approval, 23 Nov 2026 (D6: fiveHandsRev 4 tuned to 200 at 112 hand points before it shipped).
    ok(line4, "fivehands rev 4: the one part is min(200, floor(hand points × 200 ÷ 112)) on every partial best");
    ok(at128(56) === 100 && at128(111) === 198 && at128(112) === 200 && at128(160) === 200, "fivehands rev 4: anchors (56 → 100, 111 → 198, 112 → 200, 160 → 200)");
    ok(JSON.stringify({ ...game4.init(SEED), rev: 3 }) === JSON.stringify(game.init(SEED)), "fivehands rev 4: rev 3's deck and opening state exactly");
    // A built state over the cap: five straight flushes (250 on the table) pay 200.
    const flushes = [0, 1, 2, 3].map((s) => [0, 1, 2, 3, 4].map((r) => s * 13 + r)).concat([[5, 6, 7, 8, 9]]);
    const capped = fiveHandsStdParts({ ...game.init(SEED), rows: flushes, acted: 1 })!;
    ok(fhTotals(flushes, 3).total === 250 && capped[0]!.points === 200 && game.score({ ...game.init(SEED), rows: flushes, acted: 1 }) === 200, "fivehands: 250 hand points (× 1.4 = 350) are capped at 200");
    // Rev 2 (stored rounds): its one part, full at FH_CORE_FULL_V2, exactly as before.
    const v2 = fiveHandsGameFor(2);
    const w2 = fhDeal(SEED, 2).witness;
    const p2 = fiveHandsStdParts({ ...v2.init(SEED), rows: w2, acted: 1 })!;
    ok(p2.length === 1 && p2[0]!.max === FH_CORE_MAX_V2 && p2[0]!.points === Math.floor((FH_CORE_MAX_V2 * Math.min(fhTotals(w2, 2).total, FH_CORE_FULL_V2)) / FH_CORE_FULL_V2), "fivehands: rev 2 keeps hand points to 200, full at 49");
    // Rev 1 (stored rounds): its two parts exactly as before.
    const v1 = fiveHandsGameFor(1);
    const w1 = fhDeal(SEED, 1).witness;
    const p1 = fiveHandsStdParts({ ...v1.init(SEED), rows: w1, acted: 1 })!;
    const t1 = fhTotals(w1, 1);
    ok(p1.length === 2 && p1[0]!.points === Math.floor((FH_CORE_MAX * Math.min(t1.total, FH_CORE_FULL)) / FH_CORE_FULL) && p1[1]!.points === FH_HAND_EACH * t1.made, "fivehands: rev 1 keeps hand points 160 (full at 23) and made hands 8 a row");
  },
};
