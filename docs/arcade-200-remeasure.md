# The ten 200-point arcade games re-measured with the fixed bots (Oct 2026)

26 Oct 2026. The ten arcade games already shipped at 200 (Coral Pop, Gemstone, Ball Tracker, Breaker, Pinball,
High Rise, Swish, Slice, Meteor, Tempo) re-measured with #175's fixed skill-band bots
(docs/arcade-bands-elite.md), on the revision each game deals today, and checked against Joe's bar.

## The bar (Joe, 26 Oct 2026)

This replaced the first brief's near-perfect and elite number targets and its "200 reachable on every seed" rule:

- The game is fun, and its scoring is fair, consistent and appropriate.
- A brilliant player scores more than a great player, who scores more than a good player (here: the medians rise
  good → great → elite, the same seeds for every level).
- Someone who actually plays scores above 0, and an ordinary (good-level) player's score doesn't jump from before.
- No chasing a few points: precise tuning will come from real beta scores.

## Result

- **Nine pass unchanged:** Gemstone, Ball Tracker, Breaker, Pinball, High Rise, Swish, Slice, Meteor, Tempo.
- **Coral Pop is retuned** on `bubbleRev 9`: no played run scores 0 any more, and every level's median is unchanged.
- No game's good-level median moves (Coral Pop's weak median moves by 1 on the fresh seeds, from the runs that
  used to score 0).

## How it was measured

`bun scripts/arcade-skill-bands.ts <the ten games> --rev=now --levels=all --seeds=60 --jobs=4` (tuning seeds,
n = 0–59) and the same with `--from=10000 --seeds=200` (fresh seeds), with `--save=<dir>` keeping every run's
encoded log. Every level plays the same seeds (paired runs), and only the server replay's score counts. On the
revisions dealt before this PR the numbers are identical to #175's report (the tool and bots are deterministic).
Coral Pop's `bubbleRev 9` figures replay the same saved logs through the server's replay on the new stamp: its
play is identical, so the logs replay with no desync, and only the score differs.

## Coral Pop: `bubbleRev 9` (credit for bubbles burst)

**The problem.** On `bubbleRev 8` the base units are the reef's net shrink: bubbles at the start minus bubbles left.
The reef descends and grows during a run, so a player who burst 20–36 bubbles but fell behind the descents
ended with more bubbles than at the start, and scored **0**. With the fixed bots this happened to 3 of 60 weak runs
on the tuning seeds, and to 8 of 200 weak runs and 1 of 200 average runs on the fresh seeds. All of them were
genuine plays: 28–37 shots, 19–31 bubbles popped.

