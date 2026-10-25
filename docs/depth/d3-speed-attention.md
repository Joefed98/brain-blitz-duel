# Depth to 200, D3: Speed and Attention (25 Oct 2026)

Twelve games raised from 150 to 200 (`ROUND_MAX`, docs/scoring-200.md), each under its own new version stamp.
Older stamps replay and score exactly as before. Shared pieces: `src/lib/duel/depth200.ts` (the stretch curve),
`src/lib/duel/depth200.server.ts` (one dispatcher, called by `gradeAnswer` before puzzleScoreRev 2 / 3's mapping,
which caps at 150) and one `src/lib/duel/depth/<game>.server.ts` grader per puzzle game. Engine games (Bonk, Pull!,
Mixed Signals) score in their sims.

Routes: STRETCH = the game is unchanged and the curve reaches further; FEATURES = the extra 50 comes only through
the new features.

<!-- Each game's section: stamp, route, features, scoring formula, old vs new distribution table (median, top 10 %,
best per bot skill level), checks, assumptions, demo status. -->

## Flash (`reaction`)

**Stamp `tapRev: 5`** (`TAP_REV_DEPTH`, `src/lib/duel/tapLog.ts`; rules `src/lib/duel/depth/flash.ts`, grader
`depth/flash.server.ts`). STRETCH plus the steady-hand bonus. Same flashes, decoys, tap log and replay (tapRev 4's decoy
cut and false starts carry on).

- Score = curve(average credited reaction, misses 1,200 ms) + steady hand − false starts, 0–200.
- Curve `FLASH_REV5_CURVE`: tapRev 4's exactly from 165 ms down (165 → 140, 200 → 120, 300 → 110, 450 → 80, 600 → 20,
  800 → 0); above it 150 ms → 155 (was the 150 plateau), 135 ms → 170, 120 ms or faster → 185.
- Steady hand: every flash hit, no false start, fastest to slowest credited reaction within 50 ms → +15, within 80 ms → +8.
  200 needs 120 ms and the tight spread.
- Phone: the summary line reads "Flash 4 of 6 · steady 38 ms" while the steady hand is on (gold within 50 ms), else the
  old "best" line; the reveal adds "Steady hand: all within N ms, +15". Same 20 px row, nothing moves.
- Distribution (80 room seeds a level; the puzzle-fairness kits plus an elite player at 128 ± 10 ms; same answers graded
  on tapRev 4 and 5):

| Level | Old median | Old top 10 % | Old best | New median | New top 10 % | New best |
| --- | --- | --- | --- | --- | --- | --- |
| average | 72 | 101 | 114 | 72 | 101 | 114 |
| good | 107 | 116 | 120 | 107 | 116 | 133 |
| great | 121 | 132 | 141 | 122 | 138 | 156 |
| near | 141 | 150 | 150 | 151 | 167 | 175 |
| elite | 150 | 150 | 150 | 191 | 196 | 199 |

- Check: `depth-flash-check` (legacy runs, curve, steady rules, 200 on a perfect run, distribution).

## Ascend (`numhunt`)

**Stamp `tapRev: 5`** (rules `depth/ascend.ts`, grader `depth/ascend.server.ts`). FEATURE: the flow streak.

- Score = puzzleScoreRev 3's Ascend score (unchanged: 110 × progress unfinished, 120 + up to 30 speed for a finish, at
  most 150; worked out exactly as `withRev3` does) + flow points, at most 200.
- Flow: a right tap within 1 s of the right tap before extends the streak; a wrong tap or a longer pause ends it (taps on
  cleared discs change nothing). Multiplier ×1 for a streak's first 3 right taps, ×2 from the 4th, ×3 from the 8th, ×4 from
  the 12th; each right tap earns its multiplier less one, at most 50 (all 24 unbroken = 51). Worked out by the server from
  the tap log's times (`ascendFlow` walks `replayAscend`'s outcomes).
- Phone: a pill beside "Next" in the HUD row (`FlowChip`, always there on tapRev 5, ×1 dim, ×2–×4 gold with level dots,
  a slow glow that holds still under reduced motion / reduced effects); it drops to ×1 once the pause runs out. The reveal
  adds "Flow bonus +N · best ×M".
- Distribution (80 room seeds a level; same answers graded on tapRev 1 and 5):

| Level | Old median | Old top 10 % | Old best | New median | New top 10 % | New best |
| --- | --- | --- | --- | --- | --- | --- |
| average | 62 | 86 | 120 | 62 | 86 | 120 |
| good | 125 | 134 | 138 | 125 | 134 | 139 |
| great | 140 | 145 | 147 | 140 | 149 | 153 |
| near | 150 | 150 | 150 | 163 | 183 | 198 |
| elite | 150 | 150 | 150 | 198 | 200 | 200 |

- Check: `depth-ascend-check` (legacy runs, flow rules, flow the only route above 150, 200 on a clean 400 ms-a-disc run,
  distribution).

## Bang On (`stopwatch`)

**Stamp `tapRev: 5`** (rules `depth/bangOn.ts`, grader `depth/bangOn.server.ts`). FEATURES: the dead-centre line and the
zone streak. Same watches, schedule and replay.

