# High Rise on the arcade scoring standard (skylineRev 9, 29 Oct 2026)

Batch B of the arcade scoring standard (`src/lib/arcade/arcadeStandard.ts`). Rooms deal **`skylineRev 9`**
(`SKYLINE_REV_STD`, `skylineStdGame`); every older revision (unstamped, 2–8) plays and scores exactly as before.

Joe's row: "High Rise: core up to 140 = floors built, full at the near-flawless height (the every-10-floors bonus is
folded into core). Perfect drops 30 (by share of drops that are perfect). Perfect streak 10 (full for a streak of
10+). Gold blocks landed perfectly 20, split. Replaces the 1,100-point scale."

## The parts (200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Floors (core) | 140 | `stdLine(140, floors, 61)`: a straight line, full at **61 floors** |
| Perfect drops | 30 | `30 × perfect drops ÷ max(floors, 61)`, rounded down: the share of drops that are perfect, counted over at least 61 drops |
| Perfect streak | 10 | 1 for each perfect drop in the best streak, full at 10 in a row |
| Gold blocks | 20 | 4 for each of the 5 gold blocks landed perfectly |

Score = `stdScore(parts, acted)`: 0 with no input, else the sum held to 1…200. The help's SCORE text is
`liveStdHelp("skyline", "Every floor you build counts the same.")`.

## The core target

`fullAt` = the skill-band tool's `near` level's median floors on the tuning seeds 0–59
(`bun scripts/arcade-skill-bands.ts skyline --rev=now --levels=all --seeds=60 --jobs=2`, default fixed bots). On
skylineRev 8 (before) the near median was **61 floors** (`counters.placed`); on skylineRev 9 (after, `units` =
floors) it reads **61** again, as it must: rev 9 plays exactly as rev 8 (the gold blocks are normal width and
judged like any block). Set: `SKYLINE_V9_FULL_AT = 61`. Elite's median is 79–81 floors and flawless 85–87, so both
fill the core; the top is separated by the share of perfect drops, the streak and the gold blocks.

## What changed in play

- **Gold blocks** are dealt differently: exactly 5 a run (`SKYLINE_V9_GOLD_COUNT`), from the room seed on their own
  stream (`skylineKindsV9`), one in each fifth of blocks 4–60 (0-based), so a player who builds 61 floors meets every
  one, each on a block whose neighbours are both normal (never two specials in a row). Rev 7–8's random golds become
  normal blocks. Narrow and wide blocks stay exactly where rev 7–8 deal them, except in the rare fifth with no block
  free of special neighbours: then a seeded block in that fifth takes the gold and its neighbours are made normal
  (35 of 3,000 seeds, about 1 %; arcade-standard-check holds it at 2 % or under). Every player in a room meets the
  same gold blocks at the same heights.
- Gold blocks are the usual width, so the slide, the overhang rule, the wind and the widths are unchanged: the 28
  saved rev-8 logs replay on rev 9 to the same tower, block for block (skyline-standard-check).
