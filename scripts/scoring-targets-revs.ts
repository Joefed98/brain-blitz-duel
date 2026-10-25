/**
 * The scoring-targets revisions (18 Oct 2026, docs/scoring-targets.md): the
 * revision rooms deal now for each arcade band game, and the revision whose play
 * it keeps (only the score curve moved; Swish's binRev 5 also shortens the
 * spinner). Older checks that pin "rooms deal revision N" compare playRevOf(dealt)
 * with N, so they keep proving the play they were written for;
 * scoring-targets-check proves the new revisions themselves.
 */
import { LIVE_BANDS, type LiveBandGame } from "../src/lib/arcade/liveBands";
import { SNAKE_REV_STRICT } from "../src/lib/arcade/snake";
import { BURST_REV_STRICT } from "../src/lib/arcade/burst";
import { BEAT_REV_STRICT } from "../src/lib/arcade/beat";

/**
 * Expansions to 200 (docs/scoring-200.md): games whose rooms now deal an expansion revision (LIVE_BANDS) and
 * the score-bands revision rooms dealt before it, which these tables keep describing (expansion E2: Meteor,
 * Fission, Tempo). playRevOf leaves an expansion revision as itself: it is new play.
 */
export const EXPANSION_STRICT: Partial<Record<LiveBandGame, number>> = { snake: SNAKE_REV_STRICT, burst: BURST_REV_STRICT, beat: BEAT_REV_STRICT };
const strictRevOf = (type: LiveBandGame): number => EXPANSION_STRICT[type] ?? LIVE_BANDS[type].rev;

/**
 * type → [the target revision (18 Oct 2026), the revision whose play it keeps]. Rooms now deal the score-bands
 * revision after it (19 Oct 2026, LIVE_BANDS: the same play again, band 3), so the target is LIVE_BANDS' rev − 1.
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
