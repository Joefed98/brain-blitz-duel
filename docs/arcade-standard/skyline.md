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

## skylineRev 10: another floor never lowers the score (Nov 2026, the scoring audit)

`docs/audit-nov-2026/scoring.md` issue 5: the perfect-drops part was the share of drops that were perfect, counted over at
least 61, while the core stops at 61 floors; past 61 every drop that wasn't perfect lowered the score (elite runs of 117
and 123 floors scored 176 and 162 against 173 for 60 floors). skylineRev 10 (`SKYLINE_REV_COUNT`) is skylineRev 9's play and
gold blocks exactly (states keep `expandRev: 9` and add `perfectCount: 1` outside the checksum), with perfect drops
counted: 30 × min(perfect drops, 61) ÷ 61 (`SKYLINE_STD_SPEC_V10`). Up to 61 floors this is the same number rev 9 gave.

| Level | Weak | Average | Good | Great | Near | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| skylineRev 9 | 35 | 44 | 67 | 96 | 162 (120–171) | 170 (144–181) | 198 (194–199) |
| skylineRev 10 | 35 | 44 | 67 | 96 | 164 (120–177) | 177 (144–191) | 200 (196–200) |

scoring-audit-arcade-check proves the score never falls for another floor (perfect or not) over 0–160 floors.

The table's medians (p10–p90) are 30 room seeds, measured with `bun scripts/arcade-skill-bands.ts cross wavefront burst skyline slice --rev=now --seeds=30 --levels=all` on main and on this branch.

## skylineRev 11: lives and the wide-block rescue (15 Nov 2026, the Action overhaul)

Rooms deal **`skylineRev 11`** (`SKYLINE_REV_LIVES`, `skylineLivesGame`; `docs/design/game-reviews/action.md`). It is
skylineRev 10's play, gold blocks and parts exactly (Floors 140, Perfect drops 30, Perfect streak 10, Gold blocks 20;
`SKYLINE_STD_SPEC_V11` is rev 10's parts under the new stamp), with two changes so no run ends on the first miss:

- **Lives.** A run starts with 3 (`SKYLINE_V11_LIVES`). A block that misses the tower costs a life and falls away; the
  run carries on with the same tower and the same block again (its kind and width) from the side it came from, the
  streak broken. A tap in the half second after a lost life is ignored (`SKYLINE_V11_REARM_TICKS`, 30), so a double tap
  can't cost two. The last life's miss ends the run as before. The score never reads the lives: a lost life costs its
  time and the streak.
- **The wide-block rescue.** After 5 placed drops in a row that were not perfect (`SKYLINE_V11_TRIM_RUN`), the next block
  is a wide one (rev 7's wide block: the top's width + `SKYLINE_WIDE_GROW`, up to the start width; centred, it stays whole
  and widens the tower) when the schedule has a normal block there and after it; the count starts again. The rule reads
  only the drops, so it is the same for every player who drops the same.

States add `lives`, `livesLost`, `trimRun` and `rescues` (folded into the checkpoint checksum last) and keep `expandRev: 9`
and `perfectCount: 1`, so every rev 9/10 path (the parts, the HUD, the reveal) reads them. A run with no miss and no trim
is skylineRev 10's run exactly (skyline-overhaul-check proves it on the perfect-drop player's runs). Every older stamp
replays and scores as on main a3f40ff7 (60 runs, `scripts/fixtures/skyline-overhaul-legacy.json`).

Medians, skill-band tool (`bun scripts/arcade-skill-bands.ts skyline --rev=now --levels=all --seeds=30`, the default
fixed bots), skylineRev 10 → 11:

| Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- |
| 35 → 39 | 44 → 53 | 66 → 75 | 96 → 103 | 161 → 168 | 177 → 177 | 200 → 200 |

The look (display only, every revision): the city from concept A behind the tower (three layers deep, lights coming on
as night falls), the round starting at dusk and turning to night from the floors built (`skylineNightShare`, in 24 steps,
`skylineNightStep`), a solid plaza the tower stands on (the tower drawn 22 px above the world's bottom; the sim has no
heights), a LIVES chip in the HUD, a lost block falling away with "−1 LIFE". Edge to edge: the screen's fill
(`skylineSceneFill`, painted once per size and night step) paints the still scene beside the world and the quay and river
below it, and the world blends its side edges into that same still scene (`drawEdgeRamps`) and settles its bottom rows to
the quay's colour, so no seam shows at its edges however the camera has moved.