- Score = tapRev 4's curve (`STOPWATCH_REV4_CURVE`, at most 150) + dead centre + zone streak, at most 200.
- Dead centre: a stop within 12 ms of marker travel of the zone's centre line (about the line's 3 px plus half the
  6 px marker on a 1 s sweep) → +2 each (ten: +20). Always inside the zone.
- Zone streak: a stop inside the drawn gold band (marker within the zone's half-width of its centre, moving targets at
  the tap) extends the run; anything else ends it. The 2nd watch in a row +1, the 3rd +2, the 4th +3, every later one +4
  (ten in a row: +30). Short lucky runs earn little; spam's feature points stay at 0 (median) and at most 10.
- 200 needs tapRev 4's 150 (≤ 5 ms average), all ten in the zone and every one dead centre.
- Phone: the zone's centre line is a bright white-gold line (`.bangon-dead-centre`); a "Zone ×n" chip top left in the face
  (mirroring the passes counter, so no layout change); "DEAD CENTRE" inside the face after a stop on the line; history
  cards rim gold for a zone stop and bright for a dead-centre stop; the reveal marks each watch with a dot and adds
  "Dead centre n × 2 = +x · zone streak +y".
- Distribution (80 room seeds a level; same answers graded on tapRev 4 and 5):

| Level | Old median | Old top 10 % | Old best | New median | New top 10 % | New best |
| --- | --- | --- | --- | --- | --- | --- |
| average | 73 | 109 | 128 | 75 | 118 | 152 |
| good | 100 | 119 | 137 | 108 | 134 | 159 |
| great | 113 | 141 | 148 | 126 | 166 | 188 |
| near | 142 | 144 | 146 | 161 | 172 | 185 |
| elite | 145 | 147 | 149 | 178 | 188 | 193 |

- Check: `depth-bangon-check` (legacy runs; on every kit run the score is tapRev 4's plus the features exactly; marks
  against the drawn band; 200 on a perfect run; distribution).

### Flash, Bang On and Ascend: shared notes

- Legacy: `scripts/fixtures/depth-speed-legacy.json.gz`, 400 runs (20 room seeds × the kits' four levels and spam, with
  the stored puzzle and full grade) recorded on main 37aab99 by `scripts/depth-speed-record.ts`; each depth check
  regrades them and requires the identical score, verdict, time, figures and extra.
- Checks written for the older stamps pin new deals to them with `pinPreDepthTapRev(true)` (tapLog.ts, like
  `pinDealtPuzzleScoreRev`): scoring-bands-check, scoring-batch2-check, scoring-rev3-check, speed-oct14-check;
  tap-log-check now expects tapRev 5 on new puzzles. scoring-rev3-check skips its rev-3 help/intro text test for games
  raised above 150 (their depth checks prove their texts).
- Texts: `depth/speedTexts.ts` builds the "?" help and intro lines from the rules, with `{max}`; each game's How gains one
  line for its feature; the intro stills (IntroExample) state the new figures.
- Demos: Flash, Bang On and Ascend's stored demos play older rounds without the new pieces, so they are stopped
  (`DEPTH_D3_SPEED_DEMOS`, presentation "oct25-depth-d3-speed" in `src/components/puzzles/wordInput.ts`) and the intro
  shows its still. **All three demos need re-recording on tapRev 5.**
