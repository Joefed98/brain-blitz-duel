# Round replays (first wave, 13 Oct 2026)

Display only. Nothing here changes a sim, a score, a rule or stored data, so there are no
version stamps. Every replay is rebuilt from what a round already stores: the puzzle
(`puzzles_public` + `duel_secrets`) and the round winner's `round_results.answer`.

## What players see

- **Results screen** (`phase === "result"`): a panel above the table with the round winner's
  highlight. The results screen moves on 8 s after it opens, so the highlight fits inside it:
  at most two moments, about 7.5 s together (about 3.7 s each, half speed for 0.35 s either
  side of the key tick; one moment alone runs about 7.3 s), and never longer than the time the
  screen has left when the replay is ready (`planHighlight`'s budget, from the room's own
  clock; under 1.5 s left it doesn't start). The moment's caption sits under it, with **Skip**,
  then a slim bar with **Watch \<name\>'s run** (the full run: play / pause, Slow, 1x, 2x, a seek
  bar, Close). Flash, Bang On, Nucleus and Forage show a **moment card**; puzzles with a stored
  ordered move list show a **time-lapse**, fitted to the same budget. Nothing is forced: the
  panel plays once, Continue, the host's controls and every timer are untouched, and the room
  moves on when it always did.
- **Stale-version reload** (#39, `lib/appUpdate`): the results, standings and final screens
  allow it. The replay panels never claim the update gate or hold a submission; once the
  reload starts ("Updating…"), the highlight, the full-run player and the play of the game
  simply end, and the page reload takes them away.
- **Podium** (multi-player `Podium` and two-player `FinalResult`): the **play of the game**, the
  single best candidate across every round, played once (10–15 s for an arcade moment,
  5–10 s for a time-lapse, 6 s for a card) with Skip. Not shown after a "Finish now" ending.

On a short phone with a full room the results panel drops its picture and keeps one line
(heading + Watch), so the table and Continue stay on screen (`highlightPx`).

## Trust: when logs and answers leave the server

`roundReplayFn` / `gameReplaysFn` (`src/lib/replay/replay.functions.ts`) are the only way the
replay screens get a stored answer. `replayRoundClosed` (`access.ts`) opens a round only on
its results screen or later (`result`, `standings`, `winner_reveal`, a later round, or a
finished room): the reveal phase still accepts a lagging phone's answer, so it stays closed.
The podium call opens only once the room is finished. Only the **round winner's** answer is
returned (ties broken by `standings`, i.e. quicker answer time, then slot), plus the scores
needed for the margin. Checked by `replay-access-check` against the real loader code with an
in-memory database.

Closed 13 Oct 2026: the `round_results` RLS policy let room members read other players' rows
(answers included) from the reveal phase on (`duel_round_ended`) while the reveal still took late
answers. Migration `20261013120000_reveal_phase_answers_closed.sql` opens other players' rows on
the same cutoff as replays (`result`, `standings`, `winner_reveal`, a later round, or a finished
room); a player's own row stays readable. `revealAnswerFn` (`reveal.server.ts`) returns only the
caller's own detail during the reveal phase, plus where the others' arcade runs ended on the reveal
track; the phone fetches the reveal and the results again once the round closes
(`reveal-window-check`). A player with no answer in gets no answer detail at all during the
reveal phase (only the public puzzle, `awaitingAnswer`; `duel_secrets` is not read): the correct
answer would otherwise be sendable as their late answer. Their phone fetches again once their
answer is stored or the round closes. The word checker (`checkWordFn`), the only other path to a
round's private solution after the puzzle phase, now works only in the puzzle phase, like
`checkMovesFn` and `checkGroupFn`.

## Replay player

`src/lib/replay/steppers.ts` opens up each game's server replay loop (same game object for
the stored revision, same start state, same input repair, same last tick) so the phone can
step it tick by tick; `timeline.ts` keeps a copy of the state every 60 ticks during the first
pass, so a jump costs at most 60 sim steps. Drawing uses each game's own live renderer
(`playback.renderer.ts`, the art and shared success effects players saw). The first pass runs
in slices and never holds a frame; if it takes over 2.5 s, or the first 40 frames average
over 28 ms, the panel shows a still of the moment's tick with its caption instead.

