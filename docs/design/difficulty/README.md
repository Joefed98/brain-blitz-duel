# Difficulty levels: the framework

Phase 2 step 4, 15 Nov 2026 (agreed with Joe). Every game is getting four levels: **Easy, Normal, Hard, Expert**.
This page is the framework the family sessions plug their games into. It does not define any game's levels: until a
family session adds a game's levels, the game offers **Normal only, and Normal is exactly today's game**.

## The pieces

| Piece | File | What it is |
| --- | --- | --- |
| The level type | `src/lib/levels/levels.ts` | `LEVELS`, `Level`, `NORMAL`, `LEVEL_LABEL`, `puzzleLevel(puzzle)`, the stored key mapping, `MAX_ROUND_CLOCK_MS` |
| The registry | `src/lib/levels/gameLevels.ts` | `GAME_LEVELS`: per game, the levels beyond Normal and each one's settings; `levelsOf`, `resolveLevel`, `gameLevelSettings` |
| Where levels apply | `src/lib/levels/modes.ts` | `modeLevel(mode, requested)`: rated and the Daily are always Normal |
| The player's choice | `src/lib/levels/levelChoice.ts` | the catalogue's level and each game's own, on the device |
| The level switch | `src/components/levels/LevelSwitch.tsx` | the segmented control (style guide's Segmented) the catalogue, a game's page and room settings use |
| The tuning tool | `scripts/level-tune.ts` | bots on a game and level: average score and finish rate (`--human-limits`: the bots under about 0.25 s to react and 0.15 s to move, `HUMAN_LIMITS`; checkpoints at each game's own interval) |
| The check | `scripts/difficulty-check.ts` | the rules below |

## How a game adds levels (family sessions)

1. **One registry entry** in `GAME_LEVELS` (`src/lib/levels/gameLevels.ts`). Plain data only (the phone loads it):

   ```ts
   tents: {
     levels: {
       easy: { settings: { size: 6 }, oneSolution: { proof: "scripts/tents-levels-check.ts" } },
       hard: { settings: { size: 9 }, oneSolution: { proof: "scripts/tents-levels-check.ts" } },
     },
   },
   ```

   Normal has no entry: it is today's game. List only the levels the game has; the selectors show only those.
2. **The generator reads the level.** The deal (`generatePuzzle` in `generate.server.ts`) resolves the level asked
   for against the registry (a level the game doesn't offer is Normal) and hands it to the game's generator as
   `context.level`; read the settings with `gameLevelSettings(type, level)`. At Normal the context carries no level and
   the generator must deal exactly what it deals today.
3. **The deal stamps the level itself**: the puzzle gets `level: "hard"` (only when it isn't Normal, so every Normal
   deal is byte for byte today's and every stored round without the field is Normal). Stamp anything else your stage
   or grader needs (a board size is usually already in the board) on the puzzle as usual. A different clock is the
   puzzle's own `timeLimitMs` (or the game's existing clock stamp).
4. **Grade from the stored puzzle**: `puzzleLevel(puzzle)` says which level it was dealt at. Older stamps and every
   puzzle without the field grade exactly as before (the version-stamp rule).
5. **Arcade games** whose sim changes with the level give their skill-band spec a `gameForPuzzle(puzzle)`
   (`scripts/arcade-skill-bands/games.ts`) so the tuning tool's bots play the level's world.
6. Tune with `bun scripts/level-tune.ts <game> --level=all`, then prove the level's boards (the one-solution rule).

Nothing else needs touching: the catalogue, a game's page, room settings, practice bests and stars, analytics and
the server's enforcement all read the registry.

## Where levels apply (and how the server enforces it)

- **Practice**: every level the game has, all open from the start. The phone sends the level with the deal request
  (`practiceGenerateFn`'s `level`, validated as one of the four); the server deals `modeLevel("practice", level)`,
  resolved against the game's levels. The level then rides in the sealed deal, so the grade, the stored play's
  `practice_plays.level` and the bests and stars all follow the deal, never the phone. Offline packs hold Normal deals
  only: another level needs a connection (the page says so).
- **Rooms**: the host picks one level in room settings (the Difficulty row). It is stored as a `level:<level>` token in
  `duels.selected_categories` after the others, and only when it isn't Normal, so every room saved before levels reads
  as it did. The room's start deals every round at that level (`buildRoomPuzzles` → `dealRounds`), so every player gets
  the same deal; a game without the level plays Normal. Only the host writes it (`changeRoomSettings`, validated).
- **Tournaments**: `tournament_events.level` (default `normal`, migration `20261118200000_difficulty_levels.sql`). The
  Score Attack deal reads it; no tournament rule changed, and the Arena and the Category Cup's matches deal Normal
  through the rated match builder.
- **Rated matches and the Daily: always Normal.** Their deals name `modeLevel("rated" | "daily", …)`, which is Normal
  whatever is asked. Ratings never mix levels: a recorded run holding a game at another level is refused
  (`recordedRefusal` → `"level"`), and a game's version (`gameVersionOf`) includes its level, so it never matches
  today's Normal deal.

## Bests and stars per level

Kept separately per game and level (`practice_progress`, one row per player, game and level, from wave 2 C1a). Every
row stored before levels is on the level the database calls `classic`, which **is Normal**; the stored key stays
`classic` (no row is rewritten) and the app reads it as Normal (`storedLevelKey` / `levelFromStored`; SQL
`public.level_name`). Stars are earned on Easy, Normal and Hard (175+; Expert's crown comes later), as before.
Challenges stay on Normal for now: a run at any other level completes none.

## The player's choice

Remembered per game on the device (`duelz-levels:v1`): the catalogue's difficulty switch sets the level for every game
(and clears each game's own choice); a game page's selector sets that game's. Accounts have no synced settings yet, so
the choice is not on the account (see "For Joe" in the PR).

## The Games page top (in this order)

1. The **Puzzles | Arcade** switch (restored; counts from the registry; remembered on the device).
2. The switch's **categories as colour tiles** in one sideways-scrolling row (puzzle categories, or arcade groups); a
   tap shows that category, a second tap the whole side.
3. The **difficulty switch** (Easy · Normal · Hard · Expert): tiles show that level's best and mark that level's star;
   a game without the level says "Normal". Play from a tile or a game's page starts at it.

## Standing rules (difficulty-check enforces them)

- **No game, at any level, has a clock longer than 120 s.** difficulty-check deals every active game at every level it
  offers (and at one it lacks) and reads the dealt puzzle's clock (an arcade run's 3 s of slack is not play).
- **Every puzzle board at every level has exactly one solution, proven by its generator or bank.** Each non-Normal
  level of a puzzle game names its proof in the registry: `oneSolution: { proof: "scripts/<x>-check.ts" }` (a check
  that runs in CI and proves the level's boards, generator or bank), or `{ open: "<why>" }` for a game whose answers are
  open by design (word finds, reaction games). difficulty-check fails on a level with neither or a missing script.
- **Rated and the Daily are always Normal; ratings never mix levels.**
- Normal is today's game: a Normal deal is byte for byte the deal before levels (difficulty-check samples it;
  deal-identity-check covers every game).

## Tuning a level

```bash
bun scripts/level-tune.ts tents --level=all --seeds=20
```

Plays the game's existing bots on real deals at the level (`generatePuzzle(game, { bankSeed, level })`) and reports
the average and median score and the finish rate, graded by the server's own code: puzzles play the puzzle-fairness
kits at Great and Near-perfect; arcade games play their skill-band bots at Near-perfect and Elite, graded through the
server replay on the dealt puzzle. Joe's elite targets: **about 198 on Normal, 160 on Hard, 140 on Expert, mostly
finishing.** A line ending "(no hard level: dealt normal)" means the game doesn't offer that level yet.

## Analytics

`game_started` and `game_finished` (rooms, practice, the Daily, challenges) carry `props.level`; `room_started`
carries the room's level. Nothing else in the event list changed.
