# Duelz visual snapshots — October 2026

Headless renders of every active game (68) plus the room screens, for design review. Captured 11 Oct 2026 from a local `vite dev` server on the session branch, with Playwright 1.64 driving the pre-installed Chromium at a 390 × 700 viewport (device scale 1). No app code was changed; the capture scripts lived outside the repo.

## How they were made

- **Practice mode, fixed seed.** Each game was opened from `/practice`. The practice generate request was rewritten in flight to `example: true`, so the server builds the game's fixed intro example under `INTRO_EXAMPLE_SEED` (the same puzzle on every run) instead of a random one. Client-side `Math.random` was also seeded (mulberry32, seed 20261011) so presentation randomness repeats.
- **`-intro.png`** — the RoundIntro screen about 2.5 s after it opens, before tapping Ready.
- **`-play.png`** — puzzles: 3 s after Ready, untouched. Arcade games: when the sim's run clock reached tick 600 (10 s of run at 60 ticks/s), with no input. Some arcade runs end before 10 s without input; those are noted below and the image shows the run as it ended.
- **`-reveal.png`** — no answer is entered; the page clock is fast-forwarded past the round so practice grades an empty answer at the buzzer, as a room does. The AnswerReveal is captured about 1.5 s after the server score arrives. So every reveal shows a timed-out, zero-point round.
- **Room screens** (`room/`): `home.png` is the real `/` route. Lobby, round results, standings and podium can't be reached without a live Supabase room (the container can't reach the project, and creating rooms would write to the production database), so the real components (`RoomLobby`, `RoundResultsTable`, `Standings`, `Podium` inside `PhoneShell`) were mounted on the loaded app with mock data: 6 players (Joe = you and host, Priya, Sam, Alex, Mo, Kat), 5 rounds, fixed scores, with tables built by the app's own `standings()` helper. The room chat is omitted, and the lobby's room-code header and Copy code button are re-created from the route's markup, because `LobbyActions` isn't exported. Headless Chromium has no `navigator.share`, so there's no Share link button.

## Assumptions and caveats

