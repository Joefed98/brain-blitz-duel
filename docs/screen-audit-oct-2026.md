# Screen audit (16 Oct 2026)

A docs-only audit of every screen at **414 × 896 as an iPhone 11 home-screen app** (48 px notch, 34 px home bar,
laid out 848 px short, `navigator.standalone`) and at **390 × 844** (47 / 34 px insets, browser). No app code was
changed. The findings feed the fix-up prompts at the end of this file. Joe does all device testing: everything
here was drawn in headless Chromium and measured in code, not seen on a phone.

Screenshots (JPEG, 414 px wide, the 414 × 896 frames show the full physical screen with the notch and home-bar lines
drawn in red) are in [`screen-audit-oct-2026/`](screen-audit-oct-2026/). The folder holds only screens with
issues plus one example of each screen type (`ex-*` files).

**Severity:** **Must** = must fix before the beta. **Nice** = nice to have.

## How it was done

- **Coverage.** All 74 active games (`ACTIVE_PUZZLE_TYPES`), at both sizes: practice intro, practice in-game,
  practice answer reveal, room intro, room in-game, room answer reveal and room round results (1,036 frames).
  Intro demos: the harness serves no recorded demo, so every intro shows the demo's still frame.
  The rest of the app at both sizes: home (plus the create and join forms), onboarding (3 cards), the practice
  list (top and end), the sound settings popover, two help sheets (a puzzle and an arcade game), the lobby (host
  with 1, 2 and 10 players, a guest, long names), link join, chat (closed with unread, open empty, open with
  messages), loading and disbanded, Prepare to Duel, round titles (round 2 and the final round), round results
  (2 and 10 players), standings (2, 3 and 10 players), winner reveal (2 and 3 players), final results (2 players,
  host and guest) and the podium (3 players host, 10 players guest), including Play again.
- **Harness.** The real routes and components through a copy of `scripts/safe-area-harness.tsx` (network edge
  stubbed, as safe-area-screens-check does) with `scripts/device-emulation.ts` for the device geometry. Puzzles are
  real (`generatePuzzle`, seed 41); room states are built per screen. The harness and capture script were kept out
  of the repo (`.shots/`, gitignored).
- **Measured on every frame:** text and controls under the notch or home bar, controls covered by another element,
  tap targets under 44 px, text under 11 px, text contrast (WCAG: 4.5:1, or 3:1 for large text), text that
  overlaps other text, text cut off by an ellipsis or clipping, anything off the side of the screen, horizontal
  scrolling and repeated text. Every 414 × 896 frame was then looked at (one contact sheet per game). The
  390 × 844 frames were checked by the measurements, and their sheets were spot-checked.
- **Wording:** every active game's goal, how and score lines (`instructions.ts`), display names, in-game strings,
  reveal and results summaries (`roundSummaries.ts`, `nearMiss.ts`) and the room and home screens were read for
  plain wording, British spelling, capitalisation, one word per thing, and repeated wording.

### Assumptions and limits

- **Reveals are timed-out runs with no answer** (0 points). Round results use placeholder scores; their green
  "✓ Correct" flag comes from the placeholder and can contradict the summary ("Correct · 0 / 23 cells"). Ignore
  that contradiction; it is not an app bug.
- **Slider's in-game screen was not captured:** it calls the move checker on mount, which the stubbed harness
  cannot answer. Its intro, reveal and results were captured.
- **Room not found / not in this room** showed the link-join screen, because the harness's link preview always
  finds the room. Those states' wording was read in code instead.
- **Arcade practice runs log "client/server desync"** in the console: the stubbed server returns no checkpoint.
  That is a harness artefact, not an app error.
- **Canvas text** (arcade HUDs and in-world labels) is not measured for size or contrast; it was only looked at.
- **Room screens use 3 players** unless a row says otherwise. Display names are short ("Joe", "Sam") except in the
  long-names lobby.
- In the home-screen app the layout viewport is 414 × 848. The app extends only the arcade play screens by the
  48 px shortfall (`--standalone-short`); on every other screen the bottom 48 px of the physical screen is plain
  page background, so those frames are padded to 896 px with the page colour. Measurements use the physical
  896 px screen.
- **Disabled buttons** (Undo, Reset, Submit before any input) are reported for contrast but marked Nice: WCAG
  exempts disabled controls.
- **Arcade controls in the home-bar zone** (the lowest control row ends 16 px above the bottom by design,
  CLAUDE.md "Arcade play screen") are not reported as defects. One decision for Joe is listed under
  "In-game (arcade)".

### Checks

Only docs changed, so no app check is relevant and none was run locally. The PR touches only `docs/**`, which the
Checks workflow skips.

---

## App-wide issues (apply to every game)

