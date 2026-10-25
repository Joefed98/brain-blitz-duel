# Depth d1: the word puzzles to 200 (25 Oct 2026)

Gameplay change, under new version stamps. Nine word games score up to 200 (`ROUND_MAX`), the other games keep 150.
Older stamps grade exactly as before: each game has a `scripts/depth-<game>-check.ts` that regrades a fixture of
old-stamp rounds recorded before any change (`scripts/fixtures/depth-<game>-legacy.json.gz`) and fails on any difference.

| Game | Route | New stamp | What earns the extra 50 |
| --- | --- | --- | --- |
| Nucleus | Stretch + pangram | `wordsmithRev 3` | a longer word-points curve (to 180) and +20 for the word using every tile |
| Interlock | Stretch | `tileGridRev 1` | a finish clearly faster than today's 150 pace, no mistakes |
| Slider | Feature: par moves | `wordSlideRev 1` | finishing within par (the stored scramble count), more the faster |
| Forage | Features: 6×6, long words, golden tile | `wordHuntRev 3` | 6+ letter words (×1.5, 7+ ×2) and words through the golden tile (×2), on their own 50-point curve |
| Lookout | Feature: hidden bonus word | `wordSearchRev 3` | finding the unlisted on-theme word (+20, up to +30 more for time) |
| Roundabout | Feature: bonus jar | `wheelRev 2` | real words not in the crossword fill a jar (50 × drops ÷ jar size) |
| Strikeout | Stretch + early solves | `strikeoutRev 5` | up to 25 for pace and up to 25 for solving words with letters still hidden |
| Cryptogrid | Stretch | `codewordRev 4` | a finish clearly faster than today's 150 pace, no mistakes |
| Swapword | Feature: par swaps | `swapwordRev 4` | finishing in the fewest swaps (stored `minSwaps`), more the faster |

## Shared plumbing (this session)

- `src/lib/duel/wordDepth.ts`: the nine games, `dealtDepthRev` / `pinPreDepth` (checks written for the 150 scale pin new
  deals to the pre-depth stamps), `stretchFinish` (rev 3's finish below today's fast share, then 50 × efficiency^k ×
  s^p up to an elite share of the clock left), `withBonus`.
- `src/lib/duel/wordDepth.server.ts` and `src/lib/duel/depth/<type>.server.ts`: `gradeAnswer` (generate.server.ts)
  grades every puzzle as today, then hands a puzzle carrying its game's depth stamp to its depth grader with both the
  game's own grade and today's final grade. Puzzles without the stamp never reach it.
