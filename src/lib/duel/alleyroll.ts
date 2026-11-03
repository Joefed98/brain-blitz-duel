/**
 * Alley Roll round plumbing (alleyRollRev 1): the phone sends its rolls; the server replays them and keeps its own
 * score (makeArcadeRun). The lane is the same for every seed.
 */
import {
  ALLEYROLL_REV_RINGER, alleyRollGameFor, alleyRollStdParts, arCheckpoint, arTotals, ringerTotals, AR_CHECKPOINT_INTERVAL, AR_CHECKPOINT_KEYS,
  type ArCheckpoint, type ArState,
} from "@/lib/arcade/alleyroll";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<ArState, ArCheckpoint>({ tag: "alleyroll", game: alleyRollGameFor(1), checkpoint: arCheckpoint, keys: AR_CHECKPOINT_KEYS, interval: AR_CHECKPOINT_INTERVAL });
/** Ringer (alleyRollRev 2): the same wire format, its own game (the gold cup's seeded path, the raised cups). */
const ringerRun = makeArcadeRun<ArState, ArCheckpoint>({ tag: "alleyroll", game: alleyRollGameFor(ALLEYROLL_REV_RINGER), checkpoint: arCheckpoint, keys: AR_CHECKPOINT_KEYS, interval: AR_CHECKPOINT_INTERVAL });

/** Encodes a run (the format is the same on every revision; `_rev` is accepted for symmetry with replay). */
export function encodeAlleyRollRun(r: Parameters<typeof run.encode>[0], _rev?: number | null): string {
  return run.encode(r);
}
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
  /** Ringer (alleyRollRev 2): gold cups hit (0 on rev 1). */
  gold: number;
}

/** The single place an Alley Roll / Ringer score is worked out (no stamp: alleyRollRev 1; 2: Ringer). */
export function replayAlleyRollRun(seed: number, raw: string, rev?: number | null): AlleyRollResult {
  const ringer = (rev ?? 1) >= ALLEYROLL_REV_RINGER;
  const r = (ringer ? ringerRun : run).replay(seed, raw);
  const s = r.state;
  const t = ringer ? ringerTotals(s) : { ...arTotals(s), gold: 0 };
  return {
    ...r, rings: t.rings, pockets: t.pockets, streak: t.streak, balls: t.balls, points: s.balls.slice(0, t.balls).map((b) => b.points),
    finished: s.ended === 1, parts: alleyRollStdParts(s) ?? [], gold: t.gold,
  };
}
