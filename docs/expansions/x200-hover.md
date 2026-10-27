# Hover to 200: hoverRev 9

26 Oct 2026. Hover `hoverRev 9` raises the game to 200 (`ROUND_MAX`, docs/scoring-200.md). It takes Hover's half of
the parked Expansion E1 (PR #165, `origin/claude/e1-parked`: the taller world, tight gates, star chains and shields; not
its Jaywalk or Rainbow Bridge) onto today's main, adds the **centre line** through each tight gate, and retunes the
scoring to the arcade rule agreed with Joe (guaranteed opportunities, skill headroom). Rooms, practice, the daily and
challenges deal `hoverRev 9`; every older stamp keeps its own course and scoring (`hover-x200-check`).

## Stamp

`HOVER_REV_EXPAND = 9`. The parked branch's `hoverRev 8` was never merged or dealt; it is folded into 9 (every rule gates
on `rev === 9`, nothing deals or names 8). A round stamped 8 would play as hoverRev 7, the revision before it
(`hoverGameFor(8)` is the hoverRev 7 game, `hoverWorldHFor(8)` its 735 px world); none exists.

## World and course

A **390 × 727** world (`HOVER_EXPAND_H`, the height a 390-wide world fills the iPhone 11 home-screen play box, 414 × 772,
edge to edge). The course is hoverRev 7's (seeded barriers, gap sizes, two-gap, sliding and gold-star barriers, spacing,
scroll ramp), drifting over the full height. New on hoverRev 9:

- **Warm-up gate**: the first barrier is a 400 px gap (`HOVER_OPEN_H`) centred on the saucer's start height.
- **Flight credit, 1 unit** (`hoverFlightUnits`): staying up half a second (30 ticks) or flying up to the first barrier,
  so a weak-but-trying run never scores 0 (no input still scores 0; random play about 2).

## Features (all placed by the seed alone, the same for every player)

Laid on the course at init from their own PRNG stream (`seed ^ 0x7e1a5c03`); the counts are fixed on every course.

- **Tight gates** (`HOVER_TIGHT_GATES` = 5): on plain barriers (one still gap, no star) a second, gold-rimmed gap only
  80 px high, ≥ 56 px of wall from the main gap, within reach of the neighbouring gaps. Threaded cleanly (inside it on
  every tick the saucer overlaps the barrier, not on a broken shield's moment): 5 skill points.
- **The centre line** (new): a line through the middle of every tight gate. On a clean thread, the furthest the saucer's
  centre strays from it while within the barrier's columns (the gate's depth) grades the pass: within 6 px grade 3, 10 px
  grade 2, 15 px grade 1 (`HOVER_CENTRE_TOL`, `hoverCentreGrade`), paying **4 / 2 / 1** skill points
  (`HOVER_CENTRE_POINTS`: dead centre pays twice a grade 2, the line is what separates elite from near-perfect). Integer sim; state fields `ctrOn`, `ctrDev` (running
  furthest stray), `ctrLog` (barrier × 4 + grade) and `ctrPts`, folded into the checkpoint checksum last.
  The slowest gate's best arc strays about 4.3 px, so dead centre is open on every gate; generation also guarantees it
  can be flown (below).
- **Star chains** (`HOVER_CHAINS` = 5): 5–7 stars on the top of one flap's arc between two barriers. All stars of a
  chain: 5 skill points. (The number of stars in a chain varies with the stretch's speed; the number of chains and their
  pay do not.)
- **Shields** (`HOVER_PICKUPS` = 2): two bubbles at fixed seeded points (one early, one mid-course), drawn whether or not
  a player can take them. Touching one with no shield held gives a shield; a crash (barrier, floor or ceiling) breaks it
  instead and the saucer is untouchable for 45 ticks. No points. The parked code already placed them by the seed only;
  nothing about a shield depends on what the player did except whether it is held.

Generation rules added on hoverRev 9 so that every course offers the full set and perfect play can take all of it:
5 chains on every course (two more relaxation passes), never two chains in a row, a chain only where the barrier after
it can be flown out of the chain's flap (`chainExitFlyable`), no chain leading into a tight gate, a low tight gate keeps a
whole arc above the floor, and a tight gate only where its centre line can be flown dead centre out of the barrier
before (`centreFlyable`, up to 6 places drawn per barrier, a third pass with 18). Over 20,000 seeds every course has
exactly 5 tight gates, 5 chains and 2 shields.