These show on every game's screens, so they are listed once here and not repeated in the per-game tables.

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| All | **Practice reveal says "Round 1 of 6"** in its header, though practice is a single game ([iss-practice-reveal-round](screen-audit-oct-2026/iss-practice-reveal-round.jpg)). | Must | Pass a `practice` flag; show "Practice" in place of the round. | `src/routes/practice.tsx`, `src/components/duel/AnswerReveal.tsx` |
| All 22 arcade + 5 engine games | **The game shows through the arcade reveal**: its HUD text ("pts", "Throw 1 / 10", "SORT BY INK", "Sta…") sits half-faded behind "0 POINTS" ([iss-arcade-reveal-bleed](screen-audit-oct-2026/iss-arcade-reveal-bleed.jpg)). | Must | Make the reveal's backdrop opaque over the top 30 % (or crop the frozen world below the score) so no world text sits behind it. | `src/components/duel/ArcadeReveal.tsx` |
| All | The room reveal's top-right number ("0s", "6s") has no label. | Nice | "Next in 6 s", or drop it. | `src/components/duel/AnswerReveal.tsx` |
| All | **Help "?" button is 28 × 28** on every play screen. | Must | 44 × 44 hit area (keep the 28 px circle drawn inside). | `src/components/duel/PuzzleInstructions.tsx` (`PuzzleHelpButton`) |
| All | **Sound controls:** mute buttons 36 × 36; the volume chevrons **16 × 36** on every screen. | Must | 44 px hit areas; one chevron per control is enough if room is short. | `src/components/duel/MuteToggle.tsx` |
| All | Intro "← Back" (practice) is 65 × 32. | Nice | `min-h-11`. | `src/components/duel/RoundIntro.tsx` |
| All | **Text under 11 px on every intro:** the GOAL / HOW / SCORE labels and "· word" category are 10 px; "auto-start in 28s" is 11.2 px at 3.87:1. | Must | 11 px minimum; lift the countdown to `text-foreground/70`. | `src/components/duel/RoundIntro.tsx`, `src/components/duel/PuzzleInstructions.tsx` |
| All arcade | The arcade header's game name ("Gemstone", "Tilt") is 10 px, and longer names ellipsise at 414 px: "Mixed Sign…", "Rainbow B…" ([iss-mixed-signals-header](screen-audit-oct-2026/iss-mixed-signals-header.jpg)). | Nice | 11 px; prefer the "Round 2 of 6 / name" two-line form before the compact form at 414 px. | `src/components/duel/RoundLabel.tsx` |
| All puzzles | **Play and reveal screens use 4 px side margins**, where every other screen uses 20 px: logo, "ROUND 2 OF 6", score pill and reveal lists sit 4 px from the edge (Nucleus and Forage "YOU MISSED" columns, Forage "POINTS 0 … WORDS: 0", Lightbender "FIRES LEFT: 3"). | Nice | 12–16 px for text rows (boards may stay wide). | `src/components/duel/PhoneShell.tsx`, `src/polish-layout/bottom.css` |
| All (home-screen app) | Only arcade play screens are extended by the 48 px shortfall, so every other screen (intros, reveals, results, lobby, home) ends 48 px above the physical bottom: READY and Continue sit about 80 px above the bottom there, against 16 px on arcade play. | Nice | Apply `--standalone-short` to every `.game-viewport` / PhoneShell screen, or accept it (device test first). | `src/components/duel/PhoneShell.tsx`, `src/polish-layout/bottom.css` |
| All | Disabled buttons fall to 1.9–2.6:1 (Undo / Reset in Gridlock, Skid, Heave, Lightbender; Clear / Enter in Nucleus, Interlock; Submit in Forage; Throw in Checkout). | Nice | Disabled opacity 0.6 not 0.5. | `src/components/ui/button.tsx` |
| All | The room intro shows the chat composer under READY, so the intro has two bottom bars. | Nice | Hide the composer on the intro (keep the unread badge). | `src/components/duel/RoomChat.tsx` |

## Intro (practice and room, including stopped demos)

Example: [ex-intro-practice](screen-audit-oct-2026/ex-intro-practice.jpg), [ex-intro-room](screen-audit-oct-2026/ex-intro-room.jpg).

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| Fission, Wavefront, Tempo, Breaker, Rally, Slice, Coral Pop, Mixed Signals, Pull!, Grappler, Orbit, Ball Tracker, Strikeout (demos stopped by revision in `introDemo.functions.ts`) | **A stopped demo shows its still first frame with a "DEMO" tag that never moves.** For Fission it is an empty black playfield, for Wavefront just "WAVE 1", for Tempo an empty lane strip ([iss-stopped-demo-fission](screen-audit-oct-2026/iss-stopped-demo-fission.jpg)). Games whose demo is not stopped show the same still while no recording is available, and some are near empty too: Hover a black box with one dot, Tenfall bare columns ([-hover](screen-audit-oct-2026/iss-stopped-demo-hover.jpg), [-tenfall](screen-audit-oct-2026/iss-stopped-demo-tenfall.jpg)). The harness served no recordings, so whether those games' recorded demos play was not checked. | Must | Re-record the stopped demos on the tall revisions. Until then, show a mid-game still (or the static `IntroExample`) without the DEMO tag. | `src/components/duel/IntroDemo.tsx`, `src/lib/duel/introDemo.functions.ts` |
| Pull! | **An all-caps mono paragraph above GOAL** ("14–16 BIRDS CROSS: DON'T SHOOT THEM — EACH ONE COSTS 10. AIM: AFTER 30 SHOTS…") repeats the how and score lines and is hard to read ([iss-pull-intro](screen-audit-oct-2026/iss-pull-intro.jpg)). | Must | Drop the `introLine` (the how line already says "Don't shoot the 14–16 white birds"), or shorten it to one sentence-case line. | `src/puzzles/clayShoot.tsx` |
| Hanoi | The "4 POSTS" chip sits between the title and GOAL, unlike every other intro. | Nice | Move it into the how lines or the example caption. | `src/puzzles/tower.tsx` |
| Arcade (all) | The example is a narrow phone-shaped frame with a lot of empty space beside it; the Score block sits far below. | Nice | Wider example (or the score line beside it). | `src/components/duel/RoundIntro.tsx` |
| Shikaku | The intro example is ten stacked "10" bars and doesn't show what a cut grid looks like. | Nice | A 4 × 4 example with two or three rectangles. | `src/puzzles/shikaku.tsx` |
| Safe Cracker | The example clues ("① is even") are about 9 px. | Nice | 11 px. | `src/puzzles/safeCracker.tsx` |
| Eagle Eye, Tally | Four how lines on the intro (meant to be three). | Must | Mark the 4th `helpOnly`. | `src/lib/duel/instructions.ts` |
| Jaywalk, Pinball, Slice (2), Roofbound (2), Ball Tracker (2), Strikeout | How lines over about 70 characters (81–107) wrap to 2–3 lines on a phone. | Must | Shorten (suggested text in "Wording"). | `src/lib/duel/instructions.ts` |
| Scrumper | Score says "each leaf 2" but no how line mentions leaves. | Must | Add "Grab leaves for +2". | `src/lib/duel/instructions.ts` |
| Room intro (all) | "Round 6 of 6" on the final round's intro, while the play header says "Final round". | Nice | "Final round" on the intro too. | `src/components/duel/RoundIntro.tsx` |

## In-game (practice and room)

Examples: puzzle in a room [ex-play-puzzle-room](screen-audit-oct-2026/ex-play-puzzle-room.jpg), arcade in a room
[ex-play-arcade-room](screen-audit-oct-2026/ex-play-arcade-room.jpg).