Replayable: the 22 arcade games (Junction included, practice only) plus Letterfall, Tenfall,
Bonk, Pull! and Mixed Signals. `replay-check` proves, for every game on the revision rooms stamp today
(Tenfall tenRev 1, Mixed Signals clashRev 4 and Scrumper snipRev 6 included) and the older-revision runs in the score-band and Tuning A/C/E fixtures, that the stepper's final
state is deep-equal to the server replay's, on the same tick, with the stored score.

## Moments

Detected from **sim state**, tick by tick during the first pass (never from drawing state),
with the shared success layer's own firing rule. Arcade rows are the success events each game
fires today (`arcadeFxGames.renderer.ts`), named by index and kind; `replay-check` fails if a
game's events and rows drift apart. Picking is deterministic: weight, then the earlier tick,
then table order; a highlight takes the best moment and the next best at least 5 s away.

Near-misses are the dodges the sims already count (Meteor, Grappler, Roofbound's crumbling
tiles, Hover's moving barriers) plus Fission's last-life wave clear. The **final-second save**
applies to every engine game: the run's last score rise lands in the final two seconds of a run
that reached the buzzer.

**Play of the game** ranks every round winner's best candidate by `weight + margin over the
round's second-best score`, then the earlier round, the earlier tick, the lower slot.

### The weight table (`MOMENT_TABLE`, src/lib/replay/moments.ts)

Weights run 0–100; 0 means the event fires today but isn't a highlight. Orbit rounds on rev 3+
read the camera spec (`ORBIT3_FX`, the same two rows plus the black hole).

| Game | Moment (id) | Weight | Kind | Source |
|---|---|---|---|---|
| Hover | Barrier passed (border light only) (`barrier`) | 0 | success | success event #0 (pop) |
| Hover | New zone (every 7 barriers) (`zone`) | 30 | success | success event #1 (streak) |
| Hover | Gold star (`gold-star`) | 40 | success | success event #2 (perfect) |
| Hover | Through a two-gap barrier (`two-gap`) | 20 | success | success event #3 (pop) |
| Hover | Slipped through a moving barrier (`slipped-through`) | 30 | near-miss | success event #4 (pop) |
| Hover | Every barrier passed (`all-barriers`) | 90 | finish | success event #5 (final) |
| Breaker | Power-up caught (`power-up`) | 25 | success | success event #0 (perfect) |
| Breaker | Bricks streak (every 10) (`bricks`) | 20 | success | success event #1 (streak) |
| Breaker | Fireball caught (`fireball`) | 40 | success | success event #2 (perfect) |
| Breaker | Brick out of a sliding row (`moving-target`) | 25 | success | success event #3 (pop) |
| Breaker | Row cleared (`row-clear`) | 35 | success | success event #4 (clear) |
| Breaker | Wall cleared (`wall-cleared`) | 95 | finish | success event #5 (final) |
| Rally | Long rally (every 10 returns) (`long-rally`) | 35 | success | success event #0 (streak) |
| Rally | Gold ball returned (`gold`) | 25 | success | success event #1 (pop) |
| Rally | Far-wall target struck (`target`) | 45 | success | success event #2 (perfect) |
| Rally | Off the bumper (`bumper`) | 10 | success | success event #3 (pop) |
| Rally | Paddle hit (court lights only) (`hit`) | 0 | success | success event #4 (pop) |
| Tempo | Combo (every 10) (`combo`) | 30 | success | success event #0 (combo) |
| Tempo | Swipe note hit (`swipe`) | 15 | success | success event #1 (pop) |
| Tempo | Full combo (`full-combo`) | 95 | finish | success event #2 (final) |
| Meteor | Stars streak (every 10) (`stars`) | 30 | success | success event #0 (streak) |
| Meteor | Rock dodged (`dodged`) | 25 | near-miss | success event #1 (pop) |
| Meteor | Meteor shower incoming (`shower`) | 20 | success | success event #2 (streak) |
| Meteor | Meteor shower dodged (`shower-dodged`) | 60 | near-miss | success event #3 (perfect) |
| Meteor | Every star eaten (`all-eaten`) | 90 | finish | success event #4 (final) |
| Fission | Wave cleared (`wave-cleared`) | 45 | success | success event #0 (clear) |
| Fission | Freeze caught (`freeze`) | 30 | success | success event #1 (perfect) |
| Fission | Flawless finish (`flawless`) | 90 | finish | success event #2 (final) |
| Fission | Wave cleared on the last life (`last-life-wave`) | 55 | near-miss | own sim/answer read |
| Wavefront | Saucer shot down (`saucer`) | 55 | success | success event #0 (perfect) |
| Wavefront | Wave cleared (`wave-cleared`) | 45 | success | success event #1 (clear) |
| Wavefront | Diver shot mid-dive (`diver-down`) | 25 | success | success event #2 (pop) |
| Wavefront | Boss hit streak (every 6) (`boss-hits`) | 40 | success | success event #3 (streak) |
| Wavefront | Boss destroyed (all waves on older rounds) (`boss-down`) | 100 | finish | success event #4 (final) |
| Orbit | Planets streak (every 10) (`planets`) | 35 | success | success event #0 (streak) |
| Orbit | All 40 planets (`all-planets`) | 95 | finish | success event #1 (final) |
| Orbit | Through a black hole (`black-hole`) | 60 | success | ORBIT3_FX #2 (clear) |
| High Rise | Perfect drop (`perfect-drop`) | 20 | success | success event #0 (perfect) |
| High Rise | Floors streak (every 10) (`floors`) | 35 | success | success event #1 (streak) |
| High Rise | Perfect streak (`streak`) | 40 | success | success event #2 (combo) |
| High Rise | Wind flag raised (info only) (`wind-flag`) | 0 | success | success event #3 (pop) |
| High Rise | Perfect drop in the wind (`wind-perfect`) | 50 | success | success event #4 (perfect) |
| Jaywalk | Road crossed (`crossing`) | 35 | success | success event #0 (clear) |
| Jaywalk | Past the cyclists (`bikes`) | 20 | success | success event #1 (pop) |
| Jaywalk | Through the roadworks (`cones`) | 20 | success | success event #2 (pop) |
| Junction | Ambulance through (`ambulance`) | 45 | success | success event #0 (perfect) |
| Junction | Cars cleared (every 10) (`cleared`) | 25 | success | success event #1 (streak) |
| Junction | New road built (info only) (`new-road`) | 0 | success | success event #2 (pop) |
| Junction | Bus through (`bus`) | 20 | success | success event #3 (pop) |
| Junction | New roads' traffic (every 5) (`new-roads`) | 20 | success | success event #4 (streak) |
| Rainbow Bridge | Level cleared (`level`) | 35 | success | success event #0 (clear) |
| Rainbow Bridge | Coin through the gold star (`gold-star`) | 45 | success | success event #1 (perfect) |
| Rainbow Bridge | All 10 levels (`all-levels`) | 95 | finish | success event #2 (final) |
| Slice | Combo multiplier (`combo`) | 25 | success | success event #0 (combo) |
| Slice | Sauce frenzy (`frenzy`) | 30 | success | success event #1 (perfect) |
| Slice | Simmer (slow time) (`simmer`) | 30 | success | success event #2 (perfect) |
| Slice | Sliced streak (every 25) (`sliced`) | 25 | success | success event #3 (streak) |
| Slice | Mayonnaise squeezed (`mayo`) | 30 | success | success event #4 (perfect) |
| Slice | Four or more in one cut (`many-in-one`) | 55 | success | success event #5 (combo) |
| Swish | Buckets in a row (3+) (`in-a-row`) | 35 | success | success event #0 (combo) |
| Swish | Through the hoop (`hoop`) | 40 | success | success event #1 (perfect) |
| Swish | Past the spinner (`spinner`) | 20 | success | success event #2 (pop) |
| Swish | Ten out of ten (`ten-of-ten`) | 95 | finish | success event #3 (final) |
| Flightpath | Bullseye (`bullseye`) | 40 | success | success event #0 (perfect) |
| Flightpath | Inner bull (`inner-bull`) | 60 | success | success event #1 (perfect) |
| Flightpath | Balloon popped (`balloon`) | 20 | success | success event #2 (pop) |
| Flightpath | Bulls in a row (`bulls-in-a-row`) | 55 | success | success event #3 (combo) |
| Flightpath | All ten on target (`all-on-target`) | 80 | finish | success event #4 (final) |
| Coral Pop | Big pop (5+) (`big-pop`) | 55 | success | success event #0 (combo) |
| Coral Pop | Big drop (3+) (`big-drop`) | 60 | success | success event #1 (perfect) |
| Coral Pop | Joker (`joker`) | 30 | success | success event #2 (perfect) |
| Coral Pop | Mine (`mine`) | 40 | success | success event #3 (perfect) |
| Coral Pop | Torpedo (`torpedo`) | 40 | success | success event #4 (perfect) |
| Coral Pop | Reef cleared (`reef-cleared`) | 95 | finish | success event #5 (final) |
| Roofbound | Survival streak (every 10 s) (`seconds`) | 20 | success | success event #0 (streak) |
| Roofbound | Survived (`survived`) | 80 | finish | success event #1 (final) |
| Roofbound | Star taken (`star`) | 15 | success | success event #2 (pop) |
| Roofbound | All 10 stars (`all-stars`) | 70 | success | success event #3 (perfect) |
| Roofbound | Off a crumbling tile just in time (`just-in-time`) | 40 | near-miss | success event #4 (pop) |
| Grappler | Distance (every 100 m) (`distance`) | 30 | success | success event #0 (streak) |
| Grappler | Star (`star`) | 25 | success | success event #1 (perfect) |
| Grappler | Stalactite dodged (`dodged`) | 30 | near-miss | success event #2 (pop) |
| Grappler | Over the lava jet (`over-lava`) | 20 | success | success event #3 (pop) |
| Grappler | 500 m (dragon outrun) (`finish`) | 95 | finish | success event #4 (final) |
| Scrumper | Leaf taken (`leaf`) | 15 | success | success event #0 (pop) |
| Scrumper | Apple fed (`level`) | 35 | success | success event #1 (clear) |
| Scrumper | All 10 apples (`all-apples`) | 95 | finish | success event #2 (final) |
| Scrumper | Off a springy branch (`spring`) | 10 | success | success event #3 (pop) |
| Tilt | Maze done (`maze`) | 45 | success | success event #0 (clear) |
| Tilt | All 4 mazes (`all-mazes`) | 95 | finish | success event #1 (final) |
| Tilt | Bonus star (`star`) | 25 | success | success event #2 (pop) |
| Tilt | First marble home (`first-marble`) | 25 | success | success event #3 (pop) |
| Ball Tracker | Marbles home (every 5) (`home`) | 25 | success | success event #0 (streak) |
| Ball Tracker | All 30 home (`all-home`) | 95 | finish | success event #1 (final) |
| Ball Tracker | Home off a turned tube (`turned-home`) | 20 | success | success event #2 (pop) |
| Ball Tracker | Home past a switch (`switched-home`) | 20 | success | success event #3 (pop) |
| Gemstone | Cascade (3+ steps) (`cascade`) | 50 | success | success event #0 (combo) |
| Gemstone | Five or more in a line (`line-of-five`) | 70 | success | success event #1 (perfect) |
| Gemstone | Jackpot gem made (`jackpot-gem`) | 75 | success | success event #2 (perfect) |
| Gemstone | Jackpot set off (`jackpot`) | 65 | success | success event #3 (combo) |
| Gemstone | Par smashed (`par-smashed`) | 85 | finish | success event #4 (final) |
| Letterfall | Word made (`word`) | 15 | success | success event #0 (pop) |
| Letterfall | Six-letter (or longer) word (`long-word`) | 55 | success | success event #1 (perfect) |
| Letterfall | Par reached (`par`) | 80 | finish | success event #2 (final) |
| Bonk | Bonks streak (every 10) (`bonks`) | 25 | success | own sim/answer read |
| Bonk | Twenty bonks without a wrong tap (`clean-twenty`) | 60 | success | own sim/answer read |
| Pull! | Gold clay (`gold`) | 40 | success | own sim/answer read |
| Pull! | Clays streak (every 10) (`clays`) | 25 | success | own sim/answer read |
| Pull! | Two clays with one shot (`double`) | 55 | success | own sim/answer read |
| Tenfall | Ten made (`ten`) | 20 | success | own sim/answer read |
| Tenfall | Every target cleared (`all-cleared`) | 90 | finish | own sim/answer read |
| Mixed Signals | Sorted streak (every 5) (`sorted`) | 20 | success | own sim/answer read |
| Mixed Signals | Whole queue sorted (`all-sorted`) | 70 | finish | own sim/answer read |
| Mixed Signals | Whole queue sorted without a mistake (`flawless`) | 90 | finish | own sim/answer read |
| Flash | Fastest reaction (`fastest`) | 30 | success | own sim/answer read |
| Flash | Reaction under 200 ms (`lightning`) | 50 | success | own sim/answer read |
| Bang On | Closest stop (`closest`) | 30 | success | own sim/answer read |
| Bang On | Stopped within 10 ms (`dead-on`) | 60 | success | own sim/answer read |
| Nucleus | Best word (`best-word`) | 30 | success | own sim/answer read |
| Nucleus | Pangram (every letter) (`pangram`) | 60 | success | own sim/answer read |
| Forage | Best word (`best-word`) | 30 | success | own sim/answer read |
| Forage | Seven-letter (or longer) word (`long-word`) | 50 | success | own sim/answer read |
| Time-lapse puzzles | Puzzle solved (time-lapse) (`solved`) | 45 | success | own sim/answer read |
| Time-lapse puzzles | Puzzle solved in the minimum moves (time-lapse) (`minimum`) | 70 | success | own sim/answer read |
| Every engine game | Final-second save: scored in the last two seconds (`final-second`) | 55 | save | own sim/answer read |

## Moment cards

From the winner's stored answer and `round_results.extra` (`src/lib/replay/cards.ts`):

| Game | Card | Source |
|---|---|---|
| Flash (`reaction`) | Fastest reaction, ms (row `lightning` under 200 ms) | `extra.times` (tapRev 1), else the legacy answer `ms,ms,ms\|falseStarts` |
| Bang On (`stopwatch`) | Closest stop, ms, early / late (row `dead-on` within 10 ms) | `extra.distances` + `extra.signed`, else the legacy answer |
| Nucleus (`wordsmith`) | Best word by `wordsmithPoints` (row `pangram`) | `extra.words`, else the stored word list |
| Forage (`wordhunt`) | Best word by `wordHuntPoints` (row `long-word` at 7+) | `extra.words`, else the stored word list (paths are not stored) |

## Puzzle time-lapse inventory

The time-lapse hands the game's own `Reveal` component growing prefixes of the stored move
list, read-only (no game file is edited), with a move counter against the minimum where the
puzzle stores one. Stored lists carry no times, so moves are spaced evenly (about 7.5 s in all,
never under 5 s or over 10 s, at most 0.6 s a move; on the results screen within the time it has
left). Wired today: Gridlock, Slider, Hanoi,
Labyrinth, Polypotions, Topsy-Turvy, Colour Flood, Turntable, Strikeout and Heave (Gridlock and
Heave draw the player's board only when told the answer was right, so they time-lapse only
solved rounds). The remaining puzzles are wired to the timestamped puzzle action log that Room
rules and trust is defining (docs/puzzle-action-log.md) in a follow-up session.

| Puzzle (id) | Stored answer | Ordered moves? | Minimum on the puzzle | Time-lapse today | Needs |
|---|---|---|---|---|---|
| Gridlock (`unblock`) | `id:to,…` | yes, no times | `minMoves` | **yes** (solved rounds) | — |
| Slider (`wordslide`) | `r2+,c0-,U,X,L3,…` | yes (undo/reset tokens) | `par` | **yes** | — |
| Hanoi (`tower`) | `from>to,…` | yes | `minMoves` | **yes** | — |
| Labyrinth (`maze`) | path `c,c,c,…` | yes (cells) | — | **yes** | — |
| Polypotions (`tubes`) | `from>to,…` | yes | `minMoves` | **yes** | — |
| Topsy-Turvy (`gravity`) | `UDLR` (+X undo, Y reset) | yes | `minMoves` | **yes** | — |
| Colour Flood (`flood`) | `c,c,-1,…` | yes | `par` | **yes** | — |
| Turntable (`rings`) | ring taps `r,r,…` | yes | `minMoves` | **yes** (solved state shows solved rings) | — |
| Strikeout (`strikeout`) | canonical `E,T,2CRANE,…` | yes | — | **yes** | — |
| Heave (`push`) | `UDLR` walk steps | yes | `minPushes` | **yes** (solved rounds) | — |
| Blackout (`lightsout`) | presses `c,c,-1,-2` | yes | `minPresses` | no | Reveal to draw `replayLights` of the answer |
| Skid (`iceslide`) | `UDLR` (+X/Y) | yes | `minMoves` | no | Reveal to draw the replayed ball/paths |
| Jumbled (`tiles`) | tiles `n,n,-1,-2` | yes | `minMoves` | no | Reveal to draw `replay.frame` |
| Matchmaker (`pairmatch`) | flips `c,c,…` | yes | — | no | Reveal to pass `replay.matched` |
| Cryptogrid (`codeword`) | `12E,7-,…` | yes | — | partial (colours only) | Reveal to draw the player's letters |
| Swapword (`swapword`) | swaps `a-b,…` | yes | `minSwaps` | partial (marks only) | Reveal to draw `run.board` letters |
| Lookout (`wordsearch`) | selections `start.end,…` | yes | — | prefix works (found-so-far) | a board-progress view; action log for times |
| Roundabout (`letterwheel`) | words `WORD,…` | yes | — | prefix works (crossword fill) | action log for times |
| Bomb Defusal (`bomb`) | `w3,bA,…` | yes | — | text list only | a board render |
| Checkout (`checkout`) | darts per stage | yes | `minDarts` (secret) | text only | a dartboard render |
| Brimful (`measure`) | jug actions per board | yes | `minMoves[]` | no (text only) | a jug render |
| Ballpark (`numline`) | placements per item | yes | — | prefix works (dots) | action log for times |
| Safe Cracker (`safe`) | tries `1234,…` (max 3) | yes | — | last try only | a per-try view |
| Exact (`target`) | steps `a\|op\|b;…` | yes | — | value only | a tile-pool render |
| Don't Break the Chain (`chain`) | `node@ms,…\|reason` | yes, **with times** | — | no | a node/board render |
| Ascend (`numhunt`) | `log1:n@t,…` | yes, **with times** | — | no | Reveal progress rendering |
| Tessellate (`blockparty`) | placements in order (removals lost) | final set | `solution` | partial board, not history | action log |
| Chroma Lines (`flow`) | final paths | final state | `solution` | no | action log |
| Trail (`trail`) | final path in number order | final state | — | partial path, not history | action log |
| Shikaku (`shikaku`) | final rects | final state | `solution` | no | action log |
| Interlock (`tilegrid`) | final grid | final state | `solution` | no | action log |
| Counterweight (`balance`) | final pegs | final state | `solutions` | no | action log |
| Pipeline (`pipes`) | final tile masks | final state | `solution` | no | action log |
| Box Six (`sudoku`) | final digits | final state | `solution` | no | action log |
| Lightbender (`laser`) | final mirrors | final state | `solution` | no | action log (Lightbender's shot log, Room rules and trust) |
| Mosaic (`nonogram`) | filled cells (sorted) | final state | `pattern` | no | action log |
| Tents and Trees (`tents`) | tent cells (sorted) | final state | `solution` | no | action log |
| Lamplighter (`lightup`) | bulb cells (sorted) | final state | `solution` | no | action log |
| Integer Pyramid (`numpyramid`) | final boards (JSON) | final state | `solutions` | no | action log |
| Nucleus, Forage | word lists | words in order | `par` | card instead | (paths for Forage) |
| Flash, Bang On | tap logs with times | yes, **with times** | — | card instead | — |
| Operator, Tally, Eagle Eye, Double Take, Interloper | per-stage picks / sets | n/a | — | no (quiz-style) | — |

Retired types (practice only) are not dealt in rooms; of them Word Ladder, Sequence and
Reverse Recall would prefix-play, Dig stores sim-step stamps (needs a replay that stops at a
step), Sum Hunt replays to a board it doesn't draw, One-Stroke needs a traced-edge render, and
Groups, Number Sequence, Chain Calculation, Spatial Memory, Go / No-Go, Pattern Completion,
Spin, Word Match, Percent Sprint, Number Climb and Mirror Match are quizzes.

## Sound cues

No audio yet; every replay effect dispatches a named cue. See docs/sound-cues/replays.md.

## Checks

- `replay-check` (shard d): the fixture replays above, seek parity (keyframe seek = stepping
  from the start = the server replay cut at that tick), the weight table against today's
  success events, deterministic detection, ranking and picking.
- `replay-access-check` (shard d): the serve-after-close gate, the loader with an in-memory
  database (no read of results before the round closes; only the winner's answer; strangers
  refused), and a source scan.
- `replay-flow-check` (shard d): results and podium screens keep Continue / Play again / Leave
  with a panel, or a failing one; no replay code calls a room action or timer; timings; fit.
- `replay-play-check` (CI shard **play5**, which installs Playwright's Chromium and caches
  Vite's dependencies): five stored runs (Tenfall tenRev 1, Mixed Signals clashRev 4, Scrumper
  snipRev 6, Pull!, Gemstone by default) in the replay lab's player with main's polished
  renderers at 1x, 2x and after a seek, frame time, stored score; Continue and Play again on
  screen and on top with the panels up.
- `replay-flow-check` also renders each time-lapse puzzle's own (polished) Reveal with growing
  prefixes of a move list and fails if its board stops changing with the moves.

Fixtures: `scripts/fixtures/replay-runs.json`, rebuilt by `bun scripts/replay-fixtures.ts`
(the skill-band bots at "great" on today's revisions, greedy drivers for Bonk, Pull!, Tenfall
and Mixed Signals, the Letterfall bot from wordfall-check, and two solved puzzle rounds).
Revisions that reach main later get stored runs appended with
`bun scripts/replay-fixtures.ts --add=<types>` (13 Oct 2026: Tenfall tenRev 1, Mixed Signals
clashRev 4, Scrumper snipRev 6), and `replay-check` fails unless every game has a stored run on
the revision stamps the live generator puts on a new puzzle.
Development lab: `/replay-lab?view=results|podium|player|timelapse|card&game=<id>` (dev server
only: in a production build the route's `beforeLoad` compiles to an unconditional not-found, the
lab chunk is a stub and the fixture isn't bundled).