- `scripts/depth-word-bands.ts`: the tuning report below (kit players on room seeds through the real grader, before =
  pinned pre-depth stamps, now = depth stamps; levels average / good / great / near-perfect from the fairness kits plus
  an elite player at twice a good player's pace with no mistakes).
- round-max-check: the nine games are listed as raised (from `WORD_DEPTH_GAMES`); the rest still prove 150.
- `practiceStamps.data.ts` regenerated (each game's new stamp starts a fresh practice best).

## Tuning (median / top 10 % / best, 40–60 room seeds)

**Nucleus**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 70 / 84 / 98 | 70 / 81 / 127 | 0 (0 %) |
| Good | 104 / 131 / 134 | 101 / 127 / 160 | -3 (-3 %) |
| Great | 132 / 139 / 147 | 133 / 160 / 166 | +1 (+1 %) |
| Near-perfect | 140 / 148 / 150 | 160 / 171 / 183 | +20 (+14 %) |
| Elite | 140 / 150 / 150 | 172 / 187 / 199 | +32 (+23 %) |
| All levels | 133 / 150 / 150 | 136 / 174 / 199 | +3 |

**Interlock**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 86 / 121 / 124 | 86 / 121 / 124 | 0 (0 %) |
| Good | 132 / 137 / 140 | 132 / 137 / 140 | 0 (0 %) |
| Great | 142 / 145 / 147 | 142 / 145 / 147 | 0 (0 %) |
| Near-perfect | 149 / 150 / 150 | 149 / 152 / 166 | 0 (0 %) |
| Elite | 150 / 150 / 150 | 171 / 182 / 200 | +21 (+14 %) |
| All levels | 142 / 150 / 150 | 142 / 171 / 200 | 0 |

**Slider**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 136 / 149 / 150 | 136 / 155 / 157 | 0 (0 %) |
| Good | 150 / 150 / 150 | 156 / 156 / 162 | +6 (+4 %) |
| Great | 150 / 150 / 150 | 156 / 165 / 173 | +6 (+4 %) |
| Near-perfect | 150 / 150 / 150 | 162 / 176 / 200 | +12 (+8 %) |
| Elite | 150 / 150 / 150 | 181 / 200 / 200 | +31 (+21 %) |
| All levels | 150 / 150 / 150 | 156 / 184 / 200 | +6 |

**Forage**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 63 / 81 / 85 | 64 / 72 / 76 | +1 (+2 %) |
| Good | 100 / 109 / 111 | 100 / 114 / 119 | 0 (0 %) |
| Great | 119 / 124 / 130 | 124 / 136 / 144 | +5 (+4 %) |
| Near-perfect | 137 / 141 / 147 | 155 / 174 / 181 | +18 (+13 %) |
| Elite | 150 / 150 / 150 | 186 / 195 / 200 | +36 (+24 %) |
| All levels | 119 / 150 / 150 | 124 / 186 / 200 | +5 |

**Lookout**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 121 / 127 / 129 | 120 / 129 / 134 | -1 (-1 %) |
| Good | 140 / 143 / 146 | 139 / 145 / 164 | -1 (-1 %) |
| Great | 146 / 148 / 150 | 147 / 174 / 180 | +1 (+1 %) |
| Near-perfect | 150 / 150 / 150 | 150 / 190 / 194 | 0 (0 %) |
| Elite | 150 / 150 / 150 | 194 / 196 / 198 | +44 (+29 %) |
| All levels | 146 / 150 / 150 | 147 / 194 / 198 | +1 |

**Roundabout**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 74 / 79 / 90 | 81 / 90 / 99 | +7 (+9 %) |
| Good | 105 / 122 / 131 | 110 / 126 / 130 | +5 (+5 %) |
| Great | 132 / 139 / 147 | 136 / 144 / 156 | +4 (+3 %) |
| Near-perfect | 148 / 150 / 150 | 163 / 168 / 174 | +15 (+10 %) |
| Elite | 150 / 150 / 150 | 197 / 199 / 200 | +47 (+31 %) |
| All levels | 132 / 150 / 150 | 136 / 197 / 200 | +4 |

**Strikeout**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 84 / 121 / 130 | 79 / 92 / 106 | -5 (-6 %) |
| Good | 128 / 138 / 148 | 127 / 140 / 149 | -1 (-1 %) |
| Great | 140 / 144 / 149 | 142 / 152 / 166 | +2 (+1 %) |
| Near-perfect | 145 / 149 / 150 | 156 / 171 / 176 | +11 (+8 %) |
| Elite | 149 / 150 / 150 | 169 / 189 / 200 | +20 (+13 %) |
| All levels | 138 / 150 / 150 | 143 / 171 / 200 | +5 |

**Cryptogrid**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 98 / 125 / 129 | 98 / 125 / 129 | 0 (0 %) |
| Good | 138 / 143 / 145 | 138 / 143 / 145 | 0 (0 %) |
| Great | 144 / 148 / 149 | 144 / 148 / 149 | 0 (0 %) |
| Near-perfect | 150 / 150 / 150 | 150 / 165 / 173 | 0 (0 %) |
| Elite | 150 / 150 / 150 | 177 / 194 / 200 | +27 (+18 %) |
| All levels | 144 / 150 / 150 | 144 / 177 / 200 | 0 |

**Swapword**

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 121 / 129 / 131 | 121 / 132 / 137 | 0 (0 %) |
| Good | 138 / 144 / 144 | 139 / 150 / 150 | +1 (+1 %) |
| Great | 147 / 150 / 150 | 153 / 156 / 156 | +6 (+4 %) |
| Near-perfect | 150 / 150 / 150 | 158 / 169 / 178 | +8 (+5 %) |
| Elite | 150 / 150 / 150 | 178 / 190 / 200 | +28 (+19 %) |
| All levels | 147 / 150 / 150 | 153 / 178 / 200 | +6 |

Reading: "Good" is today's solid player (median within ±10 % everywhere; Roundabout's average +9 %, Strikeout's
average −6 % comes from the kit's rev-5 early-solve play, not the scoring: unfinished rounds score as before);
today's 150 play (near-perfect) lands about 150–165 at the median (Nucleus 160, Roundabout 163, Slider 162); only elite
play reaches 190–200.

## Demos

Re-recording needed: **Forage** (6×6 board) and **Roundabout** (jar slot) — their old demos are rejected through their
`wordInput.ts` presentation revisions, so the intros show their stills. **Lookout**'s demo revision was bumped too (the
bonus chip slot). The other six boards and touch targets did not move; their demos still land (a re-record would only
show the new feature).

## Screenshots

`screenshots/depth-d1-oct-2026/<game>-414x896.png` (practice, mid-play, `bun scripts/shots/capture.ts … --phases=play`).

## Assumptions

- Nucleus: the brief's "all seven letters" is read as "every tile" (boards have 8–11 tiles).
- Slider: par is the stored scramble count (5–8); a reverse of the scramble always meets it.
- Lookout: the bonus counts only if found before the sixth listed word (the sixth still ends the round); found without
  finishing it is worth +9, so an unfinished round stays below every finish.
- Roundabout: each miss after the free five spills a drop from the jar (so random tracing cannot fill it).
- Forage: one board per round and the 100 s clock unchanged; 6×6 boards need at least 120 words.

## Shared requests

- `src/lib/duel/generate.server.ts`: the depth hook in `gradeAnswer` (`gradeToday` + `wordDepthGrader`) and the dealt
  stamps on Nucleus's and Forage's lines. Other depth sessions will need the same hook; whoever merges second should
  reuse `gradeToday` rather than add a second branch.
- `scripts/round-max-check.ts`: raised games read from `WORD_DEPTH_GAMES`; later depth PRs add their own list.
- Checks written for the 150 scale pin new deals to the pre-depth stamps with `pinPreDepth(true)` (one line each):
  scoring-rev3, scoring-bands, scoring-batch2, scoring-targets, puzzle-score-rev, strikeout, codeword, swapword,
  letterwheel, wordsearch. scoring-rev3-check and scoring-bands-check skip their "help is the shared helper text"
  assertion for the nine games (their texts now come from each game's depth text).
- `src/components/puzzles/usePuzzleSurfaces.ts`: Forage's trace-line cell count follows the board (6 on 36 tiles).
- `scripts/word-polish-check.ts`: a depth presentation-revision map for Roundabout's and Lookout's demos.

## Checks (the combined tree, run by the lead after every game landed)

All PASS: depth-wordsmith, depth-tilegrid, depth-wordslide, depth-wordhunt, depth-wordsearch, depth-letterwheel,
depth-strikeout, depth-codeword, depth-swapword, round-max, reveal-score, replay, intro-score-text, intro-demo,
scoring-rev3, scoring-bands, scoring-batch2, scoring-targets, puzzle-score-rev, standard-scoring, room-practice-grade,
room-figures, round-time, practice-bests, word-polish, word-game-tuning, strikeout, codeword, swapword, letterwheel,
wordsearch, wordsmith-variable, tile-grid-word-count, puzzle-surface, puzzle-input-tuning, presentation-geometry,
beta-recording, sound-manifest, removed-games, category-pool, daily, challenge, orbit-legacy-replay, orbit-rev3-replay;
first-paint-check (the nine games: practice, room and standalone-late passes); frame-probe board-size check
(`--compare=scripts/fixtures/board-sizes-main.json`, the nine games at 414×896 and 375×667); no-wrap-check (answer
reveal, round leaderboard, standings, practice list); tsc. The per-game notes below were written while the other
games were still being edited, so a failure they mention on another game's code was fixed before this run.

## Per-game notes

## Nucleus (wordsmith): STRETCH + pangram bonus, `wordsmithRev 3`

**Stamp.** New rounds deal `wordsmithRev 3` (`WORDSMITH_REV_DEPTH`, through `dealtDepthRev(3, WORDSMITH_REV_TARGET)` in
`generateUnstamped`); `WORDSMITH_REV_TARGET` stays 2 (the pre-depth stamp, what pinned checks deal). Rev 0/1/2 rounds
grade exactly as before (depth-wordsmith-check's fixture). The fixed intro/practice example board
(`generateWordsmithExample`, letters unchanged) now carries `wordsmithRev 3` too (it was unstamped and scored 2.5 ×
points uncapped; practice only, nothing stored is regraded).

**Score (rev 3, scoring.ts).** `score = min(180, WORDSMITH_V3_CURVE(word points)) + 20 if a word uses every tile`.
- `WORDSMITH_V3_CURVE` = rev 2's curve exactly up to 45 points (6 → 30, 11 → 70, 18 → 90, 32 → 130, 45 → 140), then
  60 → 143, 80 → 152, 110 → 166, 150 → 180 (`WORDSMITH_V3_CAP`). Rev 2's "140 at most without the every-tile word" cap
  is gone; the curve flattens instead.
- `WORDSMITH_V3_PANGRAM_BONUS` = 20, once (two every-tile anagrams don't stack).
- The split of the extra 50: up to +30 from the stretched word curve (150 → 180) and +20 from the pangram. 190+ needs the
  pangram and about 115+ word points; 200 the pangram with 150 points. Today's 150 (60 points + pangram) now 163.
- gradeWordsmith already scores rev 3 itself (scoreWordsmith's new branch); today's rev-2 pass clamps that at 150, so
  the depth grader (`depth/wordsmith.server.ts`) stores gradeWordsmith's own score with `extra.wordScore`,
  `extra.pangramBonus` and `parts: { kind: "partial", base: score }`. isCorrect (word points ≥ par) unchanged.

**UI.** A "PANGRAM +20" pill laid over the arena's top-left corner (outside the ring, absolutely positioned, so it never
moves anything): a quiet sunk pill from the first frame on rev-3 boards, the gold shine with a glow once the every-tile
word is accepted, one 520 ms pop (none under prefers-reduced-motion or reduced effects), and the existing
`shared.momentcard` cue (through `wordCue`, so muted/Effects slider/demo hush apply). The points counter is unchanged.
Reveal: "+20" after the 9-letter word when the stored `pangramBonus` is set; round summary "N word points + pangram 20 →
score". Intro example text and help updated.

**Texts.** Intro: "Longer words score more. The word using every tile adds a big bonus; {max} only with it." Help: the
curve's figures generated from `WORDSMITH_V3_CURVE` (11 points ≈ 70, 22 ≈ 101, 32 ≈ 130, 76 ≈ 150, 108 ≈ 165, up to 180
at 150 points) + "The word that uses every tile (the pangram) adds 20: {max} only with it."; the help-only how line
"Pangram bonus: the word using every tile adds 20. There's always one."

**Kit.** On rev 3 the kit player spots the every-tile word with chance 5 / 15 / 35 / 60 / 80 % (average → elite)
somewhere in the run's first half; otherwise as before (rev 2 boards unchanged).

**Bands** (`bun scripts/depth-word-bands.ts --game=wordsmith --seeds=40`, median / top 10 % / best; "before" is the kit
on rev-2 boards, which does not hunt the pangram):

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 70 / 84 / 98 | 70 / 81 / 127 | 0 (0 %) |
| Good | 104 / 131 / 134 | 101 / 127 / 160 | -3 (-3 %) |
| Great | 132 / 139 / 147 | 133 / 160 / 166 | +1 (+1 %) |
| Near-perfect | 140 / 148 / 150 | 160 / 171 / 183 | +20 (+14 %) |
| Elite | 140 / 150 / 150 | 172 / 187 / 199 | +32 (+23 %) |
| All levels | 133 / 150 / 150 | 136 / 174 / 199 | +3 |

Same plays graded both ways (the rev-3 kit's answers restamped rev 2 vs rev 3): Average 70/81/107 → 70/81/127,
Good 101/127/140 → 101/127/160, Great 133/141/150 → 133/160/166, Near 142/150/150 → 160/171/183, Elite 150/150/150 →
172/187/199.

**Assumptions.** "Seven letters" read as "every tile" (boards have 8–11 tiles; there is always such a word). The bonus is
once per round. The pangram's own word points (11 or 15) still count on the curve.

**Checks.**
- depth-wordsmith-check (new, ~3 s): PASS (840 legacy cases on 20 boards, rev 2 / 1 / unstamped, regrade exactly;
  rev-3 curve, cap, bonus, parts, elite 190–200, good ±10 %, texts).
- wordsmith-variable-check: PASS. round-max-check: PASS. round-time-check: PASS. intro-score-text-check: PASS.
  beta-recording-check: PASS.
- scoring-batch2-check: PASS, scoring-targets-check: PASS (both pinned with `pinPreDepth(true)`; they failed only on
  "rooms deal wordsmithRev 2 / wordHuntRev 2" and rev-2 figures on new deals).
- scoring-bands-check: pinned likewise; after the pin the only failures are the other forks' seven finish games ("the
  '?' help is not the puzzle's score text" for tilegrid, wordslide, wordsearch, letterwheel, strikeout, codeword,
  swapword), none for Nucleus.
- tsc: clean at the time of running.
- scoring-rev3-check: PASS (pinned by another fork; before the pin it failed "wordsmith: an open game left rev 2's curve
  under rev 3" on new deals).
- replay-check: PASS. intro-demo-check: PASS (26 demos). standard-scoring-check: "caps: pass". room-practice-grade-check:
  PASS. presentation-geometry-check: PASS. puzzle-input-tuning-check: PASS (audit file restored). puzzle-surface-check: PASS.
- reveal-score-check: FAIL, but only on Forage's reveal ("wordHunt.tsx: Reveal computes a score locally", another fork's
  file); Nucleus rows pass.
- puzzle-score-rev-check: FAIL only on wordsearch / letterwheel ("unfinished credit 119 > 110", other forks' games;
  probably needs pinPreDepth there).
- tsc: no errors in Nucleus files.

**Demo.** The ring and its tiles did not move (the badge is an overlay in an empty corner), so a recorded coordinate demo
still lands; it will not show the badge lighting unless it enters the every-tile word. No re-record needed for touch
targets; re-record if the demo should show the pangram.

**Shared files touched (own lines only).** scoring.ts (Nucleus constants and scoreWordsmith's rev-3 branch),
generate.server.ts (the wordsmith generateUnstamped line + `dealtDepthRev` import), instructions.ts (wordsmith entry and
a `wordsmithV3Line` helper; dropped the now-unused `scoreWordsmith` / `WORDSMITH_V2_CAP` / `WORDSMITH_REV_TARGET`
imports), introScore.ts (wordsmith line), roundSummaries.ts (wordsmith summary), kits-word.ts (nucleus kit + import),
scripts/shots/drivers/word.ts (wordsmith mid-play enters the pangram), scoring-batch2-check / scoring-targets-check /
scoring-bands-check (one `pinPreDepth(true)` each).

**Shared requests.** None beyond the pins above. Note for the lead: generate.server.ts gained
`import { dealtDepthRev } from "./wordDepth";` — another fork adding the same import would duplicate it.

## Interlock (tilegrid): STRETCH, `tileGridRev 1`

- Stamp: new field `tileGridRev: 1` (TileGridPuzzleData), dealt by `stampTileGridRev` (tileGrid.ts) through `dealtDepthRev(1, undefined)`; absent on older rounds and while a check pins the pre-depth stamps. Board, tray, rules, clock (100 s) and rev 3's grading are unchanged.
- Score (`src/lib/duel/depth/tilegrid.server.ts`, shape in `depth/stretchShapes.ts`): unfinished = today's rev-3 score exactly (≤ 110). A finish keeps rev 3's 120 + speed (150 at fastShare 0.72 of the clock left) and adds a **pace bonus** 50 × efficiency² × s^1.5, s = (left − 0.72) ÷ (0.84 − 0.72) clamped: 150 at today's pace (finish in about 28 s), 200 only finishing in about 16 s. Interlock measures no mistakes (efficiency 1). Breakdown "120 + N pace bonus + M speed" (`extra.paceBonus`).
- Texts: intro "Each tile in a word: up to 110. Finish: 120+, 150 in about 28 s, {max} in about 16 s."; help states the pace bonus (`stretchHelp`).
- UI: none (game unchanged). Demo: unaffected (board and controls unchanged); no re-record needed.

**Interlock** (median / top 10 % / best)

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 86 / 121 / 124 | 86 / 121 / 124 | 0 (0 %) |
| Good | 132 / 137 / 140 | 132 / 137 / 140 | 0 (0 %) |
| Great | 142 / 145 / 147 | 142 / 145 / 147 | 0 (0 %) |
| Near-perfect | 149 / 150 / 150 | 149 / 152 / 166 | 0 (0 %) |
| Elite | 150 / 150 / 150 | 171 / 182 / 200 | +21 (+14 %) |
| All levels | 142 / 150 / 150 | 142 / 171 / 200 | 0 |

Checks: depth-tilegrid-check PASS (6,766: 340 legacy pre-depth cases regrade exactly from `scripts/fixtures/depth-tilegrid-legacy.json.gz`, new stamp rules, 150 at today's pace, 200 at elite pace, monotonic in time, bands), tile-grid-word-count-check PASS, scoring-rev3-check PASS (pinned + depth texts skipped), scoring-bands-check PASS, standard-scoring-check PASS, puzzle-score-rev-check (Interlock lines PASS; overall FAIL only on wordsearch/letterwheel, other forks' games), intro-score-text-check PASS, round-max-check PASS, tsc PASS.
Also: replay-check PASS, intro-demo-check PASS, room-figures-check PASS, reveal-score-check (every reveal of this game shows the stored score; the run FAILs only on wordHunt.tsx's static scan, the Forage fork's). Browser checks (first-paint, no-wrap, frame-probe) left to the lead.
Shared edits made (one line each, for all nine depth games): scoring-rev3-check pins new deals with pinPreDepth(true) and skips the rev-3 help/intro text equality for WORD_DEPTH_GAMES; scoring-bands-check skips the bandsHelp equality for WORD_DEPTH_GAMES. New shared-by-my-games files: scripts/depth-stretch-lib.ts, src/lib/duel/depth/stretch.server.ts, src/lib/duel/depth/stretchShapes.ts.

## Slider (wordslide): par moves — FEATURE

- Stamp: new field `wordSlideRev: 1` (`WORD_SLIDE_REV_PAR`, src/lib/duel/wordSlide.ts), dealt through `dealtDepthRev(1, null)` in generateWordSlide (pinned deals carry no field, exactly the pre-depth puzzle; same board, same seeded draws).
- Par: the stored `par` (the scramble's shift count, 5–8), unchanged. It is fair: reversing the scramble always meets it, and the kit's optimal (BFS) solves are at or under it; a wrong slide plus Undo costs 2 moves (Undo and Reset count), so par needs a clean or nearly clean solve. Kit finishes at par: average 16/40, good 25/40, great 26/40, near 36/40, elite 40/40. (Kit solves sometimes beat par: BFS finds shorter paths than the scramble; noted, par kept as is.)
- Score (src/lib/duel/depth/wordslide.server.ts, src/lib/duel/parBonus.ts): today's rev-3 score (≤ 150) + par bonus, only for a finish in ≤ par moves: `base + (50 − base) × s^power`, s = (time-left share − fast) ÷ (elite − fast) clamped 0–1; SLIDE_PAR_BONUS = { base 6, fast 0.75 (rev 3's clamped fastShare), elite 0.95, power 6 }. Unfinished and over-par finishes score exactly today's. Breakdown: "120 + N par bonus + M speed" (`extra.parts` measure "par bonus"; `extra.parBonus`, `extra.atPar`, `extra.wordSlideRev`).
- UI (src/puzzles/wordSlide.tsx): the live summary reads "… · Moves 7 · Par 9"; moves and "Par 9" gold while within par, past par the moves turn white and "Par 9" dims and is struck through (data-par-moves / data-par-label). Same line, no new height; nothing moves.
- Texts: intro "Each row made a word: up to 110. Finish: 120+, or {max} in the fewest moves, fast." (no "par": intro-score-text-check bans it); how line 3 "Finish within par moves for a bonus; Undo and Reset count." (+ a help-only line on what par is); help from `parBonusHelp` (src/lib/duel/parBonusText.ts): rev 3's progress and finish numbers to 150, then "Par bonus: finish in the par moves or fewer for 6 to 50 more, the whole 50 in about 5 s; {max} only with it."
- Demo: board and controls unchanged (summary text only), so recorded touches still land; no presentation revision bump. A re-recording would show the Par figure (optional).
- Kit: unchanged (it already plays the optimal line; mistakes cost 2 moves).

### Bands (40 seeds; median / top 10 % / best)

**Slider** (median / top 10 % / best)

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 136 / 149 / 150 | 136 / 155 / 157 | 0 (0 %) |
| Good | 150 / 150 / 150 | 156 / 156 / 162 | +6 (+4 %) |
| Great | 150 / 150 / 150 | 156 / 165 / 173 | +6 (+4 %) |
| Near-perfect | 150 / 150 / 150 | 162 / 176 / 200 | +12 (+8 %) |
| Elite | 150 / 150 / 150 | 181 / 200 / 200 | +31 (+21 %) |
| All levels | 150 / 150 / 150 | 156 / 184 / 200 | +6 |

(40 seeds, 4 s)

### Checks
- depth-wordslide-check (new, ~3 s): PASS — 744 pre-depth rounds (fixture scripts/fixtures/depth-wordslide-legacy.json.gz, recorded before the change) regrade identically; dealt stamp; pinned deal = pre-depth puzzle; every kit answer at 9 clock shares: off-par = today, at par = today + 1–50, >150 only at par, 0–200, breakdown adds up, monotone in time; bands; texts.
- word-game-tuning-check PASS; puzzle-surface-check PASS; room-figures-check PASS; room-practice-grade-check PASS; replay-check PASS; intro-score-text-check PASS; intro-demo-check PASS; round-max-check PASS; standard-scoring-check PASS (caps); tsc clean.
- reveal-score-check: FAIL only on wordHunt.tsx (another fork's game); wordslide/swapword rows pass.
- puzzle-score-rev-check: FAIL only on wordsearch / letterwheel (other forks).
- scoring-rev3-check: FAIL "the ? help does not state the rev-3 numbers" / "intro line" for all seven depth finish games incl. wordslide (it asserts PUZZLE_INSTRUCTIONS[type].score === rev3Help(type)); scoring-bands-check: FAIL "the ? help is not the puzzle's score text" for the same games. Both are shared checks: see Shared requests.
- word-polish-check: FAIL "shared.momentcard is listed in docs/sound-cues/word.md" — not from my games (no sound changes here); probably another fork's.
- Not run (lead): first-paint, no-wrap, bottom-clearance, frame-probe, capture.

### Shared requests
- scoring-rev3-check section 6 (lines ~264–265) and scoring-bands-check's help-text assertion: skip WORD_DEPTH_GAMES (their help/intro now come from their depth text, by design).

## Forage (wordhunt): FEATURES, `wordHuntRev 3`

### What changed (all gated on wordHuntRev 3; dealt through `dealtDepthRev(WORDHUNT_REV_DEPTH, WORDHUNT_REV_TARGET)`)
- **Bigger board**: 6×6 (36 tiles) instead of 5×5 (`generateWordHuntDepth` in wordHunt.server.ts: 3–4 seed words of 6–9
  letters, filler, at least `WORDHUNT_DEPTH_MIN_WORDS` = 120 everyday words, else the richest of 300 tries). The board's
  side is read from the stored grid (`wordHuntCols(grid)` in types.ts: 6 only for 36 tiles, otherwise 5), so every
  older board keeps 5-column adjacency, generation, grading, reveal and replays. Round clock unchanged (100 s; Forage is
  one board per round, so nothing to drop). The board's outer box is unchanged (`.word-confirmation-board`, 406 px at
  414×896, 367 px at 375×667); tiles are about 57 px wide at 375 px (6 cols, 5 px gaps; 5×5 keeps its 6 px gaps).
- **Long-word multiplier**: 6 letters ×1.5, 7+ ×2 on the word's points (6 → 6, 7 → 14, 8+ → 22).
- **Golden tile**: one public tile (`puzzle.golden`), drawn from the six non-Qu tiles that sit on the most words; a word
  traced through it scores double (stacks with long words). The board's private word paths run through it where they
  can (reveal / kit only).
- **Score** (`src/lib/duel/wordHunt.ts`, phone + server): base word points (no multipliers) on
  `WORDHUNT_V3_BASE_CURVE` [0,4,6,9,18,27,44,70] → [0,6,25,58,92,112,135,150] (max 150) **plus** the extras the
  features add (value − base) on `WORDHUNT_V3_BONUS_CURVE` [0,8,17,27,48,89,140] → [0,6,9,13,20,38,50] (max 50); both
  cut by rev 2's misses rule. Base points alone stop at 150: the extra 50 only comes from long words and the golden tile.
  Graded in `gradeWordHunt` (extra: points, value, extraPoints, longWords, goldWords, basePart, bonusPart, misses,
  missCutPct); `depth/wordhunt.server.ts` returns that grade as the round's score (not rev 2's knots), breakdown
  `{kind:"partial", base: score}`.
- **UI** (WordHuntPuzzle.tsx, batch-w-wordhunt.css): the golden tile is a gold body, gold letter and static gold glow
  (`data-golden`; no motion, so identical under reduced motion / reduced effects; it keeps its gold on the trace and
  takes the trace ring). The points counter and "Best WORD · N pts" show multiplied points; the accepted chip reads
  "PLANETS ×4 ★ · 28" (×label for multipliers, ★ = through gold) through the existing AcceptedWordChip (unchanged). No new
  sounds. Nothing new appears after first paint (the golden tile is part of the board's first frame; the chip row was
  already reserved). Reveal: words show multiplied points, ★ on gold words (from the stored `goldWords`); round summary
  "N word points + M extra → score · K words", detail "K through the golden tile".
- **Intro still**: a fixed 6×6 example board with the golden A and P→A→N→E traced; list PANE ★ 2, SNARE 2, PLANETS ×2 14.
- **Texts**: how line "6+ letters and the gold tile / multiply a word's points" (Submit line moved to help-only, plus a
  help line with the exact multipliers); help score states the base curve to 150, the extras to 50 and "{max} only with
  both"; intro "Longer words score more; 6+ letters and the gold tile add extra. {max} needs both."
- **Demo**: `FORAGE_DEPTH_DEMOS` / "oct25-forage-depth" in wordInput.ts rejects older coordinate demos, so the intro
  shows its still. **The Forage intro demo needs re-recording on the 6×6 board.**
- **Kit** (kits-word.ts): 6×6-aware neighbours; careful players look round the golden tile first and route words
  through it (an average player about half the time, an error-free one always).
- Shots driver: mid-play traces a 6+ letter word through the golden tile, submits it, then starts a second trace.

### Assumptions
- One golden tile per board; long words ×1.5 at 6, ×2 at 7+; golden ×2 stacks (a 7-letter golden word is ×4).
- Par (isCorrect) stays on base points × 0.35 of the board's base total.
- The minimum word count was scaled to 120 for 36 tiles (5×5 needs 40; 6×6 boards found 130–400).

### Bands (40 seeds, `bun scripts/depth-word-bands.ts --game=wordhunt --seeds=40`; median / top 10 % / best)
| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 63 / 81 / 85 | 64 / 72 / 76 | +1 (+2 %) |
| Good | 100 / 109 / 111 | 100 / 114 / 119 | 0 (0 %) |
| Great | 119 / 124 / 130 | 124 / 136 / 144 | +5 (+4 %) |
| Near-perfect | 137 / 141 / 147 | 155 / 174 / 181 | +18 (+13 %) |
| Elite | 150 / 150 / 150 | 186 / 195 / 200 | +36 (+24 %) |
| All levels | 119 / 150 / 150 | 124 / 186 / 200 | +5 |

### Checks run
- depth-wordhunt-check (new, ~7 s; 352 legacy runs recorded on the pre-depth code in
  scripts/fixtures/depth-wordhunt-legacy.json.gz — rev 2, rev 1 and unstamped boards — plus the rev-3 proofs): PASS
- tsc: PASS (clean)
- scoring-batch2-check: PASS · scoring-bands-check: PASS (one earlier run printed 7 failures while other forks were
  mid-edit; rerun clean) · scoring-targets-check: PASS · scoring-rev3-check: PASS · round-time-check: PASS ·
  round-max-check: PASS · intro-score-text-check: PASS · reveal-score-check: PASS · replay-check: PASS ·
  intro-demo-check: PASS · room-practice-grade-check: PASS · room-figures-check: PASS · puzzle-surface-check: PASS ·
  puzzle-input-tuning-check: PASS · standard-scoring-check: caps pass
- puzzle-score-rev-check: FAIL on wordsearch / letterwheel only (not Forage; other forks' games)
- practice-bests-check: FAIL only because practiceStamps.data.ts needs regenerating (lead runs practice-stamps.ts)
- Not run (lead): first-paint, no-wrap, frame-probe, bottom-clearance, capture.

### Shared requests / shared lines touched
- `src/components/puzzles/usePuzzleSurfaces.ts`: one line — the route overlay's cell count for wordhunt is 6 on a
  36-tile board (was a fixed 5), so the trace line keeps its width on 6×6.
- `src/lib/duel/roundSummaries.ts` (Forage's summary only), `wordInput.ts` (Forage's demo entry), types.ts (Forage
  constants and interface), generate.server.ts (Forage's line), instructions.ts / introScore.ts (Forage's entries).

## Lookout (wordsearch): hidden bonus word — FEATURE, `wordSearchRev 3`

**Stamp:** `wordSearchRev 3` (`WS_DEPTH_REV`, wordSearch.ts), dealt through `dealtDepthRev(3, 2)` in `generateWordSearch`; `pinPreDepth(true)` deals rev 2 exactly as before.

**Rules (rev 3 only):**
- Every board hides one more, unlisted on-theme word (the bonus). Bank: `src/lib/duel/wordSearchBankRev3.server.ts` (`WORD_SEARCH_REV3_BONUS`, one per bank index, seeded `REV3_SEED`, built by `bun scripts/word-search-bank.ts`, `--check` proves all three bank files current). The rev-3 grid is the rev-2 grid with the bonus written in: a theme word from `rev2Words` (no theme-name clash), not one of the six and not nested with them (either way round), in a straight line over filler cells only (at most one crossing, on a matching letter). The six words keep their cells and still appear exactly once; the bonus appears exactly once; no other theme word and no blocked word appears (`rev3Problem`, re-proved for all 1,520 boards by the check).
- `bonus` is private until the reveal (secrets.ts `wordsearch: ["placements", "bonus"]`).
- Live: `checkWordSearchPath(..., bonus)` answers `{ valid: true, bonus: true, word }` for a drag on the bonus; every other drag answers as before (a near miss reveals nothing). The three callers (room `checkWordFn`, practice, async `checkRoundWord`) pass `puzzle.bonus`.
- The round still ends when the six listed words are found, so the bonus must be spotted before the sixth (a scanning skill; no Done button, no flow change).
- Grading: the wordsearch case in grade.ts sets bonus drags aside (`wsSplitBonus`: never a wrong pick) and stores `extra.bonusFound`; everything else is rev 2/3 as today.

**Score:** today's rev-3 score (≤ 150) + `wsBonusPoints` (the only way past 150):
- found with all six: `WS_BONUS_FOUND` 20 + `WS_BONUS_SPEED` 30 × clamp((left share − 0.5) ÷ (0.9 − 0.5)) → 200 needs the bonus and a clean finish in about 12 s (90 % of the 120 s clock left);
- found without finishing: +9 (`WS_BONUS_UNFINISHED`; 110 + 9 = 119 stays under every finish);
- parts: finish `120 + N bonus word + N speed`; unfinished `N for progress`.

**UI** (`src/puzzles/wordSearch.tsx`, `batch-w-wordsearch.css`): a gold-star chip `data-ws-chip="bonus"` at the end of the chip row, fixed 68 × 28 px from the first paint (rev 3 only): an open sunk well with a dashed gold rim, star and "?"; found, lit gold glass with the word (10.5 px mono so 8 letters fit, nothing moves). The bonus cells turn gold with the found-word line, like the six. Sound: `fx.onCorrect()` + `buzz(18)`, `rightMoveFlash` on the chip (reduced motion shortens it; mute/Effects handled by the sound system). Stage state `wsBonus` keeps it over a reload. Reveal: the bonus word listed with ★ (gold when found, muted when missed), its cells outlined gold when missed. Round leaderboard summary: "6 / 6 found · bonus word".
- Layout reasoning: the chip row stays two rows at 414 and 375 px for every mix of six chip widths (worst second row ≈ 253 px + 74 px), so the board keeps its size — the lead's frame-probe should confirm.

**Texts:** intro "Each word: up to 110. Finish: 120+, 150 in about 30 s. Hidden bonus word: up to {max}." (84 chars); help (`src/lib/duel/wordSearchText.ts`) states the rev-3 figures, the bonus rule and points; how line "A seventh theme word hides unlisted: find it for a bonus." (the old "A found word is struck through" is help-only now, plus a help-only line about the gold star chip and finding it before the sixth word).

**Demo:** `LOOKOUT_DEPTH_DEMOS` / `oct25-lookout-bonus` in wordInput.ts rejects older coordinate demos (the intro grid's filler letters change and the chips gain the star), so the intro shows its still. **Lookout's intro demo needs re-recording.**

**Kit** (`kits-word.ts` Lookout): spots the bonus with p = min(0.9, 0.85·e^(−4·(pace − 0.35))) — elite 0.85, near-perfect ≈ 0.47, great ≈ 0.19, good ≈ 0.06, average ≈ 0 — and drags it before a random listed word, costing 0.6 × a word's scan time. Boards without a bonus draw no extra random numbers (legacy fixture unchanged).

**Bands** (`bun scripts/depth-word-bands.ts --game=wordsearch --seeds=40`; median / top 10 % / best):

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 121 / 127 / 129 | 120 / 129 / 134 | -1 (-1 %) |
| Good | 140 / 143 / 146 | 139 / 145 / 164 | -1 (-1 %) |
| Great | 146 / 148 / 150 | 147 / 174 / 180 | +1 (+1 %) |
| Near-perfect | 150 / 150 / 150 | 150 / 190 / 194 | 0 (0 %) |
| Elite | 150 / 150 / 150 | 194 / 196 / 198 | +44 (+29 %) |
| All levels | 146 / 150 / 150 | 147 / 194 / 198 | +1 |

**Checks run:**
- depth-wordsearch-check (new, ~11 s): PASS (7,221 checks: 482 legacy cases recorded before the change in `scripts/fixtures/depth-wordsearch-legacy.json.gz` regrade identically; pinPreDepth deals rev 2 as before; rev-3 bank byte-for-byte and all 1,520 boards' rules; privacy; scoring (no bonus = rev 2 exactly, bonus adds its points, monotonic in time, 200 only with bonus + fast finish, parts add up, unfinished + bonus < any finish, bonus drags never wrong); live check; texts; stage draws the chip only on rev 3; bands)
- wordsearch-check: PASS (pinned to rev 2 with `pinPreDepth(true)`, one line + comment)
- `bun scripts/word-search-bank.ts --check`: PASS (all three files current; bank and rev-2 files unchanged)
- scoring-rev3-check: PASS (final run; an earlier run failed only on other forks' Strikeout/Swapword texts while in flux)
- scoring-bands-check: PASS · puzzle-score-rev-check: PASS · standard-scoring-check: PASS · scoring-batch2-check: PASS
- room-practice-grade-check: PASS · room-figures-check: PASS · round-time-check: PASS
- intro-score-text-check: PASS for Lookout (one run failed on Nucleus's 91-char line, another fork's)
- reveal-score-check: Lookout fine; the run FAILed only on `wordHunt.tsx` (Forage fork's reveal)
- replay-check: PASS · intro-demo-check: PASS (26 demos) · round-max-check: PASS
- puzzle-surface-check: PASS · room-viewport-check: PASS (Word Search reveal outlines)
- word-polish-check: FAIL on "shared.momentcard is listed in docs/sound-cues/word.md" — from WordsmithPuzzle.tsx (Nucleus fork), not Lookout
- tsc: clean
- Not run (lead runs): first-paint, frame-probe, no-wrap, bottom-clearance, capture.

**Screenshot readiness:** `scripts/shots/drivers/word.ts` Lookout mid-play drags the first word and then the intro example's bonus word, so the gold star chip shows it.

**Shared files touched (Lookout lines only):** types.ts (`bonus?` on WordSearchPuzzleData, rev comment), secrets.ts (`"bonus"`), grade.ts (wordsearch case), wordCheck.server.ts / duel.functions.ts / practice.functions.ts (pass `puzzle.bonus` to the live check), instructions.ts and introScore.ts (Lookout entries), roundSummaries.ts (Lookout summary), wordInput.ts (`LOOKOUT_DEPTH_DEMOS`), scripts/puzzle-fairness/kits-word.ts (Lookout kit), scripts/shots/drivers/word.ts (Lookout case), scripts/wordsearch-check.ts (pin).

**Shared requests:** none required. `bun scripts/practice-stamps.ts` must be re-run by the lead (wordSearchRev 3).

**Assumptions:** the bonus counts only if found before the sixth listed word (the sixth ends the round as today); found without finishing it is worth a small +9 so an unfinished round never passes a finish.

## Roundabout (letterwheel): the bonus jar, `wheelRev 2` (FEATURE)

**Stamp.** `wheelRev 2` (`LW_REV_JAR`), dealt through `dealtDepthRev(2, 1)` in `generateLetterWheel`; same 300-board rev-1
bank and draw, plus a public `jarSize`. `pinPreDepth(true)` deals wheelRev 1. wheelRev 1 and unstamped rounds grade
exactly as before (depth grader only applies at wheelRev ≥ 2).

**Rule.** Real words traced from the wheel (dictionary words, 3+ letters, drawable from the wheel) that are not in the
crossword fill the bonus jar; each distinct word once: 3 letters 1 drop, 4 letters 2, 5 letters 3, 6+ letters 4.
Each miss after the free 5 spills a drop (so tracing at random never fills it). The jar holds 30 drops
(`LW_JAR_DROPS`), smaller on a wheel whose bonus words hold few drops: `jarSize = min(30, ceil(0.6 × all bonus drops))`
(226 of 300 boards get 30). Bonus = round(50 × min(drops, size) ÷ size). Score = today's score (rev 3 helper, ≤150) +
bonus; unfinished rounds capped at 119 so every finish (≥120) beats every unfinished run. The extra 50 above 150 comes
only from the jar. Breakdown stored as `120 + N bonus jar + M speed` (finish) or `N for progress`; extra adds
`todayScore, bonusWords, jarDrops (kept), jarSpilled, jarSize, jarBonus`.

**Phone.** The live check is unchanged (server functions untouched): under wheelRev 2 the phone reads the existing
"Not in this puzzle" verdict as a bonus word, keeps the jar's words in stage state (`lwBonus`, survives a reload),
and draws `BonusJar` (a glass jar filling gold, with the word count) at the trace row's right end, rendered from the
first paint when the puzzle has the stamp (fixed 32 px row, absolutely placed, nothing moves). A new bonus word plays
the existing `tick`, a light buzz, flashes "Bonus · WORD" in the trace row and pulses the jar (skipped under
prefers-reduced-motion and reduced effects); a repeat shows "Already in the jar" with the existing reject. The jar
shown subtracts the phone's miss count past 5, as the server does. Reveal adds a "Bonus jar · n words · d / size"
line; the round summary adds "· n in the jar".

**Texts.** Intro: "Words: up to 110. A fast finish 150; a full bonus jar lifts it to {max}." How: "Other real words
fill the bonus jar." (the old "Lift off the wheel or × to drop a trace" moved to help-only), plus a help-only jar line.
Help score from `letterWheelJarHelp()` (src/lib/duel/letterWheelText.ts): rev 3's figures, then the jar's drops, size,
spill rule, 50 / 25 for full / half, the {max} top and the 119 unfinished cap.

**Demo.** Old Roundabout coordinate demos are rejected (`ROUNDABOUT_DEPTH_PRESENTATION` "oct25-roundabout-jar" in
wordInput.ts), so the intro shows its still. Wheel and crossword did not move, but no recorded demo shows the jar:
**the Roundabout intro demo needs re-recording.**

**Bands** (`bun scripts/depth-word-bands.ts --game=letterwheel --seeds=60`; median / top 10 % / best). Kit: under
wheelRev 2 players trace bonus words before the crossword's last word, ~0 for average/good/great (beyond real words
traced by mistake, which also land in the jar), ~3 for near-perfect, 13 for the elite player, stronger players
spotting longer words.

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 74 / 79 / 90 | 81 / 90 / 99 | +7 (+9 %) |
| Good | 105 / 122 / 131 | 110 / 126 / 130 | +5 (+5 %) |
| Great | 132 / 139 / 147 | 136 / 144 / 156 | +4 (+3 %) |
| Near-perfect | 148 / 150 / 150 | 163 / 168 / 174 | +15 (+10 %) |
| Elite | 150 / 150 / 150 | 197 / 199 / 200 | +47 (+31 %) |
| All levels | 132 / 150 / 150 | 136 / 197 / 200 | +4 |

**Assumptions.** Unfinished rounds keep the jar but stay ≤119 (finish beats unfinished). Misses spill drops (anti-spam;
random 3-letter sweeps would otherwise fill half a jar). Words the dictionary blocks never count (isWord). The phone's
jar is a display of the public rule from the live verdicts; only the stored score is shown on the reveal.

**Files.** src/lib/duel/letterWheel.ts (jar rules), letterWheel.server.ts (deal + jar size), letterWheelText.ts (new:
texts), depth/letterwheel.server.ts (grader), types.ts (wheelRev doc, `jarSize`), instructions.ts / introScore.ts
(Roundabout entries), roundSummaries.ts (Roundabout summary), src/puzzles/letterWheel.tsx (jar UI, reveal line),
src/components/puzzles/wordInput.ts (Roundabout demo revision), scripts/puzzle-fairness/kits-word.ts (Roundabout kit),
scripts/shots/drivers/word.ts (Roundabout mid-play: two bonus words then a crossword word),
scripts/depth-letterwheel-check.ts + depth-letterwheel-new.ts + fixtures/depth-letterwheel-legacy.json.gz (new),
scripts/letterwheel-check.ts (pinPreDepth(true), one line), scripts/word-polish-check.ts (depth presentations map:
letterwheel and Lookout's wordsearch).

**Shared requests.** None needed beyond the above. Note for the lead: word-polish-check currently fails on
`wordCue("shared.momentcard")` from WordsmithPuzzle.tsx (Nucleus fork), not listed in docs/sound-cues/word.md and
breaking its "one completion cue per word game" count; my parts of that check pass.

**Checks run (Roundabout's parts).** tsc: PASS. depth-letterwheel-check: PASS (1,859 checks; 800 wheelRev 1 cases
identical; jar rules, spill, unfinished cap, random spam medians ≤ 5, bands, texts). letterwheel-check: PASS (303,
pinned to wheelRev 1). intro-score-text-check: PASS. round-max-check: PASS. scoring-rev3-check: no Roundabout failures
(failures seen were other games' texts, mid-edit by their forks). scoring-bands-check: no Roundabout failures (same).
scoring-batch2-check: PASS. puzzle-score-rev-check: PASS (after pinPreDepth(true), one line). standard-scoring-check:
pass. reveal-score-check: Roundabout PASS (the run failed only on wordHunt.tsx's Reveal, Forage's fork). replay-check:
PASS. intro-demo-check: PASS. room-figures-check: PASS. room-practice-grade-check: PASS. word-polish-check: my parts
PASS; the run fails on the Nucleus fork's `shared.momentcard` cue (see Shared requests). Browser checks not run (lead).

## Strikeout: STRETCH + early-solve bonus, `strikeoutRev 5`

- Stamp: `STRIKEOUT_REV5 = 5`; `generateStrikeout(seed, dealtDepthRev(5, 4))` = rev 4's draw exactly, stamped 5; `so2Rules(5)` = rev 4's rules (12 strikes, 3 vowels, 1.25 a strike left).
- Score (`depth/strikeout.server.ts`, constants in `depth/stretchShapes.ts`): unfinished = today's rev-3 score. A finish = rev 3's 120 + speed (150 at fastShare 0.74 left, about 26 s, no strikes) plus:
  - pace bonus, up to 25: 25 × efficiency² × s^1.2, s = (left − 0.74) ÷ (0.80 − 0.74) (all of it in about 20 s, no strikes);
  - early solves, up to 25: 25 × min(1, share ÷ 0.8) × min(1, left ÷ 0.74)³, share = tiles still hidden at each right Solve ÷ tiles hidden at each word's start, over all five words (`so2EarlySolves` in strikeout.ts). The cube means early solves count in full only on a quick finish, so a solid player is unchanged.
  - Breakdown "120 + N pace and early-solve bonus + M speed"; `extra.paceBonus`, `earlyBonus`, `earlyShare`, `hiddenAtSolve`.
- UI (`src/puzzles/strikeout.tsx`, `batch-w-strikeout.css`): rev 5 only, a gold pill "Early +N" absolutely centred in the Word-dots / Vowels row (reserved, `invisible` until the first early solve, so nothing moves), N = letters still hidden when words were solved with Solve (public: the board showed them; stage state `so5Early`, so a reload keeps it). A small scale pop on an early solve (none with reduced motion or reduced effects); the existing `fx.onCorrect` cue, no new sound. The reveal shows only the stored score.
- Texts: how line "Tap Solve: to guess the word; early earns more, wrong is a strike." plus a help-only line; intro "Words and letters: up to 110. Finish: 150 in about 26 s; {max} needs early solves too."; help states both bonuses.
- Kit: rev 5 players read the certain word only once few enough tiles are hidden for their pace (average/good 4–5, great 5, near 6, elite as soon as it is certain); older revs keep the kit unchanged.
- Demo: the board and keys did not move (the pill is an overlay in an existing row); no re-record needed.
- Assumption: the kit's average player finishes less often on rev 5 (it now guesses more before it solves): a kit artefact of the new reading rule, not a scoring change (unfinished rounds score exactly as before).

**Strikeout** (median / top 10 % / best)

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 84 / 121 / 130 | 79 / 92 / 106 | -5 (-6 %) |
| Good | 128 / 138 / 148 | 127 / 140 / 149 | -1 (-1 %) |
| Great | 140 / 144 / 149 | 142 / 152 / 166 | +2 (+1 %) |
| Near-perfect | 145 / 149 / 150 | 156 / 171 / 176 | +11 (+8 %) |
| Elite | 149 / 150 / 150 | 169 / 189 / 200 | +20 (+13 %) |
| All levels | 138 / 150 / 150 | 143 / 171 / 200 | +5 |

Checks: depth-strikeout-check PASS (6,594; legacy fixture `depth-strikeout-legacy.json.gz`, so2Rules(5) = rev 4, early-share rules, all-early at the elite pace 200, guessed-out gets no early points), strikeout-check PASS (pinned to the pre-depth stamp), scoring-rev3-check PASS, scoring-bands-check PASS, standard-scoring-check PASS, intro-score-text-check PASS, round-max-check PASS, tsc PASS.
Screenshot driver: scripts/shots/drivers/word.ts solves the first word with Solve at its start, so the pill shows mid-play.
Also: replay-check PASS, intro-demo-check PASS, room-figures-check PASS, reveal-score-check (every reveal of this game shows the stored score; the run FAILs only on wordHunt.tsx's static scan, the Forage fork's). Browser checks (first-paint, no-wrap, frame-probe) left to the lead.
Shared edits made (one line each, for all nine depth games): scoring-rev3-check pins new deals with pinPreDepth(true) and skips the rev-3 help/intro text equality for WORD_DEPTH_GAMES; scoring-bands-check skips the bandsHelp equality for WORD_DEPTH_GAMES. New shared-by-my-games files: scripts/depth-stretch-lib.ts, src/lib/duel/depth/stretch.server.ts, src/lib/duel/depth/stretchShapes.ts.

## Cryptogrid (codeword): STRETCH, `codewordRev 4`

- Stamp: `codewordRev 4` (`CODEWORD_DEPTH_REV`, codeword.ts), dealt in `generateCodeword` through `dealtDepthRev(4, 3)`; `codewordFromEntry(entry, 4)` builds rev 3's board (six givens; every rev comparison is `>= 2` / `>= 3`). Bank, givens, rules and clock (120 s) unchanged.
- Score (`depth/codeword.server.ts`): unfinished = today's rev-3 score. A finish = rev 3's 120 + speed (150 at fastShare 0.75 left, about 30 s) + pace bonus 50 × efficiency² × s^1.5, s = (left − 0.75) ÷ (0.86 − 0.75): 200 only in about 17 s. Wrong letters cost progress as before (rev 3's efficiency for Cryptogrid is 1).
- Texts: intro "Each number decoded: up to 110. Finish: 120+, 150 in about 30 s, {max} in about 17 s."; help states the pace bonus.
- UI: none. Demo unaffected.

**Cryptogrid** (median / top 10 % / best)

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 98 / 125 / 129 | 98 / 125 / 129 | 0 (0 %) |
| Good | 138 / 143 / 145 | 138 / 143 / 145 | 0 (0 %) |
| Great | 144 / 148 / 149 | 144 / 148 / 149 | 0 (0 %) |
| Near-perfect | 150 / 150 / 150 | 150 / 165 / 173 | 0 (0 %) |
| Elite | 150 / 150 / 150 | 177 / 194 / 200 | +27 (+18 %) |
| All levels | 144 / 150 / 150 | 144 / 177 / 200 | 0 |

Checks: depth-codeword-check PASS (5,102; legacy fixture `depth-codeword-legacy.json.gz`), codeword-check PASS (pinned to the pre-depth stamp: one line), scoring-rev3-check PASS, scoring-bands-check PASS, standard-scoring-check PASS, intro-score-text-check PASS, round-max-check PASS, tsc PASS.
Also: replay-check PASS, intro-demo-check PASS, room-figures-check PASS, reveal-score-check (every reveal of this game shows the stored score; the run FAILs only on wordHunt.tsx's static scan, the Forage fork's). Browser checks (first-paint, no-wrap, frame-probe) left to the lead.
Shared edits made (one line each, for all nine depth games): scoring-rev3-check pins new deals with pinPreDepth(true) and skips the rev-3 help/intro text equality for WORD_DEPTH_GAMES; scoring-bands-check skips the bandsHelp equality for WORD_DEPTH_GAMES. New shared-by-my-games files: scripts/depth-stretch-lib.ts, src/lib/duel/depth/stretch.server.ts, src/lib/duel/depth/stretchShapes.ts.

## Swapword (swapword): par swaps — FEATURE

- Stamp: `swapwordRev 4` (`SWAPWORD_REV = 4`, `SWAPWORD_REV_PAR`), dealt through `dealtDepthRev(SWAPWORD_REV, SWAPWORD_REV3)` in generateSwapword: rev 3's boards and budget (minimum + 8: `swapwordBudget` keys on rev ≥ 3); every other swapwordRev comparison is ≥ 2 / ≥ 3, so rev 4 plays as rev 3.
- Par: the stored `minSwaps` (the proven fewest). Kit finishes at par: average 7/23 finishes, good 21/40, great 32/40, near 38/40, elite 40/40.
- Score (src/lib/duel/depth/swapword.server.ts, parBonus.ts): today's rev-3 score + par bonus only for a finish in ≤ minSwaps swaps; SWAP_PAR_BONUS = { base 6, fast 0.75 (rev 3's clamped fastShare), elite 0.89, power 2 }. Unfinished and over-par finishes score exactly today's. Breakdown "120 + N par bonus + M speed"; `extra.parBonus`, `extra.atPar`.
- UI (src/puzzles/swapword.tsx): a second pill beside "N swaps left" in the same h-10 row: "5 USED · PAR 10", gold border/figures while within par, grey with the par struck through once past it (data-par-swaps). Present from the first paint; the row's height is unchanged, the board does not move.
- Texts: intro "Each tile placed: up to 110. Finish: 120+, or {max} in the fewest swaps, fast."; how line 3 "Finish in par swaps for a bonus. Swaps are limited." (help-only lines: what par is; budget is par + 8, running out ends the round); help: rev 3's numbers to 150 then "Par bonus: finish in par swaps (the fewest that solve the board) or fewer for 6 to 50 more, the whole 50 in about 13 s; {max} only with it."
- Demo: tiles unmoved; no presentation bump. Re-recording would show the par pill (optional).
- swapword-check: pinned to the pre-depth stamp (`pinPreDepth(true)`, one line) as it proves rev 3; PASS.
- Shots driver (scripts/shots/drivers/word.ts swapword case): one swap then a tile picked up, so the pill shows "1 used · par N".

### Bands (40 seeds; median / top 10 % / best)

**Swapword** (median / top 10 % / best)

| Player | Before (max 150) | Now (max 200) | Median change |
| --- | --- | --- | --- |
| Average | 121 / 129 / 131 | 121 / 132 / 137 | 0 (0 %) |
| Good | 138 / 144 / 144 | 139 / 150 / 150 | +1 (+1 %) |
| Great | 147 / 150 / 150 | 153 / 156 / 156 | +6 (+4 %) |
| Near-perfect | 150 / 150 / 150 | 158 / 169 / 178 | +8 (+5 %) |
| Elite | 150 / 150 / 150 | 178 / 190 / 200 | +28 (+19 %) |
| All levels | 147 / 150 / 150 | 153 / 178 / 200 | +6 |

(40 seeds, 3 s)

### Checks
- depth-swapword-check (new, ~25 s): PASS — 956 rev-3 rounds (scripts/fixtures/depth-swapword-legacy.json.gz, recorded before the change) regrade identically; rev 4 dealt on rev 3's board; pinned deal = rev-3 puzzle; rules on every kit answer at 9 clock shares; bands; texts.
- swapword-check PASS (pinned); others as in notes-wordslide.md (same runs).

### Shared requests
- As Slider: scoring-rev3-check and scoring-bands-check help/intro assertions should skip the depth games.

