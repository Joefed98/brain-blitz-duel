# Word polish: before and after (13 Oct 2026)

Display-only polish for the ten word games: Nucleus (`wordsmith`), Forage (`wordhunt`), Interlock
(`tilegrid`), Slider (`wordslide`), Lookout (`wordsearch`), Roundabout (`letterwheel`), Strikeout,
Cryptogrid (`codeword`), Swapword and Letterfall (`wordfall`). "Before" is `main` at eb143ad; "after"
is this branch. No rules, scoring, generation or sim changes.

## How they were made

`scripts/word-polish-shots.ts` (the October snapshot method from #9, now in the repo): a local
`vite dev` server, Playwright driving the pre-installed Chromium at device scale 1, each game
opened from `/practice` with the generate request rewritten to the fixed intro example and
`Math.random` seeded, so before and after show the same puzzle. One contact sheet per game and
size (`<game>-375x667.jpg`, `<game>-390x844.jpg`): the before row above the after row, five frames each:

- **Intro**: the round intro 2.5 s after it opens (Supabase is unreachable here, so intro demos show the fallback).
- **Mid-play**: after a few scripted taps (Interlock places HUNK and Lookout traces FINLAND from the example's answers).
- **Completion effect**: about 350 ms into the effect. The dev-only `duelz-dev-word-finish` event plays it on the
  board as it stands (solving every example by hand in a script was out of reach), so Nucleus, Forage and Letterfall
  show it on a mid-play board, and the other games on a partly solved one. Before = the same moment on `main`, which has no effect.
- **Reveal (timed out)**: the page clock is run past the buzzer, so practice grades what was entered (as #9).
- **Reveal (full answer)**: a layout stress test. The grade request carries a full answer from
  `scripts/word-polish-answers.ts` (every Nucleus word, Forage's 30 longest, the solutions elsewhere), so the
  reveal shows its fullest list or grid with the real server score. Slider and Letterfall have none (no solver / an engine run).

Headless Chromium on Linux, not a phone: Joe does the device testing.

## Gaps above / below the play area (px), with the board size

Measured mid-play from the board's edges to the nearest drawn thing above (top bar, timer, HUD row) and
below (the first control). Target: equal within 8 px.

| Game | 375×667 before | 375×667 after | 390×844 before | 390×844 after |
|---|---|---|---|---|
| Nucleus | 40 / 12 (338×338) | 12 / 12 (367×367) | 40 / 12 (382×382) | 93 / 93 (382×382) |
| Forage | 40 / 36 (367×367) | 40 / 36 (367×367) | 40 / 36 (382×382) | 40 / 36 (382×382) |
| Interlock | 47 / 15 (353×353) | 26 / 22 (367×367) | 122 / 13 (381×381) | 108 / 104 (381×381) |
| Slider | 96 / 19 (372×312) | 74 / 78 (372×312) | 184 / 19 (372×312) | 157 / 161 (382×322) |
| Lookout | 8 / 12 (367×367) | 8 / 12 (367×367) | 8 / 12 (382×382) | 8 / 12 (382×382) |
| Roundabout | 12 / 16 (217×475) | 12 / 8 (217×483) | 57 / 16 (260×561) | 61 / 57 (260×561) |
| Strikeout | 24 / 34 (260×276) | 20 / 23 (275×291) | 61 / 72 (260×276) | 20 / 23 (342×358) |
| Cryptogrid | 12 / 12 (323×323) | 12 / 12 (323×323) | 23 / 23 (360×360) | 12 / 12 (382×382) |
| Swapword | 24 / 33 (336×336) | 8 / 14 (367×367) | 31 / 41 (336×336) | 8 / 14 (382×382) |
| Letterfall | 8 / 16 (299×479) | 8 / 16 (299×479) | 8 / 61 (382×611) | 8 / 61 (382×611) |

Letterfall's canvas sits in the shared arcade arena slot (`ArcadeCanvasStage`), which keeps every arcade world
at a fixed top with spare height below, by design and guarded by presentation-geometry-check. It can only be
centred there, so it is left as is (8 / 61 px at 390×844).

At 430×932 (after): Nucleus 117 / 117, Forage 40 / 36, Interlock 134 / 130, Slider 206 / 210 (board 422 wide),
Lookout 8 / 12, Roundabout 100 / 96, Strikeout 21 / 24, Cryptogrid 13 / 13, Swapword 19 / 25, Letterfall 8 / 85 (shared slot).

## Reveals at 375×667: overflow · smallest text · lowest text contrast

Overflow is how far the reveal would have to scroll (0 = fits). Smallest text counts every glyph,
board letters included. Contrast is against the painted background (gradient stops included).

| Game | before, timed out | after, timed out | before, full answer | after, full answer |
|---|---|---|---|---|
| Nucleus | 0 px · 16 px · 3.23 | 0 px · 12 px · 6.79 | 508 px · 16 px · 3.23 | 0 px · 12 px · 6.79 |
| Forage | 0 px · 16 px · 6.79 | 0 px · 14 px · 6.79 | 632 px · 16 px · 6.79 | 0 px · 14 px · 6.79 |
| Interlock | 0 px · 12 px · 6.79 | 0 px · 14 px · 6.79 | 0 px · 12 px · 6.79 | 0 px · 14 px · 6.79 |
| Slider | 0 px · 16 px · 6.79 | 0 px · 16 px · 6.79 | – | – |
| Lookout | 0 px · 9 px · 4.24 | 0 px · 14 px · 6.01 | 0 px · 9 px · 9.36 | 0 px · 14 px · 9.36 |
| Roundabout | 0 px · 15 px · 11.02 | 0 px · 16 px · 11.02 | 0 px · 15 px · 9.36 | 0 px · 16 px · 9.36 |
| Strikeout | 0 px · 14 px · 6.22 | 0 px · 14 px · 6.22 | 0 px · 14 px · 10.91 | 0 px · 14 px · 10.91 |
| Cryptogrid | 0 px · 8 px · 5.39 | 0 px · 14 px · 6.22 | 0 px · 8 px · 5.39 | 0 px · 16 px · 8.75 |
| Swapword | 0 px · 14 px · 6.22 | 0 px · 14 px · 6.22 | 0 px · 16 px · 10.91 | 0 px · 16 px · 10.91 |
| Letterfall | 0 px · 10 px · 6.79 | 0 px · 10 px · 6.79 | – | – |

Letterfall's reveal is the shared arcade reveal (ArcadeReveal), outside this pass; its 10 px stat labels are noted for its owner.

## On the merged code (main with #39–#44 and #46–#49)

Layout 2 (#41) gives every arena auto top/bottom margins. In the word games these stacked with the
column's own split and pulled HUD rows and banners off their boards: Slider 52 / 99, Cryptogrid 12 / 4,
and Lookout's category, Forage's points row and Swapword's swaps pill drifted 20–40 px off their boards.
`wordPolish.css` cancels #41's arena margins inside the ten word stages, and keeps Cryptogrid's
code key 12 px under its grid (as #49 did for Tenfall). Gaps above / below the play area (px), board in brackets:

| Game | 375×667 | 390×844 | 430×932 |
|---|---|---|---|
| Nucleus | 12 / 12 (367) | 93 / 93 (382) | 117 / 117 (422) |
| Forage | 40 / 36 (367) | 40 / 36 (382) | 40 / 36 (422) |
| Interlock | 26 / 22 (367) | 108 / 104 (381) | 134 / 130 (416) |
| Slider | 74 / 78 (372×312) | 157 / 161 (382×322) | 181 / 185 (422×362) |
| Lookout | 8 / 12 (367) | 8 / 12 (382) | 8 / 12 (422) |
| Roundabout | 12 / 8 (217×483) | 61 / 57 (260×561) | 100 / 96 (260×572) |
| Strikeout | 20 / 23 (275×291) | 20 / 23 (342×358) | 21 / 24 (380×396) |
| Cryptogrid | 12 / 12 (323) | 12 / 12 (382) | 13 / 13 (420) |
| Swapword | 8 / 14 (367) | 8 / 14 (382) | 19 / 25 (400) |
| Letterfall | 8 / 16 (299×479) | 8 / 61 (382×611) | 8 / 85 (422×675), shared arcade slot, top-aligned |

All ten reveals still fit 375×667 with no scrolling on the merged code, with main's scores (0 px overflow, smallest text 12 px, lowest contrast 6.0:1).
