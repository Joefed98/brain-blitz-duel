# E8: Tilt expansion (tiltRev 7, 25 Oct 2026)

Part of expansion session E8 (Wavefront, Scrumper, Tilt). Tilt's round maximum is 200 (`ROUND_MAX`); new
rooms deal `tiltRev: 7` (`TILT_REV_EXPAND`). Every older revision plays and scores exactly as before.

## What changed

**More world.** Three bigger mazes (`TILT_X_SIZES` 13, 15 and 17 cells across at 30 px a cell, against
tiltRev 6's four mazes of 11–13 cells in a 360 px disc) in a taller world, 440 × 820 (`TILT_X_W` ×
`TILT_X_H`, was 440 × 470), which fills the iPhone 11 home-screen app's arena box (414 × 772) edge to edge.
The second and third mazes are wider than the screen: the renderer's camera follows the marbles still
rolling (their middle, pulled a third of the way back toward the disc's centre so more maze is in view),
eased, and the drawing turns about the screen's centre, so the marbles stay near the middle while the board
spins round them. Display only: the sim turns gravity into the maze frame by the angle alone, whichever
point the drawing turns about, and the drag input (horizontal deltas) is unchanged. A marble the camera
cannot show gets an arrow on the screen's edge in its colour. The cup sits at the rim cell whose route is
nearest `TILT_X_ROUTE` (50, 58, 52 cells for the blue marble; the third maze also has the amber one), so the
mazes have far more off the route to find. Black holes 1, 2, 3; the amber marble from maze 3
(`TILT_X_TWO_FROM`), as tiltRev 6's last half; no red chaser.

**Skill features** (all seeded on the decoration stream, gated on `xp: 1` in the state):
- *Ice zones*: frosted cells (`maze.ice`): the marble keeps its speed there (no rolling drag) up to 4.8 px a
  tick (`TILT_X_ICE_CAP`, 3.6 elsewhere), so it slides on past a turn or into a hole. Two or three patches of
  five cells on the routes, and every quick star's side passage.
- *Keys and gates*: the old padlock gate generalised. A gate across the blue route (between 30 % and 75 % of
  the way) and, in the two-marble maze, one across the amber route's own part; each is a wall for both marbles
  until either marble rolls over its key (brass, then verdigris; key and gate share a colour), which waits two
  to ten cells into a side passage on the start's side. `tiltCupReachableX` proves every key reachable with
  every gate shut (gates opening as their keys are taken) and both cups reachable after; the dealer re-deals
  any seed that fails it or has a maze with no key (`tiltSeedReachableX`, `tiltExpandHasKeys`; about 5 % of
  seeds).
- *Time-bonus stars* ("quick stars"): two per maze, three to seven cells into an icy side passage off the
  route's first half, each with a ring that drains over 20 s from the maze's start (`TILT_X_QUICK_WINDOW`).
  Taken within 12 s (`TILT_X_QUICK_FULL`, the ring still pale gold) one is worth 8, then less as the ring
  turns amber and runs out (`tiltQuickPoints`); after 20 s it is gone. All six add 2 more (`TILT_X_SWEEP`).
- Kept: two marbles at once (blue and amber, each to its own cup), the gold stars at the black holes'
  mouths (two per maze), the black holes.

**Score** (`tiltXBandParts`, `scoreX`): mazes 40, progress through the maze being played up to 39, stars 5
on `TILT_V7_BAND_CURVE` (units 0 45 85 115 130 150 → 0 45 60 72 104 140), finishing all three adds up to
10 for speed (full by 72.5 s, falling to 0 at the buzzer; `TILT_X_FINISH_MIN` 55 s), quick stars add up to
50: `bandTotal(parts, acted, 200)`. Not routed through `bandCurveOf` / `bandStrict` (no strict row). A run
with no input scores 0. The extra 50 above 150 can only come from quick stars.

**Texts.** Intro: GOAL unchanged; HOW "Drag left or right to spin the maze." / "Keys open gates; grab quick
stars early." / "From maze 3, two marbles, each to its own cup." (arcade-batch4-check allows three lines of
46 characters); SCORE "Mazes, progress and stars; early quick stars add more. All 3 mazes quickly: up to
{max}." The "?" help adds keys and gates, quick stars and ice, and its score line comes from the new curve
(`liveBandHelp`, ending "Up to 200."). The intro shows its still: older demos are stopped for tiltRev 7
(`introDemo.functions.ts`). **The intro demo needs re-recording on tiltRev 7.**

