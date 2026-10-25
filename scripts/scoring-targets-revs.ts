/**
 * The scoring-targets revisions (18 Oct 2026, docs/scoring-targets.md): the
 * revision rooms deal now for each arcade band game, and the revision whose play
 * it keeps (only the score curve moved; Swish's binRev 5 also shortens the
 * spinner). Older checks that pin "rooms deal revision N" compare playRevOf(dealt)
 * with N, so they keep proving the play they were written for;
 * scoring-targets-check proves the new revisions themselves.
 */
import { LIVE_BANDS, type LiveBandGame } from "../src/lib/arcade/liveBands";
import { ORBIT_REV_STRICT, ORBIT_REV_XP } from "../src/lib/arcade/orbit";

/**
 * World expansions (25 Oct 2026, docs/scoring-200.md): a game whose rooms now deal an expansion revision
 * (new play, scored to 200) after its score-bands revision: type → [the expansion revision, the score-bands
 * revision before it]. The revisions below stay keyed on the score-bands revision, which older rounds keep.
 */
export const EXPANSION_REVS: Partial<Record<LiveBandGame, readonly [expansion: number, strict: number]>> = {
  orbit: [ORBIT_REV_XP, ORBIT_REV_STRICT],
};
const bandRevOf = (type: LiveBandGame) => EXPANSION_REVS[type]?.[1] ?? LIVE_BANDS[type].rev;
/**
 * The score-bands revision an expansion revision builds on (any other revision is itself). Checks written before
 * an expansion that pin "rooms deal revision N" compare playRevOf(expansionBaseOf(dealt)) with N; the expansion's
 * own check (e.g. orbit-rev11-check) proves what it changed.
 */
export function expansionBaseOf(type: string, rev: number | undefined | null): number | undefined | null {
  const pair = EXPANSION_REVS[type as LiveBandGame];
  return pair && rev === pair[0] ? pair[1] : rev;
}

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
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && (rev === pair[0] || rev === STRICT_REVS[type as LiveBandGame]) ? pair[1] : rev;
}
