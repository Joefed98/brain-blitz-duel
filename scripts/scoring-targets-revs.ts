/**
 * The scoring-targets revisions (18 Oct 2026, docs/scoring-targets.md): the
 * revision rooms deal now for each arcade band game, and the revision whose play
 * it keeps (only the score curve moved; Swish's binRev 5 also shortens the
 * spinner). Older checks that pin "rooms deal revision N" compare playRevOf(dealt)
 * with N, so they keep proving the play they were written for;
 * scoring-targets-check proves the new revisions themselves.
 */
import { LIVE_BANDS, type LiveBandGame } from "../src/lib/arcade/liveBands";

/** type → [the target revision rooms deal, the revision whose play it keeps]. */
export const TARGET_REVS: Partial<Record<LiveBandGame, readonly [target: number, play: number]>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[])
    .filter((type) => type !== "junction")
    .map((type) => [type, [LIVE_BANDS[type].rev, LIVE_BANDS[type].rev - 1] as const]),
);

/** The revision whose play a dealt revision keeps: the target revision maps to its predecessor, any other is itself. */
export function playRevOf(type: string, rev: number | undefined | null): number | undefined | null {
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && rev === pair[0] ? pair[1] : rev;
}
