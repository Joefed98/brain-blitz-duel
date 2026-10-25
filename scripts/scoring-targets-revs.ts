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
 * Expansions (docs/scoring-200.md): games whose rooms now deal a revision past their score-bands revision,
 * with new play scored to 200. Each maps to its score-bands revision (one entry per game); the expansion's
 * own check proves the new revision (Jaywalk: cross-expand-check).
 */
export const EXPANDED: Partial<Record<LiveBandGame, { rev: number; bands: number }>> = {
  cross: { rev: 8, bands: 7 }, // Expansion E1: Jaywalk crossRev 8
  inkbridge: { rev: 9, bands: 8 }, // Expansion E1: Rainbow Bridge inkRev 9
  hover: { rev: 8, bands: 7 }, // Expansion E1: Hover hoverRev 8
};
/** The score-bands revision (19 Oct 2026) of a game: LIVE_BANDS' rev, or the one an expansion builds on. */
const bandsRevOf = (type: LiveBandGame): number => EXPANDED[type]?.bands ?? LIVE_BANDS[type].rev;
/** The same table as [dealt, score-bands revision] pairs. */
export const EXPANSION_REVS: Partial<Record<LiveBandGame, readonly [dealt: number, strictBefore: number]>> = Object.fromEntries(
  Object.entries(EXPANDED).map(([type, e]) => [type, [e!.rev, e!.bands] as const]),
);

/**
 * type → [the target revision (18 Oct 2026), the revision whose play it keeps]. Rooms now deal the score-bands
 * revision after it (19 Oct 2026, LIVE_BANDS: the same play again, band 3), so the target is LIVE_BANDS' rev − 1.
/** The same table as type → score-bands revision. */
export const EXPANDED_FROM: Partial<Record<LiveBandGame, number>> = Object.fromEntries(
  Object.entries(EXPANDED).map(([type, e]) => [type, e!.bands]),
);
 */
export const TARGET_REVS: Partial<Record<LiveBandGame, readonly [target: number, play: number]>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[])
    .filter((type) => type !== "junction")
    .map((type) => [type, [bandsRevOf(type) - 1, bandsRevOf(type) - 2] as const]),
);

/** The score-bands revision rooms deal (19 Oct 2026), the same play as the target revision. */
export const STRICT_REVS: Partial<Record<LiveBandGame, number>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[]).filter((type) => type !== "junction").map((type) => [type, bandsRevOf(type)]),
);

/**
 * The revision whose play a dealt revision keeps: the target and score-bands revisions map to the target's
 * predecessor, any other is itself.
 */
export function playRevOf(type: string, rev: number | undefined | null): number | undefined | null {
  // An expansion's revision counts as the score-bands revision it builds on here, so older checks keep proving
  // the play they were written for; the expansion's own check proves its new play.
  const expanded = EXPANDED[type as LiveBandGame];
  if (expanded && rev === expanded.rev) rev = expanded.bands;
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && (rev === pair[0] || rev === STRICT_REVS[type as LiveBandGame]) ? pair[1] : rev;
}
