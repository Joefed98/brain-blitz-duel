# The effects pass (15 Nov 2026)

The shared frame's and the app's big moments, made richer. Presentation only: no game's play, deal, timing, grading,
scoring or stamp changed, and RoundIntro's behaviour and timing are unchanged. Gallery:
`docs/design/pages-review/effects/GALLERY.md`.

## Rules every moment keeps

- **Celebrations off** (`FX_CELEBRATIONS`): every screen's markup exactly as before (celebrations-off.json). The new
  markup (the lineup, the round numeral, the rich overlay parts, the entrance attributes) is drawn only with them on.
- **Reduced motion**: the room overlay's parts run the calm fade (`rfx-calm`); movement-only parts (embers) are not
  drawn; entrances, the count-up and the lightning are skipped (reduced-motion-end-check lists each part).
- **Reduced effects** (low-end step down, Battery saver): the rich parts, the entrances and the lightning are skipped.
- **Minimal glow, no glare**: soft gold at low opacity, no full-screen white; the strikes brighten the screen only on GO.
- **During play**: nothing new over a board while a game runs; the 3-2-1 strikes are behind the countdown, before play.
- Transform and opacity only (room-moments-check, fx-check).

## The moments

| Moment | Where | What changed |
|---|---|---|
| Prepare to Duel | `DuelStart.tsx`, `roomMoments.ts` `PREPARE_SPEC` | The players' mini cards arrive one by one under the logo (`DuelLineup`, `LINEUP_*`), VS between two; a floor glow, rising embers, a light sweep and two charge rings build to the flash. |
| Round n title | `RoundTitle.tsx`, `ROUND_BACKDROPS` | Each round adds one of five backdrops in turn (rays, grid, orbs, stripes, pulse rings) under its look, and the round's numeral large and faint behind the title. |
| Final round | `FINAL_SPEC` | Rays, a burst of 20 sparks and a ★ in place of the numeral, on top of the existing punch. |
| 3-2-1 lightning | `celebrationCanvas.ts` `strike`, `countdownStrike` | A small strike on each of 3, 2, 1 and the GO strike, each built fresh: 1–3 bolts, their origins, forks, length, timing and a re-strike flicker vary every time. |
| Answer reveal, results, standings, podium, final, Daily and challenge results | `useMomentEnter` | One entrance: the screen's blocks rise (results tables) or fade (reveal, standings, podium, final) in a short stagger. |
| Tab and pushed pages | PhoneShell `data-page-enter` | A 220 ms fade on arrival. |
| Badge earned | `BadgeMoment` | The kit's new-best burst on the badge. |
| Pass level-up | `PassLevelNotice` | The new-best burst. |
| Reward claimed | `PassScreen` | The kit's win moment on the claimed level. |
| Season reward | `SeasonNotice` | The win moment. |
| Practice challenge done | `ChallengeMoments` | The match moment (silent). |
| Tournament result | `TournamentEvent` | The win moment on your total once the event is done. |
| New trophy | `TrophyCabinet` | The new-best burst on a trophy not seen before on this device (`duelz-trophy-seen:v1`). |
| Rating change | `RatedMatchScreens` `RatingCountUp` | The rating counts up from the one before the match on a decorative copy; the real figure never changes. |

## Pass-3 answers in the same PR

- **Phones' status panel** (`PhoneStatus` in `ArenaGamePanel.tsx`): on a phone's live puzzle round, where 72 px or more
  is free above the board, the goal and the live figures (moves, par, filled, mistakes) show there in larger type; the
  same figures above the board are hidden (`data-phone-mirrored`), pills under the board stay. phone-gap-check proves it.
- **The room's finished strip** sits just below the timer bar (puzzles) or above it inside the header (arcade), never over
  it (room-extras-check keeps it off the bar).
- **The reveal heading** follows what is shown: "Your answer", "The solution" or "Answer and solution"
  (`src/lib/duel/revealHeading.ts`, every game audited; a Solution / Yours switch names the side shown).
- **Short phones** (`SHORT_REVEAL_QUERY`, 720 px tall and under): practice's stars join the score line and the best in one
  block under the verdict, and the reveal's gaps and verdict card tighten, so each game's own reveal keeps its size.
  At 375 × 667, of the 18 puzzles drawn below full size, 15 now draw at full size or larger; Slider 0.51 → 0.93,
  Eagle Eye 0.64 → 0.98, Counterweight stays 0.5 (its own list of attempts is taller than the screen).

app-moments-check (~1 s) proves the wiring of all of it.
