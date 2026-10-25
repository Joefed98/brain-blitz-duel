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
 * The revision whose play a dealt revision keeps: the target and score-bands revisions map to the target's
 * predecessor, any other is itself.
 */
export function playRevOf(type: string, rev: number | undefined | null): number | undefined | null {
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && (rev === pair[0] || rev === STRICT_REVS[type as LiveBandGame]) ? pair[1] : rev;
}

/**
 * The revision rooms dealt before a game's 200-point expansion, given the revision dealt now (LIVE_BANDS' `strictRev`,
 * read through liveStrictRev): older checks that pin "rooms deal revision N" wrap the dealt stamp in this, then in
 * playRevOf, so they keep proving the play they were written for; each expansion's own check proves its revision.
 */
export function beforeExpansion(type: string, rev: number | undefined | null): number | undefined | null {
  const live = (LIVE_BANDS as Record<string, { rev: number; strictRev?: number }>)[type];
  return live && live.strictRev !== undefined && rev === live.rev ? liveStrictRev(type as LiveBandGame) : rev;
}
