/**
 * arcade-standard-check's entry for `blockfall` (Blockzone, blockfallRev 2 since 3 Nov 2026, Retro;
 * docs/arcade-standard/blockfall.md): born on the standard at blockfallRev 1, re-fitted on blockfallRev 2 (90 s, no
 * hold). Perfect runs are the oracle's logs on the stamp's own deal seeds through the server's replay; the core is
 * lines on a straight line, full at BF_ZONE_CORE_FULL; 1 for every piece placed up to 65; multi-line clears 4 / 8 / 12
 * up to 24; a low stack 16 at 4 rows or lower, 0 from 10 up. blockfallRev 1's three parts still score its states.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  BF_ROWS, BF_W, BF_ZONE_CORE_FULL, BF_ZONE_LOW_MAX, BF_ZONE_MULTI_MAX, BF_ZONE_PIECES_MAX, bfInit, blockfallStdParts, blockzoneGame, bzInit, type BfState,
} from "../../src/lib/arcade/blockfall";
import { BLOCKFALL_DEAL_V2 } from "../../src/lib/duel/blockfallDealV2.server";
import { blockfallOracleRun } from "../blockfall-oracle";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.blockfall!.spec!;
const rec = (s: BfState) => Object.fromEntries((blockfallStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: BfState) => Object.fromEntries((blockfallStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** A state with `lines` cleared, no piece counted, no multi-line clear and a stack too high for the low part. */
function coreOnly(lines: number): BfState {
  const s = bzInit(3);
  const board = s.board.slice();
  for (let y = BF_ROWS - 10; y < BF_ROWS; y++) board[y * BF_W] = 1;
  return { ...s, board, lines, pieces: 0, acted: 1, ended: 1 };
}

export const entry: StdEntry = {
  type: "blockfall",
  field: "blockfallRev",
  rev: 2,
  before: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [BLOCKFALL_DEAL_V2[0]!, BLOCKFALL_DEAL_V2[1]!, BLOCKFALL_DEAL_V2[77]!, BLOCKFALL_DEAL_V2[299]!].map((seed) => {
      const r = blockfallOracleRun(seed, 2).result;
      return { label: `deal seed ${seed}'s oracle run through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a turn and nothing cleared, topped out", score: blockzoneGame.score({ ...bzInit(4), acted: 1, ended: 2 }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: blockzoneGame.score(bzInit(12)) }],
  help: { terms: ["lines", "four", "piece"] },
  core: { fullAt: BF_ZONE_CORE_FULL, at: coreOnly, parts: blockfallStdParts },
  older: () => (blockfallStdParts({ ...bfInit(5), acted: 1 }) ?? []).length === 3,
  extra(ok) {
    const s = { ...bzInit(5), acted: 1, ended: 1 };
    const part = (st: BfState, key: string) => blockfallStdParts(st)!.find((p) => p.key === key)!.points;
    const multi = (d: number, t: number, q: number) => part({ ...s, doubles: d, triples: t, quads: q }, "multi");
    ok(multi(1, 0, 0) === 4 && multi(0, 1, 0) === 8 && multi(0, 0, 1) === 12 && multi(2, 1, 0) === 16 && multi(0, 0, 4) === BF_ZONE_MULTI_MAX, "blockfall: multi-line clears 4 / 8 / 12, held to 24");
    ok(part({ ...s, pieces: 1 }, "pieces") === 1 && part({ ...s, pieces: 200 }, "pieces") === BF_ZONE_PIECES_MAX, "blockfall: 1 a piece placed, held to 65");
    const low = (h: number) => {
      const board = new Array<number>(BF_ROWS * BF_W).fill(0);
      if (h > 0) board[(BF_ROWS - h) * BF_W] = 1;
      return part({ ...s, board }, "low");
    };
    ok([0, 1, 4].every((h) => low(h) === BF_ZONE_LOW_MAX) && low(10) === 0 && low(14) === 0 && low(7) === 8, "blockfall: a low stack 16 at 4 rows or lower, 0 from 10, a straight line between");
    ok(part({ ...s, ended: 2 }, "low") === 0, "blockfall: a topped-out run earns no low-stack points");
  },
};
