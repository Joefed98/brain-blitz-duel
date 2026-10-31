/**
 * arcade-standard-check's entry for `pokersquares` (Full House pokerSquaresRev 2, Cards & Board;
 * docs/arcade-standard/pokersquares.md): born on the standard at rev 1 (full at the near-perfect median, 68); rev 2
 * (31 Oct 2026) is full at PS_CORE_FULL_V2, the elite median. Perfect runs place every card on its target-grid
 * square through the server's rev-2 replay; the core is hand points on a straight line, checked on the partial grids
 * of a target grid.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { NO_CARD } from "../../src/lib/arcade/cards/cards";
import { PS_CORE_FULL_V2 as PS_CORE_FULL, PS_CORE_MAX, pokerSquaresGameFor, pokerSquaresStdParts, psTargetGrid, psTotals, type PsState } from "../../src/lib/arcade/cards/pokerSquares";
import { replayPokerSquaresRun } from "../../src/lib/duel/cards";
import { pokerSquaresFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.pokersquares!.spec!;
const pokerSquaresGame = pokerSquaresGameFor(2);
const rec = (s: PsState) => Object.fromEntries((pokerSquaresStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: PsState) => Object.fromEntries((pokerSquaresStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** The target grid of seed 9 filled square by square: every hand-point total on the way and the grid at each. */
const SEED = 9;
const GRID = psTargetGrid(SEED, 2).grid;
const PARTIALS = Array.from({ length: 26 }, (_, n) => GRID.map((c, i) => (i < n ? c : NO_CARD)));
/** A state holding `v` hand points: the partial grid with that total (only totals the grids reach are asked for). */
function withTotal(v: number): PsState {
  const g = PARTIALS.find((p) => psTotals(p).total >= v) ?? GRID;
  return { ...pokerSquaresGame.init(SEED), grid: g, acted: 1 };
}

export const entry: StdEntry = {
  type: "pokersquares",
  field: "pokerSquaresRev",
  rev: 2,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [1, 2, 3, 77, 123456789].map((seed) => {
      const { raw } = pokerSquaresFlawless(seed, 20, 2);
      const r = replayPokerSquaresRun(seed, raw, 2);
      return { label: `seed ${seed}'s target grid through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap that placed nothing", score: pokerSquaresGame.score({ ...pokerSquaresGame.init(4), acted: 1 }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: pokerSquaresGame.score(pokerSquaresGame.init(12)) }],
  help: { terms: ["hand points", "pair"] },
  extra(ok) {
    // The core is a straight line on hand points, full at PS_CORE_FULL, on every partial grid of a target grid.
    let straight = true;
    for (const g of PARTIALS) {
      const { total } = psTotals(g);
      const core = pokerSquaresStdParts({ ...pokerSquaresGame.init(SEED), grid: g, acted: 1 })![0]!.points;
      if (core !== Math.floor((PS_CORE_MAX * Math.min(total, PS_CORE_FULL)) / PS_CORE_FULL)) straight = false;
    }
    ok(straight, `pokersquares: the core is floor(160 × min(total, ${PS_CORE_FULL}) ÷ ${PS_CORE_FULL}) on every partial grid`);
    ok(psTotals(GRID).made === 10 && psTotals(GRID).total >= PS_CORE_FULL, "pokersquares: the target grid makes all ten hands and fills the core");
    ok(pokerSquaresStdParts(withTotal(PS_CORE_FULL + 30))![0]!.points === PS_CORE_MAX, "pokersquares: a total past the full figure holds the core at 160");
  },
};
