# Scoring to 200: how a game's expansion raises its maximum

25 Oct 2026. The foundation PR made every round's maximum a per-game value. **Every game is still
150 today**; this doc is for the expansion PRs that later raise one game to 200 by adding skill
features. The foundation changed no game's scoring, rules, timing, difficulty, seeds, hitboxes or
version stamps.

## The pieces

- **`src/lib/duel/roundMax.ts`** is the single source of truth.
  - `ROUND_MAX`: one line per game (every `PuzzleType`), 150 for all of them today.
  - `SCORE_CEILING` = 200: no game may go above it (`roundMaxFor` caps at it).
  - `roundMaxFor(type)`: a game's maximum (unknown or removed games: 150).
  - `isPerfectScore(type, score)`, `roundShare`, `scaledToMax(type, x)` (a threshold written on
    the 150 scale, scaled to the game: 120 → 160 at 200), `scoreBandOf` / `scoreBandFloor` (Joe's
    bands, perfect = the maximum only, the others scaled), `isValidRoundScore`.
  - `fillMax` / `{max}` for texts, `liveRecord` for text tables, `withRoundMax` for checks.
- **What follows a game's maximum automatically** (nothing to edit in these files):
  - the reveal's perfect moment, `shared.perfect` and `voice.perfect` (`usePerfectBurst`);
  - the signature beat's no-finish threshold (`signatureMinScore`: 120 of 150, 160 of 200);
  - the arcade reveal chart: its rows are thirds of the maximum and its top label is the
    maximum (`chartRows(max)`, `ArcadeScoreChart` reads `roundMaxFor(type)`);
  - the intro SCORE line (`introScore.ts`) and the "?" help (`instructions.ts`,
    `puzzleBandsText.ts`, `liveBandHelp`): every "up to 150", "150 is perfect", "150 only for …"
    is written `{max}` or reads `roundMaxFor`;
  - the podium's Perfectionist ("A perfect 200 in Tempo"), So Close and Fastest Finger's 110
    (scaled), the two-player round result's bars, the onboarding's top score ("Games score up to 200" once games differ).
- **What does not follow** (scoring, on purpose): every sim, grader and score formula keeps its
  own caps and curves, so a stored round always scores as it did. `MAX_ROUND_SCORE` in
  `scoring.ts` is the old formulas' clamp. The shared band clamps (`bandOpen`, `bandFinishFlat`,
  `bandFinishSpeed`, `bandTotal`, `bandMapTotal`) take an optional `max` that defaults to 150.
- **Kept 150s** that are not "the round's maximum": `HERO_RUN_SCORE` (celebrations' hero run, an
  absolute 150), every revision's own curve, knot table and cap (`BAND_TARGET_MAP`, the strict
  bands, rev-2 knots, rev-3's 120 + 30, `stagedRounds.ts`, `engine.ts`'s finish score), grading's
  `run.score >= 150` "correct" flags (Scrumper, Gemstone), reveal breakdown lines stating a
  revision's cap ("capped at 150"), and texts that are formula arithmetic for retired games
  ("2 per coin, so all 75 = 150", "150 − 5 per touch").

## Raising a game to 200 (the expansion PR)

1. **Set the maximum**: change the game's line in `ROUND_MAX` from 150 to 200. That alone moves
   its chart, intro and help figures, perfect moment, Perfectionist, signature threshold and bands.
2. **Add the skill features** that earn the extra 50 (the game's own design; arcade art stays
   within 2 px of the sim's bounds, the sim stays deterministic).
3. **Bump the game's version stamp** (e.g. `snakeRev 9`) and gate every new rule and the new
   scoring on it. New rounds deal the new stamp; older stamps score exactly as before.
4. **Score to 200 on the new stamp only**: pass `roundMaxFor(type)` (or 200) as `max` to the
   band clamps from the new revision's scoring, give it its own curve to 200, and keep the old
   revisions' curves and caps untouched. If grading has a `score >= 150` correct flag, gate the
   new threshold on the stamp too.
5. **Retune to the target bands on the 200 scale**: perfect 200 only, then the bands' edges
   scaled (`scoreBandFloor`: near perfect 173, great 147, good 120, decent 107, average 80).
   Re-measure with `scripts/arcade-skill-bands.ts` (arcade) or `puzzle-bands-fit.ts` (puzzles),
   fit the curve, keep scoring-bands-check and arcade-score-bands-check green.
6. **Texts**: write any new score sentence with `{max}` or `roundMaxFor(type)`, never a number.
   A curve-derived help line ("200 at 24,000") comes from the new curve by itself.
7. **Replay coverage**: record runs on the old stamp before the change and prove they replay and
   score exactly as before (the game's legacy/identity check, arcade-self-replay, replay-check),
   plus runs on the new stamp reaching 200. Never regrade stored rounds.
8. **Practice stamps**: run `bun scripts/practice-stamps.ts` (the new stamp starts a fresh
   practice best for that game, as every stamp change does).
9. **Checks**: round-max-check (update its "every game is 150" line for the raised game),
   intro-score-text-check, the game's own checks, reveal-score-check, arcade-chart-check.

## Practice bests reset (Joe's decision)

With this change practice bests start fresh once on every device: they are stored under
`duelz-practice-best:v3:` (`PRACTICE_BEST_PREFIX`, `practiceBest.ts`). The v2 values stay in
storage untouched and are simply never read, so no old best can show, even for a frame, and the
first new run is never a "New best!". The room arcade "new best" record (`arcadeBest.ts`, the
only "New best!" in rooms, daily and challenge reveals) resets the same way: `duelz-arcade-room-best:v2:`
(`ARCADE_ROOM_BEST_PREFIX`), the old records kept and never read. Daily history and boards (including
Profile's daily best totals, which show no "New best!"), recent rooms and challenge results keep
their own keys. Later expansions need no reset: their
stamp bump already starts a fresh best for that game.
