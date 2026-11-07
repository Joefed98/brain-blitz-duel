# Code audit 7: text and help accuracy (7 Nov 2026)

Read-only audit; nothing in the app is changed by this PR. Main at `34272737`.

**How it was done**

- The intro, "?" help and reveal text for all 92 active games was regenerated from today's modules with
  `bun scripts/audit/intro-reveal-text.ts --out=<scratch>`. The committed `docs/audit/intro-reveal-text-final.md`
  is from 4 Nov, and some of its reveal captures are already out of date.
- Each game's text was compared with its live dealt stamp: the sims, the `*_STD_SPEC` parts, the standard graders,
  `reveal.ts` and `nearMiss.ts`.
- Reveal tiles were checked by grading a fresh live-stamp deal through the real grader in a scratch script. No
  browser tests were run.
- Names were checked across tiles, intros, results, share cards, help, sound docs and docs. Voice was checked
  against DESIGN.md sections 3 and 10–11 and `docs/copy-pass/voice-proposal-nov-2026.md` (rows Joe kept are not
  re-raised).

**Severity**

- **High:** a wrong number, mechanic or screen that a player sees and acts on.
- **Medium:** missing or misleading.
- **Low:** wording or voice.

Within each band, rows are ordered by reach (rooms before practice-only screens).

"Proposed" is a suggestion for Joe to approve, as in the copy passes. A few High rows are code bugs, not wording
(marked **bug**).

## High

