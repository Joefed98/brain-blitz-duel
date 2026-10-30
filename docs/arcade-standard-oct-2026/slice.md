# Slice on the arcade scoring standard (sliceRev 11, 29 Oct 2026)

Rooms and practice deal **`sliceRev 11`** (was 10). It plays sliceRev 10 exactly: the same seeded schedule on the
430 × 805 board, the same food sizes, bottles, chillies, blade and combo rule (three foods in one finger-down-to-up
path start a combo; every path that does renews its 10 seconds; a chilli ends it). Only the scoring changed, into
straight-line parts that add up to 200. Every older stamp (unstamped, 2–10) replays and scores exactly as before.

Code: `src/lib/arcade/slice.ts` ("The arcade scoring standard" section: `SLICE_REV_STANDARD`, `sliceV11Parts`,
`sliceV11Cuts`, `initV11`, `sliceStandardGame`). Check: `scripts/slice-standard-check.ts`. Standard module:
`scripts/arcade-standard/slice.ts`. Oracle player: `scripts/slice-standard-oracle.ts`.

## The parts

| Part | Max | Rule |
| --- | ---: | --- |
| Core: food sliced | 120 | 120 × foods cut ÷ foods thrown (a straight line; per mille of the share, `SLICE_V11_BAND_CURVE` = 0 → 120 over 0–1000). |
| Combo | 40 | 2 points for every 5 foods cut while a combo is live (rounded down), up to 40 (100 combo foods). The path that starts or renews the combo counts all its foods. No multiplier. |
| Golden fruit | 20 | 20 × golden fruit cut ÷ golden fruit thrown (six a run), rounded down: 3, 6, 10, 13, 16, 20. |
| Bread tickets | 10 | 3 breads cut in a row fill a ticket. Other food cut in between does not break the run; a bread that leaves the board uncut resets it to 0. 10 × tickets ÷ the most the schedule allows, capped at 10. |
| Dodges | 10 | 2 for each food cut while its skin is within 60 px (`SLICE_V11_CLOSE`) of the skin of a chilli on the board, by a segment that cuts no chilli. Up to 10 (five dodges). |
| Bottles | 0 | Ketchup, mustard and mayo pay nothing; their effects still help (ketchup's batch is more food and keeps chillies away). |
| Chilli | −10 each | Each chilli cut costs 10 and ends the combo. |

Total = the parts less the chillies, at most 200; **0 with no input, at least 1 with any input**.

Definitions:

- **Food** is any bread, cabbage, onion, meat or golden fruit, including a ketchup bottle's batch once it is thrown.
  Chillies and bottles never count.
- **Thrown** means cut, or left the board uncut. A food still in the air at the buzzer counts only if it was cut, so
  no one loses core for food thrown in the last instant. A food that drifts off a side and lands uncut is missed.
- **The tickets' maximum** is a third (rounded down, at least 1) of the breads on the schedule thrown at least a second
  before the buzzer (`SLICE_V11_TICKET_BEFORE`). Fixed at init from the seed; breads in a ketchup batch count towards
  tickets but not towards the maximum.
- The sliceRev 9/10 order tickets and dodge streak are gone on this stamp (its states hold no order tickets).

## Core target

Core has a fixed maximum (every food thrown), so there is no measured target: core is full when every food thrown is
cut. The near-perfect median share is 931 ‰ (core 111); the oracle cuts 1000 ‰ on every seed tried.

## Medians, weak → flawless

`bun scripts/arcade-skill-bands.ts slice --rev=now --levels=all --seeds=30 --jobs=4`, median (p10–p90):

| Level | Before (sliceRev 10, main) | After (sliceRev 11) |
| --- | --- | --- |
| Weak | 38 (25–55) | 75 (56–86) |
| Average | 73 (55–89) | 116 (92–131) |
| Good | 128 (90–172) | 156 (140–176) |
| Great | 176 (122–188) | 173 (156–182) |
| Near-perfect | 177 (161–200) | 181 (163–191) |
| Elite | 182 (150–200) | 194 (180–200) |
| Flawless | 184 (156–199) | 200 (200–200) |

Per-part medians on sliceRev 11 (30 seeds): weak core 59, combo 6, gold 10, tickets 3, dodges 2; average 84 / 14 / 13
/ 6 / 6; good 102 / 32 / 16 / 8 / 6; great 106 / 39 / 16 / 10 / 10; near 111 / 40 / 20 / 10 / 10; elite 120 / 40 /
20 / 10 / 10; flawless 120 / 40 / 20 / 10 / 10.

## The bot (scripts/arcade-skill-bands/bots/slice.ts)

Changes are read only on sliceRev 11 states (`s.v11`), so every older revision's bot plays as before:

- Dodges: the chance a swipe goes first for a food close to a noticed chilli (but clear of the bomb margin), by level
  (good 0.1, great 0.3, near 0.5, elite 0.75), until the dodges are full; such a swipe is not held for a combo.
- Golden fruit is never left for the base (it is worth more than three foods).
- Elite also reads that a food drifting off a side is about to be lost (its urgency); lower levels don't.
- Flawless (the "perfect" level: no error, each seed's ceiling) is the oracle player of
  `scripts/slice-standard-oracle.ts`: it reads the sim's own positions, cuts one food a tick with a short segment on
  its centre (most urgent first, ketchup bottles too), keeps every segment clear of the chillies, renews the combo
  with a new path before it runs out, and waits to cut a food as it passes close to a chilli while dodges remain. It
  uses segments a finger could not draw (each tick's segment starts anywhere), which the server accepts: it is the
  ceiling, not a human model.

## Rest of the change

- `generateSlice` deals sliceRev 11; `LIVE_BANDS.slice` reads it with `SLICE_V11_BAND_CURVE`; `playRevOf` maps 11 to
  10's play (`LIFT_REVS` in `scripts/scoring-targets-revs.ts`), so older checks keep proving the play they were
  written for; `expansion-e5-check` compares the dealt stamp through it.
- Help (`instructions.ts`) and intro (`introScore.ts`) state the parts; the reveal breakdown (`sliceBandParts`) and
  reveal tiles (`reveal.ts`) show them; the HUD (`slice.renderer.ts`) shows the bread ticket (×3 in a row, pips for
  the run, tickets filled) in the order ticket's place, the bonus as the four parts, and a single COMBO bar with its
  seconds (no ×2/×3); the combo pop reads "COMBO!".
- The intro demo stays stopped until one is recorded on sliceRev 11 (`introDemo.functions.ts`).
- `scripts/fixtures/replay-runs.json` gained one sliceRev 11 run (`bun scripts/replay-fixtures.ts --add=slice`). No
  self-replay entry was added (the sliceRev 7–10 bumps added none either).
- `scripts/fixtures/slice-standard-legacy.json.gz` (22 runs on every older stamp, recorded on main 73f6bb7 with
  `bun scripts/slice-standard-legacy.ts <main checkout>`).

## Assumptions

- A food's ketchup batch counts as food thrown only once released (a bottle never cut throws nothing), so cutting
  ketchup can only help the share.
- "Close" for a dodge is 60 px skin to skin (a chilli is 40 px across, so about a chilli and a half); each food counts
  once. At 40 px the oracle still filled the dodges on every seed tried, but the human-model bots found the chances too
  rare (great to elite medians of one or two dodges), so the line sits at 60.
- The golden-fruit and ticket parts are shares of what the seed throws, so a perfect run reaches exactly 20 and 10 on
  every seed.
