# Who builds what: every plan row, every shared file, the launch order

Companion to `docs/polish-plan-final.md` section 11 and the prompts in `prompts/`. Written on the fact-check pass of 20 Nov 2026. Three things Joe asked for: every plan row mapped to exactly one prompt, every file that more than one prompt would have touched with its ownership fixed, and the launch order with the merge trains.

## 1. Every plan row and the one prompt that builds it

"Plan" is `docs/polish-plan-final.md`; ids like C1.3 are rows of `earlier-plan.md` that the plan carries forward.

### Sections 1 and 3: the direction and the flow

| Row | Prompt |
|---|---|
| 1.1 Navy token values and their mirrors (earlier A5) | P1 |
| 1.3 Motion: hero sheen, staggered lists on tab pages | P1 |
| 1.3 Motion: the VS halves and plate, the win count-up | P3 |
| 3.2 Tabs Home · Games · Compete · Shop · You; ids kept | P1 |
| 3.2 The Play bar removed; `/play` and `/more` redirect | P1 |
| 3.2 The avatar always opens You | P1 |
| 3.2 The rail's contents (earlier B5), with Joe's added rows of 20 Nov: Daily, Leaderboards, Badges, Notifications | P1 |
| 3.2 Compete's contents | P3 |
| 3.2 You's contents | P3 |
| 3.3 Home, Joe's mix of H1 and H2 (20 Nov): the top line, the player banner in three states, the two rating chips, Dailies side by side, Play friends, Jump back in; the removals | P1 |
| 3.3 Every Home section reserved before paint (earlier A2) | P1 |
| 3.4 The first open | P2 |
| 3.5 Words: round intro, game page, help sheet | P2 |
| 3.5 Words: Home for a new guest | P1 |
| 3.5 Words: beta terms, Profile for a new guest, the tournaments page | P3 |
| 3.5 The seventeen longest strings | The owner of each string's file: P1 (`index.tsx`, `play.tsx`), P2 (`levelIntro.ts`, `instructions.ts`, `PuzzleInstructions.tsx`, `practice.tsx`), P3 (all others) |
| 3.6 Practice: the reveal's "Try Hard" and "Games" | P2 |
| 3.6 The Daily: the page before the terms, Home on results | P3 |
| 3.6 A friend's room link: nameplates, pre-filled name | P3 |
| 3.6 Rated: Home on the result | P3 |
| 3.6 One name sheet | P3 |
| 3.6 Money: the two tab-bar toasts become the Shop tab's dot | P1 (their mount in `AppTabBar`) |

### Section 4: page by page

