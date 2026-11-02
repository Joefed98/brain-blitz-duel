/**
 * Alley Roll round plumbing (alleyRollRev 1): the phone sends its rolls; the server replays them and keeps its own
 * score (makeArcadeRun). The lane is the same for every seed.
 */
import {
  alleyRollGameFor, alleyRollStdParts, arCheckpoint, arTotals, AR_CHECKPOINT_INTERVAL, AR_CHECKPOINT_KEYS, type ArCheckpoint, type ArState,
} from "@/lib/arcade/alleyroll";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<ArState, ArCheckpoint>({ tag: "alleyroll", game: alleyRollGameFor(1), checkpoint: arCheckpoint, keys: AR_CHECKPOINT_KEYS, interval: AR_CHECKPOINT_INTERVAL });

export const encodeAlleyRollRun = run.encode;
export const decodeAlleyRollRun = run.decode;

export interface AlleyRollResult extends FlatReplay<ArState, ArCheckpoint> {
  rings: number;
  pockets: number;
  streak: number;
  /** Balls that came down, and each one's points. */
  balls: number;
  points: number[];
  finished: boolean;
  parts: StdPart[];
}

/** The single place an Alley Roll score is worked out (no stamp: alleyRollRev 1). */
export function replayAlleyRollRun(seed: number, raw: string, _rev?: number | null): AlleyRollResult {
  const r = run.replay(seed, raw);
  const s = r.state;
  const t = arTotals(s);
  return {
    ...r, rings: t.rings, pockets: t.pockets, streak: t.streak, balls: t.balls, points: s.balls.slice(0, t.balls).map((b) => b.points),
    finished: s.ended === 1, parts: alleyRollStdParts(s) ?? [],
  };
}
