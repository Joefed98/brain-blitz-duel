/**
 * arcade-standard-check's entry for `blockfall` (Blockfall blockfallRev 1, Retro; docs/arcade-standard/blockfall.md):
 * born on the standard. Perfect runs are the oracle's logs on deal seeds through the server's replay; the core is
 * lines on a straight line, full at BF_CORE_FULL (the elite median); multi-line clears 4 / 8 / 12 up to 40; a
 * low stack 20 at 4 rows or lower, 0 from 10 up.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  BF_CORE_FULL, BF_LOW_MAX, BF_MULTI_MAX, BF_ROWS, BF_W, bfInit, bfLowPoints, blockfallGame, blockfallStdParts, type BfState,
} from "../../src/lib/arcade/blockfall";
import { BLOCKFALL_DEAL } from "../../src/lib/duel/blockfallDeal.server";
import { blockfallOracleRun } from "../blockfall-oracle";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.blockfall!.spec!;
const rec = (s: BfState) => Object.fromEntries((blockfallStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: BfState) => Object.fromEntries((blockfallStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** A state with `lines` cleared, no multi-line clear and a stack too high for the low part (rows 10 and up filled). */
function coreOnly(lines: number): BfState {
  const s = bfInit(3);
  const board = s.board.slice();
  for (let y = BF_ROWS - 10; y < BF_ROWS; y++) board[y * BF_W] = 1;
  return { ...s, board, lines, acted: 1, ended: 1 };
}

export const entry: StdEntry = {
  type: "blockfall",
  field: "blockfallRev",
  rev: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [BLOCKFALL_DEAL[0]!, BLOCKFALL_DEAL[1]!, BLOCKFALL_DEAL[77]!, BLOCKFALL_DEAL[299]!].map((seed) => {
      const r = blockfallOracleRun(seed).result;
      return { label: `deal seed ${seed}'s oracle run through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a turn and nothing cleared, topped out", score: blockfallGame.score({ ...bfInit(4), acted: 1, ended: 2 }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: blockfallGame.score(bfInit(12)) }],
  help: { terms: ["lines", "four"] },
  core: { fullAt: BF_CORE_FULL, at: coreOnly, parts: blockfallStdParts },
  extra(ok) {
    const s = { ...bfInit(5), acted: 1, ended: 1 };
    const multi = (d: number, t: number, q: number) => blockfallStdParts({ ...s, doubles: d, triples: t, quads: q })![1]!.points;
    ok(multi(1, 0, 0) === 4 && multi(0, 1, 0) === 8 && multi(0, 0, 1) === 12 && multi(2, 1, 1) === 28 && multi(0, 0, 4) === BF_MULTI_MAX, "blockfall: multi-line clears 4 / 8 / 12, held to 40");
    ok([0, 1, 4].every((h) => bfLowPoints(h) === BF_LOW_MAX) && bfLowPoints(10) === 0 && bfLowPoints(14) === 0 && bfLowPoints(7) === 10, "blockfall: a low stack 20 at 4 rows or lower, 0 from 10, a straight line between");
    ok(blockfallStdParts({ ...s, ended: 2 })![2]!.points === 0, "blockfall: a topped-out run earns no low-stack points");
  },
};