**Art** (`tiltArt.renderer.ts`, the A4 Toybox look): the screen-fixed oak table with its planks and
lamplight pool sized to the taller world; the disc, its grain, groove, drop shadow and bevelled rim drawn at
each maze's radius and moving with the camera; the disc, its holes, ice and carved strips baked into one
sprite per maze and scale (drawn rotated each frame, as the old reduced-effects path did); frosted ice cells
with glints; brass and verdigris keys with a soft glow (light only); gate bars with a keyhole plate that
swing open and fade (the old padlock gate's swing); quick stars as the gold star with a draining ring; the
marbles with their screen-fixed shadow and gloss. The HUD keeps "Maze n / 3" and "Stars a / b" and adds the
quick stars left with the window's ring. The success layer (`TILT_X_FX`) keeps tiltRev 6's moments in order
(the replay moments read them by index) and adds QUICK STAR! and GATE OPEN! pops, each at the marble's place
under the last camera drawn. Reduced motion: the camera eases faster (no long drift), the key and gate
animations snap. Reduced effects: no gloss, no key glow, the strips' lite pass. Arcade bounds: everything
that collides (walls, gates, holes, cups) is drawn on its sim edges; keys and stars are pickups, drawn
within their pickup square.

**Sound** (no new files or manifest entries): a quick star plays Tilt's gold-star chime a little higher
(`tilt.starTaken`, rate 1.25), a key plays the gate latch (`tilt.gate`), in `tiltSounds` (`gameSounds.ts`).

## Tuning: old versus new

Skill-band bots (`bun scripts/arcade-skill-bands.ts tilt --rev=now --seeds=40`), the same 40 room seeds,
server replay scores. "Top 10 %" is the 90th percentile.

| Level | tiltRev 6 median | top 10 % | best | tiltRev 7 median | top 10 % | best | median change |
|---|---|---|---|---|---|---|---|
| Average | 71 | 131 | 140 | 65.5 | 112 | 133 | −8 % |
| Good | 101.5 | 135 | 140 | 110 | 162 | 182 | +8 % |
| Great | 131 | 144 | 148 | 122.5 | 176 | 190 | −6 % |
| Near-perfect | 129.5 | 145 | 148 | 121 | 181 | 193 | −7 % |

A flawless player (`bun scripts/tilt-expand-best.ts --seeds=200`: the bot with no lag, aim error, slips or
misreads, taking every star and quick star): median 131, top 10 % 185, best 200; two of the 200 seeds reach
200 (both stored in `scripts/fixtures/tilt-expand-best.json.gz`).

Every level's median is within 10 % of tiltRev 6. The bots' units barely separate good, great and
near-perfect (black holes end about a third of every level's runs, as on tiltRev 6), so the spread above the
median comes from the quick stars: 190+ needs all three mazes, every star and most quick stars inside 12 s.

## Checks

- `scripts/tilt-expand-check.ts` (new, ~20 s): 32 tiltRev 6 runs recorded before the change (and the same
  logs on revisions 1–5) replay to the same score and final state; 32 tiltRev 7 runs and the stored 200s
  replay; rooms deal tiltRev 7; on 3,000 seeds every key and cup is reachable, two quick stars on ice in
  every maze, the amber marble only in maze 3, the mazes bigger; older revisions carry no keys, gates, ice or
  quick stars; no input scores 0; random play 0–200 through the server; the quick-star curve; LIVE_BANDS.
- Fixtures: `tilt-expand-legacy.json.gz` (recorded on tiltRev 6 before the sim changed),
  `tilt-expand-runs.json.gz`, `tilt-expand-best.json.gz`; `scripts/tilt-expand-record.ts` and
  `scripts/tilt-expand-best.ts` record them. One tiltRev 7 run appended to `replay-runs.json`
  (`bun scripts/replay-fixtures.ts --add=tilt`).

## Assumptions and decisions

- Three mazes instead of four, so the bigger mazes fit the unchanged 90 s run (`TILT_RUN_TICKS`, so the
  room clock and `TILT_TIME_MS` are unchanged).
- The amber marble joins in maze 3 (the last), not maze 2: with it in maze 2, almost no one finished.
- No red chaser on tiltRev 7: the gate/padlock mechanism became keys and gates; the chaser and its crevice
  were the only thing behind the old gate.
- Quick stars carry the whole 50: ice and keys shape where they are and how hard they are to take, but score
  nothing of their own (a key is on the way; ice is a hazard).
- The camera turns the drawing about the screen's centre, not the disc's (display only; the sim never had a
  rotation centre).

## Shared files touched (Tilt's own lines only)

- `src/lib/duel/roundMax.ts`: `tilt: 200` (the groundwork commit).
- `src/lib/arcade/liveBands.ts`: the tilt line (rev 7, `TILT_V7_BAND_CURVE`, `bands` = tiltRev 6 and its strict curve).
- `src/lib/duel/arcade.server.ts`: `generateTilt` deals tiltRev 7 with the expansion's reachability rule.
- `src/lib/duel/instructions.ts` (the tilt block and its imports), `src/lib/duel/introScore.ts` (the tilt line).
- `src/lib/duel/introDemo.functions.ts`: one line stopping older Tilt demos.
- `src/lib/arcade/reveal.ts`, `src/lib/duel/roundSummaries.ts`, `src/lib/arcade/revealRenderers.ts`: Tilt's
  entries (three mazes, quick stars, the taller reveal backdrop).
- `src/lib/fx/gameSounds.ts`: two lines in `tiltSounds`.
- `scripts/arcade-skill-bands/games.ts`: an optional `expand` field on `GameSpec` and Tilt's `expand: 7`.
- Checks' Tilt lines: `arcade-tuning-a-check.ts` and `arcade-tuning-c-check.ts` (the dealt revision),
  `six-game-scoring-check.ts` (the intro's text), `arcade-batch4-check.ts` (the intro states Tilt's maximum).
- `scripts/fixtures/replay-runs.json`: one Tilt run appended (a one-line file: other games' additions will
  conflict textually; re-run `--add=` per game when merging).

## Shared requests

- `src/lib/arcade/arcadeFxGames.renderer.ts`: `TILT_FX` still states "ALL 4 MAZES!" and places pops about the
  old disc centre; tiltRev 7 draws through its own `TILT_X_FX` in `tiltArt.renderer.ts`, so nothing is wrong
  on screen, but arcade-fx-check only exercises the old spec.
- `src/lib/replay/moments.ts`: Tilt's "All 4 mazes" moment label; tiltRev 7's quick-star and key pops have no
  replay moment rows (they sound through `tiltSounds` instead).
- `src/lib/arcade/AGENTS.md`: a line for tiltRev 7 (camera display-only, keys/gates reachability, quick
  stars) would match the file's other revisions.
- `practiceStamps.data.ts` needs `bun scripts/practice-stamps.ts` after merging (tiltRev 7 starts a fresh
  practice best).
