# Depth to 200, D3: Speed and Attention (25 Oct 2026)

Twelve games raised from 150 to 200 (`ROUND_MAX`, docs/scoring-200.md), each under its own new version stamp.
Older stamps replay and score exactly as before. Shared pieces: `src/lib/duel/depth200.ts` (the stretch curve),
`src/lib/duel/depth200.server.ts` (one dispatcher, called by `gradeAnswer` before puzzleScoreRev 2 / 3's mapping,
which caps at 150) and one `src/lib/duel/depth/<game>.server.ts` grader per puzzle game. Engine games (Bonk, Pull!,
Mixed Signals) score in their sims.

Routes: STRETCH = the game is unchanged and the curve reaches further; FEATURES = the extra 50 comes only through
the new features.

<!-- Each game's section: stamp, route, features, scoring formula, old vs new distribution table (median, top 10 %,
best per bot skill level), checks, assumptions, demo status. -->

## Flash (`reaction`)

## Ascend (`numhunt`)

## Bang On (`stopwatch`)

## Don't Break the Chain (`chain`)

## Bonk (`whack`)

## Pull! (`clayshoot`)

## Mixed Signals (`stroop`)

## Eagle Eye (`symscan`)

## Double Take (`spotdiff`)

## Tally (`countup`)

## Labyrinth (`maze`)

## Matchmaker (`pairmatch`)

## Shared requests

## Checks run