- The Supabase project is unreachable from this container (`ERR_TUNNEL_CONNECTION_FAILED`), so anonymous sign-in and any intro demo recording fetched from Supabase failed. Intro screens show what the app renders in that case (the demo panels seen in the intros are the app's fallback or bundled demos). This may differ slightly from the live app.
- Practice reveals show "Round 1 of N" and practice chrome; room reveals would also show other players.
- Animations are captured at a single moment, so timing-dependent frames (countdowns, pops) can differ slightly between runs.
- Fonts and rendering are headless Chromium on Linux, not a phone. Joe does the device testing.

## Word (6)

| Game id | Name | Intro | Mid-play | Reveal | Notes |
|---|---|---|---|---|---|
| `wordsmith` | Nucleus | [word/wordsmith-intro.png](word/wordsmith-intro.png) | [word/wordsmith-play.png](word/wordsmith-play.png) | [word/wordsmith-reveal.png](word/wordsmith-reveal.png) |  |
| `tilegrid` | Interlock | [word/tilegrid-intro.png](word/tilegrid-intro.png) | [word/tilegrid-play.png](word/tilegrid-play.png) | [word/tilegrid-reveal.png](word/tilegrid-reveal.png) |  |
| `wordslide` | Slider | [word/wordslide-intro.png](word/wordslide-intro.png) | [word/wordslide-play.png](word/wordslide-play.png) | [word/wordslide-reveal.png](word/wordslide-reveal.png) |  |
| `wordhunt` | Forage | [word/wordhunt-intro.png](word/wordhunt-intro.png) | [word/wordhunt-play.png](word/wordhunt-play.png) | [word/wordhunt-reveal.png](word/wordhunt-reveal.png) |  |
| `wordsearch` | Lookout | [word/wordsearch-intro.png](word/wordsearch-intro.png) | [word/wordsearch-play.png](word/wordsearch-play.png) | [word/wordsearch-reveal.png](word/wordsearch-reveal.png) |  |
| `letterwheel` | Roundabout | [word/letterwheel-intro.png](word/letterwheel-intro.png) | [word/letterwheel-play.png](word/letterwheel-play.png) | [word/letterwheel-reveal.png](word/letterwheel-reveal.png) |  |

## Number (6)

| Game id | Name | Intro | Mid-play | Reveal | Notes |
|---|---|---|---|---|---|
| `balance` | Counterweight | [number/balance-intro.png](number/balance-intro.png) | [number/balance-play.png](number/balance-play.png) | [number/balance-reveal.png](number/balance-reveal.png) |  |
| `target` | Exact | [number/target-intro.png](number/target-intro.png) | [number/target-play.png](number/target-play.png) | [number/target-reveal.png](number/target-reveal.png) |  |
| `equation` | Operator | [number/equation-intro.png](number/equation-intro.png) | [number/equation-play.png](number/equation-play.png) | [number/equation-reveal.png](number/equation-reveal.png) |  |
| `tendrop` | Tenfall | [number/tendrop-intro.png](number/tendrop-intro.png) | [number/tendrop-play.png](number/tendrop-play.png) | [number/tendrop-reveal.png](number/tendrop-reveal.png) |  |
| `numpyramid` | Integer Pyramid | [number/numpyramid-intro.png](number/numpyramid-intro.png) | [number/numpyramid-play.png](number/numpyramid-play.png) | [number/numpyramid-reveal.png](number/numpyramid-reveal.png) |  |
| `trail` | Trail | [number/trail-intro.png](number/trail-intro.png) | [number/trail-play.png](number/trail-play.png) | [number/trail-reveal.png](number/trail-reveal.png) |  |

## Speed (6)

| Game id | Name | Intro | Mid-play | Reveal | Notes |
|---|---|---|---|---|---|
| `reaction` | Flash | [speed/reaction-intro.png](speed/reaction-intro.png) | [speed/reaction-play.png](speed/reaction-play.png) | [speed/reaction-reveal.png](speed/reaction-reveal.png) |  |
| `numhunt` | Ascend | [speed/numhunt-intro.png](speed/numhunt-intro.png) | [speed/numhunt-play.png](speed/numhunt-play.png) | [speed/numhunt-reveal.png](speed/numhunt-reveal.png) |  |
| `stopwatch` | Bang On | [speed/stopwatch-intro.png](speed/stopwatch-intro.png) | [speed/stopwatch-play.png](speed/stopwatch-play.png) | [speed/stopwatch-reveal.png](speed/stopwatch-reveal.png) |  |
| `chain` | Don't Break the Chain | [speed/chain-intro.png](speed/chain-intro.png) | [speed/chain-play.png](speed/chain-play.png) | [speed/chain-reveal.png](speed/chain-reveal.png) |  |
| `whack` | Bonk | [speed/whack-intro.png](speed/whack-intro.png) | [speed/whack-play.png](speed/whack-play.png) | [speed/whack-reveal.png](speed/whack-reveal.png) |  |
| `clayshoot` | Pull! | [speed/clayshoot-intro.png](speed/clayshoot-intro.png) | [speed/clayshoot-play.png](speed/clayshoot-play.png) | [speed/clayshoot-reveal.png](speed/clayshoot-reveal.png) |  |

## Attention (7)

| Game id | Name | Intro | Mid-play | Reveal | Notes |
|---|---|---|---|---|---|
| `stroop` | Mixed Signals | [attention/stroop-intro.png](attention/stroop-intro.png) | [attention/stroop-play.png](attention/stroop-play.png) | [attention/stroop-reveal.png](attention/stroop-reveal.png) |  |
| `symscan` | Eagle Eye | [attention/symscan-intro.png](attention/symscan-intro.png) | [attention/symscan-play.png](attention/symscan-play.png) | [attention/symscan-reveal.png](attention/symscan-reveal.png) |  |
| `spotdiff` | Double Take | [attention/spotdiff-intro.png](attention/spotdiff-intro.png) | [attention/spotdiff-play.png](attention/spotdiff-play.png) | [attention/spotdiff-reveal.png](attention/spotdiff-reveal.png) |  |
| `countup` | Tally | [attention/countup-intro.png](attention/countup-intro.png) | [attention/countup-play.png](attention/countup-play.png) | [attention/countup-reveal.png](attention/countup-reveal.png) |  |
| `maze` | Labyrinth | [attention/maze-intro.png](attention/maze-intro.png) | [attention/maze-play.png](attention/maze-play.png) | [attention/maze-reveal.png](attention/maze-reveal.png) |  |
| `intruder` | Interloper | [attention/intruder-intro.png](attention/intruder-intro.png) | [attention/intruder-play.png](attention/intruder-play.png) | [attention/intruder-reveal.png](attention/intruder-reveal.png) |  |
| `pairmatch` | Matchmaker | [attention/pairmatch-intro.png](attention/pairmatch-intro.png) | [attention/pairmatch-play.png](attention/pairmatch-play.png) | [attention/pairmatch-reveal.png](attention/pairmatch-reveal.png) |  |

## Pattern (7)

| Game id | Name | Intro | Mid-play | Reveal | Notes |
|---|---|---|---|---|---|
| `unblock` | Gridlock | — | — | — | **Not rendered:** The server could not generate the puzzle. Unblock boards come from the Supabase unblock_bank table, read with the service-role client, and this container has no SUPABASE_SERVICE_ROLE_KEY (the server reported "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY"), so practice stays on "Making a puzzle". The Supabase host is also unreachable from this container. |
| `blockparty` | Tessellate | [pattern/blockparty-intro.png](pattern/blockparty-intro.png) | [pattern/blockparty-play.png](pattern/blockparty-play.png) | [pattern/blockparty-reveal.png](pattern/blockparty-reveal.png) |  |
| `iceslide` | Skid | [pattern/iceslide-intro.png](pattern/iceslide-intro.png) | [pattern/iceslide-play.png](pattern/iceslide-play.png) | [pattern/iceslide-reveal.png](pattern/iceslide-reveal.png) |  |
| `laser` | Lightbender | [pattern/laser-intro.png](pattern/laser-intro.png) | [pattern/laser-play.png](pattern/laser-play.png) | [pattern/laser-reveal.png](pattern/laser-reveal.png) |  |
| `gravity` | Topsy-Turvy | [pattern/gravity-intro.png](pattern/gravity-intro.png) | [pattern/gravity-play.png](pattern/gravity-play.png) | [pattern/gravity-reveal.png](pattern/gravity-reveal.png) |  |
| `tiles` | Jumbled | [pattern/tiles-intro.png](pattern/tiles-intro.png) | [pattern/tiles-play.png](pattern/tiles-play.png) | [pattern/tiles-reveal.png](pattern/tiles-reveal.png) |  |
| `rings` | Turntable | [pattern/rings-intro.png](pattern/rings-intro.png) | [pattern/rings-play.png](pattern/rings-play.png) | [pattern/rings-reveal.png](pattern/rings-reveal.png) |  |

## Logic (14)

| Game id | Name | Intro | Mid-play | Reveal | Notes |
|---|---|---|---|---|---|
| `lightsout` | Blackout | [logic/lightsout-intro.png](logic/lightsout-intro.png) | [logic/lightsout-play.png](logic/lightsout-play.png) | [logic/lightsout-reveal.png](logic/lightsout-reveal.png) |  |
| `pipes` | Pipeline | [logic/pipes-intro.png](logic/pipes-intro.png) | [logic/pipes-play.png](logic/pipes-play.png) | [logic/pipes-reveal.png](logic/pipes-reveal.png) |  |
| `sudoku` | Box Six | [logic/sudoku-intro.png](logic/sudoku-intro.png) | [logic/sudoku-play.png](logic/sudoku-play.png) | [logic/sudoku-reveal.png](logic/sudoku-reveal.png) |  |
| `flow` | Chroma Lines | [logic/flow-intro.png](logic/flow-intro.png) | [logic/flow-play.png](logic/flow-play.png) | [logic/flow-reveal.png](logic/flow-reveal.png) |  |
| `push` | Heave | [logic/push-intro.png](logic/push-intro.png) | [logic/push-play.png](logic/push-play.png) | [logic/push-reveal.png](logic/push-reveal.png) |  |
| `tower` | Hanoi | [logic/tower-intro.png](logic/tower-intro.png) | [logic/tower-play.png](logic/tower-play.png) | [logic/tower-reveal.png](logic/tower-reveal.png) |  |
| `tubes` | Polypotions | [logic/tubes-intro.png](logic/tubes-intro.png) | [logic/tubes-play.png](logic/tubes-play.png) | [logic/tubes-reveal.png](logic/tubes-reveal.png) |  |
| `safe` | Safe Cracker | [logic/safe-intro.png](logic/safe-intro.png) | [logic/safe-play.png](logic/safe-play.png) | [logic/safe-reveal.png](logic/safe-reveal.png) |  |
| `bomb` | Bomb Defusal | [logic/bomb-intro.png](logic/bomb-intro.png) | [logic/bomb-play.png](logic/bomb-play.png) | [logic/bomb-reveal.png](logic/bomb-reveal.png) |  |
| `nonogram` | Mosaic | [logic/nonogram-intro.png](logic/nonogram-intro.png) | [logic/nonogram-play.png](logic/nonogram-play.png) | [logic/nonogram-reveal.png](logic/nonogram-reveal.png) |  |
| `flood` | Colour Flood | [logic/flood-intro.png](logic/flood-intro.png) | [logic/flood-play.png](logic/flood-play.png) | [logic/flood-reveal.png](logic/flood-reveal.png) |  |
| `tents` | Tents and Trees | [logic/tents-intro.png](logic/tents-intro.png) | [logic/tents-play.png](logic/tents-play.png) | [logic/tents-reveal.png](logic/tents-reveal.png) |  |
| `shikaku` | Shikaku | [logic/shikaku-intro.png](logic/shikaku-intro.png) | [logic/shikaku-play.png](logic/shikaku-play.png) | [logic/shikaku-reveal.png](logic/shikaku-reveal.png) |  |
| `lightup` | Lamplighter | [logic/lightup-intro.png](logic/lightup-intro.png) | [logic/lightup-play.png](logic/lightup-play.png) | [logic/lightup-reveal.png](logic/lightup-reveal.png) |  |

## Arcade (22)

| Game id | Name | Intro | Mid-play | Reveal | Notes |
|---|---|---|---|---|---|
| `hover` | Hover | [arcade/hover-intro.png](arcade/hover-intro.png) | [arcade/hover-play.png](arcade/hover-play.png) | [arcade/hover-reveal.png](arcade/hover-reveal.png) | The run had already ended (no input) before 10 s; mid-play shows the end of the run. |
| `skyline` | High Rise | [arcade/skyline-intro.png](arcade/skyline-intro.png) | [arcade/skyline-play.png](arcade/skyline-play.png) | [arcade/skyline-reveal.png](arcade/skyline-reveal.png) |  |
| `bintoss` | Swish | [arcade/bintoss-intro.png](arcade/bintoss-intro.png) | [arcade/bintoss-play.png](arcade/bintoss-play.png) | [arcade/bintoss-reveal.png](arcade/bintoss-reveal.png) |  |
| `bullseye` | Flightpath | [arcade/bullseye-intro.png](arcade/bullseye-intro.png) | [arcade/bullseye-play.png](arcade/bullseye-play.png) | [arcade/bullseye-reveal.png](arcade/bullseye-reveal.png) |  |
| `matchup` | Gemstone | [arcade/matchup-intro.png](arcade/matchup-intro.png) | [arcade/matchup-play.png](arcade/matchup-play.png) | [arcade/matchup-reveal.png](arcade/matchup-reveal.png) |  |
| `breaker` | Breaker | [arcade/breaker-intro.png](arcade/breaker-intro.png) | [arcade/breaker-play.png](arcade/breaker-play.png) | [arcade/breaker-reveal.png](arcade/breaker-reveal.png) |  |
| `rally` | Rally | [arcade/rally-intro.png](arcade/rally-intro.png) | [arcade/rally-play.png](arcade/rally-play.png) | [arcade/rally-reveal.png](arcade/rally-reveal.png) | The run had already ended (no input) before 10 s; mid-play shows the end of the run. |
| `slice` | Slice | [arcade/slice-intro.png](arcade/slice-intro.png) | [arcade/slice-play.png](arcade/slice-play.png) | [arcade/slice-reveal.png](arcade/slice-reveal.png) |  |
| `bubble` | Coral Pop | [arcade/bubble-intro.png](arcade/bubble-intro.png) | [arcade/bubble-play.png](arcade/bubble-play.png) | [arcade/bubble-reveal.png](arcade/bubble-reveal.png) |  |
| `beat` | Tempo | [arcade/beat-intro.png](arcade/beat-intro.png) | [arcade/beat-play.png](arcade/beat-play.png) | [arcade/beat-reveal.png](arcade/beat-reveal.png) |  |
| `snake` | Meteor | [arcade/snake-intro.png](arcade/snake-intro.png) | [arcade/snake-play.png](arcade/snake-play.png) | [arcade/snake-reveal.png](arcade/snake-reveal.png) | The run had already ended (no input) before 10 s; mid-play shows the end of the run. |
| `cross` | Jaywalk | [arcade/cross-intro.png](arcade/cross-intro.png) | [arcade/cross-play.png](arcade/cross-play.png) | [arcade/cross-reveal.png](arcade/cross-reveal.png) |  |
| `wavefront` | Wavefront | [arcade/wavefront-intro.png](arcade/wavefront-intro.png) | [arcade/wavefront-play.png](arcade/wavefront-play.png) | [arcade/wavefront-reveal.png](arcade/wavefront-reveal.png) |  |
| `flip` | Roofbound | [arcade/flip-intro.png](arcade/flip-intro.png) | [arcade/flip-play.png](arcade/flip-play.png) | [arcade/flip-reveal.png](arcade/flip-reveal.png) | The run had already ended (no input) before 10 s; mid-play shows the end of the run. |
| `junction` | Junction | [arcade/junction-intro.png](arcade/junction-intro.png) | [arcade/junction-play.png](arcade/junction-play.png) | [arcade/junction-reveal.png](arcade/junction-reveal.png) |  |
| `inkbridge` | Rainbow Bridge | [arcade/inkbridge-intro.png](arcade/inkbridge-intro.png) | [arcade/inkbridge-play.png](arcade/inkbridge-play.png) | [arcade/inkbridge-reveal.png](arcade/inkbridge-reveal.png) |  |
| `burst` | Fission | [arcade/burst-intro.png](arcade/burst-intro.png) | [arcade/burst-play.png](arcade/burst-play.png) | [arcade/burst-reveal.png](arcade/burst-reveal.png) |  |
| `orbit` | Orbit | [arcade/orbit-intro.png](arcade/orbit-intro.png) | [arcade/orbit-play.png](arcade/orbit-play.png) | [arcade/orbit-reveal.png](arcade/orbit-reveal.png) |  |
| `swing` | Grappler | [arcade/swing-intro.png](arcade/swing-intro.png) | [arcade/swing-play.png](arcade/swing-play.png) | [arcade/swing-reveal.png](arcade/swing-reveal.png) |  |
| `snip` | Scrumper | [arcade/snip-intro.png](arcade/snip-intro.png) | [arcade/snip-play.png](arcade/snip-play.png) | [arcade/snip-reveal.png](arcade/snip-reveal.png) |  |
| `tilt` | Tilt | [arcade/tilt-intro.png](arcade/tilt-intro.png) | [arcade/tilt-play.png](arcade/tilt-play.png) | [arcade/tilt-reveal.png](arcade/tilt-reveal.png) |  |
| `balltrack` | Ball Tracker | [arcade/balltrack-intro.png](arcade/balltrack-intro.png) | [arcade/balltrack-play.png](arcade/balltrack-play.png) | [arcade/balltrack-reveal.png](arcade/balltrack-reveal.png) |  |

## Room screens

| Screen | File |
|---|---|
| Home | [room/home.png](room/home.png) |
| Lobby (host view) | [room/lobby.png](room/lobby.png) |
| Round results (round 3) | [room/round-results.png](room/round-results.png) |
| Overall standings (after round 3 of 5) | [room/standings.png](room/standings.png) |
| Podium (final) | [room/podium.png](room/podium.png) |

## Contact sheets

Review sheets in `sheets/`. Each game gets one row (intro, mid-play and reveal side by side, scaled to 83 %) with its display name and id above it. Each sheet holds at most 6 games: a category is split evenly across sheets, and the long side stays under 4,000 px. Gridlock (`unblock`) appears as a labelled empty row. The room sheet shows the five room screens at full size in one row.

| Sheet | Size (px) | Games |
|---|---|---|
| [sheets/word-1.png](sheets/word-1.png) | 1052 × 3918 | Nucleus (`wordsmith`), Interlock (`tilegrid`), Slider (`wordslide`), Forage (`wordhunt`), Lookout (`wordsearch`), Roundabout (`letterwheel`) |
| [sheets/number-1.png](sheets/number-1.png) | 1052 × 3918 | Counterweight (`balance`), Exact (`target`), Operator (`equation`), Tenfall (`tendrop`), Integer Pyramid (`numpyramid`), Trail (`trail`) |
| [sheets/speed-1.png](sheets/speed-1.png) | 1052 × 3918 | Flash (`reaction`), Ascend (`numhunt`), Bang On (`stopwatch`), Don't Break the Chain (`chain`), Bonk (`whack`), Pull! (`clayshoot`) |
| [sheets/attention-1.png](sheets/attention-1.png) | 1052 × 2636 | Mixed Signals (`stroop`), Eagle Eye (`symscan`), Double Take (`spotdiff`), Tally (`countup`) |
| [sheets/attention-2.png](sheets/attention-2.png) | 1052 × 1995 | Labyrinth (`maze`), Interloper (`intruder`), Matchmaker (`pairmatch`) |
| [sheets/pattern-1.png](sheets/pattern-1.png) | 1052 × 2636 | Gridlock (`unblock`), Tessellate (`blockparty`), Skid (`iceslide`), Lightbender (`laser`) |
| [sheets/pattern-2.png](sheets/pattern-2.png) | 1052 × 1995 | Topsy-Turvy (`gravity`), Jumbled (`tiles`), Turntable (`rings`) |
| [sheets/logic-1.png](sheets/logic-1.png) | 1052 × 3277 | Blackout (`lightsout`), Pipeline (`pipes`), Box Six (`sudoku`), Chroma Lines (`flow`), Heave (`push`) |
| [sheets/logic-2.png](sheets/logic-2.png) | 1052 × 3277 | Hanoi (`tower`), Polypotions (`tubes`), Safe Cracker (`safe`), Bomb Defusal (`bomb`), Mosaic (`nonogram`) |
| [sheets/logic-3.png](sheets/logic-3.png) | 1052 × 2636 | Colour Flood (`flood`), Tents and Trees (`tents`), Shikaku (`shikaku`), Lamplighter (`lightup`) |
| [sheets/arcade-1.png](sheets/arcade-1.png) | 1052 × 3918 | Hover (`hover`), High Rise (`skyline`), Swish (`bintoss`), Flightpath (`bullseye`), Gemstone (`matchup`), Breaker (`breaker`) |
| [sheets/arcade-2.png](sheets/arcade-2.png) | 1052 × 3918 | Rally (`rally`), Slice (`slice`), Coral Pop (`bubble`), Tempo (`beat`), Meteor (`snake`), Jaywalk (`cross`) |
| [sheets/arcade-3.png](sheets/arcade-3.png) | 1052 × 3277 | Wavefront (`wavefront`), Roofbound (`flip`), Junction (`junction`), Rainbow Bridge (`inkbridge`), Fission (`burst`) |
| [sheets/arcade-4.png](sheets/arcade-4.png) | 1052 × 3277 | Orbit (`orbit`), Grappler (`swing`), Scrumper (`snip`), Tilt (`tilt`), Ball Tracker (`balltrack`) |
| [sheets/room-1.png](sheets/room-1.png) | 2062 × 832 | Home, Lobby, Round results, Overall standings, Podium |

## Games that couldn't be rendered

- `unblock` (Gridlock, pattern): The server could not generate the puzzle. Unblock boards come from the Supabase unblock_bank table, read with the service-role client, and this container has no SUPABASE_SERVICE_ROLE_KEY (the server reported "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY"), so practice stays on "Making a puzzle". The Supabase host is also unreachable from this container.

Total: 206 screenshots plus 15 contact sheets (221 PNG files).