### Puzzles

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| Bomb Defusal | **Wires are 26 px tall tap targets**; A / B buttons 40 × 40; DEFUSE 36 tall ([iss-bomb-play](screen-audit-oct-2026/iss-bomb-play.jpg)). | Must | 44 px hit areas (wire rows can stay drawn thin). | `src/puzzles/bombDefusal.tsx` |
| Tally | **Keypad keys 35 × 36** (the only input). | Must | Two rows of keys at 44 px, or full-width keys. | `src/puzzles/countUp.tsx` |
| Safe Cracker | **Dial Up / Down arrows 36 × 36** (the only input). | Must | 44 × 44. | `src/puzzles/safeCracker.tsx` |
| Checkout | Target chips (89, 104…) 76 × 36. | Nice | 44 tall. | `src/puzzles/checkout.tsx` |
| Cryptogrid | The number-to-letter strip keys are 23 × 31 and their numbers about 8 px; the grid's clue numbers are under 11 px. | Nice | Bigger strip or make it display-only; clue numbers 10→11 px where the cell allows. | `src/puzzles/codeword.tsx` |
| Strikeout | Keyboard keys 37–40 px wide (QWERTY on a phone). | Nice | Acceptable for a full keyboard; keep 44 tall. | `src/components/puzzles/LetterKeypad.tsx` |
| Nucleus | "WORDS 0 / 79" button is 33 px tall. | Nice | 44. | `src/puzzles/wordsmith.tsx` |
| Lightbender | "FIRES LEFT: 3" wraps to two lines against the right edge ([iss-lightbender-play](screen-audit-oct-2026/iss-lightbender-play.jpg)). | Nice | "3 fires left" on one line. | `src/puzzles/laser.tsx` |
| Cryptogrid | In-game hint "TAP A SQUARE, THEN A LETTER" repeats the intro's how line word for word ([iss-cryptogrid-play](screen-audit-oct-2026/iss-cryptogrid-play.jpg)). | Nice | Show it only until the first tap. | `src/puzzles/codeword.tsx` |
| Strikeout | "TAP A LETTER · SOLVE TO GUESS THE WORD" repeats the intro. | Nice | As above. | `src/puzzles/strikeout.tsx` |
| Gridlock | "GET THE GOLD BLOCK OUT" repeats the goal. | Nice | Drop it or show "Moves 0 · min 17". | `src/components/puzzles/UnblockPuzzle.tsx` |
| Matchmaker, Turntable | Counters in lower case mono ("pairs 0 / 15 · flips 0") where others are upper case ("MOVES 0"). | Nice | One style. | `src/puzzles/pairMatch.tsx`, `src/puzzles/rotatingRings.tsx` |
| Slider | In-game not captured (see limits). | — | — | — |

### Arcade

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| Swish | "drag here to cancel" is about 10 px, 2.78:1, and 16 px above the bottom: inside the home-bar zone ([iss-swish-play](screen-audit-oct-2026/iss-swish-play.jpg)). | Nice | 12 px at 4.5:1, above the control row. | `src/puzzles/binToss.tsx` |
| Ball Tracker | Cup labels ("0 home", "29 to drop") are 22 px above the bottom, in the home-bar zone. | Nice | Move above the cups. | `src/puzzles/ballTrack.tsx` |
| Roofbound | After a run ends early in a room, "Waiting for other players" floats over the world without the LOCKED stamp that Hover and Meteor show ([iss-roofbound-wait](screen-audit-oct-2026/iss-roofbound-wait.jpg)), and overlaps the runner. | Nice | Same LOCKED card as other games, on a scrim. | `src/routes/duel.$code.tsx` (lock overlay) |
| Rally | HUD reads "GOLD 0 0PTS" (no space or separator). | Nice | "Gold 0 · 0 pts". | `src/lib/arcade/rally.renderer.ts` |
| Orbit | "Planets 0 / 40" is drawn over the first planet. | Nice | Draw the HUD on a band, or offset the course. | `src/lib/arcade/orbit.renderer.ts` |
| Gemstone, Flightpath, Rally | HUDs say "pts"; everywhere else says "points". | Nice | "points", or "pts" everywhere. | `src/lib/arcade/matchup.renderer.ts`, `bullseye.renderer.ts`, `rally.renderer.ts` |
| All arcade | **Decision for Joe:** the lowest control row ends 16 px above the bottom, inside iOS's 34 px home-indicator zone, where an upward swipe goes home. This is deliberate (biggest world), but Jaywalk, Mixed Signals, Fission, Rainbow Bridge and Orbit put buttons there. | Nice | Keep (device test), or end controls at 34 + 8 px only for games with swipe-up input. | `src/polish-layout/bottom.css` |

## Answer reveal (practice and room)