| # | Game · screen | Where | Current | Proposed / fix | Evidence |
|---|---|---|---|---|---|
| H1 | Grappler · arcade reveal tiles and axis (**bug**) | `src/lib/arcade/reveal.ts:766` | The swingRev ≥ 17 / 15 / 14 branches never run, because `n(r,"swingRev")` is 0. The old metres branch shows axis "Metres" of 500 and "Survived 90.0 s", and "Finished at 90.0 s" with outcome "finish" once metres ≥ 500, even on an unfinished course (the course is ~790 m). | Carry the stamp (and `permille`) into the reveal run, so swingRev 17 shows "% of the course", Under par, Restarts and Gates n / 5. | `replaySwingRun` (`src/lib/duel/swing.ts:60-63`) returns `swingExtra` with no `swingRev`. Grading `generateSwing()` gives `tiles:[{label:"Survived"…}]`, axis max 500. |
| H2 | Five Hands · arcade reveal tiles (**bug**) | `reveal.ts:210` | `n(r,"fiveHandsRev") \|\| 1` is always 1, so the tiles show rev 1's "Full at 23" (jargon too), "Made hands 5 / 5", axis max 23. | Pass the stamp. Tiles: "Rows with a hand n / 5", "Bonus column <hand> +N", "Placed". | `replayFiveHandsRun` (`src/lib/duel/cards.ts:141-146`) returns no stamp. Grading `generateFiveHands()` gives "Full at 23". |
| H3 | Tempo · intro HOW | `src/lib/duel/instructions.ts:1404` | Full meter? Tap it: FEVER doubles your notes. | Full meter? Tap it: each fever you start scores a bonus. | beatRev 11 has no ×2: fever is its own fixed part of 25 (`src/lib/arcade/beat.ts:1250-1251`). The help-only line already says "a fixed bonus". |
| H4 | Exact · intro example (and "?" help) | `src/puzzles/targetNumber.tsx:158` | A hit scores 120 to 150 (150 in about N s); off by 1 scores 110, less the further off. | Hitting it scores 150, with up to 35 more for speed and 15 for using only 5 numbers. One away scores about 120, less the further off. | This is puzzleScoreRev 3's shape. The standard deals 150 + speed 35 + elegance 15 (`standard/number.ts:19,46`), and one away ≈ 129 × 0.93 (`:53-58`). |
| H5 | Ballpark · intro example | `src/puzzles/numline.tsx:366`, `:369` | Placed: 0.5% off → 8 points / Only the ends are labelled. Within 1% of the line scores all 8; 10% off scores 0. | Placed: 0.5% off, a bullseye / Only the ends are labelled. Within 2% scores in full, 15% off scores nothing; within 1% is a bullseye. | `standard/number.ts:62-70` (full ≤ 2 %, 0 at 15 %, bullseye ≤ 1 %). 8 a number is only the unfinished credit. "→" breaks the no-arrow rule. |
| H6 | Pipeline · intro example (and "?" help) | `src/puzzles/pipes.tsx:195` | All 49 connected = 120 + up to 30 for speed. You have 120 seconds. | Connect all 49 to finish. Faster and fewer taps score more. You have 120 seconds. | A finish is 150 + speed 40 + taps 10 (`standard/patternText.ts:49`). |
| H7 | Spacewalk · help SCORE | `instructions.ts:1004` | Rows and crossings: 1 for each row crossed, 2 more for each full crossing, up to 150. | Rows and crossings: every row crossed counts, and a full crossing counts as 2 rows more; 76 rows for all 150. | `stdLine(150, units, 76)` (`src/lib/arcade/cross.ts:1633-1656`): a unit is ~2 points, not 1. |
| H8 | Wavefront · help SCORE | `instructions.ts:1519` | Ships, hits and waves: 1 for each ship shot, armour hit and boss hit, 15 for each wave cleared, up to 150. | Ships, hits and waves: every ship, armour hit and gunship hit counts, and a cleared wave (the gunship's too) counts 15; 294 for all 150. | Full at 294 units (`wavefront.ts:2403-2404`): a unit is ~0.5 points. "Boss" here is the gunship only (`:2425-2427`), and the gunship counts as a wave (`:2126-2130`), which is why reveals read "6 waves". |
| H9 | Curl Champ · help SCORE | `src/lib/arcade/curling.ts:221` | Stones: 15 for a stone on the button, less further out, if it stops nearer than every red, up to 150. | Stones: a stone on the button counts most, less further out and nothing from 1.2 m, only if it stops nearer than every red; about six and a half on the button for all 150. | `CURL_V4_CORE_FULL = 95`, `stdLine(150, core, 95)` (`curling.ts:211`, `:629`). "15 each" over 8 stones caps at 120. |
| H10 | Docs · the game bank | `docs/duelz-game-bank.md` (whole file) | Frozen at 14 Oct ("Duelz — Game Bank", 74 active). It has no Iron Wall, Moon Climb, Ringer, Blockzone, Regions, Island Link, Loopline, Thirteen or Spacewalk, and none of the 18+ games added since. It lists Jaywalk, Ricochet and Bastion. | Rewrite from `gameNames.ts`, the registry and the live stamps (as the 13 Oct rewrite did), titled for Joulz. | CLAUDE.md tells every session to read this doc first. |

## Medium

| # | Game · screen | Where | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| M1 | Summit · arcade reveal tile (**bug**) | `reveal.ts:166` | Stock left 23 | Stock par <turned> / <par> (as the part and HUD) | `replayTripeaksRun` (`cards.ts:103-110`) has no `tripeaksRev`. |
| M2 | Ball Tracker · reveal near miss | `src/lib/duel/nearMiss.ts:89` | `remaining("home", 30, …)`: "24 marbles left to bring home" beside "6 of 36 marbles home" | Use the stamp's count (36 on btRev ≥ 7). That run should read "30 marbles left to bring home". | `BT_V7_BALLS = 36` (`ballTrack.ts:746`). |
| M3 | Grappler · reveal near miss | `nearMiss.ts:59-63` | N m short of the finish (500 m) | On swingRev ≥ 15: "N stretches left to clear", or no line | The course is ~790 m and scores by stretches. |
| M4 | Slice, Roofbound, Grappler, Gemstone, Rainbow Bridge, Tilt, Ball Tracker, Orbit · reveal breakdown | `src/lib/arcade/scoreBands.ts:185-191` → `revealBreakdown.ts:134` | Band-style lines become pointless "note" rows: "dodges 6 +10 +75", "big lines 6 +10 +61", "Perfect landings 37" (points, beside the tile "5 / 8"), "4 of 4 mazes times 35", "0 of 40 planets and 15 of 16 of the next" | Build their lines with `stdLines` from their parts (labels exist in `scripts/arcade-standard/<type>.ts`), so each reads "<Part>: <detail>: n of max", as Minefield, Moon Climb and Iron Wall do. | `breakdownRows` on Slice's lines returns 4 rows with `points: null`. |
| M5 | Gridlock, Pipeline, Turntable · intro and help HOW | `instructions.ts:556`, `:586`, `:788` | Par is the fewest moves; the bar’s gold mark shows it. (taps / turns) | Par is the fewest moves, shown beside your moves. | These stages draw pills (`framePills.tsx:23`). There is no bar: ParMeter is Blackout, Hanoi and Polypotions only. |
| M6 | Tally · intro example (and help) | `src/puzzles/countUp.tsx:160-174` | How many gold stars? | A dealt colour, e.g. "How many pink stars?" (recolour so the answer stays 3) | Gold is never dealt (`countUp.tsx:30`), and the help's own colour list contradicts it. |
| M7 | Top Bins · intro and help | `instructions.ts:1095` | too late flies high, too early comes in low and slow | above the gold flies high, below it comes in low and slow | The needle sweeps up and back, so the error is the needle's height, not release time (`freekick.ts:805-815`). |
| M8 | Home Run · help SCORE | `src/lib/arcade/homerun.ts:859` | up to 12 a pitch by how far it goes (300 ft for all of it) | every foot counts; 3,000 ft over the ten pitches for all 120; a caught ball scores nothing | `stdLine(120, feet, 3000)` is pooled over the run (`:848`, `:876`). |
| M9 | Wavefront · help SCORE | `instructions.ts:1522` | Saucers: 4 for each saucer shot down, up to 20. | add: ", and every saucer still to come when you destroy the boss" | `wavStdSaucers` (`wavefront.ts:2433-2436`). |
| M10 | Checkout · help | `instructions.ts:1829-1835` | Nothing on board 4's x4 ring or board 5's minus numbers and exact darts | Help-only line: "Board 4 has a gold x4 ring. Board 5 has two minus numbers and must finish in exactly 4 darts." | `checkout.server.ts:46-54`, stage `checkout.tsx:704`, `:759`. |
| M11 | Bang On · help SCORE and reveal | `src/lib/duel/depth/speedTexts.ts:37`, `src/puzzles/stopWatch.tsx:644` | No floor mentioned. A 335 ms average reads "0 at 220 ms" yet scores 4. | Help row "At least 2 for each watch stopped within 100 ms"; the same line on the reveal when it applies. | `BANGON_PARTIAL_POINTS` / `_MS` (`depth/bangOn.ts:32-33`). |
| M12 | Mixed Signals · help SCORE | `standard/attentionTexts.ts:50-51` | Streak: … / Gold words: … (read as finish-only) | add ", finished or not" to both (as Matchmaker's rows) | An unfinished run adds streak and gold (`clashStandardScoreOf`, ~`colourClash.ts:700`). |
| M13 | Lamplighter · intro and help HOW | `instructions.ts:1966-1969` | No line on how to place a bulb. The help-only line repeats the intro's wall rule. | Intro: "Tap a square for a bulb; again for a dot, again to clear." Help: "Dots are your notes; they never score." | Tap cycle (`lightUp.tsx:27`, `:227-230`), "Dots" pill (`:264`). |
| M14 | Thirteen · sound cue doc and dead cue | `docs/sound-cues/cards-solitaire.md:12`, `gameSounds.ts:1707` | `pyramid.turn`: "The empty stock turns the waste back over (passes 2 and 3)" | One pass since 3 Nov, so the cue can't fire. Mark it unused (or remove it in a sound PR). | pyramidRev 1 is one pass. |
| M15 | Standings (Placings room) · meta line | `src/components/duel/DuelOverall.tsx:46` | After round 3 of 6 · Placings | A Placings chip, as `Standings.tsx:160` (`MetaChips facts={["Placings"]}`) | DESIGN.md 3.5: no " · " in meta lines. The same screen has two wordings. |

## Low

**Text accuracy**

| # | Game · screen | Where | Current | Proposed |
|---|---|---|---|---|
| L1 | Breaker · reveal near miss | `nearMiss.ts:116-118` | "33 bricks left to clear" (gold left out) beside "72 of 108 bricks" | Count the gold bricks (108 − destroyed). |
| L2 | Free Cell · reveal axis (latent) | `reveal.ts:147` | `fcCardsFor(n(r,"freecellRev") \|\| 1)` → 52 | Pass the stamp (40 on rev 4). The axis isn't drawn today. |
| L3 | Roofbound · reveal tile | `reveal.ts:629`, `:643` | Features +77 | Bonuses +77 ("features" is on the jargon list). |
| L4 | Roofbound · help SCORE | `instructions.ts:1577` | Flow streak: your longest run of clean jumps, up to 20. | …clean jumps (50 in a row for all of it), up to 20. |
| L5 | Orbit · help SCORE penalty | `instructions.ts:1671` | Running out of fuel ends the run. | …ends the run (or sends you back to your checkpoint). |
| L6 | Thirteen · help | `instructions.ts:1291` | can be cleared with ten pyramid pairs | can be cleared with pyramid pairs and Kings alone (deals hold 12–13 pairs; the part counts 10). |
| L7 | Wavefront · intro | `instructions.ts:1502`, `:1506` | Five waves and two bosses… / Bosses: hit weak points dead centre | Bosses: shoot out the cannons and hit the core while it’s open. (There is no centre rule.) |
| L8 | Swish · intro | `instructions.ts:850` | Aim into the flag. | Aim against the flag. (The help says aim opposite the flag.) |
| L9 | Curl Champ · reveal and intro | `curling.ts:631` | "Red ring: 6 in the 4-foot"; intro "shot stone" | "6 in the red ring"; "finish nearest the button". |
| L10 | Hover · intro | `instructions.ts:798` | Gold gates: | Tight gates: (the help and parts' name; "gold stars" is a separate part) |
| L11 | Meteor, Hover · help | `instructions.ts:973`, `:807` | Taller and wider field: / Taller sky: | Field: / Sky: (history words) |
| L12 | Cue Ball · help | `instructions.ts:1152` | tap the cue ball, bottom right | tap the spin ball, bottom right |
| L13 | Flash · help SCORE | `depth/speedTexts.ts:19-20` | Reactions up to 186 + Steady hand up to 15 = "Total 200" (the rows add up to 201) | Reactions up to 185, or "capped at 200". |
| L14 | Strikeout · reveal score line | `standard/word.server.ts:177` | 150 + 30 solve bonus + 0 speed | early solves and strikes (the help's names) |
| L15 | Tenfall · reveal tile | `reveal.ts:996` | Gold tens | Gold tiles (intro and help) |
| L16 | Exact · help SCORE | `standard/numberText.ts:65` | the fewest numbers it needs (5 here), 5 less for each number more | use only 5 of the 6 numbers for all of it; all 6 scores 10 |
| L17 | Bonk · help SCORE | `instructions.ts:1496` | every target hit scores the same… | more for every target hit, 15 more for all; wrong taps come off this part (the curve, `whack.ts:636`) |
| L18 | Pull! · help SCORE | `instructions.ts:1478` | 5 for each orange clay, 10 for each gold… (pre-curve) | more for each clay, gold worth double, a bonus for all 25 with no bird hit |
| L19 | Operator · help | `instructions.ts:432` | every step must stay a whole number. | …a whole number, never below 0. (`operatorGaps.ts:10`) |
| L20 | Loopline, Island Link · help | `instructions.ts:1760-1767`, `:1782-1789` | Undo and Reset not mentioned | Help-only "Undo takes back your last move; Reset clears the board." (as Regions) |
| L21 | Gradient · reveal | `gradientBoard.tsx:575` | 6 / 21 in place · 0 % rebuilt (includes pre-locked tiles) | 2 of 17 placed, 12% rebuilt (graded count, `standard/pattern.server.ts:316-321`) |
| L22 | Skid, Topsy-Turvy, Labyrinth, Pipeline · HUD pills against the text | `iceSlide.tsx:268`, `topsyBoard.tsx:320`, `mazeDash.tsx:462`, `pipes.tsx:281` | Pills "Moves" / "Turns"; text says slides / tilts / steps / taps | One word each: rename the pills or the text. |
| L23 | Mixed Signals · reveal line | `reveal.ts:1015` | … · N net → base · … | "N more right than wrong", with no "→" |
| L24 | Eagle Eye, Colour Flood · help decimals | `attentionTexts.ts:58`, `logicText.ts:47` | about 13.3 for each grid / 6.7 less for each move over | 40 shared by the grids with no wrong eagle / less for each move over, nothing at par + 6 |

**Voice**

| # | Screen | Where | Current | Proposed |
|---|---|---|---|---|
| V1 | Room settings sheet | `src/components/duel/RoomSettingsSheet.tsx:198` | Every round's score adds up. | Every round’s score adds up. (curly) |
| V2 | Room settings (Placings refused) | `src/lib/duel/roomSettings.server.ts:63` | Placings scoring isn't available yet. | isn’t |
| V3 | Link join | `src/components/duel/JoinFromLink.tsx:114` | This game has already started | This game’s already started. (the one wording since copy pass 2) |
| V4 | Round leaderboard detail, async results | `RoundResultsTable.tsx:145`, `AsyncResults.tsx:208`, `rivals.tsx:73`, `routes/duel.$code.tsx:453` | details joined with " · " | commas, or one detail a line (DESIGN.md 3.5) |
| V5 | Round leaderboard summaries | `src/lib/duel/roundSummaries.ts` (~180 lines) | "2 / 3 grids perfect · 41 s" | A comma, or the time as its own column. One mechanical pass. |
| V6 | Gradient, Topsy-Turvy status lines | `gradientBoard.tsx:432,522,574`, `topsyBoard.tsx:392` | swaps 12 · par 9 | HudPills, as the other par games |
| V7 | Celebrations, two wordings | `ArcadeCelebration.tsx:11` against `NewBestMoment.tsx:37` | New personal best! / New best! | One phrase. Both are kept rows in copy pass 2, so this is Joe's pick. |
| V8 | Chat | `src/lib/duel/chat.functions.ts:88` | Unknown reaction. | That reaction doesn’t exist. (copy pass row 45's pattern) |
| V9 | Grappler deal failure (can reach a room's create error) | `src/lib/duel/arcade.server.ts:466` | Could not verify a safe Grappler course; try again. | Couldn’t build the course. Try again. |
| V10 | Nucleus · help, replay card | `instructions.ts` (help-only "Pangram bonus"), `src/lib/replay/moments.ts:328` | Pangram bonus / Pangram (every letter) | Every-tile word (the score row's name) |
| V11 | Intro stills and help · spaced hyphens and ranges | `wordsmith.tsx:19`, `reaction.tsx:127`, `chainTap.tsx:224`, `flow.tsx:176`, `iceSlide.tsx:52`, `push.tsx:74`, `sortTubes.tsx:153`, `rotatingRings.tsx:90`; `instructions.ts:594` (1-6), `:704` (1-7), `:1600-1608` (Levels 1-4, 5-8, 9-10), `:1651` (5-6) | " - " and "1-6" | " – " and "1–6"; Rainbow Bridge's labels also want a colon ("Levels 1–4:", "Ink is limited:") |
| V12 | Home Run · intro | `instructions.ts:1079` | in his circle | in their circle |
| V13 | Hanoi · intro | `instructions.ts:653` | the fewest moves (Par) | (par) |
| V14 | Island Link · intro | `instructions.ts:1786` | Bridges run straight never cross… | Bridges run straight, never cross, and at most two join a pair. |
| V15 | Bomb Defusal · help | `instructions.ts:703` | Only one order fits the clues… | Only one order fits: … |
| V16 | Brimful · intro example | `src/puzzles/measure.tsx:370` | Pour 5 → 3: 4 L! | Pour 5 → 3: 4 L (an example step, not a celebration) |

## Game names (renames)

The code is consistent:

- Every tile, intro, header, results row, reveal, help and sound-cue sheet row reads `gameDisplayName()`.
- The share card draws game icons, not names.
- No old display name (Bastion, Ricochet, Alley Roll, Blockfall, Fillomino, Fences, Bridges, Jaywalk, Pyramid,
  Minesweeper, FreeCell, TriPeaks, Minigolf, Curling, Free Kick, Racing, Home Run Derby, Speed Pool, Jumbled)
  appears in player text.

The remaining old names are all in docs:

| # | Where | Current | Proposed |
|---|---|---|---|
| N1 | `docs/duelz-game-bank.md` | see H10 | rewrite |
| N2 | `docs/sound-cues/arcade.md:195-199`, `cards-solitaire.md:1,10-12`, `music.md:92` (and so the generated `cue-sheet.md` / `.csv` rows) | game column "Pyramid" | Thirteen; then `bun scripts/sound-cue-sheet.ts` |
| N3 | `docs/sound-cues/core.md:20,23` | arcade crashes in Jaywalk… / Wavefront, Jaywalk, Junction | Spacewalk |
| N4 | `docs/sound-cues/blockfall-alleyroll.md:1` | Blockfall and Ringer (Alley Roll…) | Fine as a dated history title. Leave it, or add "now Blockzone" first. |

Developer labels only, not shown to players (the replay moment rows made by `fx()` show generic captions, never
their names):

- `moments.ts:113-115` ("All 52 cards home", "Thirteen more cards home": Free Cell rev 4 has 40)
- `moments.ts:139` ("Coin taken", Moon Climb)
- `moments.ts:208-214` (road, cyclists and roadworks, Spacewalk)
- `moments.ts:266-270` (lava, dragon, 500 m, Grappler)
- `moments.ts:134,137,143` ("The core’s…")

Worth refreshing with the next replay change. "Duelz Mono" is still named in four arcade renderers' font stacks
(`freekick`, `homerun`, `racing`, `sportsHud`; the face was dropped in F1). That's harmless, but it's dead text.

## Hard-coded or duplicated text

- **"That room’s full. It’s N max."** is written twice (`src/lib/duel/types.ts:610`,
  `src/lib/duel/playerLook.server.ts:29`). Have the error class call the `types.ts` helper.
- **Standings meta line** is built twice with different wording (M15).
- **"This game’s already started."** has seven server copies and a differently worded client copy (V3). A shared
  constant would stop drift.
- **Intro examples hold their own score sentences** (H4, H5, H6, M6). They aren't generated from the graders, so
  they went stale when the standard landed. The rest of the help reads from the specs (`stdHelp`,
  `*_STD_HELP`, `puzzleScoreList`). Suggest generating the example's score line from the same texts, or dropping
  score figures from examples.
- **Hand-written numbers in `instructions.ts`** (H7, H8, H9's "15", M8's "300 ft") went wrong where a part is
  pooled over a run. Where a part is a straight line to a full figure, the help should say the full figure, not a
  per-item rate.
- **Reveal builders read a stamp the run doesn't carry** (H1, H2, M1, L2). It's one pattern: `reveal.ts` reads
  `n(r,"<stamp>")` off a replay result that holds only sim counters. Have the grader pass the puzzle's stamp (or
  merge `extraDetail`) into `buildArcadeReveal`.

## Checked, no issue

- **Word:** Nucleus, Interlock, Slider, Forage, Lookout, Roundabout, Cryptogrid, Swapword.
- **Number:** Counterweight, Integer Pyramid, Brimful, Kakuro, Tenfall (intro, help).
- **Speed:** Ascend, Don’t Break the Chain.
- **Attention:** Double Take, Matchmaker, Bomb Defusal (its text names no category).
- **Pattern / Logic:**
  - Labyrinth, Skid and Topsy-Turvy: no star or gem text on the live stamps; 32 / 30 s and 1.5× par match.
  - Tessellate, Chroma Lines, Heave, Lightbender, Blackout, Box Six, Hanoi, Polypotions, Safe Cracker, Mosaic,
    Colour Flood, Tents and Trees, Shikaku, Trail.
  - Regions: number pad, tints, Undo and Reset all described.
- **Retro:** Pinball, Blockzone (no hold or pads, 95/65/24/16), Rally, Meteor (gold counts 2), Fission.
- **Sports:** Flightpath, Apex (pace 152–221.5 km/h, 160 + 40), Crazy Golf, Ringer (no arrow, 140/30/20/10), Top
  Bins' parts, Cue Ball's parts.
- **Spacewalk's mechanics:** no coins or roads, 3 lives, −15 a hit, no-stop streak, close calls.
- **Cards & Board:** Minefield, Mahjong, Free Cell's text, Summit's text, Five Hands' text.
- **Action:**
  - High Rise, Slice (food, chilli 10).
  - Moon Climb: lantern rides, scrolls, flow. The 4 Nov audit capture showing coins is out of date.
  - Iron Wall (110/30/20/30/10, drones, 120 px).
  - Orbit (fuel).
  - Grappler's intro and help (vines, river, pterodactyl, 5 gates).
- **Strategy:** Gemstone, Coral Pop, Rainbow Bridge (120/30/20/10/20), Tilt, Ball Tracker's text.

Also clean:

- British spelling in every intro and help text.
- No "Duelz" in player text.
- No "Please" or "Oops" outside the beta terms, which are left for Joe's adviser.
- "Add to Home Screen" keeps its capitals on purpose: it quotes Apple's own menu label.

The committed `docs/audit/intro-reveal-text-final.md` (4 Nov) should be regenerated after these fixes. Several of
its reveal captures already predate fixes made on 4 Nov (Nucleus and Forage "Finished", Flash, Kakuro, Curl Champ
and Swish near misses).
