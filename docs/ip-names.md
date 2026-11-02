# Game names for the solicitor's IP review

A running list for task 23 of the master plan (the solicitor's freedom-to-operate review). It records each game name
the app shows, the puzzle or genre it is, and what to check. Not legal advice; nothing here has been cleared.

## Added 1 Nov 2026: the new grid puzzles

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Fences | `fences` | loop puzzle: one closed loop round numbered cells | "Slitherlink" (a Nikoli title) | "Fences" as a puzzle-game name in classes 9 / 28 / 41 |
| Fillomino | `fillomino` | region puzzle: regions of N squares hold N | — | "Fillomino" is the puzzle's common name and is used by many publishers; check whether any mark covers it (Nikoli published the puzzle; the name is widely used generically) and decide whether to keep it or rename |
| Bridges | `bridges` | island-and-bridge connection puzzle | "Hashiwokakero" / "Hashi" (Nikoli titles) | "Bridges" as a puzzle-game name in classes 9 / 28 / 41 |
| Kakuro | `kakuro` | cross-sum number puzzle | — | "Kakuro" is the puzzle's common name; check for marks covering it in classes 9 / 28 / 41 |

The boards, art and rules text are original (generated in the app; no puzzle collection, font or artwork copied).

## Added 1 Nov 2026: Blockfall and Alley Roll (arcade)

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Blockfall | `blockfall` | falling-block line-clear game (Retro group) | "Tetris" and "tetromino" (The Tetris Company's marks), and Tetris's look and music | "Blockfall" as a game name in classes 9 / 28 / 41; the trade dress: our own block style (glass tiles with a neon rim and corner glint) and our own colours in Retro's cyan family, not the classic per-shape colours; no Tetris music (its bed is our own Fission Retro track). The 10 × 20 well, seven shapes, hold, ghost and three-piece preview are common to the genre |
| Alley Roll | `alleyroll` | ramp-and-rings alley ball game (Sports group) | "Skee-Ball" (a registered trade mark) | "Alley Roll" as a game name in classes 9 / 28 / 41; the art is our own (a warm wooden alley, a lit ring board and a scoreboard drawn in code), ring values 10–50 with two 100 pockets, library sounds only |

Both are working names; Joe may rename either (`src/lib/duel/gameNames.ts`; ids never change).

## Added 1 Nov 2026: Ricochet back as the ninja wall-climb (arcade)

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Ricochet | `ricochet` | two-wall leaping climb (Action group; back as an active game on `ricoRev` 2) | — | "Ricochet" (a common word) in classes 9 / 28 / 41; the two-wall leaping mechanic (common to wall-jump games: check none is a close copy of a specific game); the ninja character (the Joulz hero in ninja gear, drawn in code: check it reads as generic, not a known character). All art is drawn in code; no third-party assets. |

## Added 1 Nov 2026: Bastion (back in rooms)

| Shown as | Id | Genre (generic description) | Name chosen to avoid | To check |
| --- | --- | --- | --- | --- |
| Bastion | `bastion` | first-person tank-defence shooter: aim a turret's crosshair from behind a wall, lead tanks down three lanes, hit exposed weak spots, a timed fast-reload needle | — (the name is kept from our own October 2026 game) | "Bastion" is also the title of a 2011 video game by Supergiant Games: check the mark in classes 9 / 28 / 41 before the store launch; the fast-reload needle is a common genre idea (check no implementation is patented) |

The art (the battlefield, tanks and HUD drawn in code, `src/lib/arcade/bastionTank.renderer.ts`), the wave schedule,
rules and scoring (`docs/arcade-standard/bastion.md`) are original; no third-party art, fonts beyond the self-hosted OFL
set, or sounds beyond the existing library.
