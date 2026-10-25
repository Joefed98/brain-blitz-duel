/**
 * The scoring-targets revisions (18 Oct 2026, docs/scoring-targets.md): the
 * revision rooms deal now for each arcade band game, and the revision whose play
 * it keeps (only the score curve moved; Swish's binRev 5 also shortens the
 * spinner). Older checks that pin "rooms deal revision N" compare playRevOf(dealt)
 * with N, so they keep proving the play they were written for;
 * scoring-targets-check proves the new revisions themselves.
 */
import { LIVE_BANDS, type LiveBandGame } from "../src/lib/arcade/liveBands";
import { SKYLINE_REV_EXPAND, SKYLINE_REV_STRICT } from "../src/lib/arcade/skyline";
import { PIN_REV_EXPAND, PIN_REV_STRICT } from "../src/lib/arcade/pinball";

/**
 * The 200-point expansions (docs/scoring-200.md): type → [the expansion revision rooms deal, the score-bands
 * revision it follows]. These checks keep proving the score-bands revision (stored rounds still play and score
 * on it); the expansion's own checks prove the new one (E4, 25 Oct 2026: scripts/e4-expansion-check.ts).
 */
export const EXPANSION_REVS: Partial<Record<LiveBandGame, readonly [expansion: number, strict: number]>> = {
  skyline: [SKYLINE_REV_EXPAND, SKYLINE_REV_STRICT],
  pinball: [PIN_REV_EXPAND, PIN_REV_STRICT],
};

/** The score-bands revision (19 Oct 2026) of a game: LIVE_BANDS' rev, or the one an expansion followed. */
const strictRev = (type: LiveBandGame): number => EXPANSION_REVS[type]?.[1] ?? LIVE_BANDS[type].rev;

/**
 * type → [the target revision (18 Oct 2026), the revision whose play it keeps]. Rooms now deal the score-bands
 * revision after it (19 Oct 2026, LIVE_BANDS: the same play again, band 3), so the target is LIVE_BANDS' rev − 1.
 */
export const TARGET_REVS: Partial<Record<LiveBandGame, readonly [target: number, play: number]>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[])
    .filter((type) => type !== "junction")
    .map((type) => [type, [strictRev(type) - 1, strictRev(type) - 2] as const]),
);

/** The score-bands revision rooms deal (19 Oct 2026), the same play as the target revision. */
export const STRICT_REVS: Partial<Record<LiveBandGame, number>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[]).filter((type) => type !== "junction").map((type) => [type, strictRev(type)]),
);

/**
 * The revision whose play a dealt revision keeps: the target and score-bands revisions map to the target's
 * predecessor, any other is itself.
 */
export function playRevOf(type: string, rev: number | undefined | null): number | undefined | null {
  // An expansion revision stands for the score-bands revision it follows (the older checks prove that one).
  const expansion = EXPANSION_REVS[type as LiveBandGame];
  if (expansion && rev === expansion[0]) rev = expansion[1];
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && (rev === pair[0] || rev === STRICT_REVS[type as LiveBandGame]) ? pair[1] : rev;
}