## Scoring

- Base: `hoverExpandUnits` (barriers 3, gold stars 2, the flight unit 1) on `HOVER_V9_BAND_CURVE`
  (`[0, 24, 27, 42, 45, 65, 89, 100, 145]` → `[0, 68, 70, 97, 101, 112, 118, 139, 140]`: hoverRev 7's strict curve with
  the middle knots a few points lower, because the shields and the warm-up gate carry players a few barriers further;
  140 at every barrier and 9 of the 10 gold stars), plus 10 for lasting the minute: at most 150.
- Skill: raw points `hoverSkillRaw` = 5 a tight gate + 5 a whole chain + the centre points (at most 25 + 25 + 20 = 70),
  paid on `HOVER_SKILL_PAY` (`[0, 15, 30, 45, 52, 60]` → `[0, 8, 23, 31, 39, 50]`): the full 50 from
  `HOVER_SKILL_FULL` = 60, 10 short of everything (`HOVER_SKILL_SLACK`), so a flawless human-paced run reaches 200 with
  one slip (a chain lost, or a couple of centre lines a grade off) but the last 8 raw points before it (elite
  precision) are worth 11. The score, the reveal, the round summary and the stored run
  (`extra.skill`, `tightGates`, `starChains`, `centrePts`, `centreLines`, `shieldBreaks`) read the paid figure.
- Total: min(200, base + paid skill) (`HOVER_V9_MAX`).

## The guarantee (perfect-play ceiling)

- From the counts: every course offers 42 reachable barriers, 10 gold stars, 5 tight gates with centre lines and 5
  chains (proved on every course `hover-x200-check` builds: 1,500 seeds plus all 260 below), so a perfect run scores
  140 + 10 + pay(70) = 200; with one gold star and 10 raw skill points lost it is still 200.
- Reachability: `scripts/hover-x200-witness.ts` searched, with the course solver (`scripts/hover-x200-solver.ts`, a beam
  search over taps at least 6 ticks apart), a run through every barrier, gold star, tight gate (dead centre) and chain
  on all **60 tuning seeds** (room seeds 0–59) and **200 fresh seeds** (10000–10199). All 260 were found and replay to
  **200 through the server replay** (`scripts/fixtures/hover-x200-witness.json.gz`; hover-x200-check replays them).
  Lowest ceiling on each set: **200**. Hover has no room bank (rooms deal a fresh seed).

## Phase 1 of the arcade rule (26 Oct 2026, evening; same stamp, changed in place: hoverRev 9 was never dealt)

Session A's fixed bots found 194 the top for elite and flawless (no bot above 199), near-perfect's top 10 % at 194 and
average zeros on 11 of 200 seeds. Changes: the flight credit (above, replacing "reaching the first barrier counts 1"),
the centre line paying 4 / 2 / 1 (was 3 / 2 / 1), the full skill pay at 60 raw of 70 (was 65 of 65) and the base's 140
at nine stars (was ten). The course generation is unchanged, so the 260 witness runs still replay to 200. Interim, with
this branch's bots on the 60 tuning seeds (my harness, not the final tool): average 62 (0 zeros), good 103,
near-perfect 163 / 184, elite 189 / 197, the parked flawless player 194 / 200 (max 200), random 2 (max 11). The final
tuning (phase 2) uses Session A's bots; the tables below are from before phase 1.

## Phase 2: #175's fixed bots (26 Oct 2026, night)

The bot is #175's fixed `bots/hover.ts` (old-stamp play exactly as #175 has it) with this expansion's feature play
ported in (tight gates, centre line, chains, shields by level; `randomBot`). The flawless level (`perfect`) on hoverRev 9
plays `bots/hoverFlawless.ts`: it sees the screen ahead of the saucer (260 px), re-plans every 6 ticks with a beam search
over taps at most 10 a second, takes everything in view, plans a star chain whole once its first star is in view (and
through the barrier after it), and sets up a gold gate's flap as the gate comes into view. Scoring changes on the same
stamp for the top: the full skill pay at 58 raw of 70 (`HOVER_SKILL_SLACK` 12) and the base's 140 at every barrier and
8 of the 10 gold stars (one slip forgiven at each end). The course is unchanged (witnesses still 200).

