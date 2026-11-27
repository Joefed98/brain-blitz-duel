# Rally on the arcade scoring standard (rallyRev 12, 29 Oct 2026)

## rallyRev 14 (D5's ladder, 23 Nov 2026): spin shots measured, Normal's lines lowered, the levels' paddles

New stamp **rallyRev 14** (`RALLY_REV_LADDER`), dealt at Normal and every level; rallyRev 13 rounds (every level) and
every older stamp replay and score exactly as before (`scripts/fixtures/rally-ladder-legacy.json.gz`, recorded on
polish/d5 428cd79a before any change; rally-ladder-check section 1). Checks written for rallyRev 13 pin
`rallyPreLadder` (`DEAL_PINS`). States add `ladder: 1`, folded into the checkpoint checksum last.

**First, the bot learnt spin shots** (Joe, 23 Nov 2026: a strong player uses them), on rallyRev 14 with the Oct 2026
fixes only, so every older check keeps the bot it was proved with (rally-ladder-check replays the legacy fixture's bot
runs and requires exactly the recorded logs):

- `SPIN_TRY` (great 0.3, near 0.6, elite 0.9, flawless 1): when a ball is about to land (as seen, at most 34 ticks away)
  and no other ball lands soon after, the player weighs eight sweeps (2.5–8 px a tick either way) and five contact points
  on the paddle, plays each forward through the sim from what it has seen (the lagged view stepped on with its own
  finger's moves since), and keeps the one whose curling ball strikes a pink pad or a gold target soonest, for the wall
  bounces' small seeded nudges as dealt and as two other draws (a shot aimed at a curve, never at one bounce). The sweep
  runs 7 ticks before the contact to 3 after; the finger keeps its top speed.
- `PLACE_SD` (the spec's aim-error bot): where the paddle is put for each ball carries a seeded normal error (average 10 px,
  elite 4 px, flawless 0), so the paddle's width tells.

Then Normal was refitted by Joe's rule (each feature part full at about what the realistic elite takes on three runs in
four; the core moves only if that isn't enough). Measured with the new bot on 64 Normal deals: the elite's
three-in-four figures are 15 gold-ball hits, 5 pink pads, 3 gold targets and 3 spin shots. With the features there and
the core left at 23 the elite reached 200 on 11 % of runs (and the planner below proved only 51 of 220 Normal seeds), so
the core line moved too, as little as gives the aim: to 19 (47 % on the proved deals; 20 gave 29 %):

| Part | Max | rallyRev 13 | rallyRev 14 (Normal) |
| --- | --- | --- | --- |
| Gold-ball hits | 130 | full at 23 | full at 19 |
| Pink pads | 30 | 3 each (full at 10) | 6 each (full at 5) |
| Gold targets | 30 | 5 for each of the 6 | 10 each (full at 3 of the 6) |
| Spin shots | 10 | 2 each (full at 5) | about 3 each (full at 3) |

Rally's average and elite players return gold balls at close rates (the five gold balls and Joe's reaction limit, not the
player's skill, cap the count: the flawless player's median is 18, the elite's 18, the average's 14), so a core line the
elite can fill also lifts the average: Normal's average is 145 on rallyRev 14 against 115 on rallyRev 13 (today's bot; 105
for the bot with the placement error on rallyRev 13's lines). This is the one point where Joe's two aims for Normal (elite
40–60 % at 200, the average close to today's) pull apart for Rally; the elite aim is met and the average's rise is Joe's to
judge.

### Levels (D5, 23 Nov 2026)

The lever is **the paddle's width** (retroLevels.ts `RALLY_LEVELS_V14`, mirrored by the level registry): each level takes
about two fifths off the paddle, with the bumpers on court from the first serve on Hard and Expert instead of arriving
later (none at all on Easy), so the step shows before the first return.

| | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| Paddle (px, start → narrowest) | 168 → 84 | 120 → 40 | 72 → 28 | 48 → 24 |
| Bumpers | none | from 30 s and 45 s | both from the first serve | both from the first serve |
| Lives | 4 | 2 | 2 | 1 |
| Ball's top speed | 86 % | 100 % | 115 % | 125 % |
| Gold-ball hits full at | 20 | 19 | 15 | 16 |
| Pink pads full at | 6 (5 each) | 5 (6 each) | 5 | 4 |
| Gold targets full at | 3 (10 each) | 3 | 3 | 3 |
| Spin shots full at | 3 | 3 | 2 (5 each) | 3 |
| Seeds dealt (proved of tried) | 100 of 122 | 100 of 152 | 100 of 122 | 100 of 134 |

Each level carries its own scoring lines (decision 12), set from the realistic elite's runs on each level's proved
candidates so the elite's share of runs at 200 steps down each level (`RALLY_V14_LINES` for Normal). The renderer draws
each bumper from the sim's own arrival tick (`rallyBumperFromTick`).

**The ladder** (`scripts/fixtures/d5-ladder-rally.json.gz`: 96 deals a level, the ladder's average and realistic elite
under the human limits, graded by the server; `bun scripts/d5-ladder-record.ts rally --deals=96`):

| | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| Average player, mean | 170.2 | 145.1 | 122.2 | 72.4 |
| Realistic elite, mean | 194.3 | 183.9 | 176.8 | 171.1 |
| Elite runs at 200 | 78 % | 47 % | 39 % | 28 % |

On rallyRev 13 (today's deal, today's bot, 96 deals) the averages were 139.5 / 114.9 / 98.1 / 85.4 and the elite 161.4 /
139.0 / 121.1 / 106.3 with no run at 200 at any level. The spec's targets were average 150–180 / 55–75 / 25–45 and elite
195+ / 150–175 / 120–150: Hard's and Expert's averages sit above them because the lines the elite needs for 200 lift every
player (see Normal above). The spec's risk (a 24 px paddle against a 14 px ball at 125 % may be past a human-paced player,
floor 32) did not bite: the planner held to the limits proves 200 on 100 of 134 Expert seeds.