### Levels (15 Nov 2026, the difficulty framework: built)

Normal is skylineRev 11 exactly (checked: a 3 px perfect tolerance, `SKYLINE_PERFECT_TOL` 768; wind from block 20; 3
lives; the slide 768 + 26 a floor up to 1,536). Easy, Hard and Expert are skylineRev 11 with the puzzle's `level` (the
deal stamps it; the stamp stays 11, the seed is Normal's for the room seed, no proved deal is needed: every seed is
proved at every level). The sim reads the level from the state (`lvl`: 1 / 3 / 4, folded into the checkpoint checksum
last) and `SKYLINE_LEVEL_RULES` (frozen with the sim; `GAME_LEVELS.skyline` mirrors it for the phone). The parts (Floors
140, Perfect drops 30, Perfect streak 10, Gold blocks 20), the gold blocks, the wide-block rescue and the 60 s run are
skylineRev 11's at every level.

| | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| Slide (1/256 px a tick: start + a floor, top) | 448 + 12, 896 | 768 + 26, 1,536 | 896 + 30, 1,792 | 960 + 32, 1,920 |
| Perfect tolerance | 5 px | 3 px | 3 px | 2 px |
| Wind from block | 30 | 20 | 15 | 10 |
| Lives (grace: never fewer than 2) | 3 | 3 | 2 | 2 |

Code: `skylineGameFor(rev, level)`, `skylineLivesGameAt`, `skylineSpeedOf` / `skylineTolOf` / `skylineWindFrom` /
`skylineStartLives` (the HUD's "LIVES n / 2", the flag and the success layer's wind pop read them); every replay site
passes `puzzleLevel(puzzle)` (grade.ts, the stage, the reveal, the run picture, round replays). Help: one "Levels:" line
and the lives and wind lines say what changes (instructions.ts).

**Measured** (`bun scripts/action-levels-bands.ts skyline --seeds=40 --bots=weak,…,limited`; real deals graded by the
server replay; mean / median, finish = the run not ended by the last life). `limited` is the elite held to Joe's human
limits (`scripts/arcade-skill-bands/humanLimits.ts`: 250 ± 30 ms reactions, 150 ms finger lag, 15 ms timing, 2.5 px aim):

| Bot | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| weak | 86 / 85 | 43 / 44 | 34 / 35 | 30 / 30 |
| average | 116 / 113 (p90 144) | 53 / 52 | 44 / 44 | 41 / 39 |
| good | 166 / 168 (p90 187) | 72 / 70 | 60 / 57 | 53 / 51 |
| great | 183 / 188 | 105 / 101 | 84 / 83 | 71 / 70 |
| near-perfect | 194 / 196 | 156 / 164 | 137 / 129 | 111 / 111 |
| elite (145 ms) | 196 / 200, 100 % | 176 / 178, 80 % | 167 / 172, 38 % | 141 / 153, 13 % |
| **limited elite** | 167 / 168, 100 % | 123 / 122, 73 % | 112 / 106, 33 % | 96 / 94, 5 % (p90 131) |
| oracle (`scripts/skyline-oracle.ts`) | 200 | 200 | 200 | 200 |

`bun scripts/level-tune.ts skyline --level=all --seeds=40` (the shared tool, near-perfect / elite averages): Easy 193.5 /
196.1, Normal 155.8 / 176.3, Hard 136.8 / 167.1, Expert 110.7 / 140.9.

Every step is a clear step down for every bot. Normal under human limits is 123, well short of Joe's ~198 guide (the
limited bot, reacting in a quarter second, often lets a fast pass go and takes the return pass, so it builds fewer floors
in the minute: none of its 40 runs reaches 61); Normal is not changed here (a decision for Joe). Expert, scored well
under human limits: the limited elite's best Expert boards (room seed n → course seed): n=29 (1530145177) 146, n=39
(1523294388) 139, n=34 (989469536) 136, n=14 (30710843) 132, n=25 (870299109) 131 (the 145 ms elite scores 155, 162,
166, 156, 156 on them). "Well" on Expert here means 130+ (the Floors part nearly full and most of the perfect drops).
Easy gives a good player a star most runs (median 168, p90 187) and an average one a run in the 140s at best.