Example: [ex-reveal-puzzle](screen-audit-oct-2026/ex-reveal-puzzle.jpg). App-wide reveal issues are above.

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| Counterweight | **"One balanced way: …" text is overlapped by the kettlebells** of the next scale ("One b▢lanced way") ([iss-balance-reveal](screen-audit-oct-2026/iss-balance-reveal.jpg)). | Must | Give each scale's caption its own row below the beam, with spacing for the hanging weights. | `src/puzzles/balance.tsx` |
| Double Take | **"A ice cream cone became a candy cane"** (should be "An"); four rows of just "A sweet changed colour" ([iss-doubletake-reveal](screen-audit-oct-2026/iss-doubletake-reveal.jpg)). | Must | Pick "a"/"an" when the label is drawn (the stored label stays as is); name the sweet. | `src/puzzles/spotTheDifference.tsx` |
| Interlock | **"0 / 15 · invalid at the timer"** ([iss-interlock-reveal](screen-audit-oct-2026/iss-interlock-reveal.jpg)). | Must | "0 / 15 · not a valid grid when time ran out". | `src/puzzles/tileGrid.tsx` (and `roundSummaries.ts`, Wording batch) |
| Exact | "Target Number Achieved" uses the game's old name and Title Case. | Must | "Target hit!". | `src/puzzles/targetNumber.tsx` |
| Flash | Room reveal before any tap: "YOUR AVERAGE — ms" ([iss-flash-reveal](screen-audit-oct-2026/iss-flash-reveal.jpg)); practice shows "1200 ms" while the rows say "1,200 ms". | Nice | "No taps" instead of "— ms"; one number format. | `src/puzzles/reaction.tsx` |
| Flash, Bang On | Rows use a spaced hyphen: "Flash 1 - missed (1,200 ms)". | Nice | En dash or "·". | `src/puzzles/reaction.tsx`, `src/puzzles/stopWatch.tsx` |
| Exact, Operator, Eagle Eye, Tally | Heading "THE ANSWER WAS" sits over the score ("0 points"), not over the answer. | Nice | Put the score first, then the heading over the answer panel. | `src/components/duel/AnswerReveal.tsx` |
| Hanoi, Polypotions, Topsy-Turvy | "0 ✗ MOVES · MIN 29": the ✗ after the number reads as "0 times". | Nice | "✗ 0 moves · min 29". | `src/puzzles/tower.tsx`, `src/puzzles/sortTubes.tsx`, `src/puzzles/gravityMaze.tsx` |
| Pipeline, Chroma Lines, Lightbender, Tessellate, Turntable, Shikaku, Tents | Panel labels disagree: SOLVED / SOLUTION / ONE SOLUTION; YOURS / YOUR BOARD / "Your result"; Turntable's are sentence case. | Nice | "Solution" and "Yours" everywhere. | `src/puzzles/pipes.tsx`, `flow.tsx`, `laser.tsx`, `blockParty.tsx`, `rotatingRings.tsx`, `shikaku.tsx`, `tents.tsx` |
| Lightbender | Reveal verdict is just "MISSED". | Nice | "Missed: 0 of 6 gems lit". | `src/puzzles/laser.tsx` |
| Nucleus, Forage | "YOU MISSED" two-column word list runs to the screen edges (4 px). | Nice | Covered by the app-wide margin fix. | (app-wide) |
| Colour Flood vs Slider | "Par 11 — you used" vs "Par 6 - you used". | Must | One dash style (Wording batch). | `src/puzzles/colourFlood.tsx`, `src/puzzles/wordSlide.tsx` |
| Don't Break the Chain | Only reveal without the ✗/✓ badge and heading; large empty space. | Nice | Same header as the others. | `src/puzzles/chainTap.tsx` |

## Round results (rooms)

Examples: 2 players [ex-results-2p](screen-audit-oct-2026/ex-results-2p.jpg), 10 players
[ex-results-10p](screen-audit-oct-2026/ex-results-10p.jpg).

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| All (3–9 players) | **Rows stretch to fill the screen**: with 3 players each card is about 170 px tall with its text floating in the middle ([iss-results-stretched](screen-audit-oct-2026/iss-results-stretched.jpg)). | Must · **Done** (Batch 1) | `auto-rows-min` / `content-start` on the grid; let the gap sit below the list. Done: rows take their content's height from the top. | `src/components/duel/RoundResultsTable.tsx`, `src/components/duel/Standings.tsx` |
| 14 arcade games + Interlock, Ballpark | **Summaries are cut with "…"** at 414 px (more at 390): Rally "0 gold hits (2.5 each, ro…", Bonk "Hits 0 / 0 · Wrong 0 · Bo…", Wavefront, Fission, Pinball, Breaker, Coral Pop, Slice, Tempo, Tilt, Gemstone, Hover, Ballpark ([iss-results-truncated](screen-audit-oct-2026/iss-results-truncated.jpg)). | Must · **Done** (Batch 1) (the wrap; shortening stays in Batch 5) | Let the summary wrap to two lines (rows are tall enough), and shorten the long summaries (Wording batch). Done: two lines with up to 8 players; 9–10 players keep one line (the rows would not fit), tap a row for the whole summary as before. Summaries longer than two lines (Rally) still end in "…" until Batch 5 shortens them. | `src/components/duel/RoundResultsTable.tsx` |
| Operator, Brimful, Checkout, Tally, Eagle Eye, Mosaic, Slider | **The round title appends the answer**: "Round 2 · Operator · × − − − × × + + − · × × − ÷" (wraps, unreadable), "Brimful · 6 · 8 · 9 · 11 moves", "Checkout · 2 · 2 · 2 · 3 · 4 darts", "Mosaic · The picture", "Slider · SWIPE · MACRO · PLUNK…" ([iss-results-title-answer](screen-audit-oct-2026/iss-results-title-answer.jpg)). | Must · **Done** (Batch 1) | Title "Round 2 · Operator" only; show `correctAnswer` as its own "Best: 17 moves" line, and only for short answers (moves, a number). Done: the title never carries the answer; "Best: 17 moves" shows only for a single fewest-moves count (moves, presses, pushes, pours, tilts). | `src/routes/duel.$code.tsx` (`roundTitle`) |
| All | **"CONTINUE (5S)"**: the uppercase style turns "5s" into "5S" (also on standings). | Must · **Done** (Batch 1) | Drop `uppercase` on the count, or write "Continue · 5". | `src/components/duel/ContinueFooter.tsx` |
| All | "ROUND RESULTS" plus a corner tag "THIS ROUND" says the same thing twice; the corner tag is 10 px and overlaps the heading's box. | Nice | Drop the corner tag (keep "Final round" as the heading on the last round). | `src/components/duel/RoundResultsTable.tsx`, `src/components/duel/RoundResult.tsx` |
| All | The category tag ("LOGIC", 10 px, top left) sits above results and standings, where it means little. | Nice | Remove it from results and standings. | `src/routes/duel.$code.tsx` |
| All | "ROUND WON" badge is 9 px; "Round results" / "This round" 10 px. | Must · **Done** (Batch 1) | 11 px minimum. | `src/components/duel/RoundResultsTable.tsx`, `src/components/duel/RoundResult.tsx` |
| 2 players | The loser's card is dimmed to 4.36:1 (name) and 3.53:1 ("✓ Correct", 11 px); the summary wraps to three lines in the half-width card; the cards sit at the top with a large empty gap below. | Nice | Dim less (≥ 4.5:1); full-width stacked cards. | `src/components/duel/RoundResult.tsx` |

## Leaderboard (standings)

Example: [ex-standings](screen-audit-oct-2026/ex-standings.jpg).

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| All (3–9 players) | Rows stretch to fill the screen (as round results). | Must · **Done** (Batch 1) | As round results. | `src/components/duel/Standings.tsx` |
| All | "OVERALL STANDINGS" plus corner tag "OVERALL". | Nice | Drop the tag. | `src/components/duel/Standings.tsx`, `src/components/duel/DuelOverall.tsx` |
| All | Legend "▲▼ places moved · +points this round · total" is 10 px and cryptic. | Nice | 11 px; "+130 this round" already explains itself, so drop the legend. | `src/components/duel/Standings.tsx` |
| 2 players | "+130 this round · –" and "#1" (10 px): the trailing "· –" is a movement dash with nothing to say. | Nice | Hide the movement on 2-player standings. | `src/components/duel/DuelOverall.tsx` |

