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
 * Games a 200-point expansion has moved on (docs/scoring-200.md): LIVE_BANDS lists the expansion's revision, and the
 * score-bands revision is the one rooms dealt before it. Each expansion adds its games here.
 */
export const EXPANSION_REVS: Partial<Record<LiveBandGame, { expansion: number; strict: number }>> = {
  rally: { expansion: 9, strict: 8 }, // E3 (docs/expansions/e3.md)
  breaker: { expansion: 9, strict: 8 }, // E3
};
/** The score-bands revision (19 Oct 2026) of a game: LIVE_BANDS' rev, or the one before its expansion. */
const strictOf = (type: LiveBandGame): number => EXPANSION_REVS[type]?.strict ?? LIVE_BANDS[type].rev;

/**
 * type → [the target revision (18 Oct 2026), the revision whose play it keeps]. Rooms now deal the score-bands
 * revision after it (19 Oct 2026, LIVE_BANDS: the same play again, band 3), so the target is LIVE_BANDS' rev − 1.
 */
export const TARGET_REVS: Partial<Record<LiveBandGame, readonly [target: number, play: number]>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[])
    .filter((type) => type !== "junction")
    .map((type) => [type, [strictOf(type) - 1, strictOf(type) - 2] as const]),
);

/** The score-bands revision rooms deal (19 Oct 2026), the same play as the target revision. */
export const STRICT_REVS: Partial<Record<LiveBandGame, number>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[]).filter((type) => type !== "junction").map((type) => [type, strictOf(type)]),
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
 * The revision rooms dealt before a game's 200-point expansion, given the revision dealt now (EXPANSION_REVS):
 * older checks that pin "rooms deal revision N" wrap the dealt stamp in this, then in playRevOf, so they keep
 * proving the play they were written for; each expansion's own check proves its revision.
 */
export function beforeExpansion(type: string, rev: number | undefined | null): number | undefined | null {
  const e = EXPANSION_REVS[type as LiveBandGame];
  return e && rev === e.expansion ? e.strict : rev;
}
