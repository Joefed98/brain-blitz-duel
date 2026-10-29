# Rally on the arcade scoring standard (rallyRev 12, 29 Oct 2026)

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