- Styles: `src/polish-speed/depth-speed.css` (imported last in the folder's index). Colour and glow only.
- Screenshots (414 × 896, mid-play): `screenshots/depth-d3/flash-steady-hand.png`,
  `bangon-dead-centre-streak.png`, `ascend-flow-streak.png`.
- Sounds: no new sound; Ascend's right/wrong taps and Bang On's miss sound are unchanged.

## Don't Break the Chain (`chain`)

**Stamp** `chainDepthRev: 1` (a new field on the chain puzzle; `chainTimeRev 1` and `chainCycleRev 1` unchanged).
**Route** STRETCH + chain milestones. Boards, cycles, the reversed board and the momentum windows are unchanged
(the stamp is added after generation; `generateChain(seed)` deals the same boards as before).

- **Milestones** at 10, 20 and 30 links in a row (`src/lib/duel/depth/chain.ts`): each up to 5 points, in full
  when its ten links came at an average gap of 0.40 s or less, falling evenly to none at 0.65 s (the first
  milestone's ten links have nine gaps; the first tap is untimed). A broken chain keeps the milestones it reached.
  Drawn as three fixed-size pips (10 / 20 / 30) laid over the right of the counter row (lit gold = full points, gold
  outline = some, grey = reached but slow, dark = not yet; a small gold "+n"), and a "10 in a row · +5" line under
  the existing FASTER (or REVERSE) banner. Sound: the existing `chain.faster` cue already plays at 10, 20 and 30.
- **Score** (`depth/chain.server.ts`): a finish is puzzleScoreRev 3's 120 + 30 × min(1, left ÷ 0.53) (unchanged
  below today's 150 pace), then `stretchFinishScore` adds up to 35 × ((left − 0.53) ÷ (0.68 − 0.53))^1.3 ×
  efficiency² (a full chain in about 21 s is 150, in about 14 s 185), plus the milestones (up to 15), capped at 200.
  Unfinished: rev 3's credit (110 one link short) plus milestones reached, at most 119 (below every finish).
- **Texts**: intro "Links: up to 110. Finish fast for 120 to {max}; quick 10, 20 and 30 in a row add more."; help
  states the 150 / 185 times and the milestone rule; a how line "Milestones: 10, 20 and 30 links in a row score
  extra when quick." **Demo**: `chainDemoCompatible` now also needs `chainDepthRev 1`, so today's demo is stopped
  and the intro shows its still; **the demo needs re-recording** on a chainDepthRev 1 puzzle.
- **Checks**: `scripts/depth-chain-check.ts` (~1 s): 300 rounds recorded on main
  (`scripts/fixtures/depth-chain-pair-legacy.json.gz`, `scripts/depth/chain-pair-legacy-record.ts`) regrade
  identically; dealing; the finish equals rev 3 plus milestones below 150's pace and climbs past it; unfinished
  below 120; a 250 ms-a-link chain scores 200; texts; the bot table. `chain-time-check` now takes the depth stamp
  off its fresh boards (it proves chainTimeRev's 150-point rounds).

Bots (40 room seeds each, the puzzle-fairness kit players; elite = pace 0.36, 0.4 % slips; old = the same
puzzle without `chainDepthRev`):

| Bot | Old median | Old top 10 % | Old best | New median | New top 10 % | New best |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| average | 20 | 58 | 74 | 20 | 58 | 74 |
| good | 82 | 106 | 123 | 82 | 106 | 123 |
| great | 135 | 140 | 141 | 135 | 140 | 144 |
| near-perfect | 150 | 150 | 150 | 158 | 162 | 164 |
| elite | 150 | 150 | 150 | 191 | 200 | 200 |

## Bonk (`whack`)

**whackRev 3, FEATURES.** The play, pop schedule, rule flips and costs are whackRev 2's exactly (the diamonds are
drawn after the pops from the same seeded stream carried in the state, so the pop schedule is identical); the base is
whackRev 2's score (0–150). The extra 50 comes only from:

- **Gold combo**: right hits in a row, with no wrong-colour, hedgehog or empty-burrow tap between them (a gopher left
  to sink does not break it), raise a multiplier: ×1 for hits 1–5, ×2 from the 6th, ×3 from the 11th, ×4 from the
  16th. Each hit adds (multiplier − 1) pips weighted by its quickness (full when it lands within 9 ticks, 150 ms, of
  the target rising, falling evenly to none at 16 ticks, about 267 ms); combo points = min(44, floor(44 × pips ÷
  (0.52 × P))), P = the pips of one unbroken, full-quickness run through every target, so the full combo needs a
  long clean run at elite pace (retuned 26 Oct 2026, before whackRev 3 went live: it was floor(40 × (pips ÷ P)³)
  with unweighted pips).
- **Diamonds**: two a run (one in 12–28 s, one in 34–52 s), each up for 18 ticks (300 ms) in a burrow no target uses
  meanwhile (plus a beat either side); a tap on one is worth 3 (5 before the 26 Oct retune) and is never a mistake. A late tap on an empty burrow
  costs 3 as before.

Score = whackRev 2 base + combo + diamonds, capped at 200. 200 = a perfect base, an unbroken combo at elite pace and
both diamonds. Without the features no run passes 150 (the base is capped there; a perfect run without diamonds is
194, without the combo 156).

Look: the HUD line keeps one line ("Hits 17/74 · Wrong 0 · Combo ×4 · ◆0"; gold multiplier once it passes ×1, the
diamond count in ice blue once taken). The diamond is a cut gem lit from the top, rising out of the burrow like a
gopher inside the target's circular footprint, with a cool light in the burrow (every target's light is warm, so it
reads at a glance) and two twinkles; taking it gives a ring and ice sparkles. A "×N" in Archivo gold floats over the
hit while the multiplier is 2+. Under reduced motion or reduced effects the gem appears at full size, the twinkles and
the tag hold still and the sparkles are skipped.

Sound (existing cues, pitched with the cue system's rate): diamond up `whack.popUp` ×1.6, diamond taken
`whack.cleanTwenty` ×1.25, multiplier step `whack.bonkStreak` at 1 + 0.08 × multiplier; hushed in intro demos.

Reveal: "N for hits + C combo (best run R) + D for d of 2 diamonds" on the game's reveal and a combo/diamonds line in
the arcade reveal summary; stored on the round as `extra.depth`.

Bots (puzzle-fairness kits; whackRev 3 kits also tap a diamond as a target, on their own stream so the targets play
out as on whackRev 2; elite = pace 0.4, 0.4 % slips, 140 ms reactions), 40 room seeds per level:

| Level | whackRev 2 median | top 10 % | best | whackRev 3 median | top 10 % | best |
| --- | --- | --- | --- | --- | --- | --- |
| average | 71 | 82 | 97 | 68 | 81 | 97 |
| good | 102 | 112 | 120 | 101 | 111 | 116 |
| great | 122 | 133 | 145 | 130 | 143 | 148 |
| near | 137 | 148 | 150 | 167 | 178 | 182 |
| elite | 150 | 150 | 150 | 198 | 200 | 200 |

Retuned 26 Oct 2026 (Joe: near-perfect 180 and great +14 % were too generous): great +6.6 %, near-perfect 167, only
elite reaches 190–200. Before the retune: great 139 / 162 / 183, near 180 / 198 / 200, elite 200. The average
player dips 3 because a late diamond tap lands on an empty burrow (−3, as any empty tap).

Checks: `scripts/depth-bonk-check.ts` (~6 s): 45 runs recorded on main (whackRev none / 1 / 2,
`scripts/fixtures/depth-engine-legacy.json.gz`, `scripts/depth-engine-legacy-record.ts`) grade and replay identically;
whackRev 3 dealt; pop schedule = whackRev 2's on 400 seeds; diamonds in their windows in free burrows; the multiplier
table; wrong / hedgehog / empty taps end the combo, a sunk gopher does not; scripted perfect runs score 200 and replay
on the server; without the features ≤ 150; the base = whackRev 2's score for the same taps; the table above with
average and good within 10 %, great within 8 % of whackRev 2, near-perfect 165–175 and elite 190+.

Demo: stopped (introDemo.functions.ts: only a demo recorded on whackRev 3 plays); the intro shows its still. **Needs
re-recording on whackRev 3.**

Screenshots (414 × 896, live practice round): `screenshots/depth-d3/whack-diamond.png` (diamond up, Combo ×4),
`whack-combo.png` (the ×3 tag over a hit). `bun scripts/shots/depth-engine-shots.ts --url=<origin> whack` redraws them.

## Pull! (`clayshoot`)

**clayRev 9, FEATURES.** clayRev 8 play exactly (the state keeps rev 6's sky, clays and birds, and the quick-shot
part): any shots score clayRev 8's score as the base (0–150). The extra 50 comes only from:

- **Doubles**: the last fourteen clays already fly as seven pairs, one from each side, both in the sky together; hitting
  both clays of a pair is a double (up to 7 × 2 = 14).
- **Hit streak**: clays hit in a row, with no clay getting away and no bird startled between them (a shot that hits
  nothing costs as before but does not break it), raise a multiplier: ×2 from the 5th clay in a row, ×3 from the
  10th, ×4 from the 15th; each hit adds (multiplier − 1) pips. Streak part up to 36 = 36 × (pips ÷ 48)², 48 = one
  streak through all 25.
- Both are paid by the run's quick credit (clayRev 8's measure of how soon after launch each clay was hit), squared,
  and, like the quick part, by the clayRev 6 total ÷ 150: feature points × (qk ÷ qkMax)² × total ÷ 150. A slow perfect
  run earns almost none, birds and sprayed shots cut them, mashing on movers earns none; quick, clean shooting reaches
  the top.

Score = clayRev 8 base + doubles + streak, capped at 200. 200 = a perfect quick run (every clay within 250 ms of its
launch, no bird) with every double and one unbroken streak.

Look: the HUD keeps one line ("13/25 · 2 gold · 0 birds · Streak ×3 · Doubles 1/7", gold when live). While both clays
of a double fly, a faint dashed gold tether joins them; once one is hit its partner gets a pulsing gold ring ("finish
the double"); the second hit shows "DOUBLE!" in Archivo gold, and each streak step "STREAK ×N" (kept whole inside the
sky). The tether and ring sit inside each clay's shot zone, so every hit area is unchanged (tap-mapping-check).
Reduced motion or reduced effects: the tether stops crawling, the ring stops pulsing and the words do not rise.

Sound: double made `clayshoot.doubleHit`, streak step `clayshoot.claysStreak` at 1 + 0.08 × multiplier (existing
cues; hushed in intro demos).

Reveal: "N for clays + D for d of 7 doubles + S streak (best R in a row)" and a doubles/streak line in the arcade
reveal summary; `extra.depth` on the round.

Bots (puzzle-fairness kits, unchanged play; elite as above), 40 room seeds per level:

| Level | clayRev 8 median | top 10 % | best | clayRev 9 median | top 10 % | best |
| --- | --- | --- | --- | --- | --- | --- |
| average | 72 | 80 | 90 | 72 | 80 | 90 |
| good | 97 | 117 | 119 | 97 | 118 | 121 |
| great | 126 | 131 | 133 | 134 | 143 | 149 |
| near | 139 | 142 | 142 | 166 | 174 | 175 |
| elite | 145 | 147 | 148 | 184 | 190 | 192 |

Checks: `scripts/depth-pull-check.ts` (~15 s): 120 runs recorded on main (clayRev none, 2–8) grade and replay
identically; spam scores what it did on clayRev 8; clayRev 9 dealt; clayRev 9 starts as clayRev 8 on 200 seeds; pairs leave both sides together; the
multiplier table; a scripted perfect quick run scores 200 and replays on the server; a slow perfect run earns no
feature points; a clay let go loses its double and the streak; shots that hit nothing keep it; the base is clayRev 8's
score for the same shots (scripted and kit runs); the table above.

Demo: stopped (only a clayRev 9 demo plays); the intro shows its still. **Needs re-recording on clayRev 9.**

Screenshots (414 × 896, live practice round): `screenshots/depth-d3/clayshoot-streak.png` (STREAK ×3),
`clayshoot-double-tether.png` (a double in the air), `clayshoot-double-partner.png` (finish-the-double ring),
`clayshoot-double-streak.png` (DOUBLE!, Doubles 1/7).

Assumptions (Bonk and Pull!): "gold combo" counts right hits of whichever colour the banner asks for (the combo is shown
in gold), not gold hats only; Pull!'s doubles are the seven pairs the schedule already flies (no new launches), so the
play is unchanged; feature points scale with quick credit so a solid player's score barely moves.

## Mixed Signals (`stroop`)

**clashRev 8, STRETCH + features and a refresh.** Rules in `src/lib/arcade/colourClash.ts` ("Depth to 200"), art in
`colourClash.renderer.ts`, lane notes in `src/puzzles/stroop.tsx`. The rule swaps, lane shuffle, fourth lane, five
15 s phases, speed ramp, 52-word queue and the taller 390 × 650 board are clashRev 5's, unchanged (the state keeps
`rev: 5` and adds `depth`).

