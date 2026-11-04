# Game names for the solicitor's IP review

A running list for task 23 of the master plan (the solicitor's freedom-to-operate review). It records each game name
the app shows, the puzzle or genre it is, and what to check. Not legal advice; nothing here has been cleared.

## Renamed 3 Nov 2026: Spacewalk (arcade)

Display name only (`src/lib/duel/gameNames.ts`; the id `cross`, its stamps and stored rounds are unchanged), with a new
look: the crossing re-themed in pixel art as a spacewalk (the rules, lanes, timings and every hit box exactly as before).

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Spacewalk (shown as Jaywalk until 3 Nov 2026) | `cross` | lane-crossing game: a pixel astronaut hops across lanes of space traffic (small ships, long cargo freighters, fast comets on plasma lanes, drifting debris) from station deck to station deck, with a docking platform midway (Retro group) | "Jaywalk" (a common word; the road theme also sat close to the classic road-crossing arcade games, so the street, cars and frog-like hop are gone); "Frogger" (Konami's title) and its look | "Spacewalk" is a common word (a spacewalk); check it as a game name in classes 9 / 28 / 41 (other "Spacewalk" titles exist); lane-crossing is a common genre idea, so check the look is not a close copy of a specific space-crossing game. All art is drawn in code (`src/lib/arcade/spacewalk.renderer.ts`); its sounds are existing library recordings; no third-party assets |

## Renamed 3 Nov 2026: Moon Climb and Blockzone (arcade)

Display names only (`src/lib/duel/gameNames.ts`; ids never change). They replace the two rows below: Ricochet is now
shown as Moon Climb and Blockfall as Blockzone.

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Moon Climb | `ricochet` | two-wall leaping climb on a moonlit temple, with paper sky lanterns to ride, hanging mid-ledges and a flow streak (Action group, `ricoRev` 3) | "Ricochet" (a common word, harder to own) | "Moon Climb" as a game name in classes 9 / 28 / 41; the two-wall leaping mechanic and riding a floating object are common to wall-jump games (check none is a close copy of a specific game); the ninja is the Joulz hero in ninja gear, drawn in code. All art is drawn in code; no third-party assets |
| Blockzone | `blockfall` | falling-block line-clear game (Retro group, `blockfallRev` 2: no hold, gestures only) | "Tetris" and "tetromino" (The Tetris Company's marks), and Tetris's look and music | "Blockzone" as a game name in classes 9 / 28 / 41 (check for other "Block Zone" titles); the trade dress: our own bevelled blocks with a neon rim and inner highlight, a softly glowing well, our own neon palette (since 3 Nov 2026, Joe's audit: seven clearly different hues, magenta bar, lime square, amber tee, cyan and coral steps, violet and pearl hooks; deliberately not the classic per-shape colours or their shape-to-colour mapping); no Tetris music (its bed is our own Retro track until Joe's file). The 10 × 20 well, seven shapes, ghost, soft and hard drop and lock delay are common to the genre |

## Added 1 Nov 2026: the new grid puzzles (renamed 3 Nov 2026)

Joe renamed three of them on 3 Nov 2026 (display names only; the ids, stamps and stored rounds are unchanged):
Fences → Loopline, Fillomino → Regions, Bridges → Island Link.

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Loopline (shown as Fences until 3 Nov 2026) | `fences` | loop puzzle: one closed loop round numbered cells | "Slitherlink" (a Nikoli title) | "Loopline" as a puzzle-game name in classes 9 / 28 / 41 |
| Regions (shown as Fillomino until 3 Nov 2026) | `fillomino` | region puzzle: regions of N squares hold N | "Fillomino" (the puzzle's common name, published by Nikoli) | "Regions" is a plain word; check it as a puzzle-game name in classes 9 / 28 / 41 |
| Island Link (shown as Bridges until 3 Nov 2026) | `bridges` | island-and-bridge connection puzzle | "Hashiwokakero" / "Hashi" (Nikoli titles) | "Island Link" as a puzzle-game name in classes 9 / 28 / 41 |
| Kakuro | `kakuro` | cross-sum number puzzle | — | "Kakuro" is the puzzle's common name; check for marks covering it in classes 9 / 28 / 41 |

The boards, art and rules text are original (generated in the app; no puzzle collection, font or artwork copied).

## Added 1 Nov 2026: Blockfall and Alley Roll (arcade; Blockfall shown as Blockzone since 3 Nov 2026, above)

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Blockfall | `blockfall` | falling-block line-clear game (Retro group) | "Tetris" and "tetromino" (The Tetris Company's marks), and Tetris's look and music | "Blockfall" as a game name in classes 9 / 28 / 41; the trade dress: our own block style (glass tiles with a neon rim and corner glint) and our own colours in Retro's cyan family, not the classic per-shape colours; no Tetris music (its bed is our own Fission Retro track). The 10 × 20 well, seven shapes, hold, ghost and three-piece preview are common to the genre |
| Alley Roll | `alleyroll` | ramp-and-rings alley ball game (Sports group) | "Skee-Ball" (a registered trade mark) | "Alley Roll" as a game name in classes 9 / 28 / 41; the art is our own (a warm wooden alley, a lit ring board and a scoreboard drawn in code), ring values 10–50 with two 100 pockets, library sounds only |

Both are working names; Joe may rename either (`src/lib/duel/gameNames.ts`; ids never change).

## Changed 3 Nov 2026: Alley Roll is shown as Ringer (arcade)

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Ringer | `alleyroll` (unchanged) | funfair roll-ball alley game (Sports group; `alleyRollRev` 2) | "Skee-Ball" (a registered trade mark) and its cabinet look | "Ringer" (a common word; also a sports and fairground term) as a game name in classes 9 / 28 / 41. The art is our own, drawn in code: a funfair stall with a striped awning and bulbs, a polished lane, a stepped tower of raised cream cups, corner pockets and a gold cup that slides along a track (our own feature). Joe's reference photo of a commercial roll-ball app was used for mood only; nothing in it (layout, art, items, the ×3 ring, the HUD) was copied. Library sounds until Joe's recordings. |

## Added 1 Nov 2026: Ricochet back as the ninja wall-climb (arcade; shown as Moon Climb since 3 Nov 2026, above)

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Ricochet | `ricochet` | two-wall leaping climb (Action group; back as an active game on `ricoRev` 2) | — | "Ricochet" (a common word) in classes 9 / 28 / 41; the two-wall leaping mechanic (common to wall-jump games: check none is a close copy of a specific game); the ninja character (the Joulz hero in ninja gear, drawn in code: check it reads as generic, not a known character). All art is drawn in code; no third-party assets. |

## Renamed 3 Nov 2026: Iron Wall (was Bastion, back in rooms 1 Nov 2026)

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Iron Wall | `bastion` (unchanged) | first-person tank-defence shooter: aim a turret's crosshair from behind a wall, lead tanks down three lanes, hit exposed weak spots, shoot down drones crossing the sky, a timed fast-reload needle | **Bastion** (dropped 3 Nov 2026 as a trademark risk: it is the title of a 2011 video game by Supergiant Games) | "Iron Wall" (two common words) in classes 9 / 28 / 41 before the store launch; the fast-reload needle is a common genre idea (check no implementation is patented) |

The old display name "Bastion" was dropped as a trademark risk; the id `bastion` stays (ids never change: stored rounds,
practice bests and room history keep pointing at the same game). The art (the battlefield, its scenery, tanks, drones
and HUD drawn in code, `src/lib/arcade/bastionTank.renderer.ts`), the wave schedule, rules and scoring
(`docs/arcade-standard/bastion.md`) are original; no third-party art, fonts beyond the self-hosted OFL set, or sounds
beyond the existing library.

## Added 1 Nov 2026: Pyramid, Golf Solitaire and Muggins (Cards & Board)

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Pyramid | `pyramid` | patience: pairs adding to 13 from a 28-card pyramid | — | "Pyramid" is the traditional patience's common name; check for marks covering it as a game name in classes 9 / 28 / 41 |
| Golf Solitaire | `golfsol` | patience: one up or down onto a single foundation from seven columns | — | "Golf" / "Golf Solitaire" is the traditional patience's common name; check for marks covering it in classes 9 / 28 / 41 |
| Muggins | `muggins` | solo dominoes: open ends adding to multiples of five score (also called "All Fives") | — | "Muggins" is the traditional dominoes game's common name; check for marks covering it in classes 9 / 28 / 41 |

The cards and tiles are drawn in code (no deck, font or artwork copied); the rules are the traditional games', with the
app's own timing and scoring.

## Changed 3 Nov 2026: Pyramid shown as Thirteen; Golf Solitaire retired to practice

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Thirteen (was Pyramid) | `pyramid` | patience: pairs adding to 13 from a 28-card pyramid | "Pyramid" (the traditional patience's name, possibly covered by marks) | "Thirteen" as a card-game name in classes 9 / 28 / 41 (it is also the name of other, unrelated card games) |
| Golf Solitaire | `golfsol` | as above | — | now practice only (not dealt in rooms); the name is still shown on the Practice list's Retired section |

Display names only (`src/lib/duel/gameNames.ts`); ids, rules and stored rounds unchanged.

