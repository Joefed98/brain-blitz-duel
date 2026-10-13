# Speed & Attention polish: before and after (13 Oct 2026)

One contact sheet per game and phone size. Each sheet has a **before** row (`main` at eb143ad) and an **after** row (this branch, re-captured after merging main with #39–#42, #44, #46, #47 and #49), with four columns: intro, mid-play, completion effect and reveal.

## How the shots were taken

The method follows #9, and the capture scripts lived outside the repo:
- A local `vite dev` server ran for each tree: main in a git worktree, and this branch.
- Playwright drove the pre-installed Chromium at a device scale of 1.
- Each game was opened from `/practice` with the generate request rewritten to `example: true`, so every run gets the fixed intro example, and `Math.random` was seeded.

The four columns:
- **Intro:** the RoundIntro screen about 2.5 s after it opens.
- **Mid-play:** about 3 s after Ready, with light scripted taps in the arena or on the controls. Don't Break the Chain is left untouched here, because its first wrong tap ends the run.
- **Completion effect:** fired on the live board through a dev-server-only hook (`window.__duelzFxPreview.<id>()`, which is compiled out of production builds), then captured 500 ms in. The capture can't solve every puzzle, so finish effects are shown on the board as it stood. Main has no per-game completion effect.
- **Reveal:** the run is played out with random taps until it ends, then the AnswerReveal is captured about 1.5 s later. Scores therefore differ between the two rows.

Supabase is unreachable from the container, so intro demos show the app's fallback.

## Gaps above / below the play area (px)

The play area is the stage's content blocks other than `[data-game-controls]`. Above is measured from the top of the game region, under the top bar and timer. Below is measured to the first control, or to the column bottom if there are no controls. All values were taken on the mid-play frame.

| Game | 375x667 before → after | 390x844 before → after | 430x932 before → after |
|---|---|---|---|
| Flash | 0 / 0 → 10 / 10 | 58 / 58 → 10 / 10 | 72 / 72 → 10 / 10 |
| Bang On | 138 / 12 → 142 / 142 | 226 / 12 → 230 / 230 | 270 / 12 → 274 / 274 |
| Ascend | 0 / 12 → 10 / 10 | 43 / 12 → 10 / 10 | 57 / 12 → 10 / 10 |
| Don't Break the Chain | 12 / 0 → 12 / 12 | 12 / 35 → 24 / 24 | 12 / 63 → 38 / 38 |
| Bonk | 0 / 92 → 46 / 46 | 0 / 254 → 127 / 127 | 0 / 302 → 151 / 151 |
| Pull! | 0 / 0 → 55 / 55 | 0 / 121 → 135 / 135 | 0 / 149 → 157 / 157 |
| Mixed Signals | 0 / 12 → 12 / 12 | 0 / 12 → 62 / 62 | 0 / 12 → 77 / 77 |
| Eagle Eye | 0 / 12 → 26 / 26 | 0 / 12 → 107 / 107 | 0 / 12 → 131 / 131 |
| Double Take | 0 / 0 → 0 / 0 | 0 / 119 → 48 / 48 | 0 / 147 → 62 / 62 |
| Tally | 0 / 415 → 32 / 32 | 0 / 430 → 113 / 113 | 0 / 470 → 137 / 137 |
| Labyrinth | 0 / 12 → 39 / 43 | 0 / 12 → 120 / 124 | 0 / 12 → 144 / 148 |
| Matchmaker | 114 / 12 → 115 / 115 | 196 / 12 → 197 / 197 | 225 / 12 → 226 / 226 |

Notes on reading the table:
- **Large equal gaps on tall phones** come from boards whose size is set by the width, not the height: Matchmaker's six square columns, Eagle Eye, Labyrinth and Bonk's square grids, Pull!'s true 360:400 sky, Tally's fixed-size tray, and Bang On's fixed-height face.
- **Before, Pull! and Mixed Signals** were stretched to fill. They now keep the world's true aspect.
- **Labyrinth's 4 px difference** is the column's own gap.

## Sheets

| Game | 375x667 | 390x844 |
|---|---|---|
| Flash | [sheet](reaction-375x667.png) | [sheet](reaction-390x844.png) |
| Bang On | [sheet](stopwatch-375x667.png) | [sheet](stopwatch-390x844.png) |
| Ascend | [sheet](numhunt-375x667.png) | [sheet](numhunt-390x844.png) |
| Don't Break the Chain | [sheet](chain-375x667.png) | [sheet](chain-390x844.png) |
| Bonk | [sheet](whack-375x667.png) | [sheet](whack-390x844.png) |
| Pull! | [sheet](clayshoot-375x667.png) | [sheet](clayshoot-390x844.png) |
| Mixed Signals | [sheet](stroop-375x667.png) | [sheet](stroop-390x844.png) |
| Eagle Eye | [sheet](symscan-375x667.png) | [sheet](symscan-390x844.png) |
| Double Take | [sheet](spotdiff-375x667.png) | [sheet](spotdiff-390x844.png) |
| Tally | [sheet](countup-375x667.png) | [sheet](countup-390x844.png) |
| Labyrinth | [sheet](maze-375x667.png) | [sheet](maze-390x844.png) |
| Matchmaker | [sheet](pairmatch-375x667.png) | [sheet](pairmatch-390x844.png) |
