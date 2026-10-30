/**
 * arcade-standard-check's entry for `pokersquares` (Poker Squares pokerSquaresRev 1, Cards & Board;
 * docs/arcade-standard/pokersquares.md): born on the standard. Perfect runs place every card on its target-grid
 * square through the server's replay; the core is total ÷ target × 160, so it is checked in `extra` on real grids.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { stdLine } from "../../src/lib/arcade/arcadeStandard";
import { NO_CARD } from "../../src/lib/arcade/cards/cards";
import { PS_CORE_MAX, pokerSquaresGame, pokerSquaresStdParts, psTargetGrid, psTotals, type PsState } from "../../src/lib/arcade/cards/pokerSquares";
import { replayPokerSquaresRun } from "../../src/lib/duel/cards";
import { pokerSquaresFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.pokersquares!.spec!;
const rec = (s: PsState) => Object.fromEntries((pokerSquaresStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: PsState) => Object.fromEntries((pokerSquaresStdParts(s) ?? []).map((p) => [p.key, p.max]));

export const entry: StdEntry = {
  type: "pokersquares",
  field: "pokerSquaresRev",
  rev: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [1, 2, 3, 77, 123456789].map((seed) => {
      const { raw } = pokerSquaresFlawless(seed);
      const r = replayPokerSquaresRun(seed, raw);
      return { label: `seed ${seed}'s target grid through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap that placed nothing", score: pokerSquaresGame.score({ ...pokerSquaresGame.init(4), acted: 1 }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: pokerSquaresGame.score(pokerSquaresGame.init(12)) }],
  help: { terms: ["target", "pair"] },
  extra(ok) {
    // The core is the straight line total ÷ target × 160 on every partial grid of a target (filled square by square).
    const seed = 9;
    const { grid, target } = psTargetGrid(seed);
    const base = pokerSquaresGame.init(seed);
    let straight = true;
    for (let n = 0; n <= 25; n++) {
      const g = grid.map((c, i) => (i < n ? c : NO_CARD));
      const s = { ...base, grid: g, acted: 1 };
      const { total } = psTotals(g);
      const core = pokerSquaresStdParts(s)![0]!.points;
      if (core !== stdLine(PS_CORE_MAX, total, target)) straight = false;
    }
    ok(straight, "pokersquares: the core is total ÷ target × 160 on every partial grid");
    ok(target > 0 && psTotals(grid).made === 10, "pokersquares: the target grid makes all ten hands");
    // Beating the target keeps the core at 160.
    const over = { ...base, grid, target: Math.max(1, target - 20), acted: 1 };
    ok(pokerSquaresStdParts(over)![0]!.points === PS_CORE_MAX, "pokersquares: a total past the target holds the core at 160");
  },
};