Skyscraper ("Build 61 floors on Expert", switched off until levels go live for challenges): the oracle builds 61+ floors
on Expert on every seed checked (fewest 103 floors; skyline-levels-check), the 145 ms elite on 19 of 40.
skyline-levels-check (~40 s) proves Normal's deals byte for byte and skylineRev 9–11 runs recorded on de3bec96
(`scripts/fixtures/levels-action-legacy.json.gz`), each level's rules, the 120 s rule, grace, the oracle at 200 through the
server replay on every level (tuning 0–29 and fresh 10000–10019; `CHECKS_FULL=1` 0–59 and 10000–10199), identical worlds
and the Skyscraper.

## Stage 2: effects and the reveal (15 Nov 2026, the Action overhaul; display only, no stamp)

Joe's effects list, each drawn by the game's own renderer from the sim moment it observes (`skyline.renderer.ts`, the
landing the renderer remembers: its sim tick, a perfect drop, a trim or a sliver, and the block below's span). Nothing is
written to the sim; the next tap is taken at once.

| Moment | What shows | Sound slot |
| --- | --- | --- |
| A drop | the block falls the last floor from the hook (`DROP_FALL_TICKS` 5, ~80 ms), then the tower squashes 2 px from the plaza and springs back (`skylineSquashPx`, 300 ms) | `skyline.drop` (no whistle recording yet; the clank meanwhile) |
| A perfect drop | a flattened gold ring spreads from the join (`PERFECT_RING_TICKS`, ~470 ms), the join a crisp gold seam, and the strip the block grew by (beyond the block below) lit gold and fading into the glass; the success layer's burst at the join, not mid-screen | `skyline.perfect`, a semitone higher for each drop in the streak, up to seven (`skylinePerfectRate`) |
| A trim | the overhang falls away spinning (`TRIM_SPIN`) and chips of glass and concrete crumble from the cut edge | `skyline.trim` |
| A sliver (under a quarter of the block on the tower) | it wobbles on its foot, at most 2 px at its corners (`skylineSliverTilt`, a second) | `skyline.sliver` |
| A lost life | the block tumbles away (`LOST_SPIN`), "−1 LIFE", the LIVES chip rings | `skyline.lifeLost` |
| A gold block landed perfectly | GOLD BONUS and the gold lights (as before) | `shared.celebrate.chime` |
| The end | the hook and NEXT go, the camera pulls back over the whole tower (`END_FIT`) and a big floor count counts up from 0 (`SKYLINE_END_COUNT_MS`, 900 ms); the stage holds its submit `SKYLINE_END_HOLD_MS` (1.3 s) so it is seen (the drafts already carry the same run) | none |

No edge glow: the shared success layer draws none for the Action games (`ACTION_EDGELESS_GAMES`, `success.renderer.ts`;
the effect is on the tower instead). Reduced motion: no fall, squash, wobble, spin or crumbs; the ring and the strip show
still and fade; the count is shown whole.

**The reveal** (`RunPicture` in `src/puzzles/skyline.tsx`, drawn by ArcadeReveal under the score and breakdown): the stored
log replayed through the real sim (`skylineRunSummary`, `src/lib/duel/skylineSummary.ts`) and drawn as the tower as built
(`drawSkylineRunPicture`): every floor at its real width and place, perfect drops gold, gold blocks brighter, wide blocks
(the rescue) teal, trims the tower's glass; each lost life the missed block tipping off in red where it missed; the best
streak bracketed in gold. Above it the three numbers that explain the score, big (Floors, Perfect drops, Best streak);
under it a legend with short labels and counts. The picture's numbers replace the reveal's stat tiles. The score is the
stored one; nothing here grades.

**Stage 3 (15 Nov 2026, Joe: no block of text lines above the picture):** the shared arcade reveal now draws the score,
then the big numbers and the picture, then the stored breakdown in the shared list (`RevealBreakdown`; in a room the
summary line and See breakdown) below it, for every game with a run picture (`ArcadeReveal`, `data-reveal-run-picture`).
skyline-overhaul-check section 11 mounts the reveal in happy-dom in practice and in a room and proves the order, every
stored part line a row of the shared list and none above the picture, and Roofbound's reveal in the same order.
