# The Number overhaul (15 Nov 2026)

Phase 2, step 4 for the eight Number games: Counterweight, Exact, Operator, Integer Pyramid, Brimful, Checkout,
Ballpark and Kakuro. Sources: the reviews (docs/design/game-reviews/number.md), the concepts (#429), the art direction
(#423). Gallery: docs/design/pages-review/number/GALLERY.md. Sounds to make: docs/sound-cues/number-elevenlabs.md.

## Stage 1: the look and the game changes

**The look.** Every piece and surface is rendered in Blender (Cycles, a soft even studio light, matte to satin
materials, no glare) by `docs/design/number-overhaul/source/<game>.py` on the shared `sprites.py`, into
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

## Stage 2: effects (with the effects kit)

To come.

## Stage 3: levels (with the level registry)

To come. Joe's rules: at most 120 s at every level; exactly one solution where the game is a one-answer puzzle;
Normal is the rated level; the elite bot about 198 / 160 / 140 on Normal / Hard / Expert; Expert completed by a
person-like solver (every step deducible from the screen) and finished by the elite bot on most boards; a grid whose
squares would fall under about 40 px on a 375 px screen grows downwards instead.