## Final results, winner reveal and Play again

Examples: [ex-final-2p](screen-audit-oct-2026/ex-final-2p.jpg), [ex-podium](screen-audit-oct-2026/ex-podium.jpg),
[ex-winner](screen-audit-oct-2026/ex-winner.jpg).

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| All | "AND THE WINNER IS…" wraps with "IS…" alone on line 2 at 390 and 414 px, and mid-animation the scaled heading box (with its padding) reaches 9 px past both edges of a 390 px screen; the letters stayed on screen in the frames taken ([iss-winner-wrap](screen-audit-oct-2026/iss-winner-wrap.jpg)). | Nice | A deliberate break ("And the winner / is…") and `clamp(26px, 8vw, 44px)`; sentence case in the source with CSS uppercase. | `src/styles.css` (`.winner-reveal-text`), `src/components/duel/WinnerReveal.tsx` |
| 10 players | **The sticky "Waiting for host… / Leave" footer is translucent**: rows 8–10 show through it and through the chat bar ([iss-podium-footer](screen-audit-oct-2026/iss-podium-footer.jpg)). | Must | Opaque `bg-background` on the footer with a short fade above it. | `src/components/duel/Podium.tsx` |
| All | Podium rows ("Joe: 863 points. Show round scores") are 40 px tall. | Nice | 44. | `src/components/duel/Podium.tsx` |
| All | Leaving the room is "HOME" on the 2-player result and "LEAVE" on the podium; guests see "Waiting for host…" on one and "Waiting for the host to play again" on the other. | Nice | "Leave" and "Waiting for the host to play again" on both. | `src/components/duel/FinalResult.tsx`, `src/components/duel/Podium.tsx` |
| 2 players | Game names in the breakdown are all caps and letter-spaced ("DON'T BREAK THE CHAIN"); elsewhere names are Title Case. | Nice | Title Case. | `src/components/duel/FinalResult.tsx` |

## Home, onboarding and practice list

Examples: [ex-home](screen-audit-oct-2026/ex-home.jpg), [ex-onboarding](screen-audit-oct-2026/ex-onboarding.jpg),
[ex-practice-list](screen-audit-oct-2026/ex-practice-list.jpg).

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| Practice list | The list scrolls under the status bar with nothing behind it (game names under the clock at the top of a scroll) ([iss-practice-list-scroll](screen-audit-oct-2026/iss-practice-list-scroll.jpg)). | Nice | A sticky top scrim the height of the inset (or a sticky header). | `src/routes/practice.tsx` |
| Practice list | "One puzzle at a time" heads a list that includes 22 arcade games. | Nice | "One game at a time." | `src/routes/practice.tsx` |
| Home | "Back" on the join and create forms, "Home" on link join, "Back to home" on errors. | Nice | One word ("Back"). | `src/routes/index.tsx`, `src/components/duel/JoinFromLink.tsx`, `src/routes/duel.$code.tsx` |
| Onboarding | No issues found at either size. | — | — | — |

## Room lobby, room header and chat

Examples: [ex-link-join](screen-audit-oct-2026/ex-link-join.jpg), [ex-chat](screen-audit-oct-2026/ex-chat.jpg),
[ex-prepare](screen-audit-oct-2026/ex-prepare.jpg).

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| Lobby (host) | **The sticky START GAME / Disband bar is translucent**: category chips and "Keep at least one category." show through it and between it and the chat bar; at 390 px with long names the chips are drawn below the chat bar, in the home-bar zone ([iss-lobby-footer](screen-audit-oct-2026/iss-lobby-footer.jpg), [iss-lobby-long-names-390](screen-audit-oct-2026/iss-lobby-long-names-390.jpg)). | Must | One opaque sticky footer holding Start, Disband and the chat bar, with `padding-bottom: env(safe-area-inset-bottom)`. | `src/components/duel/RoomLobby.tsx`, `src/components/duel/RoomChat.tsx` |
| Lobby (host, 1 player) | "WAITING FOR 1 MORE PLAYER" (disabled) is 2.42:1 and covers the "6 rounds… about 12 min" line above it ([iss-lobby-one-player](screen-audit-oct-2026/iss-lobby-one-player.jpg)). | Must | Not a disabled button: a plain status line at 4.5:1, with the share buttons as the call to action. | `src/components/duel/RoomLobby.tsx` |
| Lobby (host) | Category chips are 34 px tall; "Disband room" is 20 px tall. | Nice | 44 px. | `src/components/duel/RoomLobby.tsx` |
| Lobby (host) | "🔊 Chat: mute that player's chat for everyone · ×: remove them" is a legend for icons. | Nice | Label the buttons ("Mute", "Remove") or put the legend in the long-press menu. | `src/components/duel/RoomLobby.tsx` |
| Lobby | "HOST" and "YOU" badges are 10 px. | Nice | 11 px. | `src/components/duel/RoomLobby.tsx` |
| Chat | **The button that opens chat shows only the message count ("0")**, no icon or word ([iss-chat-composer-390](screen-audit-oct-2026/iss-chat-composer-390.jpg)). | Must | A chat icon with the count as a badge. | `src/components/duel/RoomChat.tsx` |
| Chat | The placeholder is cut to "Say some" (414) and "Say so" (390) by the six emoji buttons, which are 28 × 44. | Nice | Move reactions into the open sheet, or show three; 44 px each. | `src/components/duel/RoomChat.tsx` |
| Chat (open) | The sheet's scrim button ("Close messages") covers the whole page, including the notch area. That is intended; it is listed only because the measurements flag it. | — | — | — |
| Room header (in-game, puzzles) | The score pill ("JOE 143 1ST OF 3") sits 4 px from the left edge, its text runs together ("143 1ST OF 3"). | Nice | Margin fix (app-wide); a separator between score and place. | `src/components/duel/SoloScoreStrip.tsx` |
| Prepare to Duel, round titles, loading, disbanded | No issues found. | — | — | — |

## Settings and help

