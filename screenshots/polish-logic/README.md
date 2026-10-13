# Logic polish: before and after (13 Oct 2026)

Drawing, animation, layout and effects for the eleven Logic games. No sim, rule, scoring or stamp changes.
"Before" is `main` at eb143ad; "after" is this branch.

## How they were made

`bun scripts/logic-polish-shots.ts --url=<dev server> --tag=before|after` (in this repo). PR #9's capture
scripts were never committed, so this re-creates its method: Playwright driving the pre-installed Chromium at
device scale 1, each game opened from `/practice` with the generate request switched to the fixed intro example
(`INTRO_EXAMPLE_SEED`) and `Math.random` seeded, so before and after show the same puzzle. The script builds the
same example with the server's own generator to know the solution and plays it through the real UI.

- **Intro**: RoundIntro about 2.5 s after it opens (Supabase is unreachable here, so intro demos show the fallback).
- **Mid-play**: after the first half of the solution's moves.
- **Solve +120 / +450 / +850 ms**: frames after the final, solving move. Practice swaps to the reveal as soon as
  the local grade returns, so the script holds the practice grade request 1.5 s to keep the stage on screen for
  these frames. (In a room the stage stays up under the Locked overlay.) Bomb Defusal has no client-side solve:
  its frames show the panel freezing after DEFUSE; the green light is on the verified reveal.
- **Reveal**: the AnswerReveal about 1.8 s after the score arrives, for the solved run.

Frame times are wall-clock, so an animation can sit a few tens of ms either side of the label. Fonts and
rendering are headless Chromium on Linux, not a phone.

## Contact sheets

| Game | | |
|---|---|---|
| Blackout | [375×667](lightsout-375x667.jpg) | [390×844](lightsout-390x844.jpg) |
| Box Six | [375×667](sudoku-375x667.jpg) | [390×844](sudoku-390x844.jpg) |
| Hanoi | [375×667](tower-375x667.jpg) | [390×844](tower-390x844.jpg) |
| Polypotions | [375×667](tubes-375x667.jpg) | [390×844](tubes-390x844.jpg) |
| Safe Cracker | [375×667](safe-375x667.jpg) | [390×844](safe-390x844.jpg) |
| Bomb Defusal | [375×667](bomb-375x667.jpg) | [390×844](bomb-390x844.jpg) |
| Mosaic | [375×667](nonogram-375x667.jpg) | [390×844](nonogram-390x844.jpg) |
| Colour Flood | [375×667](flood-375x667.jpg) | [390×844](flood-390x844.jpg) |
| Tents and Trees | [375×667](tents-375x667.jpg) | [390×844](tents-390x844.jpg) |
| Shikaku | [375×667](shikaku-375x667.jpg) | [390×844](shikaku-390x844.jpg) |
| Lamplighter | [375×667](lightup-375x667.jpg) | [390×844](lightup-390x844.jpg) |

## Gaps above and below the play area (px, before → after)

Measured in the browser in the mid-play state. The play area is everything drawn in the stage except the bottom
controls: the status line and board (Safe Cracker: clue card and door; Bomb Defusal: rule card and panel). "Above"
is from the top of the game region (just under the timer) to the top of the play area; "below" is from the bottom
of the play area to the top of the bottom controls (Blackout, Box Six, Hanoi, Polypotions: their buttons; Safe
Cracker: TRY; Bomb Defusal: the DEFUSE row; Colour Flood: the colour pots), or to the bottom of the region when a
game has none (Mosaic, Tents and Trees, Shikaku, Lamplighter).

| Game | 375×667 | 390×844 | 430×932 |
|---|---|---|---|
| Blackout | 45 / 24 → **65 / 64** | 126 / 24 → **146 / 145** | 150 / 24 → **170 / 169** |
| Box Six | 28 / 12 → **36 / 36** | 109 / 12 → **117 / 117** | 133 / 12 → **141 / 141** |
| Hanoi | 0 / 12 → **56 / 55** | 0 / 12 → **144 / 143** | 0 / 12 → **188 / 187** |
| Polypotions | 0 / 58 → **13 / 12** | 0 / 69 → **15 / 14** | 0 / 75 → **59 / 58** |
| Safe Cracker | 70 / 8 → **81 / 81** | 158 / 8 → **151 / 151** | 202 / 8 → **195 / 195** |
| Bomb Defusal | 0 / 12 → **12 / 12** | 19 / 12 → **51 / 51** | 53 / 12 → **105 / 105** |
| Mosaic | 0 / 194 → **97 / 97** | 0 / 358 → **179 / 179** | 0 / 410 → **205 / 205** |
| Colour Flood | 0 / 12 → **61 / 61** | 0 / 12 → **142 / 142** | 0 / 12 → **166 / 166** |
| Tents and Trees | 0 / 164 → **85 / 84** | 0 / 326 → **166 / 165** | 0 / 374 → **190 / 189** |
| Shikaku | 0 / 174 → **87 / 86** | 0 / 351 → **168 / 167** | 0 / 439 → **192 / 191** |
| Lamplighter | 0 / 180 → **87 / 86** | 0 / 357 → **168 / 167** | 0 / 445 → **192 / 191** |

Square boards are as wide as the column allows at every size (their height then leaves equal space above and
below); Hanoi's rings grow with the height up to 30 px; Polypotions' flasks and Bomb Defusal's panel take the
height they can use.

## Raw measurements

`before-measure.json` and `after-measure.json`: gaps for an empty and a half-played board at each size, plus, at
375×667, reveal checks for the solved run and a half-played run that times out (scrolling, clipping, smallest
font, lowest text contrast against the nearest solid background, and the sound cues fired). The contrast figure
ignores gradients, so text on a gradient (Safe Cracker's brass drums: dark ink on brass, about 7:1) can read low there.