- **Sort streak**: words right in a row (a wrong gate or a touched grey word resets it). A STREAK badge left of the
  rule banner; the lanes glow brighter as it grows (the cached lane glow drawn again over itself, up to twice as
  bright at 20, with a slow breath; still under reduced motion / reduced effects).
- **"Don't sort" words** (5 a run): grey ink, dashed grey frame. They fall at the phase's own pace whatever you do and
  count as sorted right when left alone. Any input after their first 0.1 s touches them: the frame turns red, the word
  is struck through and it lands as a wrong word. Inputs in the first 0.1 s are ignored (too soon to be a reaction).
- **Gold words** (5 a run): gold frame and glow round the plate (the ink is never tinted). Sorted right: 2 points,
  4 on a streak of 5+. A GOLD n/5 badge right of the banner; a high sparkle tone on a gold sort.
- The specials are planned once from the seed (one of each in every 9-word block from word 6, never side by side), so
  every player in a room gets the same words.
- **Feel**: each lane plays its own note on a sort (C, E, G, A on the effects channel through `playTone`, so mute and
  the Effects slider apply; no audio file), so a quick streak across lanes plays a little tune. A sorted word zips on
  down into its gate with a trail of its ink (gold for a gold word, grey for a let-fall word sliding through the gates);
  no zip under reduced motion / reduced effects.

