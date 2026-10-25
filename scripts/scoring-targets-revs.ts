/**
 * The scoring-targets revisions (18 Oct 2026, docs/scoring-targets.md): the
 * revision rooms deal now for each arcade band game, and the revision whose play
 * it keeps (only the score curve moved; Swish's binRev 5 also shortens the
 * spinner). Older checks that pin "rooms deal revision N" compare playRevOf(dealt)
 * with N, so they keep proving the play they were written for;
 * scoring-targets-check proves the new revisions themselves.
 */
import { LIVE_BANDS, type LiveBandGame } from "../src/lib/arcade/liveBands";

/**
 * Expansions (Oct 2026, docs/expansions/, the 200-point games): a game whose rooms now deal an expansion
 * revision (new play, its own check) → the score-bands revision rooms dealt before it. The pairs below
 * are worked out from that earlier revision, and playRevOf reads the expansion as the play rooms dealt
 * before it, so the checks written before the expansion keep pinning the play they were written for.
 */
export const EXPANDED_FROM: Partial<Record<LiveBandGame, number>> = {
  swing: 11,
};
/** The score-bands revision a game's checks were written for: LIVE_BANDS' revision, or the one rooms dealt before an expansion. */
export const bandRevOf = (type: LiveBandGame) => EXPANDED_FROM[type] ?? LIVE_BANDS[type].rev;

/**
 * type → [the target revision (18 Oct 2026), the revision whose play it keeps]. Rooms now deal the score-bands
 * revision after it (19 Oct 2026, LIVE_BANDS: the same play again, band 3), so the target is LIVE_BANDS' rev − 1.
 */
export const TARGET_REVS: Partial<Record<LiveBandGame, readonly [target: number, play: number]>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[])
    .filter((type) => type !== "junction")
    .map((type) => [type, [bandRevOf(type) - 1, bandRevOf(type) - 2] as const]),
);

/** The score-bands revision rooms deal (19 Oct 2026), the same play as the target revision. */
export const STRICT_REVS: Partial<Record<LiveBandGame, number>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[]).filter((type) => type !== "junction").map((type) => [type, bandRevOf(type)]),
);

/**
 * The revision whose play a dealt revision keeps: the target and score-bands revisions map to the target's
 * predecessor, any other is itself.
 */
export function playRevOf(type: string, rev: number | undefined | null): number | undefined | null {
  const from = EXPANDED_FROM[type as LiveBandGame];
  if (from !== undefined && rev === LIVE_BANDS[type as LiveBandGame].rev) rev = from;
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && (rev === pair[0] || rev === STRICT_REVS[type as LiveBandGame]) ? pair[1] : rev;
}
