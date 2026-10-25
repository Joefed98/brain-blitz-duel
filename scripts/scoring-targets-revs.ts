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
 * Games an expansion (docs/scoring-200.md) has moved past their score-bands revision: type → that score-bands
 * revision (what rooms dealt before the expansion). One line per expansion.
 */
export const EXPANDED_FROM: Partial<Record<LiveBandGame, number>> = {
  hover: 7, // Expansion E1: hoverRev 8 follows the score-bands hoverRev 7
};

/** The score-bands revision (19 Oct 2026) of a band game: the one rooms deal, or the one before its expansion. */
const strictRevOf = (type: LiveBandGame) => EXPANDED_FROM[type] ?? LIVE_BANDS[type].rev;

/**
 * type → [the target revision (18 Oct 2026), the revision whose play it keeps]. Rooms then dealt the score-bands
 * revision after it (19 Oct 2026, LIVE_BANDS: the same play again, band 3), so the target is that revision − 1.
 */
export const TARGET_REVS: Partial<Record<LiveBandGame, readonly [target: number, play: number]>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[])
    .filter((type) => type !== "junction")
    .map((type) => [type, [strictRevOf(type) - 1, strictRevOf(type) - 2] as const]),
);

/** The score-bands revision rooms deal (19 Oct 2026), the same play as the target revision. */
export const STRICT_REVS: Partial<Record<LiveBandGame, number>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[]).filter((type) => type !== "junction").map((type) => [type, strictRevOf(type)]),
);

/**
 * The revision whose play a dealt revision keeps: the target and score-bands revisions map to the target's
 * predecessor, any other is itself.
 */
export function playRevOf(type: string, rev: number | undefined | null): number | undefined | null {
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && (rev === pair[0] || rev === STRICT_REVS[type as LiveBandGame]) ? pair[1] : rev;
}