Examples: [ex-settings](screen-audit-oct-2026/ex-settings.jpg), [ex-help-sheet](screen-audit-oct-2026/ex-help-sheet.jpg).

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| Sound settings | The popover's slider thumb is 16 × 16 px. | Nice | 28 px thumb with a 44 px hit area. | `src/components/duel/MuteToggle.tsx` |
| Help sheet | Labels GOAL / HOW / SCORE 10 px (as the intro). | Must | With the intro fix. | `src/components/duel/PuzzleInstructions.tsx` |
| Help sheet | "Show puzzle instructions" is used for arcade games too. | Nice | "Show game instructions". | `src/components/duel/PuzzleInstructions.tsx` |

## Error and empty states

| Game | Issue | Severity | Suggested fix | File to change |
|---|---|---|---|---|
| Disbanded | "Room disbanded / The host closed this room. / BACK TO HOME": fine ([ex-disbanded](screen-audit-oct-2026/ex-disbanded.jpg)). | — | — | — |
| Lobby, 1 player | See the lobby table. | — | — | — |
| Chat, empty | "No messages yet." Fine. | — | — | — |
| Leave dialogs | "Leave this game?" (dropout banner) vs "Leave this room?" (lobby). | Nice | "Leave this room?" | `src/components/duel/DropoutBanner.tsx` |

---

## Wording

Read from source (`instructions.ts`, `gameNames.ts`, every active puzzle file, `roundSummaries.ts`,
`nearMiss.ts`, the room and home screens). British spelling is almost clean.

### Must fix

| Game | Issue | Suggested fix | File to change |
|---|---|---|---|
| Labyrinth | Example caption says "You have 45 seconds"; the limit is 60 s (`MAZE_TIME_MS`). | Remove the seconds from the caption (the intro prints the real time). | `src/puzzles/mazeDash.tsx` |
| Rainbow Bridge | Levels are called "rounds", which clashes with the room's rounds: "Reached round N of 10", "Rounds 5-8 move". | "level". | `src/lib/duel/nearMiss.ts`, `src/puzzles/inkBridge.tsx` |
| Scrumper | Results summary says "N sweets · N★"; the game has apples and leaves ([iss-scrumper-results](screen-audit-oct-2026/iss-scrumper-results.jpg)). | "N apples · N leaves". | `src/lib/duel/roundSummaries.ts` |
| Slice | Summary "N bombs hit"; the game has chillies. `slice.tsx` says "cream bottle"; instructions say "mayo". | "N chillies cut"; "mayo bottle". | `src/lib/duel/roundSummaries.ts`, `src/puzzles/slice.tsx` |
| Bonk | Summary "Bombs N", "−3 per wrong ball · −5 per bomb"; the game has hats and hedgehogs. | "Hedgehogs N", "−3 per wrong hat · −5 per hedgehog". | `src/lib/duel/roundSummaries.ts` |
| Swish | Summary "10 per basket"; the game says bucket. | "bucket". | `src/lib/duel/roundSummaries.ts` |
| Rally | Point values disagree: a gold-ball hit "counts 5" in the score text but "× 2.5" in the reveal and HUD; a pink pad "scores 3" in the help and reveal but "6" in the score text. | One value for each, the same in all four places. | `src/lib/duel/instructions.ts`, `src/puzzles/rally.tsx` |
| Breaker, Bullseye, Hover, Swish, Coral Pop, Rainbow Bridge, Orbit, Grappler, Tilt, Ball Tracker | Result detail lines show old score formulas ("floor(1.7 × ring points − 20)", "130 × bricks ÷ 80") that contradict today's score text. | Drop the formula lines, or gate them on the old revision (display only; scores unchanged). | `src/lib/duel/roundSummaries.ts` |
| Nucleus | "floor(2.5 × word points)" in the score text and summary. | "2.5 × word points, rounded down". | `src/lib/duel/instructions.ts`, `src/lib/duel/roundSummaries.ts` |
| All | "game" means the whole match ("Start game", "Leave this game?"), each round's game and practice. | "room" for the session, "game" for a round's title. | `src/components/duel/RoomLobby.tsx`, `src/components/duel/DropoutBanner.tsx`, `src/components/duel/Onboarding.tsx` |
| All | Dashes: spaced hyphen " - " 31 times in instructions and 18 in puzzle UI, em dash 5 times, en dash elsewhere; Colour Flood "Par — you used" vs Slider "Par - you used"; Flightpath goal "Hit the centre - ten darts"; Roofbound goal "Run the corridor - flip…". | Spaced en dash " – " everywhere. | `src/lib/duel/instructions.ts` (Batch 5), then the puzzle files in Batch 6 and 7 |
| Pinball | Help prints "1000" next to "2,500". | `toLocaleString("en-GB")` for both. | `src/lib/duel/instructions.ts` |
| Skid, Blackout, Heave, Gridlock, Hanoi | "Fewer moves earns a bonus" (and presses / pushes). | "earn". | `src/puzzles/iceSlide.tsx`, `lightsOut.tsx`, `push.tsx`, `unblock.tsx`, `tower.tsx` |
| Interlock | "invalid at the timer" (results summary, reveal). | "not a valid grid at time-up". | `src/lib/duel/roundSummaries.ts`, `src/puzzles/tileGrid.tsx` |
| Exact | "Target Number Achieved" (old name, Title Case). | "Target hit!". | `src/puzzles/targetNumber.tsx` |
| Double Take | "A ice cream cone…". | a/an chosen at display. | `src/puzzles/spotTheDifference.tsx` |
| Jaywalk, Pinball, Slice, Roofbound, Ball Tracker, Strikeout | Intro lines of 75–107 characters. Suggested: Jaywalk "Swipe to hop. \| Up goes forward; down and sideways step." / "Bikes from crossing 3, \| cones from 4: find the gap."; Pinball "Hold left or right \| to flip; both thumbs for both."; Slice "Swipe through food. \| 3+ in one swipe: combo ×2, ×3." / "Cut a bottle: \| ketchup, mustard or mayo power-up."; Roofbound "Tap to flip sides; \| run on the side without spikes." / "Cracked tiles break; \| flip off fast."; Ball Tracker "Tap a gold tube \| to turn it." / "Tap a cup's drop \| to close it; tap again to open."; Strikeout "Three vowel guesses \| per word (the dots)." | As given. | `src/lib/duel/instructions.ts` |