**Proof**: every dealt seed at every level has a stored witness at exactly 200 through the server's replay, played by the
flawless player held to the human limits (below); rally-ladder-check replays a tenth (all with `CHECKS_FULL=1`).

Checks and tools: `scripts/rally-ladder-check.ts` (~15 s; `--full`), `bun scripts/rally-level-deal.ts [--check]`,
`bun scripts/rally-oracle.ts` (a report), `bun scripts/d5-ladder.ts rally`, the lever picture
`src/lib/levels/pictures/retro-action/rally.tsx`.

### The proof: the flawless player held to the human limits

`scripts/rally-oracle.ts`: the skill-band bot's flawless player with the fixes and the spin shots, seeing the court 0.15 s
late (its tracking lag, HUMAN_LIMITS' move time) and turning to a new ball one reaction later (never sooner than 0.25 s).
A seed is dealt at a level only when one of six draws of its reactions scores exactly 200 through the server's replay
(`scripts/rally-level-deal.ts`, `src/lib/duel/rallyLevelDeals.server.ts`, the witnesses in
`scripts/fixtures/rally-level-deal-witness.json.gz`; `--check` replays every witness and rebuilds the deal file byte for
byte).

The renderer draws each bumper from the tick the sim brings it on court (`rallyBumperFromTick`: a level's own times on
rallyRev 13 and 14; it drew Normal's 30 s and 45 s on every level before, so on rallyRev 13's levels a bumper could
bounce balls before it showed). A gold target shows what it pays on rallyRev 14 (`rallyBonusPtsOf`: 10), and the reveal's
target figure is the part's own points (`rallyBonusPartPoints`); every older stamp shows exactly what it did.

## rallyRev 13: lives and spin shots (the Retro overhaul, 15 Nov 2026)

Joe's review (docs/design/game-reviews/retro.md "Rally"): lives instead of ending on a missed blue ball, teach spin in
the intro, and a small bonus for gold scored with spin. New stamp **rallyRev 13** (`RALLY_REV_LIVES`, state marker
`exp: 4`), rallyRev 12's court, balls, pads, bumpers, targets, spin and timings with:

- **Lives** (`RALLY_V13_LIVES`, 2 at Normal). A missed blue ball costs a life while one is left: it waits 1.5 s at the
  serve spot (`RALLY_V13_RELAUNCH`, 90 ticks; blinking with a 3-2-1 over it), then serves upwards again at its current
  speed with a sideways lean from the seeded stream (the same for everyone). The second miss ends the run.
- **Spin shots**: a ball still curving from a swiped return that strikes a pink pad or a gold target.

| Part | Max | How |
| --- | --- | --- |
| Gold-ball hits | 130 | straight line, full at 23 hits (was 140) |
| Pink pads | 30 | 3 each |
| Gold targets | 30 | 5 for each of the 6 |
| Spin shots | 10 | 2 each |

The intro's HOW lines now teach the swipe ("Swipe as you hit: the ball curves; a curve that scores, +2.") and say a miss
costs a life. A life lost plays `rally.lifeLost` (the `impact` haptic), the serve `rally.serve`, a spin shot
`rally.spinShot` (library fallbacks until Joe's files, docs/sound-cues/retro-elevenlabs.md). rallyRev 12 rounds play,
score and name their three parts as before (`specFor` in `src/lib/arcade/standard/rally.ts`). retro-overhaul-check
proves the same play tick for tick up to the first miss on the skill-band bots' logs, the grace, the serve, the
spin-shot rule and the server replay. Levels (Easy to Expert) come with the difficulty framework.


Joe's row: "Rally (gameplay fix): the spin curves the wrong way. Swiping left on the ball must send it left and then
curve round to the right (and the mirror for right). Core up to 140 = gold-ball hits, full at the near-flawless count.
Pink target pads 30, split. Gold targets 30 (5 each of 6). Lasting the minute 0. Losing the blue ball ends the run."

New stamp: **rallyRev 12** (`RALLY_REV_STD`, state marker `exp: 3`), dealt by rooms (`generateRally`), listed in
`LIVE_BANDS` with its spec (`RALLY_STD_SPEC`) and core line (`RALLY_V12_BAND_CURVE`). Every earlier revision plays and
scores exactly as before (rally-standard-check replays runs recorded on 99115b0 on rallyRev 10 and 11 to the same score
and final state; expansion-e9-check keeps its own legacy fixture).

## Parts (200)

| Part | Max | How it pays |
| --- | --- | --- |
| Gold-ball hits (core) | 140 | straight line, `140 × min(hits, 23) ÷ 23`, rounded down (`RALLY_V12_FULL_AT` 23) |
| Pink pads | 30 | 3 for each pad a gold ball strikes, up to 10 (`RALLY_V12_PAD_PTS`) |
| Gold targets | 30 | 5 for each of the 6 seeded gold targets struck (`RALLY_V12_TARGET_PTS`) |

Blue returns and lasting the minute pay nothing. Losing the blue ball ends the run (as on every revision: the sim
already set `dead` on the first loss, with no lives or respawn) and the score stands at what was earned; a run that
played and earned nothing scores 1, no input 0.

## Core target

`bun scripts/arcade-skill-bands.ts rally --rev=now --levels=all --seeds=60` with the default (fixed) bots: the
near-perfect level's median gold-ball hits is 22.5 (the tool's rounded median 23), so the core is full at **23**. The
same level met 23 gold hits on rallyRev 11 (where the spin change could not matter: the bots never spin on purpose).

"Gold-ball hits" maps 1:1 to the sim's `goldHits` counter (every return of a gold ball off the paddle).

## Pink pads: the split

The pads are open-ended (each strike moves the pad on to its half's next seeded spot; 48 spots, more than any run
reaches), so the 30 is split over a fixed count of pads. The near-perfect level meets 7–8 pads (median 7 tuning, 8
fresh), the best runs 15–19. I split it over **10** (3 each, 10 divides 30) rather than 6 (5 each, the divisor closest
to the near median): with 6 the near-perfect, elite and flawless levels all cap the pads, and the top bunched
(tuning 181 / 185 / 190, fresh 179 / 185 / 190 for great-near / elite / flawless on 6, against 175 / 178 / 185 and
173 / 181 / 185 on 10, with the great → near-perfect gap 4–8 points wider).

## The spin fix (gameplay, rallyRev 12 only)

rallyRev 10/11: the paddle's smoothed speed at contact gives the return a spin that bends the flight the way the paddle
moved (a swipe left curves the ball further left). rallyRev 12: the spin keeps rallyRev 11's strength, wear (about two
thirds of a second of strong curve), steep floor, side walls mirroring it and far wall ending it, but

