/**
 * The scoring-targets revisions (18 Oct 2026, docs/scoring-targets.md): the
 * revision rooms deal now for each arcade band game, and the revision whose play
 * it keeps (only the score curve moved; Swish's binRev 5 also shortens the
 * spinner). Older checks that pin "rooms deal revision N" compare playRevOf(dealt)
 * with N, so they keep proving the play they were written for;
 * scoring-targets-check proves the new revisions themselves.
 */
import { LIVE_BANDS, liveBornOnStandard, liveStrictRev, type LiveBandGame } from "../src/lib/arcade/liveBands";

/**
 * type → [the target revision (18 Oct 2026), the revision whose play it keeps]. Rooms now deal the score-bands
 * revision after it (19 Oct 2026, LIVE_BANDS: the same play again, band 3), so the target is LIVE_BANDS' rev − 1.
 */
export const TARGET_REVS: Partial<Record<LiveBandGame, readonly [target: number, play: number]>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[])
    .filter((type) => type !== "junction" && !liveBornOnStandard(type))
    .map((type) => [type, [liveStrictRev(type) - 1, liveStrictRev(type) - 2] as const]),
);

/** The score-bands revision rooms deal (19 Oct 2026), the same play as the target revision (an expanded game's `strictRev`, docs/scoring-200.md). */
export const STRICT_REVS: Partial<Record<LiveBandGame, number>> = Object.fromEntries(
  (Object.keys(LIVE_BANDS) as LiveBandGame[]).filter((type) => type !== "junction" && !liveBornOnStandard(type)).map((type) => [type, liveStrictRev(type)]),
);

/**
 * Later score-only revisions: type → [the revision, the revision whose play it keeps]. Joe's phone notes (27 Oct
 * 2026, docs/arcade-phone-notes-oct-2026.md): Roofbound flipRev 9 and Tilt tiltRev 9 keep flipRev 8's and tiltRev 8's play
 * on lifted curves (arcade-phone-notes-check proves it). The arcade scoring standard (29 Oct 2026): Breaker brkRev 11
 * keeps brkRev 10's play, scored in fixed parts (breaker-standard-check proves it). Meteor snakeRev 11 keeps snakeRev 10's play
 * exactly on new scoring (snake-standard-check proves it). Slice sliceRev 11 keeps
 * sliceRev 10's play (slice-standard-check proves it). Flightpath bullRev 9
 * keeps bullRev 8's play on the standard's parts (bullseye-standard-check proves it). Ball Tracker btRev 8
 * keeps btRev 7's play (arcade-standard-check), Rainbow Bridge inkRev 12 inkRev 11's (ink-v11-check), Orbit orbitRev 13
 * orbitRev 12's (orbit-expand-check), Wavefront wavRev 12 wavRev 11's (wavefront-phone-check) (docs/arcade-standard/balltrack.md).
 */
export const LIFT_REVS: Partial<Record<LiveBandGame, readonly [lift: number, play: number]>> = {
  flip: [9, 8],
  tilt: [9, 8],
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/hover.md): Hover hoverRev 10 keeps hoverRev 9's
  // play in fixed parts to 200 (hover-standard-check proves it).
  hover: [10, 9],
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/breaker.md): Breaker brkRev 11 keeps brkRev 10's play.
  breaker: [11, 10],
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/snake.md): Meteor snakeRev 11 keeps snakeRev 10's play.
  snake: [11, 10],
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/slice.md): Slice sliceRev 11 keeps sliceRev 10's play.
  slice: [11, 10],
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/beat.md): Tempo beatRev 11 keeps beatRev 10's play.
  beat: [11, 10],
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/bullseye.md): Flightpath bullRev 9 keeps bullRev 8's play.
  bullseye: [9, 8],
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/README.md, batch C): each keeps its predecessor's play.
  balltrack: [8, 7],
  inkbridge: [12, 11],
  orbit: [13, 12],
  wavefront: [12, 11],
};

/**
 * The arcade scoring standard's score-only revisions (29 Oct 2026, src/lib/arcade/arcadeStandard.ts): type → [the
 * revision, the revision whose play it keeps]. Roofbound flipRev 10 keeps flipRev 9's play, which is flipRev 8's. Meteor
 * snakeRev 12 (1 Nov 2026, gold stars count 2 towards the core, full at 20) keeps snakeRev 11's play, which is snakeRev 10's
 * (snake-rev12-check proves it).
 */
// Tilt tiltRev 11 (3 Nov 2026) is not listed: it deals no gold stars, so its world is not tiltRev 10's (the marbles move
// the same for the same log, but there is nothing to collect); its own check is tilt-rev11-check.
// Jaywalk crossRev 11 (3 Nov 2026, docs/arcade-standard/cross.md "crossRev 11") keeps crossRev 10's courses and walker exactly
// (its coins taken out, which never moved the walker), scored on the no-stop streak (cross-rev11-check proves it).
export const STD_REVS: Partial<Record<LiveBandGame, readonly [std: number, play: number]>> = { flip: [10, 8], snake: [12, 10], cross: [11, 10] };

/**
 * The revision whose play a dealt revision keeps: the target and score-bands revisions map to the target's
 * predecessor, a later score-only revision (LIFT_REVS, STD_REVS) to the revision it re-scores, any other is itself.
 */
export function playRevOf(type: string, rev: number | undefined | null): number | undefined | null {
  const std = STD_REVS[type as LiveBandGame];
  if (std && rev === std[0]) return std[1];
  const lift = LIFT_REVS[type as LiveBandGame];
  if (lift && rev === lift[0]) return lift[1];
  const pair = TARGET_REVS[type as LiveBandGame];
  return pair && (rev === pair[0] || rev === STRICT_REVS[type as LiveBandGame]) ? pair[1] : rev;
}