**Score (to 200)**: clashRev 7's score of the run (CLASH_GREAT_MAP over the clashRev 5 shape; a finish now allows 3
wrong, one more for the five traps; each let-fall word is timed as a 0.7 s sort, so waiting for one never costs speed),
and on a finish: gold (up to 20) × pace, streak 20 × ((longest − 12) ÷ 40)² × pace (20 for all 52 in a row), and a
speed stretch of up to 10 for a clean finish quicker than 37.5 s (full at 36.5 s). Pace is 1 by 37.5 s and 0 at 40 s.
An unfinished run scores clashRev 7's (at most 110), a finish 120+. A word lands about 0.7 s after it appears at best,
so the game's pace barely goes below clashRev 7's 150 pace: the extra 50 is mostly clean, quick play through the new
words. 200 needs every gold word on a streak, all 52 in a row and a quick finish.

Old versus new, the puzzle-fairness kit's players (`scripts/puzzle-fairness/kits-engine.ts`, which now leaves a
grey word alone unless it slips, at 1.5 × its Stroop slip rate), 150 room seeds each, mean · median / top 10 % / best:

| level | clashRev 7 | clashRev 8 |
| --- | --- | --- |
| average | 61 · 63 / 78 / 89 | 63 · 70 / 80 / 89 |
| good | 102 · 100 / 125 / 131 | 98 · 97 / 105 / 127 |
| great | 119 · 130 / 136 / 143 | 124 · 129 / 136 / 143 |
| near-perfect | 141 · 146 / 148 / 148 | 154 · 153 / 170 / 186 |
| elite (pace 0.3, 0.3 % slips) | 149 · 150 / 150 / 150 | 190 · 193 / 198 / 200 |
| spam (random / same gate / drop where spawned) | 0 · 0 / 0 / 0 | 0 · 0 / 0 / 0 |

Checks: `scripts/depth-mixedsignals-check.ts` (~4 s; 192 legacy runs recorded on main, every older stamp, grade and
replay exactly; the plan; let-fall, touch, grace, gold doubling; a scripted perfect run 200, the same run with the
gold words wrong under 160; room = practice; the table above with its bounds; `DEPTH_SEEDS=150` for the doc's
table). scoring-batch2-check and scoring-bands-check pin their stored stroop runs to clashRev 7 (they accept 7 or 8
dealt). replay-fixtures appended one clashRev 8 run (`--add=stroop`).

Demo: stopped (introDemo.functions.ts now needs clashRev 8), so the intro shows its still; **needs re-recording on
clashRev 8**.