- the return's launch gets a sideways kick the way the paddle moved: `spin × 3 / 2` (1/256 px a tick, the speed kept),
  so a swipe left sends the ball off to the left;
- the spin is reversed, so the curve then bends it back round to the right (mirror for a swipe right).

At full spin the ball leaves about 20° left and its x-velocity turns rightwards about half a second into the flight
(rally-standard-check asserts both, and the mirror, and that rallyRev 11 still curves the way the paddle moved). The
help's "Aim with the paddle" line says so. Spin still scores nothing itself. The renderer's spin dots already turn the
way the ball bends (the spin's sign), so they follow the new direction without a change. The skill-band bot has no
spin model (it never spins on purpose; incidental paddle movement at contact spins its returns), so nothing in it
needed a rev-12 gate.

## Other changes

- Gold targets show "+5" on rallyRev 12 (`rallyBonusPtsOf`; "+6" before) above the target, in the strike pop and the
  shared layer's "GOLD TARGET +5". Pink pads already showed "+3".
- Help (`instructions.ts`): `liveStdHelp("rally", "Only gold balls and gold targets score; losing the blue ball ends the
  run.")`; How lines for the pads (+3), the gold targets (+5), the spin and "you keep what you have scored".
- Intro SCORE (`introScore.ts`): "Gold-ball hits, pink targets and gold targets. Up to {max}."
- Reveal: the standard's lines (Gold-ball hits / Pink pads / Gold targets / Total); grade extras' `bonusPts` is 5 a
  target on rallyRev 12; the in-game Reveal text lists the three counts.
- Intro demo: stopped until one is recorded on rallyRev 12 (`introDemo.functions.ts`; arcade-tuning-g1-check and
  six-game-scoring-check follow the guard to the new stamp). **Needs recording on rallyRev 12.**

## Medians, before (rallyRev 11) → after (rallyRev 12)

Skill-band tool, `--rev=now --levels=all`, default bots, every run through the server replay. No zeros at any level
on either revision.

Tuning seeds 0–59:

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rallyRev 11 | 57 | 84 | 125 | 137 | 170 | 177 | 184 |
| rallyRev 12 | 74 | 110 | 140 | 165 | 175 | 178 | 185 |

Fresh seeds 10000–10099:

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rallyRev 11 | 56 | 83 | 123 | 151 | 163 | 179 | 186 |
| rallyRev 12 | 68 | 100 | 140 | 169 | 173 | 181 | 185 |

Raw medians on rallyRev 12 (tuning): gold hits 9.5 / 15 / 18.5 / 21 / 22.5 / 24 / 27, pads 2 / 4 / 5 / 6 / 7 / 7.5 / 8,
gold targets 1 / 2 / 3 / 3 / 4 / 4 / 4. The medians rise at every level. The gaps at the top are small because the
bots themselves separate little there (fresh seeds: great and near-perfect both median 22 gold hits); past the core's
full mark only pads and targets separate elite and flawless play.

## Assumptions

- "Near-flawless count" = the near-perfect level's median on tuning seeds (the lead's decision), 22.5 → 23.
- Pads split over 10 (above). Gold targets: the six seeded targets of rallyRev 10/11 (same times and places).
- No survival points and no blue-return units (rallyRev 10/11 counted 1 unit a blue return on their curve).