| Page row | Prompt |
|---|---|
| Launch / splash (earlier A1) | P1 |
| First open | P2 |
| Home | P1 |
| Games | P2 |
| Game page, with Joe's combined level picker (the current level large, the four levels as a row, the last level remembered per game) | P2 |
| Challenges | P2 |
| Compete, in Joe's order (rating and Find a match; tournaments; leaderboards as tabs with the Daily 100 as one) | P3 |
| Leaderboards, Daily board | P3 |
| Daily | P3 |
| Rated: searching, VS | P3 |
| Rated: result | P3 |
| You (with the showcase strip, earlier A4, and the guest's page, earlier A13) | P3 |
| Friends, Customise, Card, Badges | P3 |
| Shop, Pass, Plus (earlier A8 without "best value") | P3 |
| Settings, Account, Terms | P3 |
| Room: lobby, link join, round results, standings, podium | P3 |
| Round intro | P2 |
| Reveal (the template's paint) | P2 |
| Empty and error states | P3 |
| Desktop tab pages (earlier B4) | P4 |

### Section 5: game by game (83 rows)

| Rows | Prompt |
|---|---|
| Word (9): Nucleus, Interlock, Slider, Forage, Lookout, Roundabout, Strikeout, Cryptogrid, Swapword | A1 |
| Number (8): Counterweight, Exact, Operator, Integer Pyramid, Brimful, Checkout, Ballpark, Kakuro | A1 |
| Speed (6): Flash, Ascend, Don't Break the Chain, Bonk, Tenfall, Pull! | A2 |
| Attention (6): Eagle Eye, Double Take, Tally, Labyrinth, Bomb Defusal, Matchmaker | A2 |
| Pattern (8): Gridlock, Tessellate, Pipeline, Chroma Lines, Skid, Heave, Lightbender, Topsy-Turvy | A2 |
| Logic (14): Box Six, Hanoi, Polypotions, Safe Cracker, Mosaic, Colour Flood, Minefield, Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions, Island Link | A2 |
| Retro (10), Action (6), Strategy (5), Sports (6), Cards & Board (5) | A3 |

Carried rows of `earlier-plan.md`:

| Earlier row | Status | Prompt |
|---|---|---|
| A1 splash, A2 Home reserved, A5 navy, B5 rail | kept | P1 |
| A4 showcase, A8 Shop, A12 tournaments page (now Compete), A13 guest profile | kept or absorbed | P3 |
| A6, A7 Daily cards; A11 Home layout | absorbed into the plan's Home | P1 |
| A9 Games page | absorbed into the plan's Games page, with Joe's Shelves · All switch (remembered) | P2 |
| A10 tiles re-exported | kept | F1 |
| A3 avatar discs; "best value" in A8 | dropped | – |
| B1 Cabinet, B2 Blockzone, B3 puzzles in two columns, B4 desktop tab pages | kept | P4 |
| C1.1, C1.2, C1.3, C1.4, C1.5, C1.7, C1.9, C1.10, C1.11 | kept | A3 |
| C1.6 Wavefront `wavRev 16`, C1.8 Fission `burstRev 14`, C3.5 Moon Climb `ricoRev 5` | **back** (Joe, 20 Nov) | D5; their demo re-records in F1's list |
| C2.1, C2.2, C2.3, C2.4 | kept | A3 |
| C3.1, C3.2, C3.4, C3.6, C3.7, C3.8 | kept | A3 |
| C3.3 Grappler's ring | changed (redrawn, size kept) | A3 |
| C4.1, C4.2, C4.3, C4.4, C4.5, C4.6, C4.8, C4.9, C4.10 | kept | A3 |
| C4.7 Apex's steering | built | – |
| E0.1 Number backdrop | replaced by the stage rule | A1 |
| E0.2 Pattern glows | changed (where section 5 asks) | A2 |
| E0.3 near-black frames | replaced by the stage rule and light pieces | A1 (the shared rule), A2 (its families' frames) |
| E0.4 dyed controls | kept | A1 (`number-overhaul.css`), A2 (`topsy.css`) |
| E0.5 outlines | kept | A1 (the shared ring and tray border, Word and Number frames), A2 (its families' frames) |
| E1.1 Lamplighter, E2.2 Minefield | kept or changed as section 5 says | A2 |
| E1.2 Topsy-Turvy, E1.3 Chroma Lines, E1.4 Pipeline | **the old look restored** as the earlier rows describe (Joe's picks, 20 Nov; Pipeline with the bigger pipes: the old art at today's tile and pipe size); today's rules, levels, effects and every `data-*` attribute kept; the board sits on the new lit stage | A2 |
| E2.1 Checkout, E2.3 Counterweight, E2.4 keyboards | kept or changed as section 5 says | A1 |
| E1.5 Ballpark | **the old look restored** as the earlier row describes (Joe's pick, 20 Nov); today's rules, levels, effects and every `data-*` attribute kept; the board sits on the new lit stage | A1 |
| G1 reveal template | built; its paint and its one waiting assertion | P2 |
| G2 Word reveals, G3 Number reveals | kept | A1 |
| G4 Pattern, G5 Logic, G6 Attention and Speed reveals | kept | A2 |
| G7 arcade run pictures | kept | A3 |
| H1, H2, H3, H5, H6, H7, H8 | kept | A3 |
| H4 Orbit's lost-flight rule (a stamp) | kept | D5 |
| I1 Flash `tapRev 8`; Normal's caps for Bonk `whackRev 5` and Pull! `clayRev 9` | **built on Normal too** (Joe, 20 Nov; plan section 8.2) | D3 |
| I2 Five Hands `fiveHandsRev 4`, I7 Cue Ball `poolRev 5`, I8 Tilt `tiltRev 13` | built on Normal too | D6 |
| I3 Integer Pyramid `depthRev 3` | built on Normal too | D2 |
| I4 Nucleus `wordsmithRev 6`, Forage `wordHuntRev 5`, Roundabout `wheelRev 6` (the refit, as stamps) | built on Normal too | D1 |
| I5 High Rise `skylineRev 12` | built on Normal too | D5 |
| I6 Roofbound, I9 Moon Climb | "leave it", as before | – |
| J1, J2 infrastructure | not in this plan | infrastructure session |

### Sections 6 to 9 and 12

| Row | Prompt |
|---|---|
| 6 The stage behind every puzzle board, goal text 19 px, status chips 15 px | A1 (one shared rule) |
| 6 The stage behind arcade worlds | A3 (each renderer and fill) |
| 6 The intro | P2 |
| 6.1 The level mark (`LevelMark.tsx`), on the game page, intro, reveal, room settings and the frame header | P2 |
| 6.1 The ladder on a game's page (L1 or L2 as Joe picks) and the lever-picture slot | P2 |
| 6.1 The step-up card on the reveal | P2 |
| 6.1 Each family's lever pictures (one new file a session, `src/lib/levels/pictures/<its json name>.tsx`) | D1 to D6, each its own file; Breaker's is P2's worked example in its own file, `pictures/breaker.tsx` |
| 6 The reveal's paint | P2 |
| 7 Desktop tab pages, the Cabinet, Blockzone's cabinet, puzzles in two columns | P4 |
| 7 The rail, with Joe's added rows | P1 |
| 7 Keyboard controls in every game on a computer: the map (`DESKTOP_KEYS`), the handlers, `docs/desktop-support.md` (Joe, 20 Nov) | P4 |
| 7 The intro's key line on a computer | P2 |
| 2.1 The first game on a new phone: Ascend on Easy (Joe's pick, 20 Nov) | P2 |
| 8.2 Grappler's lever, proposed to Joe before its levels are built | D5 |
| 8.2 Curl Champ's lever, proposed to Joe before its levels are built | D6 |
| 7 VS on a computer | P3 |
| 8 Difficulty: 83 games | D1 Word (9), D2 Number (8), D3 Speed and Attention (12), D4 Pattern and Logic (22), D5 Retro and Action (16), D6 Strategy, Sports and Cards & Board (16) |
| 9 The Cabinet skeleton switched on | P4 |
| 11 The last pass (tiles, stills, reveal palette, `celebrations-off.json`, the demo list) | F1 |

## 2. Files more than one prompt would have touched, and the fix

The first set of prompts shared the files below. Each now has one owner; the prompts say so.

| File | Who wanted it | Now |
|---|---|---|
| `src/components/app/AppRail.tsx` | P1 (the tabs), P4 (earlier B5) | **P1.** B5 moved to P1 |
| `src/lib/desktopKeys.ts` | P4 (the map), P2 (the intro reads it) | **P4** writes it; P2 only reads `DESKTOP_KEYS` and draws what it holds |
| The 18 stage files without keys today (`src/puzzles/<game>.tsx`) | P4 (a `keys` prop), A1 / A2 / A3 (the markup) | **The art session owns the file**; P4 changes the `keys` prop line alone and names each file in its report. If the art session has not merged, P4 merges after it for those files |
| A game's sim, deal and scoring file where section 8.2 puts a Normal stamp | the D session (levels), the same D session (the scoring fix) | **One session**: the fix and the levels are the same session's, in that order, so nobody else touches the file |
| `src/components/duel/PhoneShell.tsx` | P1 (the Play bar and tabs), P4 (the arena branch) | P1 first; **P4 edits only the arena branch after P1 has merged** |
| `src/lib/arcade/arenaFills.renderer.ts` | P4 (scenery behind the panels), A3 (the fills' colours) | **A3.** The fills already paint to the screen's edges; P4 changes layout only |
| `src/lib/arcade/retro.renderer.ts`, `actionHud.renderer.ts`, `hudPill.renderer.ts`, `cards/cards.renderer.ts` | P4 (HUD flags), A3 (art) | **A3.** The built skeleton already made these painters honour the placement flag, so P4 has nothing to change in them |
| `src/lib/arcade/blockfall.renderer.ts` | P4 (the cabinet layout), A3 (all arcade renderers) | **P4**, `bfLayout` only; the plan changes nothing else in Blockzone |
| `src/polish-layout/game-frame.css` | A1, A2 (each family's stage), P2 (goal text) | **A1**: one shared stage rule for every puzzle category, plus the goal and chip sizes |
| `src/styles.css` (the accent ring, line 1628) | A1, A2 (earlier E0.5) | **A1** |
| `src/components/puzzles/LetterKeypad.tsx` | A1 (key relief), P4 (the desktop column) | **A1.** P4 places the keypad by CSS |
| `src/components/duel/RevealScreen.tsx`, `reveal-screen.css` | nobody (the reveal's paint was unassigned) | **P2** |
| `src/components/duel/GameFrame.tsx` | P2 (the level mark), A1 (the stage) | **P2** for the one markup line that draws the level mark; A1 changes paint only in `game-frame.css` and does not edit the component |
| `src/lib/levels/pictures/*` | P2 (Breaker), D1 to D6 (their families) | **One file each**: P2 `breaker.tsx`, D1 `word.tsx`, D2 `number.tsx`, D3 `speed-attention.tsx`, D4 `pattern-logic.tsx`, D5 `retro-action.tsx` (without Breaker), D6 `strategy-sports-cards.tsx`. The slot finds them by a glob, so there is no shared index |
| Each family's reveal boards (earlier G2 to G7) | nobody (not carried forward in the first plan) | **A1** (Word, Number), **A2** (Pattern, Logic, Attention, Speed), **A3** (arcade) |
| Room screens (`RoomLobby`, `JoinFromLink`, results, podium) | nobody | **P3** |
| `src/routes/challenges.tsx` | nobody | **P2** |
| `src/polish-layout/app-pages.css`, `app-shell.css`, `src/design/components.css` | P1, P2, P3 | **P1.** P2 and P3 style their pages in their own files (`games.css`, `shop.css`, `tournaments-pages.css`, the rated and profile styles) |
| `src/polish-layout/desktop-layout.css` | P1 to P4 | **P4** |
| `src/routes/__root.tsx` | P1 (splash), P2 (first-open routing) | **P2.** The splash work stays inside `LaunchSplash` and `nav.css` |
| `scripts/safe-area-harness.tsx`, `scripts/theme-screens.ts` | P1, P2, P3 | **P1**; later sessions add their screens in their own `scripts/screens/<area>.ts` |
| `src/lib/duel/instructions.ts` | P2 (the cuts), D sessions (level lines) | **P2.** D sessions keep level text in `src/lib/levels/` |
| `public/tiles/*`, `tileScenes.data.ts`, `revealPalette.data.ts`, intro stills | A1, A2, A3 (each re-exporting its games) | **F1**, once, at the end |
| `scripts/fixtures/celebrations-off.json` | P1, P3 | **P1** records it for the Home change; **F1** records it again at the end if a recorded screen moved |
| `src/lib/duel/practiceChallenges.data.ts`, `src/lib/levels/gameLevels.ts`, `src/lib/duel/arcade.server.ts`, `src/lib/duel/dealEra.ts`, `scripts/scoring-targets-revs.ts`, `scripts/arcade-skill-bands/games.ts` | D1 to D6 (one row a game) | Each D session edits **only its own games' rows**, and the six merge one at a time |
| `src/lib/practice/practiceStamps.data.ts`, `docs/challenges/catalogue.md` (generated) | D1 to D6 | Regenerated by its script after merging main; never merged by hand |
| `scripts/arcade-self-replay-check.ts` (entries appended at the end) | D5, D6 | Appended after merging main, D5 before D6 |

Rule in every prompt's standing rules: you own the files your prompt lists and no others; a change needed in another session's file is written up for that session.

## 3. Launch order and merge trains

Three trains that share no files, plus one last pass. Sessions in different trains can run and merge in any order relative to each other, with the two cross-train rules below.

| Train | Order inside it | Why |
|---|---|---|
| **Pages** | **P1** first and alone. Then **P2, P3 and P4** together, merging in any order | P1 changes the tab list, the tokens, `PhoneShell` and the harness that the others build on |
| **Art** | **A1** first. Then **A2**. **A3** any time, beside either | A1 owns the one stage rule every puzzle family sits on; A3 shares nothing with A1 or A2 |
| **Difficulty** | **D1, D2, D3, D4, D5, D6**, merged **one at a time in that order** (they can be written in parallel) | They share one-row-a-game files, generated stamp data and the append-only self-replay list |
| **Last** | **F1**, after every other session has merged; then the merge captain runs the Save-intro-demos workflow | Tiles, stills and palettes are generated from the finished looks, once |

Cross-train rules:

1. **A difficulty session that needs new art waits for that family's art session.** Coral Pop's seventh colour, Ball Tracker's two new colours, Tessellate's two pieces, Topsy-Turvy's two balls, Tempo's extra lanes and Iron Wall's fourth lane are drawn in a new, separate function after A2 or A3 has merged, so the new pieces are born in the new look.
2. **P2 merges before any D session changes help or intro text**, because P2 cuts `instructions.ts`.

Never in the same train or the same PR: a P session with an A or D session; A2 or A3 with any D session.

First to launch, if only three sessions are started: **P1, A1 and D1**. Each unblocks its own train.
