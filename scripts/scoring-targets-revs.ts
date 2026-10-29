/**
 * The scoring-targets revisions (18 Oct 2026, docs/scoring-targets.md): the
 * revision rooms deal now for each arcade band game, and the revision whose play
 * it keeps (only the score curve moved; Swish's binRev 5 also shortens the
 * spinner). Older checks that pin "rooms deal revision N" compare playRevOf(dealt)
 * with N, so they keep proving the play they were written for;
 * scoring-targets-check proves the new revisions themselves.
 */
import { LIVE_BANDS, liveStrictRev, type LiveBandGame } from "../src/lib/arcade/liveBands";

/**
 * type → [the target revision (18 Oct 2026), the revision whose play it keeps]. Rooms now deal the score-bands
 * revision after it (19 Oct 2026, LIVE_BANDS: the same play again, band 3), so the target is LIVE_BANDS' rev − 1.
 */
export const TARGET_REVS: Partial<Record<LiveBandGame, readonly [target: number, play: number]>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[])
    .filter((type) => type !== "junction")
    .map((type) => [type, [liveStrictRev(type) - 1, liveStrictRev(type) - 2] as const]),
);

/** The score-bands revision rooms deal (19 Oct 2026), the same play as the target revision (an expanded game's `strictRev`, docs/scoring-200.md). */
export const STRICT_REVS: Partial<Record<LiveBandGame, number>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[]).filter((type) => type !== "junction").map((type) => [type, liveStrictRev(type)]),
);

/**
 * Later score-only revisions: type → [the revision, the revision whose play it keeps]. Joe's phone notes (27 Oct
 * 2026, docs/arcade-phone-notes-oct-2026.md): Roofbound flipRev 9 and Tilt tiltRev 9 keep flipRev 8's and tiltRev 8's play
 * on lifted curves (arcade-phone-notes-check proves it). The arcade scoring standard (29 Oct 2026): Breaker brkRev 11
 * keeps brkRev 10's play, scored in fixed parts (breaker-standard-check proves it).
 */
export const LIFT_REVS: Partial<Record<LiveBandGame, readonly [lift: number, play: number]>> = { flip: [9, 8], tilt: [9, 8], breaker: [11, 10] };

/**
 * The revision whose play a dealt revision keeps: the target and score-bands revisions map to the target's
 * predecessor, a later score-only revision (LIFT_REVS) to the revision it re-scores, any other is itself.
 */
export function playRevOf(type: string, rev: number | undefined | null): number | undefined | null {
  const lift = LIFT_REVS[type as LiveBandGame];
  if (lift && rev === lift[0]) return lift[1];
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && (rev === pair[0] || rev === STRICT_REVS[type as LiveBandGame]) ? pair[1] : rev;
}