`bun scripts/arcade-skill-bands.ts hover --rev=x --levels=weak,average,good,great,near,elite,perfect,random`; before =
hoverRev 7 on the same fixed bots. Median (p10–p90).

| Level | Tuning 60: before | after | Fresh 200: before | after |
|---|---|---|---|---|
| Weak | 34 (8–77) | 28 (11–70) | 25 (0–70) | 28 (11–77) |
| Average | 76 (16–114) | 91 (27–116) | 76 (8–112) | 92 (27–113) |
| Good | 110 (25–139) | 106 (45–139) | 113 (59–135) | 112 (45–139) |
| Great | 132 (104–149) | 123 (61–151) | 120 (93–149) | 141 (53–158) |
| Near-perfect | 139 (118–149) | 170 (80–185) | 149 (118–149) | 169 (95–185) |
| Elite | 149 (126–149) | 180 (131–199) | 149 (130–149) | 178 (74–199) |
| Flawless | 149 (139–150) | 200 (200–200), min 200 | 150 (139–150) | 200 (200–200), min 126 |
| Random | 0 (0–0) | 2 (2–11) | 0 (0–0) | 2 (2–11) |

Zeros: hoverRev 7 had weak 2/60 and 33/200, average 3/60 and 11/200, good 0/60 and 2/200, great 2/200; hoverRev 9 has
none at any level, random included (min 2: the flight unit). Flawless reaches 200 on 60 of 60 tuning seeds and 191 of 200
fresh (lowest 126, then 189–197: the bot's limited view, not the course: every one of those seeds has a stored witness
run at 200).

## Tuning (bots through the server's encode + replay; old = hoverRev 7, LIVE_BANDS' `strictRev`)

`bun scripts/arcade-skill-bands.ts hover --rev=x --levels=weak,average,good,great,near,elite,random --seeds=60 --jobs=1`
and `--seeds=200 --from=10000`. Median / top 10 % (p90); old revision's median in brackets.

| Level | Tuning seeds (60) | Fresh seeds (200) |
|---|---|---|
| Weak | 28 / 68 (34) | 28 / 77 (17) |
| Average | 62 / 106 (68) | 68 / 108 (68) |
| Good | 102 / 126 (100), +2 % | 98 / 133 (105), −7 % |
| Great | 120 / 151 (120) | 131 / 154 (117) |
| Near-perfect | **166 / 185** (139) | **169 / 183** (139) |
| Elite | **187 / 192** (149) | **183 / 191** (139) |
| Random | 2 / 11, max 11 (0, max 8) | 2 / 11, max 11 (0, max 8) |

Zero scores on hoverRev 9: none for any level but random (tuning 2 of 60, fresh 5 of 200 random runs). hoverRev 7 had
weak 3/60 and 39/200, average 5/60 and 14/200, good 1/60 and 2/200 zeros.

Skill paid and the centre line's raw points (median / p90), from the same bots on the same seeds:

| Level | Paid skill, tuning | Paid skill, fresh | Centre points, tuning | Centre points, fresh |
|---|---|---|---|---|
| Weak | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Average | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Good | 0 / 2 | 0 / 3 | 0 / 0 | 0 / 0 |
| Great | 2 / 8 | 2 / 8 | 0 / 2 | 0 / 2 |
| Near-perfect | 26 / 36 | 28 / 36 | 3 / 7 | 4 / 7 |
| Elite | 38 / 43 | 36 / 43 | 8 / 13 | 8 / 11 |

