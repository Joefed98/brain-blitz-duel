/**
 * Blockfall / Blockzone round plumbing (blockfallRev 1, and 2 since 3 Nov 2026): the phone sends its move log; the server replays it on the STORED seed
 * (a seed from the proved deal, blockfallDeal.server.ts) and keeps its own score (makeArcadeRun).
 */
import type { Level } from "@/lib/levels/levels";
import {
  bfCheckpoint, bfStackHeight, blockfallGameFor, blockfallStdParts, BF_CHECKPOINT_INTERVAL, BF_CHECKPOINT_KEYS, BF_ROWS, type BfCheckpoint, type BfState,
} from "@/lib/arcade/blockfall";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<BfState, BfCheckpoint>({ tag: "blockfall", game: blockfallGameFor(1), checkpoint: bfCheckpoint, keys: BF_CHECKPOINT_KEYS, interval: BF_CHECKPOINT_INTERVAL });
/** blockfallRev 2 (Blockzone, 3 Nov 2026): its own game (90 s, the soft drop, no hold); the same wire format. */
const runZone = makeArcadeRun<BfState, BfCheckpoint>({ tag: "blockfall", game: blockfallGameFor(2), checkpoint: bfCheckpoint, keys: BF_CHECKPOINT_KEYS, interval: BF_CHECKPOINT_INTERVAL });

/** Blockzone's runner at a level (stage 3 of the Retro overhaul): Normal's own, else one built on the level's game. */
const runZoneByLevel = new Map<string, typeof runZone>();
function runZoneFor(level?: Level | null): typeof runZone {
  if (!level || level === "normal") return runZone;
  let r = runZoneByLevel.get(level);
  if (!r) {
    r = makeArcadeRun<BfState, BfCheckpoint>({ tag: "blockfall", game: blockfallGameFor(2, level), checkpoint: bfCheckpoint, keys: BF_CHECKPOINT_KEYS, interval: BF_CHECKPOINT_INTERVAL });
    runZoneByLevel.set(level, r);
  }
  return r;
}

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

/** The single place a Blockfall / Blockzone score is worked out (no stamp: blockfallRev 1). */
export function replayBlockfallRun(seed: number, raw: string, rev?: number | null, level?: Level | null): BlockfallResult {
  const r = ((rev ?? 1) >= 2 ? runZoneFor(level) : run).replay(seed, raw);
  const s = r.state;
  const toppedOut = s.ended === 2;
  return {
    ...r, lines: s.lines, doubles: s.doubles, triples: s.triples, quads: s.quads, height: toppedOut ? BF_ROWS : bfStackHeight(s.board), toppedOut,
    pieces: s.pieces, parts: blockfallStdParts(s) ?? [],
  };
}
