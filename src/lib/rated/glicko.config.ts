/**
 * Every rating constant in one place (wave 3, session W3a; decided 11 Nov 2026, starting values to tune with beta
 * data). Each constant sits beside the target it was tuned to; ratings-check proves every target on simulated players.
 * Change a value here, re-run `bun scripts/ratings-check.ts`, and update docs/rated/README.md's table.
 *
 * Units: rating points on the chess scale (400 apart: the stronger wins about 10 times in 11). Glicko-2 works on its
 * own scale internally (rating − 1,000) / 173.7178; glicko2.ts converts.
 *
 * "A match" in the targets is a 1v1 best of 3 in All puzzles or All arcade won or lost 2–0, against an opponent of
 * the same rating whose rating is settled (the launch format; a 2–1 moves about half as much, Mixed half again).
 */

/** Every rating starts here. Target: "every rating starts at 1,000". */
export const START_RATING = 1000;
/** No rating goes below this. Target: "floor 100". */
export const RATING_FLOOR = 100;
/** Glicko-2's scale factor, 400 / ln 10: the chess scale. Target: "400 apart, the stronger wins about 10 times in 11". */
export const GLICKO_SCALE = 400 / Math.LN10;

/** A new rating's deviation (RD, rating points): Glicko-2's standard. */
export const START_RD = 350;
/** The most RD can grow back to with time away. */
export const MAX_RD = 350;
/** A new rating's volatility (Glicko-2 σ). Sets a settled player's steady RD (about 60) and so their moves. */
export const START_VOLATILITY = 0.06;
/** Glicko-2's τ: how fast volatility changes. 0.5 is mid-range; upsets raise σ, steady results lower it. */
export const TAU = 0.5;
/** Volatility bounds (a safety rail on the iteration). */
export const MIN_VOLATILITY = 0.03;
export const MAX_VOLATILITY = 0.12;

/**
 * One game's weight in its pool, for All puzzles / All arcade: a best of 3 won 2–0 weighs one match. Its category
 * moves at the same weight. Target: the match-sized moves below.
 */
export const GAME_WEIGHT = 0.5;
/** Mixed: each game moves Puzzles or Arcade at half weight. Target: "each game in a Mixed match … at half weight". */
export const MIXED_POOL_FACTOR = 0.5;

/**
 * The RD floor by matches the rating has had (before this one), so new ratings move by schedule rather than by how
 * fast Glicko-2's RD would shrink on its own (which would leave placement's 4th and 5th matches at 60–70):
 *  - matches 1–5 (placement): RD at least PLACEMENT_RD. Target: "placement matches move about 100–200 points"
 *    (about 150 against a settled opponent, about 105 against another new player);
 *  - matches 6 to NEWISH_UNTIL: the floor falls evenly (on a log scale) from NEWISH_START_RD to NEWISH_END_RD.
 *    Target: "a newish player's moves shrink gradually from about 100 to about 25";
 *  - after that no floor beyond MIN_RD: Glicko-2's own RD settles near 60. Target: "a settled player moves about 8–15
 *    a match".
 */
export const PLACEMENT_MATCHES = 5;
export const PLACEMENT_RD = 300;
export const NEWISH_START_RD = 222;
export const NEWISH_END_RD = 98;
export const NEWISH_UNTIL = 30;
/** A safety floor for RD at any stage (Glicko-2 alone settles above it). */
export const MIN_RD = 45;

/**
 * Time away: RD grows by this many points² for each full day since the rating last moved (Glicko's c², added to φ²
 * before the match). Target: "after about 3 months away a match moves about 25" (a settled RD of about 60 grows to
 * about 98 over 90 days).
 */
export const IDLE_RD2_PER_DAY = 66;

/** A recorded run moves its owner at most this share of a live match. Target: "at most half as much". */
export const RECORDED_OWNER_FACTOR = 0.5;
/** Uses of one recorded run a UK day that may move its owner (W3b enforces it; recorded here). Target: "at most 5". */
export const RUN_USES_PER_DAY = 5;
/** From this rated match against the same live opponent in a UK day, ratings don't move. Target: "from the 4th". */
export const SAME_OPPONENT_FREEZE_FROM = 4;

/**
 * A pool or category shows a provisional mark until it has this many matches (placement's 5 and the next few).
 * Target: "Puzzles and Arcade show a small provisional mark for their first few matches".
 */
export const PROVISIONAL_MATCHES = 10;

/** The Joulz Rating weighs Puzzles and Arcade by the share of rated games in each over this many days. */
export const JOULZ_WINDOW_DAYS = 90;