### Nice to have

| Game | Issue | Suggested fix | File to change |
|---|---|---|---|
| Orbit | "figure-eight" (American). | "figure of eight". | `src/lib/duel/instructions.ts` |
| Many | Button names in prose mix "Tap FIRE", "Tap Done", "Set Checkpoint". | Title Case in prose ("Tap Fire"). | `src/lib/duel/instructions.ts` |
| Bonk | "Hits · Wrong" capital W mid-line. | "Hits · Misses". | `src/puzzles/whack.tsx` |
| Round titles | "FINAL ROUND", "AND THE WINNER IS…" hard-coded caps (screen readers spell them). | Sentence case + CSS uppercase. | `src/components/duel/RoundTitle.tsx`, `src/components/duel/WinnerReveal.tsx` |
| Tilt | "dark hole" vs "black hole"; "red ball" vs marble. | "black hole", "marble". | `src/lib/duel/instructions.ts`, `src/puzzles/tilt.tsx` |
| Counterweight | kettlebell / weight / peg / notch. | "weight", "notch". | `src/lib/duel/instructions.ts` |
| Skid, Chroma Lines, Heave, Hover, Ascend, Topsy-Turvy | Example captions use other nouns than the intro (chevron / arrows, striped / dark walls, hatched / marked square, saucer / hover, discs / numbers, locked / parked). | Use the intro's noun. | `src/puzzles/iceSlide.tsx`, `flow.tsx`, `push.tsx`, `hover.tsx`, `numberHunt.tsx`, `gravityMaze.tsx` |
| Many | Example captions repeat the intro lines and "You have N seconds" (13 files), which the help sheet then shows twice. | Drop the repeats. | the puzzle files in Batch 6 and 7 |
| Many | Number ranges "1-6", "9-11" (hyphen) vs "words 1–3" (en dash); "Sixty seconds" vs "60 seconds"; "15 s" vs "12.3s". | En dash for ranges; digits; "12.3 s". | `src/lib/duel/instructions.ts`, then the puzzle files in Batch 6 and 7 |
| Checkout | "x1, x2, x3" with the letter x; elsewhere "×". | "×". | `src/puzzles/checkout.tsx` |
| Standings | "▲▼ places moved · +points this round · total" legend. | Drop it. | `src/components/duel/Standings.tsx` |

### Terminology (one word per thing)

| Thing | Variants found | Use |
|---|---|---|
| Confirm button | Submit, Enter, Done, Lock (plus themed: Throw, Try, Solve, Defuse, Place) | Themed verb if there is one, else **Submit** |
| Points | points, pts, units, word points, table points | **points** |
| A failed round | Not solved, Incomplete, Did not finish, Board unfinished, Run ended early, No answer | **Not solved** (puzzles), **Run ended** (arcade) |
| Out of time | Time ran out, Clock ran out, "invalid at the timer" | **Time ran out** |
| The session | game, room, match, duel | **room** |
| A stage within a game | level, round (Rainbow Bridge), maze, board… | anything but **round** |
| Leaving | Leave, Leave room, Home, Back to home, Back | **Leave** (a room), **Back** (a form) |
| Solution panels | Solved, Solution, One solution; Yours, Your board, Your result | **Solution**, **Yours** |

---

## Suggested fix-up batches

Grouped so that **no two batches touch the same file**. Each is a self-contained prompt. Run the named checks
after each; CLAUDE.md's rules still apply (display-only changes need no stamp; nothing here changes scoring,
generation or stored data).

### Batch 1 — Results and standings layout (Must)

Files: `src/components/duel/RoundResultsTable.tsx`, `src/components/duel/RoundResult.tsx`,
`src/components/duel/Standings.tsx`, `src/components/duel/DuelOverall.tsx`,
`src/components/duel/ContinueFooter.tsx`, `src/routes/duel.$code.tsx`.

- Rows no longer stretch (3–9 players); summaries wrap to two lines instead of "…".
- `roundTitle` without the answer; a short "Best: 17 moves" line where the answer is short.
- "Continue (5s)" without the uppercase "5S".
- Drop the "This round" / "Overall" corner tags and the category tag on results and standings; 11 px minimum
  for "Round won" and the remaining labels; 2-player standings without the "· –".
- The Roofbound lock overlay ("Waiting for other players" with the LOCKED card on a scrim).
- "Back" in place of "Back to home" on the room's error screens (same file).
- Checks: safe-area-screens-check, bottom-clearance-check (puzzle parts), room-moments-check.
- **Done (16 Oct 2026), Must rows only:** rows sized to content (results and standings), summaries on two lines,
  the title without the answer plus a "Best:" line, "Continue (5s)", and every label on these screens at 11 px
  ("Round won", "Round results", "This round", "Overall standings", "Overall", the legend, "#1"). The bullets above
  that the tables mark Nice (dropping the corner and category tags, the 2-player "· –", the Roofbound lock overlay,
  "Back") were left for a later pass.

### Batch 2 — Reveal screens (Must)

Files: `src/components/duel/AnswerReveal.tsx`, `src/components/duel/ArcadeReveal.tsx`, `src/routes/practice.tsx`.

- Practice reveal shows "Practice", not "Round 1 of 6".
- Arcade reveal backdrop opaque behind the score (no world HUD text behind "0 POINTS").
- Label the room reveal's countdown; score before the "The answer was" heading.
- Practice list: inset scrim and "One game at a time" (same `practice.tsx`).
- Checks: reveal-score-check, arcade-fx-check, safe-area-screens-check, bottom-clearance-check.

### Batch 3 — Lobby, chat, podium and winner (Must)

Files: `src/components/duel/RoomLobby.tsx`, `src/components/duel/RoomChat.tsx`, `src/components/duel/Podium.tsx`,
`src/components/duel/FinalResult.tsx`, `src/components/duel/WinnerReveal.tsx`, `src/styles.css`,
`src/components/duel/DropoutBanner.tsx`, `src/components/duel/JoinFromLink.tsx`, `src/routes/index.tsx`.

- One opaque sticky footer in the lobby (Start, Disband, chat) padded by the home-bar inset; the 1-player
  "waiting" line as plain text at 4.5:1; chips and Disband 44 px; HOST / YOU 11 px; label Mute / Remove.
