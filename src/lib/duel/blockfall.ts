/**
 * Blockfall round plumbing (blockfallRev 1): the phone sends its move log; the server replays it on the STORED seed
 * (a seed from the proved deal, blockfallDeal.server.ts) and keeps its own score (makeArcadeRun).
 */
import {
  bfCheckpoint, bfStackHeight, blockfallGameFor, blockfallStdParts, BF_CHECKPOINT_INTERVAL, BF_CHECKPOINT_KEYS, BF_ROWS, type BfCheckpoint, type BfState,
} from "@/lib/arcade/blockfall";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<BfState, BfCheckpoint>({ tag: "blockfall", game: blockfallGameFor(1), checkpoint: bfCheckpoint, keys: BF_CHECKPOINT_KEYS, interval: BF_CHECKPOINT_INTERVAL });

export const encodeBlockfallRun = run.encode;
export const decodeBlockfallRun = run.decode;

export interface BlockfallResult extends FlatReplay<BfState, BfCheckpoint> {
  lines: number;
  doubles: number;
  triples: number;
  quads: number;
  /** The stack's height at the end (BF_ROWS when topped out). */
  height: number;
  toppedOut: boolean;
  pieces: number;
  parts: StdPart[];
}

/** The single place a Blockfall score is worked out (no stamp: blockfallRev 1). */
export function replayBlockfallRun(seed: number, raw: string, _rev?: number | null): BlockfallResult {
  const r = run.replay(seed, raw);
  const s = r.state;
  const toppedOut = s.ended === 2;
  return {
    ...r, lines: s.lines, doubles: s.doubles, triples: s.triples, quads: s.quads, height: toppedOut ? BF_ROWS : bfStackHeight(s.board), toppedOut,
    pieces: s.pieces, parts: blockfallStdParts(s) ?? [],
  };
}
