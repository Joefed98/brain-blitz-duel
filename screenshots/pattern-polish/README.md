# Pattern polish: before and after (13 Oct 2026)

Drawing, animation, layout and completion effects for the ten Pattern games. No sim, rule, grading or scoring
changes and no stamps. "Before" is `main` at eb143ad; "after" is this branch.

## How they were made

`scripts/pattern-shots/capture.ts` (Playwright with the pre-installed Chromium, device scale 1) drives a local
`vite dev` server through the real `/practice` route. The capture scripts from the October snapshots (#9) were
never committed, so this is a new tool built the same way. It is now the shared screenshot tool,
`scripts/shots/capture.ts` (`bun scripts/shots/capture.ts --category=pattern --tag=after`), with these drivers in
`scripts/shots/drivers/` and `scripts/shots/sheets.ts` for the sheets:

- The generate request is rewritten to `example: true`, so every run plays the game's fixed intro example.
  `Math.random` is seeded. Supabase is unreachable from the container, so Gridlock uses the built-in bank
  (`scripts/shots/examples.ts` reproduces it) and intro demos show the app's fallback.
- Games whose stage keeps `useStageState` are seeded part-way (mid-play) or one step short of the solve through
  the real hook (`scripts/shots/seed.tsx`). The solving input is then made for real. Gridlock and
  Tessellate keep local state, so their drivers play every move with real drags. Every reveal shows a real
  solved round graded by the server.
- **Intro**: the RoundIntro screen, 2.5 s after it opens. **Mid-play**: about 1.8 s after Ready, with the
  seeded or played partial solve. **Solve +0.15 / +0.5 / +0.9 s**: after the solving input. Skid and
  Lightbender are timed from when the slide or shot ends. **Reveal**: 1.5 s after the score lands.
- The practice grade request is held for 2.2 s so the solved board stays up long enough to photograph. A room
  keeps the locked board up instead, dimmed by the shared frame.
- A sheet script (now `scripts/shots/sheets.ts --scale=0.5`) builds one sheet per game and viewport (before row, after row, half scale).

## Contact sheets

| Game | 375 × 667 | 390 × 844 |
|---|---|---|
| Gridlock (`unblock`) | [sheet](unblock-375x667.png) | [sheet](unblock-390x844.png) |
| Tessellate (`blockparty`) | [sheet](blockparty-375x667.png) | [sheet](blockparty-390x844.png) |
| Skid (`iceslide`) | [sheet](iceslide-375x667.png) | [sheet](iceslide-390x844.png) |
| Topsy-Turvy (`gravity`) | [sheet](gravity-375x667.png) | [sheet](gravity-390x844.png) |
| Jumbled (`tiles`) | [sheet](tiles-375x667.png) | [sheet](tiles-390x844.png) |
| Turntable (`rings`) | [sheet](rings-375x667.png) | [sheet](rings-390x844.png) |
| Lightbender (`laser`) | [sheet](laser-375x667.png) | [sheet](laser-390x844.png) |
| Chroma Lines (`flow`) | [sheet](flow-375x667.png) | [sheet](flow-390x844.png) |
| Pipeline (`pipes`) | [sheet](pipes-375x667.png) | [sheet](pipes-390x844.png) |
| Heave (`push`) | [sheet](push-375x667.png) | [sheet](push-390x844.png) |

## Gaps above and below the board (px), with board width

The gap is measured from the board to the nearest element above it in the stage column (a status line, or the
top of the game region) and to the first element below it (the controls, or the bottom of the region). The
measurement uses the capture tool at 375 × 667, 390 × 844 and 430 × 932. Boards that already fill the width
keep the shared 8 px / 12 px stack spacing; their block (status, board, controls) is now centred as a whole.

| Game | 375×667 before → after | 390×844 before → after | 430×932 before → after |
|---|---|---|---|
| Gridlock (`unblock`) | 12 / 12 (367) → 12 / 12 (367) | 12 / 12 (382) → 12 / 12 (382) | 12 / 12 (422) → 12 / 12 (422) |
| Tessellate (`blockparty`) | 8 / 12 (367) → 8 / 12 (367) | 8 / 12 (382) → 8 / 12 (382) | 8 / 12 (422) → 8 / 12 (422) |
| Skid (`iceslide`) | 8 / 12 (367) → 8 / 12 (367) | 8 / 12 (382) → 8 / 12 (382) | 8 / 12 (422) → 8 / 12 (422) |
| Topsy-Turvy (`gravity`) | 8 / 12 (367) → 8 / 12 (367) | 8 / 12 (382) → 8 / 12 (382) | 8 / 12 (422) → 8 / 12 (422) |
| Jumbled (`tiles`) | 85 / 12 (286) → 59 / 59 (351) | 174 / 12 (286) → 140 / 140 (366) | 218 / 12 (286) → 164 / 164 (406) |
| Turntable (`rings`) | 8 / 12 (367) → 8 / 12 (367) | 8 / 12 (382) → 8 / 12 (382) | 8 / 12 (422) → 8 / 12 (422) |
| Lightbender (`laser`) | 8 / 12 (367) → 8 / 12 (367) | 8 / 12 (382) → 8 / 12 (382) | 8 / 12 (422) → 8 / 12 (422) |
| Chroma Lines (`flow`) | 12 / 73 (367) → 79 / 79 (367) | 12 / 154 (382) → 160 / 160 (382) | 12 / 178 (422) → 184 / 184 (422) |
| Pipeline (`pipes`) | 24 / 157 (343) → 79 / 79 (367) | 24 / 320 (357) → 160 / 160 (382) | 26 / 369 (395) → 184 / 184 (422) |
| Heave (`push`) | 8 / 12 (367) → 27 / 31 (367) | 8 / 12 (382) → 108 / 112 (382) | 8 / 12 (422) → 132 / 136 (422) |

Every reveal measured 0 px of hidden overflow at all three sizes.
