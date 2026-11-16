# The Number overhaul (15 Nov 2026)

Phase 2, step 4 for the eight Number games: Counterweight, Exact, Operator, Integer Pyramid, Brimful, Checkout,
Ballpark and Kakuro. Sources: the reviews (docs/design/game-reviews/number.md), the concepts (#429), the art direction
(#423). Gallery: docs/design/pages-review/number/GALLERY.md. Sounds to make: docs/sound-cues/number-elevenlabs.md.

## Stage 1: the look and the game changes

**The look.** Every piece and surface is rendered in Blender (Cycles, a product-shot studio light, real materials matched
to the chosen concept A: glass with a crisp highlight on its curve, glossy liquid, lacquer and enamel with depth, wood
with grain, metal that shines; no highlight washing across a panel, tile face or number, and no glowing edges, Joe's
clarification of 15 Nov 2026: "no glare" never means matte and flat) by `docs/design/number-overhaul/source/<game>.py` on the shared `sprites.py`, into
`public/number/<game>/<piece>.webp` with alpha. Numbers are never baked in: the app draws them in bold Archivo over the
art (`numberArt(game, piece)` in `src/components/puzzles/number/overhaul.tsx`). Controls are champagne gold (the one
action that plays) and navy; the shared puzzle surface's category-green actions and pills are overridden for every
Number game (`src/polish-layout/number-overhaul.css`), and the Number background is darker (Checkout keeps its purple
cabinet). Re-render a game's pieces with `/opt/blender/venv/bin/python docs/design/number-overhaul/source/<game>.py`
(bpy 5.2.4 in a Python 3.13 venv, fonts as in the concepts' README).

**The stage moment.** The six stage games (Counterweight, Operator, Integer Pyramid, Brimful, Checkout, Ballpark) share
one "stage complete" moment (`NumberStage`): the finished stage holds a beat, lifts and slides away with a rising
two-note (`<game>.stageClear`) while the frame's stage pip fills in gold, and the next slides in. Skip
(`<game>.skip`) and fail (`<game>.fail`) slide away without the lift, with their own sounds. Reduced motion: no
movement.

**New stamps** (`src/lib/duel/numberOverhaul.ts`, the deal layer `numberOverhaul`; checks for the older stamps pin
`pinPreNumberOverhaul(true)`). Older stamps deal, grade and replay exactly as before.

| Game | Stamp | Change |
|---|---|---|
| Counterweight | `balanceRev 4` | Tap a hung kettlebell to pick it up; moving it to another notch is free; only hangs from the tray count. The balance shows under the beam ("18 \| 15"). |
| Operator | `gapsRev 2` | A full line uses a try only when it is a fill not tried before on that equation; tap an empty gap to choose it; go back to skipped equations while time is left. |
| Checkout | `checkoutRev 3` | A bust as in real darts: past the target, to 0 off the finishing ring, or 1 left on a double finish clears that board's darts and it starts again. |
| Kakuro | `kakuroRev 2` | Only a digit that breaks a rule (a repeat, a run past or off its clue, a run that can no longer reach it) is a mistake. |

**Display and input changes (no stamp).** Counterweight: "Pick a weight first" on a notch tapped with nothing picked;
out of hangs greys the scale. Exact: Lock stays navy and disabled until there is a step; the picked operator taps off.
Integer Pyramid: a gold seam or a red crack once both stones beneath a filled stone are filled; the tray in two rows;
"Finish" on the last board's Skip; the reveal one pyramid at a time. Brimful: glass jugs over the water; the reveal's
best line as small jug pictures. Checkout: "Pick a wedge first"; negative wedges read cleanly. Ballpark: the line gets
the space, the card is smaller; a bump at an end tapped past. Kakuro: a broken run is a red clue and a thin red outline;
pencil marks at 11 px or more; after a digit, the next empty square in its run.

**Checks.** number-overhaul-balance-target-check, number-overhaul-equation-pyramid-check,
number-overhaul-measure-numline-check, number-overhaul-checkout-kakuro-check; the screens in scripts/screens/number.ts
(theme-check, no-wrap-check: each game's answer reveal at every size).

## The answer reveals

Every Number game's own reveal is built from `src/components/puzzles/number/RevealParts.tsx`: one board at a time,
large, with numbered tabs (✓ right, ● not right, ○ not reached; it opens on the first not right), Yours | Solution
where the game has both (missed or wrong pieces highlighted: red for wrong, a dashed outline for empty, champagne for
what the solution has that yours didn't), a plain note under the board, and the numbers that explain the score as
chips. Pictures in place of lists: Brimful's moves as jugs, Exact's route as tiles, Checkout's darts as chips on the
rendered board, Ballpark's markers joined to their true spots, Counterweight's scale on its wall with the balance.
Every older stamp's stored answer still reveals; a room's public half (no solutions) shows yours alone. Display only.

## Stage 2: effects (with the effects kit) and the layout pass

Every effect goes through the kit (`gameFx`, #422), `silent` where the game plays its own cue, on the pieces' own
elements only; nothing reads or writes a grade, clock or hit area (each game pair's check proves the graders import
none of it). The display helpers: `balanceTiltDeg` (Counterweight's tilt, proportional and capped), `exactCombineRate`
(the merge's pitch), `gapRunningTotal` and `operatorAllFirstTime` (numberOverhaulFx.ts), `npRowsRight`,
`measureNearJugs` and `measureFillPlays` (measureFx.ts), `numlineTenthsCrossed` (numlineFx.ts), checkoutFx.ts (the
dart's flight, landing exactly on its drawn spot) and kakuroFx.ts (`kakuroSolveOrder`, across then down).

- Counterweight: lift and hang (pickUp, drop), the tilt by how far off, the pointer trembling one unit off (nearMiss),
  locking level (win); out of hangs greys and slides away with its own thunk.
- Exact: the operator click (tap), the merge sliding together pitched by size (slide), the plate pulsing within 10
  (nearMiss), the hit (win), Undo sliding back.
- Operator: the tile drop, "So far n" under the line, the red flash and cracked pip, the gold "=", a combo on four
  first-time solves; Skip's swish.
- Integer Pyramid: the stone thunk, seams popping gold or cracking, a combo per full row, a rising note a row on
  completion.
- Brimful: lift, tip and settle on a pour; the fill sized to the amount; the empty splash; the target line's flash
  and plink; the one-move hint.
- Checkout: the dart's arc, thud and count-down; Bust with the darts dropping out; the ring on a finish and the crowd
  on a big one; Undo's tug.
- Ballpark: a tick each tenth while dragging, the pin stamping in, the payoff in the reveal (each true spot flying in,
  bullseyes sparkling, the count climbing).
- Kakuro: the digit tap, a broken run's red pulse, a complete run's gold clue and two-note pitched by length, the
  combo, the solve lighting across then down.

The layout pass: Counterweight's instrument fills its wall (bigger kettlebells, staggered drops), Operator's panel
spans goal line to Next, Ballpark's line is the big element (a rendered three-slice ruler with tenths, a compact
card), Integer Pyramid's tray in balanced rows (`npTrayRows`).

## Stage 3: levels (with the level registry)

Every Number game has Easy, Normal, Hard and Expert (`GAME_LEVELS` in `src/lib/levels/gameLevels.ts`, dealt through
`context.level` and stamped `puzzleLevel`); rated play and the Daily deal Normal (`modeLevel`). Every clock is at most
120 s. Joe's decision (15 Nov 2026): for Counterweight, Brimful, Checkout and Kakuro today's game becomes Hard exactly,
and Normal, Easy and Expert are new deals on new stamps (`balanceRev 5`, `measureRev 5`, `checkoutRev 4`,
`kakuroRev 3`); the other four keep today's game as Normal. The era pins `preBalanceLevels`, `preMeasureLevels`,
`preCheckoutLevels` and `preKakuroLevels` (`dealEra.ts`) deal today's game at Normal for the checks written for it, and
any older era pinned does the same. Older stamps deal, grade and replay as before.

| Game | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Counterweight | 3 scales of 6 notches | 4 scales of 8 notches, gentler | today's | 4 scales of 10 notches, tight hangs, readout hidden |
| Exact | targets 101–300 | today's | one large, 300–999, all six needed | small numbers only, 500–999, all six |
| Operator | 2–9, + − × | today's | 2–25, one more gap, ÷ from line 3 | 2–30, mixed gaps, 2 decoys, 2 tries |
| Integer Pyramid | 4 rows | today's | 5 rows, 3 decoys | 6 rows, 3 decoys |
| Brimful | 3 boards, 2 jugs and tap | 4 gentler boards | today's | 4 long boards, 1.5× limit |
| Checkout | 3 boards, any dart finishes | 5 boards, double finish | today's | 5 odd boards (×4, minus wedges, treble finish) |
| Ballpark | 0–10, 0–100, 0–1 | today's | harder numbers | a 0–10,000 line, each line's end hidden until 3 are placed |
| Kakuro | 5 × 5 | 6 × 6 | today's | 7 × 7 |

Proofs: one-solution games (Integer Pyramid, Kakuro, Counterweight's single-arrangement scales) are proved at deal time
or by their banks (`scripts/number-pyramid-levels-bank.ts`); Expert deals only boards a person-like solver (every step
deducible from the screen, no guessing) completes. Integer Pyramid's stones grow into the band above the board (display
only). Checks: number-levels-balance-target-check, number-levels-equation-pyramid-check,
number-levels-measure-numline-check, number-levels-checkout-kakuro-check.

**Final push (16 Nov 2026).** Operator's Hard runs 85 s and Expert 78 s, each with full speed points finished within
40 s (stored on the deal as `timeLimitMs` and `speedFullByS`; Normal and older stamps unchanged). Exact's Expert deals
from a proved bank of 320 boards (`scripts/target-expert-bank.ts [--check]` writes `targetExpertBank.server.ts`; each
board from the Expert rules and the person-like solver), in milliseconds. Integer Pyramid's given and placed stones are
rendered to the empty socket's height, so there is no step between them. Counterweight's goal line names the scales its
deal has (`useStageGoal`, "Balance each of the three scales" on Easy). Integer Pyramid's "Pharaoh" asks for 180 on
Expert.

**For Joe's scoring review (16 Nov 2026).** Integer Pyramid's Normal is today's game, unchanged: on main's level-tune.ts
(40 seeds) the great bot averages 135.4 and finishes 35 % of runs (the near-perfect bot 188.7, every run finished), the
largest gap between great and near-perfect play of the eight. Left as it is for the scoring review; nothing in this
overhaul changes it.

## Intro demos

`scripts/fixtures/number-demos.json`: one run per game recorded on its intro example deal at Normal
(`bun scripts/number-demos-record.ts <game>`), each scoring 200 through the server replay (number-demos-check). The stop
rules in `introDemo.functions.ts` play a Number demo only with `numberDemoRev 1` on today's Normal stamps. Saving:
`DEMOS_URL=… INTRO_DEMO_KEY=… bun scripts/number-demos-save.ts [--dry]` (never prompts, never prints the key; refuses
unless the server's deal matches the fixture; exit 0 / 1 / 2); run the dev server with
`NODE_OPTIONS=--max-old-space-size=6144`. Nobody saves demos to the live database.