Assumptions: "touching" a grey word means any steer or drop input on it; a touched word still falls the full way
(so a touch never saves time); the finish allows one more wrong word (3) than clashRev 7 because the traps add five
chances to slip; the gold and streak points fade with pace so near-perfect play stays near today's 150 and only quick,
clean play reaches 190+.

## Eagle Eye (`symscan`)

**Stamp `scanRev 2`, STRETCH** (on puzzleScoreRev 3). Grids, targets, the two-target grid 3, 30 s and the finish rule
are scanRev 1's. Files: `src/lib/duel/depth/eagleEye.ts` (rules), `eagleEye.server.ts` (grader),
`attentionStretch.server.ts` (shared with Double Take and Tally), `attentionTexts.ts` (texts),
`src/puzzles/symbolScan.tsx` (stamp, the count of taps taken back, the reveal's "n taps taken back" line).

- Unfinished: exactly puzzleScoreRev 3 (110 × progress ÷ one-short).
- Finish: rev 3's 120 + 30 × min(1, left ÷ 0.55), then a clean climb above 150:
  `50 × ((left − 0.55) ÷ (0.76 − 0.55))^2.5 × keep²`, so 150 at 13.5 s of play, 200 at about 7 s.
- Mistakes: a finish already needs every grid perfect, so the only slip a finished run can hold is a tap taken back
  (an eagle marked, then unmarked). scanRev 2 answers carry that count as a fourth `|` part (`grid1|grid2|grid3|n`);
  `keep = 1 − 0.25 n`, so one taken back keeps 56 % of the climb, two 25 %, four none. It is the phone's count (like
  Forage's misses): a phone that lies can only score what an honest clean player scores.

| Player | old median | old top 10 % | old best | new median | new top 10 % | new best |
| --- | --- | --- | --- | --- | --- | --- |
| average | 74 | 82 | 91 | 74 | 82 | 91 |
| good | 108 | 126 | 130 | 108 | 126 | 130 |
| great | 138 | 143 | 145 | 138 | 143 | 145 |
| near | 149 | 150 | 150 | 149 | 151 | 152 |
| 150 pace | 150 | 150 | 150 | 157 | 173 | 175 |
| elite | 150 | 150 | 150 | 182 | 200 | 200 |

40 room seeds; the fairness kits' players (`scripts/puzzle-fairness/kits-speed.ts`) plus two clean players: "150 pace"
(think time × 0.36, the pace that reached 150 on scanRev 1) and "elite" (× 0.25). Demo: unchanged layout and puzzle, so
stored demos keep playing.

## Double Take (`spotdiff`)

**Stamp `spotRev 2`, STRETCH + the hidden extra difference** (on puzzleScoreRev 3). Files: `depth/doubleTake.ts`,
`doubleTake.server.ts`, `src/puzzles/spotTheDifference.tsx`, `attentionRev.ts` (`spotTwoResult` never counts the hidden
cell as a wrong tap on spotRev 2), `types.ts` (`SpotShape.small`, `SpotPuzzleData.bonus`, kind `"size"`), `secrets.ts`
(`bonus` is server-side until the reveal, like `differences`), `roundSummaries.ts` (a ★ line).

- The feature: **one hidden difference per round**, in one of the two pictures (decided: per round, so the player
  never knows which picture holds it). One sweet or creature at least two cells from every counted difference is drawn
  at 80 % size in one panel (the same art). It is not in "n / 6", never needed to finish, and tapping it is not a wrong
  tap. A picture ends when its six are found, so it must be spotted before that picture's sixth. Found: a gold ring
  with a dashed inner ring on both panels and a gold ★ in the counter row (its space is always kept, so nothing moves);
  the right-tap sound (`playCorrect`, `spotdiff.found`). Reveal: the picture that hid it opens when nothing was missed,
  with "★ Hidden: a fish was drawn smaller ✓/–" and its ring (dashed warning ring if missed).
- Scoring: unfinished exactly puzzleScoreRev 3 (the hidden difference adds nothing). A finish: rev 3's
  120 + 30 × min(1, left ÷ 0.69), then up to 25 more by 84 % left, `25 × ((left − 0.69) ÷ 0.15)^1.5 × keep²` with
  `keep = 1 − wrong ÷ 6` (wrong taps over both pictures), plus **25 for the hidden difference**. Without it a finish
  tops out at 175, so 200 needs it.

| Player | old median | old top 10 % | old best | new median | new top 10 % | new best |
| --- | --- | --- | --- | --- | --- | --- |
| average | 82 | 100 | 110 | 82 | 96 | 102 |
| good | 131 | 135 | 136 | 130 | 136 | 138 |
| great | 140 | 144 | 145 | 141 | 163 | 166 |
| near | 148 | 150 | 150 | 170 | 174 | 175 |
| 150 pace | 150 | 150 | 150 | 175 | 180 | 186 |
| elite | 150 | 150 | 150 | 191 | 196 | 199 |

The kits spot the hidden difference with a chance that grows with skill (0 for average and good, about 12 % great,
46 % near, 63–70 % for the clean fast players), at 4 s more search, always before the sixth. Without it the 150-pace
player lands 150–160 (the stretch alone); the near and 150-pace medians above include the 25 when it was found. The
small average-player change is the kit's mis-taps avoiding the hidden cell (a different random stream), not scoring.
**Demo stopped**: the intro example now deals the hidden difference, so pre-depth coordinate demos are rejected
(`DEPTH_D3_ATTENTION_DEMOS` in `wordInput.ts`) and the intro shows its still; the demo needs re-recording.

## Tally (`countup`)

**Stamp `countRev 3`, STRETCH** (on puzzleScoreRev 3). The four trays, comparison question and 60 s are countRev 2's
(`COUNTUP_COUNT_REV` in `moveLimits.ts` is now 3, so `stampMoveLimits` keeps the new stamp). Files: `depth/tally.ts`,
`tally.server.ts`, `src/puzzles/countUp.tsx` (stamp only).

- Unfinished: exactly puzzleScoreRev 3. A finish needs all four exact, so it never holds a mistake: rev 3's
  120 + 30 × min(1, left ÷ 0.72), then `50 × ((left − 0.72) ÷ (0.83 − 0.72))^1.5`, so 150 at about 17 s of play, 200 at
  about 10 s.

| Player | old median | old top 10 % | old best | new median | new top 10 % | new best |
| --- | --- | --- | --- | --- | --- | --- |
| average | 81 | 110 | 110 | 81 | 110 | 110 |
| good | 88 | 134 | 138 | 88 | 134 | 138 |
| great | 138 | 145 | 147 | 138 | 145 | 147 |
| near | 146 | 149 | 150 | 146 | 149 | 151 |
| 150 pace | 150 | 150 | 150 | 161 | 177 | 185 |
| elite | 150 | 150 | 150 | 195 | 200 | 200 |

Demo: unchanged layout and puzzle, so stored demos keep playing.

**Attention checks** (all three): `scripts/depth-eagleeye-check.ts`, `depth-doubletake-check.ts`, `depth-tally-check.ts`
(~5 s each; shared `depth-attention-lib.ts`). Legacy fixture `scripts/fixtures/depth-attention-legacy.json.gz`
(324 runs recorded on unmodified main by `scripts/depth-attention-record.ts`: 12 room seeds × the four kit levels, a
clean fast player, every spam strategy and nothing, scanRev 1 / spotRev 1 / countRev 2 on puzzleScoreRev 3) grades to
the stored score, verdict and extra, as a room too. Each check also proves the same answers score identically below
150 on both stamps and never lower on the new one, the anchors (120 / 150 / 200), the texts and the table above.
attention-rework-check and attention-pattern-check now expect the new dealt stamps (their legacy fixtures still pin
scanRev 1 / spotRev 1 / countRev 2).

## Labyrinth (`maze`)

**Stamp** `mazeRev: 1` (`src/lib/duel/depth/labyrinth.ts`, grader `depth/labyrinth.server.ts`). **Route:** FEATURES
(detour stars) plus the bigger board. Older mazes (no `mazeRev`) keep the 19 × 19 board, the path answer and their
grading (`generateMazeClassic` keeps the old builder for the checks).

- **Bigger maze:** 19 columns × 23 rows (437 cells, +21 %), the same carving and tests, drawn in exactly the board
  box the 19 × 19 maze had (the cell height is the box's height ÷ 23, so the board is never smaller; frame-probe:
  406 × 536 at 414 × 896, 367 × 453 at 375 × 667, as before). Corridor width is unchanged (21.4 px at 414, 19.3 px at
  375); cells are a little shorter (23.3 px tall at 414 × 896, was 28.2; 19.7 px at 375 × 667, was 23.8), about
  square on the narrow phone. The generator turns down routes longer than 147 cells (today's 90th percentile), so the
  route keeps today's length (median 125 vs 123 over 150 mazes) and the extra corridors are side branches. One maze
  per round already, 60 s unchanged.
- **Detour stars:** three per maze, each 3–6 cells into its own side branch, one leaving the route in each third.
  Drawn in the exit star's gold gradient with a slow halo shimmer; a taken star pops and leaves a faint gold outline;
  the status line reads "squares · wasted · stars n/3" (same line, no move). Taking one plays the `correct` chime
  pitched up (playSound: mute, Effects slider, demo hush apply); under reduced motion / reduced effects the shimmer
  and pop are still. Intro example shows a star on a side path.
- **Answer:** the whole trail, one letter a step after `t` (U/D/L/R, backtracks included, at most 3,900), so the
  server sees every star the ball reached; the drawn route is the trail with its backtracks folded away and grades
  exactly as the old path answer did. A path-style answer on a mazeRev 1 maze reads as nothing.
- **Score:** unfinished exactly as puzzleScoreRev 3 (up to 110; stars count only with a finish). A finish: rev 3's
  120 + up to 30 for speed (150 with 48 % of the clock left), plus each star taken × 17 / 17 / 16 ×
  clamp((time-left share − 0.45) ÷ 0.18): full with about 22 s used (stars included, elite pace), nothing from about
  33 s, so all three stars on an elite-pace run is 200. No stars: 150 at most, as before. (Retuned 26 Oct 2026,
  before mazeRev 1 went live; it was min(1, share ÷ 0.68)², which gave near-perfect play 180.)

Distribution (`scripts/depth-labyrinth-check.ts`, 30 room seeds per level; the puzzle-fairness kit's model, 0.4 s a
route cell × pace, wrong turns walked and retraced, stars taken with the level's chance: 25 / 50 / 80 / 100 / 100 %):

| Level | Old median | Old top 10 % | Old best | New median | New top 10 % | New best | Stars (new, median) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| average | 63 | 78 | 82 | 63 | 78 | 80 | 0 |
| good | 128 | 133 | 135 | 123 | 129 | 134 | 1 |
| great | 144 | 150 | 150 | 141 | 144 | 145 | 2 |
| near-perfect | 150 | 150 | 150 | 171 | 179 | 185 | 3 |
| elite | 150 | 150 | 150 | 197 | 200 | 200 | 3 |

Before the 26 Oct retune: good 123 / 131 / 136, great 148 / 157 / 158, near-perfect 180 / 183 / 186, elite 191 /
197 / 197. Good and great now lose a little (−4 % and −2 %) when they take stars on a slower run; they keep today's
score by skipping them.

Legacy: `scripts/fixtures/depth-labyrinth-legacy.json.gz` (576 grades of 12 room mazes on puzzleScoreRev 3 / 2 / 1 /
unstamped, recorded on unmodified main by `scripts/depth-labyrinth-record.ts`) regrade identically. Demo: older maze
demos are rejected (`DEPTH_D3_ATTENTION_DEMOS` in wordInput.ts), so the intro shows its still; **needs re-recording**
on a 19 × 23 maze with stars. Screenshots: `screenshots/depth-d3/labyrinth-*.png`. Screenshot driver:
`scripts/shots/drivers/maze.ts`.

Assumptions: "fewer mazes per round" does not apply (one maze a round), so the route length is held to today's
instead; a star's worth falls with the time taken so stars pay most for fast players (a good player gains about
nothing by taking them, a great one about +5); the gold star chime is the existing `correct` cue pitched up.

## Matchmaker (`pairmatch`)

**Stamp** `pairRev: 1` with `gold` (the gold pair's face). **Route** FEATURES: match streak and gold pair. The board
and puzzleScoreRev 3's score (at most 150) are the base; the extra 50 comes only from the two features. The gold
face is drawn on the server after the deal (`randomBelow` after the shuffle), so the cards are the same as before;
it is on the phone with the rest of the board (every face already is), and drawn only when a gold card is turned.

- **Match streak** (`src/lib/duel/depth/matchmaker.ts`): matches in a row (no miss between) build a multiplier,
  ×2 for the second match in a row up to ×5; each match adds its multiplier less one to the streak points; the
  bonus is the points less 16 (the short runs anyone makes cashing the last known pairs), at most 30. A miss
  resets it. Shown in the status line under the board: "24 flips · streak ×3" (gold once live), a rising
  `playTone` pip on each match in a streak.
- **Gold pair**: worth 20 if matched within 8 tries, falling evenly to none at try 20. Gold-foil faces with a
  small star once turned (and in the reveal and the intro still); "gold +n" joins the status line; the board's own
  `pairmatch.cardWave` cue plays on the gold match.
- **Score** (`depth/matchmaker.server.ts`): rev 3's score (the same arithmetic as `withRev3`) + streak + gold,
  capped at 200. Everything is walked from the flip list (no times), on the phone and the server alike.
- **Texts**: intro "Pairs: up to 110; finish fast for more. Streaks and an early gold pair add up to {max}."; help
  is rev 3's text (stating 150) plus the two features; a how line "Bonus: match in a row for a streak; find the
  gold pair early." **Demo**: stopped (`introDemo.functions.ts`: a demo must be on pairRev 1); **needs re-recording**.
- **Checks**: `scripts/depth-matchmaker-check.ts` (~1 s): 300 legacy rounds identical; dealing (gold one of the
  fifteen pairs); every pair in a row with the gold first scores 200; misses between matches and a late gold stay
  on the base; 300 random flip lists score exactly old + streak + gold; texts; the bot table.

Bots (60 room seeds each; feature-perfect = perfect memory at the elite pace, cashes the gold pair the moment both
cards are seen and every other pair in one run at the end):

| Bot | Old median | Old top 10 % | Old best | New median | New top 10 % | New best |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| average | 81 | 121 | 127 | 88 | 133 | 150 |
| good | 138 | 140 | 143 | 150 | 164 | 169 |
| great | 145 | 146 | 147 | 159 | 175 | 178 |
| near-perfect | 150 | 150 | 150 | 169 | 178 | 185 |
| elite | 150 | 150 | 150 | 171 | 181 | 194 |
| feature-perfect | 149 | 150 | 150 | 195 | 199 | 200 |

The kit players cash every known pair at once, so their streaks are partly luck; solid players gain about 8–10 %
(within "roughly where they are now"). Assumption: "early" for the gold pair is counted in tries (the answer has
no times).

## Shared requests

## Checks run