- Chat: icon plus count badge; reactions in the sheet or fewer; composer hidden on the intro.
- Podium footer opaque; rows 44 px; "Leave" and "Waiting for the host to play again" on both final screens;
  Title Case game names in the 2-player breakdown.
- (Nice) Winner text with a deliberate line break and a smaller clamp; sentence case source.
- "Leave this room?", "Back" everywhere on forms; "room" for the session in the lobby and dialogs.
- Checks: safe-area-screens-check, room-moments-check.

### Batch 4 — Shared play chrome and tap targets (Must)

Files: `src/components/duel/MuteToggle.tsx`, `src/components/duel/PuzzleInstructions.tsx`,
`src/components/duel/RoundIntro.tsx`, `src/components/duel/RoundLabel.tsx`, `src/components/duel/PhoneShell.tsx`,
`src/components/duel/SoloScoreStrip.tsx`, `src/polish-layout/bottom.css`, `src/components/ui/button.tsx`.

- 44 px hit areas for "?", the mute buttons, the volume chevrons and "← Back"; slider thumb.
- 11 px minimum for GOAL / HOW / SCORE, the category and the arcade header name; countdown contrast.
- 12–16 px side margins for text rows on puzzle play and reveal screens.
- Disabled buttons at 0.6 opacity; "Final round" on the final intro; "Show game instructions".
- Checks: safe-area-screens-check, bottom-clearance-check (all 8 parts), arcade-play-check, arcade-device-bottom-check
  (the header and margins are on every play screen).

### Batch 5 — Wording (Must, then Nice)

Files: `src/lib/duel/instructions.ts`, `src/lib/duel/roundSummaries.ts`, `src/lib/duel/nearMiss.ts`,
`src/components/duel/Onboarding.tsx`, `src/components/duel/RoundTitle.tsx`.

- Everything in "Wording" that lives in these files: shorter intro lines, 4th lines `helpOnly`, Scrumper's leaves,
  Rally's one value, Nucleus "rounded down", Rainbow Bridge "level", Pinball thousands, dashes and ranges,
  Scrumper / Slice / Bonk / Swish nouns in summaries, old formula lines dropped, "invalid at the timer",
  "figure of eight", Tilt / Counterweight nouns, round-title sentence case, "room" in onboarding.
- Display text only: no stored data, scores or stamps change.
- Checks: reveal-score-check, arcade-score-bands-check, the arcade batch and tuning checks that import
  `instructions.ts` (arcade-batch1–5, arcade-input, arcade-tuning-a/c/e/f), and the touched games' own checks.

### Batch 6 — Per-game puzzle screens (Must, then Nice)

Files (puzzle modules only; none is in another batch): `src/puzzles/balance.tsx`, `spotTheDifference.tsx`,
`tileGrid.tsx`, `targetNumber.tsx`, `reaction.tsx`, `stopWatch.tsx`, `bombDefusal.tsx`, `countUp.tsx`,
`safeCracker.tsx`, `checkout.tsx`, `codeword.tsx`, `strikeout.tsx`, `wordsmith.tsx`, `laser.tsx`, `tower.tsx`,
`sortTubes.tsx`, `gravityMaze.tsx`, `pipes.tsx`, `flow.tsx`, `blockParty.tsx`, `rotatingRings.tsx`, `shikaku.tsx`,
`tents.tsx`, `pairMatch.tsx`, `chainTap.tsx`, `colourFlood.tsx`, `wordSlide.tsx`, `mazeDash.tsx`, `iceSlide.tsx`,
`lightsOut.tsx`, `push.tsx`, `unblock.tsx`, `numberHunt.tsx`, `src/components/puzzles/UnblockPuzzle.tsx`,
`src/components/puzzles/LetterKeypad.tsx`.

- Must: Counterweight reveal captions clear of the weights; Double Take a/an; Interlock and Exact wording;
  Bomb wires / A / B / Defuse, Tally keypad and Safe arrows at 44 px; Labyrinth's wrong "45 seconds";
  "Fewer moves earn".
- Nice: Lightbender "3 fires left", Flash "No taps" and number format, ✗ before the count, one solution/yours
  label, in-game hints shown only until the first tap, counters in one case, Chain's reveal header, example
  captions without repeats.
- Checks: each game's own check (e.g. bomb-v3-check, move-limits-check, tap-log-check, codeword-check,
  strikeout-check), reveal-score-check, bottom-clearance-check (puzzle parts).

### Batch 7 — Arcade intros, demos and HUDs (Must, then Nice)

Files: `src/components/duel/IntroDemo.tsx`, `src/lib/duel/introDemo.functions.ts`, `src/puzzles/clayShoot.tsx`,
`src/puzzles/binToss.tsx`, `src/puzzles/inkBridge.tsx`, `src/puzzles/slice.tsx`, `src/puzzles/rally.tsx`,
`src/puzzles/whack.tsx`, `src/puzzles/hover.tsx`, `src/puzzles/tilt.tsx`,
`src/puzzles/ballTrack.tsx`, `src/puzzles/wordfall.tsx`, `src/lib/arcade/rally.renderer.ts`,
`src/lib/arcade/orbit.renderer.ts`, `src/lib/arcade/matchup.renderer.ts`, `src/lib/arcade/bullseye.renderer.ts`.

- Must: stopped demos show a real still (or are re-recorded on the tall revisions), no bare DEMO tag; Pull!'s
  caps intro paragraph; Rainbow Bridge "Levels 5–8"; Slice "mayo bottle"; Rally's reveal value (matching Batch 5);
  Letterfall's "Couldn't load the words - retrying" dash.
- Nice: Swish's "drag here to cancel"; Ball Tracker cup labels above the home-bar zone; Rally HUD spacing; Orbit HUD
  over the planet; "points" in HUDs; Bonk "Hits · Misses"; Hover / Tilt nouns.
- Renderer changes are art only (CLAUDE.md rule 3 still applies: drawn art within 2 px of collision bounds).
- Checks: arcade-play-check for the touched games, arcade-fx-check, tap-mapping-check (Pull!, Tempo, Mixed Signals
  renderers untouched here, but run it if a HUD moves), demo-taps for any re-recorded demo.

Not batched (needs Joe): whether arcade controls may sit inside the home-indicator zone (`bottom.css` is in
Batch 4, so decide before Batch 4 runs).