Bot (`scripts/arcade-skill-bands/bots/hover.ts`): the parked bot, with chase rates by **tier** (`human.tier`): tight
gates weak 2 % … near 85 %, elite 100 %; chains … near 90 %, elite 100 %; the centre line (planning the pass by its
furthest stray across the gate's depth while keeping 3 px of room) great 10 %, near 30 %, elite 100 %. The elite and
near-perfect players differ in profile, random stream and these rates. `randomBot`: taps 6–30 ticks apart at random.

Order of work, for the record: the curve, the pay scale and the bot rates were set on the tuning seeds only. The fresh
seeds were measured once mid-way; that run showed 3 weak zeros in 200 (bots falling into the warm-up gate's lower wall
before passing it). The fix (a 400 px warm-up gate and the 1 unit for reaching the first barrier) was checked on seed
indices 200–1199, not on the fresh set; the fresh numbers above are the final code's.

## Intro, help, sounds, effects

- Intro HOW: "Tap to hover up; let go to drop." / "Gold gates: thread them, dead centre for more." / "Star chains: sweep
  them; shields take a crash." SCORE: "Points for barriers and stars; tight gates, chains and centre lines add 50. Up to
  {max}." The "?" help adds lines for tight gates, the centre line (6 / 10 / 15 px), chains and shields, and the skill
  sentence with the pay scale (`skillPayLine`). The intro demo is stopped until one is recorded on hoverRev 9
  (`introDemo.functions.ts`); **the demo needs re-recording**.
- Drawing (display only, `hover.renderer.ts` `drawCentreLine`): at rest a faint 1 px gold line on the gate's middle across
  the barrier's columns (alpha 0.14). While the saucer threads the gate cleanly, the line from the barrier's left edge to
  the saucer lights up as bright as the grade held so far, and a short bright run under and either side of the saucer
  rises the closer it is to the line (white near dead centre). A graded pass stays lit and fades over 30 ticks. Reduced
  effects: the line and its lit part only, no glow. Everything is on the barrier's columns within 2 px of the line
  (hover-x200-check's bounds section). HUD: `TIGHT n/5  CHAINS n/5  CENTRE n`.
- Effects (`arcadeFxGames.renderer.ts`, appended to HOVER_FX so older rounds' moments are unchanged): TIGHT GATE!, STAR
  CHAIN!, SHIELD!, and DEAD CENTRE! / CENTRE +n; a shield breaking is a miss moment. `HOVER_FX_EXPAND` (727) is the spec
  rooms deal.
- Sounds (existing recordings only, through `hoverSounds`): a centre line plays `hover.star` (fallback `arc_retro_coin`)
  quietly and higher the better the grade; chain stars, chains, tight gates, shield pickup and break as the parked branch.
  Replay moments `hover.tight-gate`, `hover.star-chain`, `hover.shield`, `hover.centre-line` on `replay.moment.mp3`
  (manifest, `docs/sound-cues/replays.md`, cue sheet regenerated).

## Screenshots

`screenshots/x200-oct-2026/hover-centre-line-lit-414x896.png` (the saucer threading the first tight gate, the line lit
behind it with its bright run round the saucer) and `hover-centre-line-rest-414x896.png` (the gate ahead, its faint line
at rest): the real practice page in Chromium at 414 × 896, DPR 2 (`bun scripts/shots/hover-x200-shots.ts --url=<origin>`,
the flawless player's taps clicked on their sim ticks).

## Checks and tools

- `scripts/hover-x200-check.ts` (~15 s): legacy identity (64 runs recorded on main before the expansion, hoverRev 2–7 and
  unstamped, `scripts/fixtures/hover-expand-legacy.json.gz`, ported from the parked branch), wiring, the course rules and
  counts, determinism and server = phone, the centre line's rules, caps and pay, the ceiling (counts + 260 witness runs at
  200), no input 0 and random near 0, shields, bounds.
- `scripts/x200/hover.ts`: the room proof for arcade-room-schedule-check (8 deals × 5 styles, every seeded item
  identical: barriers, gaps, slides, gold stars, tight gates, centre lines, chains, shields; the opportunity counts).
- Tools (not checks): `scripts/hover-x200-solver.ts`, `scripts/hover-x200-witness.ts` (re-record the witnesses after any
  change to the course: two slices in parallel take about 25 minutes), `scripts/hover-x200-record.ts` (legacy fixture),
  `scripts/hover-x200-bands.ts`, `scripts/shots/hover-x200-shots.ts` and `hover-x200-plan.ts`.
- `scripts/arcade-self-replay-check.ts` has a `hover/x200` entry; `scripts/fixtures/replay-runs.json` one run on hoverRev 9.
- Older checks assert hoverRev 9 directly where they said "rooms deal" (arcade-tuning-c-check, arcade-tuning-e-check,
  including its help line "counts 45 – about 15 barriers" and the live arena height).