- **No scoring multiplier**: the ×2 / ×3 / ×4 streak multiplier no longer scores. The sim still counts `perfectUnits`
  and `bestMult` (rev 7's step is reused unchanged), unread by rev 9's score. HUD: "Streak n" (gold at 10+, when the
  streak part is full) and no "×n" or "next perfect ×n"; the PERFECT pop has no multiplier; the success layer's
  banner reads "STREAK n" from the 3rd perfect in a row; the count ding sounds once when the streak reaches 10.
- **Height milestones** score nothing (their floors are in the core); the celebration and camera pull-back stay, the
  banner's second line reads "CITY VIEW" instead of "CITY BONUS".
- Narrow and wide blocks count as one floor like any other (rev 7–8 gave them 8 and 3 units).

The state carries `expandRev: 9` (folded into the checkpoint checksum as 7 and 8 are), `kinds` from
`skylineKindsV9`. `skylineBandParts` answers rev 9 with units = floors, points = core, bonus = the features (the
skill-band tool's `units`).

## Assumptions and decisions

- The lead's interpretation is followed as written: perfect drops counted over at least `fullAt` drops; streak 1 a
  perfect drop up to 10; 5 golds at 4 each within the first `fullAt` blocks.
- Gold placement: one per fifth of blocks 4–60 (spread through the climb rather than five anywhere), so a player
  meets them steadily.
- The "rare fallback" (a fifth with every block next to a narrow or wide block) removes one or two narrow/wide blocks
  on about 1 % of seeds; the alternative (a gold next to a special) would break "never two specials in a row".
- Texts: help How lines (perfect streak, gold blocks, milestones as camera only), the help SCORE (`liveStdHelp`), the
  intro SCORE line ("Floors, perfect drops, a perfect streak and gold blocks. Up to {max}."), the intro still's caption,
  round summaries ("n of 5 gold blocks"), the reveal's tiles (Best streak, Gold blocks "n / 5") and its lines (the
  standard's, one per part).
- Intro demo: only a skylineRev 9 demo plays (`introDemo.functions.ts`); the intro shows its still until one is
  recorded on skylineRev 9.

## Before → after medians (skill-band tool, default fixed bots)

Before = skylineRev 8 (tree 99115b0), after = skylineRev 9. Score medians (p10–p90); zeros = runs scoring 0.

### Tuning seeds 0–59 (`--seeds=60`)

| Level | Before | After | Floors (median) | Zeros before / after |
| --- | --- | --- | --- | --- |
| Weak | 59 (48–81) | 33 (26–45) | 14 | 0 / 0 |
| Average | 78 (56–103) | 44 (32–59) | 18 | 0 / 0 |
| Good | 107 (92–121) | 64 (52–84) | 25 | 0 / 0 |
| Great | 125 (114–143) | 90 (74–119) | 35 | 0 / 0 |
| Near-perfect | 177 (145–187) | 159 (119–171) | 61 | 0 / 0 |
| Elite | 192 (177–200) | 172 (157–179) | 81 | 0 / 0 |
| Flawless | 200 (200–200) | 198 (193–199) | 85 | 0 / 0 |

### Fresh seeds 10000–10099 (`--from=10000 --seeds=100`)

| Level | Before | After | Floors (median) | Zeros before / after |
| --- | --- | --- | --- | --- |
| Weak | 63 (48–80) | 35 (27–45) | 15 | 0 / 0 |
| Average | 76 (58–101) | 44 (32–56) | 18 | 0 / 0 |
| Good | 102 (80–113) | 60 (44–74) | 24 | 0 / 0 |
| Great | 124 (115–142) | 91 (72–118) | 34.5 | 0 / 0 |
| Near-perfect | 177 (145–188) | 161 (114–171) | 61 | 0 / 0 |
| Elite | 192 (179–200) | 172 (159–180) | 79 | 0 / 0 |
| Flawless | 200 (200–200) | 198 (194–199) | 87 | 0 / 0 |

### Part medians after (tuning seeds)

| Level | Floors | Perfect drops | Streak | Gold (golds landed) |
| --- | --- | --- | --- | --- |
| Weak | 32 | 0 | 1 | 0 (0) |
| Average | 41 | 1 | 1 | 0 (0) |
| Good | 57 | 2.5 | 2 | 0 (0) |
| Great | 80 | 5 | 3 | 4 (1) |
| Near-perfect | 140 | 12 | 5 | 8 (2) |
| Elite | 140 | 15 | 7 | 8 (2) |
| Flawless | 140 | 28 | 10 | 20 (5) |

Medians rise weak < average < good < great < near < elite < flawless with clear gaps at the top (159 → 172 → 198 on
the tuning seeds). The lower levels fall well below rev 8's lifted curve because the core is now a straight line in
floors (rev 8's curve was steep at the bottom); per the standard, no bot number targets were chased.

## Checks

- `scripts/skyline-standard-check.ts`: older revisions (unstamped, 2–8) replay 28 saved rev-8 logs to the score, flag,
  floors, perfect drops and final-state digest recorded before the change
  (`scripts/fixtures/skyline-standard-legacy.json.gz`, `bun scripts/skyline-standard-legacy.ts <old root> <save dir>`);
  the logs play identically on rev 9; rev-9 runs replay through `replaySkylineRun` and `gradeSubmission` to the
  standard score, unflagged, with the extras and the reveal's lines and tiles; rooms deal rev 9 with five golds.
- `scripts/arcade-standard/skyline.ts` (arcade-standard-check): 200, 1, 0, the straight line, the parts' amounts,
  multiplier and milestones scoring nothing, and the gold schedule over 3,000 seeds.