**The change.** `bubbleRev 9` plays exactly as `bubbleRev 8`: same reef, chests, bank shots, combos, curves,
feature pay and checkpoint checksum. The only change is the base units: the larger of the net shrink and a
quarter of the bubbles burst or dropped (`BUB_V9_CREDIT_PER` = 4, capped at the reef's size). This lifts only
runs held near 0, because a good player's net shrink is far above a quarter of what they burst. States add
`credit: 1`, and rooms deal `bubbleRev 9`. Help and intro texts are unchanged: the curve and the figures they
quote didn't move. The intro demo rule is unchanged too: play is identical, so a demo recorded on `bubbleRev 8`
plays the same on 9. Every older stamp replays and scores exactly as before (e6-check, replay-check,
arcade-self-replay-check).

**Effect.** Re-scoring all 1,820 saved runs: 36 change on the tuning seeds and 118 on the fresh seeds. No zeros
are left at any level: the lowest played score is 16 (tuning) and 6 (fresh), and every level's median and top 10 %
is unchanged except fresh weak (37 → 38).

## Judgement calls

- **Slice and Meteor each have one zero in 400–520 played runs.** Slice: a weak run cut three chillies (−30)
  against 23 points of food. Meteor: an average run crashed before its first star. Both are the game's own rules
  working as designed (a chilli costs 10; nothing caught is nothing scored), not a scoring flaw, and at that rate
  they are the kind of technicality Joe asked us not to chase. Left unchanged.
- **Slice and Pinball: elite ≈ near-perfect.** Slice's elite median equals near-perfect's (181 / 183), and
  Pinball's is 1–5 above it. Both still rise good → great → elite with a wide margin. The bar compares brilliant
  with great, not with near-perfect, so both pass.
- **Ceilings below 200** (Coral Pop, Gemstone, Breaker, Meteor on most seeds) are no longer a target. They are
  listed in the tables for later design work.
- **Checks named in the brief that don't exist:** there is no `arcade-room-schedule-check`. The room-schedule
  pieces are covered by arcade-room-practice-check, room-practice-grade-check and replay-check.

## Tables

Median for each level; near-perfect and elite also show the top 10 % (90th percentile). Coral Pop shows
`bubbleRev 9` with `bubbleRev 8` (before) in brackets; the other nine are the revision they deal. "Lowest ceiling"
is the lowest per-seed best score over all levels, the flawless bot included, with how many seeds no level took
to 200 (a floor on what perfect play could score).

| Game | Stamp | Good → great → elite, fresh medians | Played-run zeros (weak / average) | Verdict |
|---|---|---|---|---|
| Coral Pop | bubbleRev 9 | 104 → 128 → 183 | none (was 8 / 1 fresh, 3 / 0 tuning) | retuned, passes |
| Gemstone | matchupRev 9 | 85 → 109 → 147 | none | passes unchanged |
| Ball Tracker | btRev 7 | 101 → 139 → 198 | none | passes unchanged |
| Breaker | brkRev 9 | 112 → 144 → 177 | none | passes unchanged |
| Pinball | pinRev 4 | 98 → 120 → 172 | none | passes unchanged |
| High Rise | skylineRev 7 | 97 → 115 → 185 | none | passes unchanged |
| Swish | binRev 7 | 115 → 166 → 200 | none | passes unchanged |
| Slice | sliceRev 9 | 114 → 175 → 183 | 1 weak (tuning) | passes unchanged (see above) |
| Meteor | snakeRev 9 | 108 → 142 → 178 | 1 average (fresh) | passes unchanged (see above) |
| Tempo | beatRev 9 | 101 → 135 → 179 | none | passes unchanged |

### Coral Pop

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 41 (41) | 73 (73) | 97 (97) | 124 (124) | 167 / 187 (167) | 183 / 190 (183) | 166 (60 below 200) |
| Fresh (200) | 38 (37) | 79 (79) | 104 (104) | 128 (128) | 168 / 187 (168) | 183 / 190 (183) | 152 (200 below 200) |

### Gemstone

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 56 | 66 | 81 | 100 | 123 / 169 | 150 / 180 | 122 (60 below 200) |
| Fresh (200) | 51 | 68 | 85 | 109 | 131 / 167 | 147 / 178 | 97 (200 below 200) |

### Ball Tracker

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 45 | 71 | 103 | 135 | 176 / 200 | 199 / 200 | 147 (31 below 200) |
| Fresh (200) | 40 | 72 | 101 | 139 | 172 / 200 | 198 / 200 | 140 (96 below 200) |

### Breaker

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 67 | 75 | 107 | 139 | 166 / 181 | 178 / 187 | 134 (60 below 200) |
| Fresh (200) | 68 | 81 | 112 | 144 | 169 / 185 | 177 / 188 | 144 (200 below 200) |

### Pinball

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 60 | 68 | 99 | 118 | 170 / 179 | 175 / 186 | 164 (39 below 200) |
| Fresh (200) | 55 | 78 | 98 | 120 | 171 / 182 | 172 / 184 | 166 (160 below 200) |

### High Rise

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 54 | 72 | 99 | 116 | 168 / 179 | 185 / 200 | 194 (1 below 200) |
| Fresh (200) | 56 | 70 | 97 | 115 | 168 / 180 | 185 / 200 | 196 (1 below 200) |

### Swish

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 67 | 80 | 110 | 157 | 187 / 200 | 200 / 200 | 200 (0 below 200) |
| Fresh (200) | 56 | 80 | 115 | 166 | 187 / 200 | 200 / 200 | 190 (3 below 200) |

### Slice

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 37 · 1 zero | 71 | 126 | 175 | 181 / 200 | 181 / 200 | 162 (46 below 200) |
| Fresh (200) | 37 | 70 | 114 | 175 | 183 / 199 | 183 / 200 | 164 (145 below 200) |

### Meteor

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 45 | 82 | 101 | 144 | 167 / 186 | 179 / 188 | 142 (60 below 200) |
| Fresh (200) | 44 | 80 · 1 zero | 108 | 142 | 163 / 184 | 178 / 188 | 155 (194 below 200) |

### Tempo

| Seeds | Weak | Average | Good | Great | Near-perfect (median / top 10 %) | Elite (median / top 10 %) | Lowest ceiling |
|---|---|---|---|---|---|---|---|
| Tuning (60) | 27 | 68 | 101 | 138 | 172 / 190 | 180 / 200 | 194 (1 below 200) |
| Fresh (200) | 27 | 68 | 101 | 135 | 171 / 180 | 179 / 200 | 192 (15 below 200) |
