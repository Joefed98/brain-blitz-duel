# Grappler: the swinging course (swingRev 15)

29 Oct 2026. Joe's direction after swingRev 14: it went too far, all ledges and hooks. Grappler (`swing`) is mostly
the old swinging game again, with short stretches of the assault course mixed in, on a new stamp, **swingRev 15**
(`SWING_REV_REWORK`, one above swingRev 14). Rooms, practice, the daily and challenges deal it; every earlier
revision (no stamp, 2–14) plays and scores exactly as before (swing-rework-check replays 60 runs recorded on
unmodified main, `scripts/fixtures/swing-rework-legacy.json`, 12 of them swingRev 14). `ROUND_MAX.swing` stays 200.

## The course

- **27 blocks** (`SWING_V15_BLOCKS`): 23 swinging stretches and 4 ledge runs (in seeded bands, never first or last): 33
  stretches in all. The course is long enough that only the fastest players finish inside the minute (a flawless run
  in about 55 s), so distance still separates the best players (clearing the course itself pays nothing).
- **Swinging stretches (about 80 % of the course's length):** 3–5 hooks each, swung hook to hook through the cave
  with no ledges. Hooks are spaced at least 140 px apart (the old cave's were 110–190 px with many more in reach),
  so about one hook is in reach at a time and each grab is a choice. Hold grabs the nearest of the stretch's hooks
  (or the next stretch's first, which clears the stretch); let go to fly. A stretch before a ledge run ends by
  landing on its first ledge; the last stretch ends on the finish ledge.
- **Ledge runs (about 20 %):** swingRev 14's sections, 3, 2, 2 and 3 of them (`SWING_V15_RUNS`): a start ledge, one
  or two hooks, a landing ledge, the section's hooks only; the first and last runs each hold a **squeeze**.
- **A miss** (the lava, or a squeeze's rock): on a swinging stretch the hero is back hanging from the last of its
  hooks they held (swingRev 4's start pose; the start ledge if they have not grabbed one yet), on a ledge section back
  on its start ledge (rev 14). Held still for 0.4 s; the clock keeps running; what was picked up since that hook or
  ledge is put back (a swinging stretch banks its pickups at each new hook, a ledge section when cleared). Joe set
  the restart rule for the ledge stretches; for the swinging ones, restarting the whole stretch made an ordinary
  player replay 3–5 hooks for every miss (an average bot restarted one stretch 35 times), so the last hook is the
  restart point and every hook's hang is proved to have a fair window on to the next.
- **The dragon** only chases over the last quarter: it appears as the hero starts the first stretch beyond three
  quarters of the course's length (rev 14's pace, catch and back-off).
- **Speed gates (5)** sit on the natural line between two hooks (a well-timed release flies through at 3.5 px a tick
  or faster: the swinging course flies slower than rev 14's ledge kicks). **Gems (5)** sit on harder lines: a
  flight to the next hook that only two or three of the releases reaching it share. **Stars (5)** sit on a tighter
  swing: where the rope reeled in (swipe up) runs, well inside the plain swing, on a swing that still reaches the
  next hook. Each kind is spread over the course in its own seeded bands.
- **Par per stretch:** a swinging stretch's planned route + 15 ticks + 5 a hook; a ledge section rev 14's (its
  fastest proved route + 50). Beaten by 30 ticks or more pays the stretch's whole share.
- **Identical for every player**, built and proved from the seed alone in the sim (`initV15`, ~100 ms a course): each
  hook is placed from the planned release and grab of the swing before it, and kept only if the planned grab takes
  it with a good swing after, releases a tick either side and grabs two ticks either side do too, four or more
  release ticks reach it, the restart's hang from the hook before reaches it on four or more release ticks within a
  few swings, the hop before's near misses reach it, and every
  earlier grab of the stretch still takes its own hook. `swingReworkPlan(seed)` returns the course's witness: its
  planned route and the line each gate, gem and star was proved on.

## Scoring (`swingReworkParts`, `swingBandPartsV15`)

| Part | Points | How |
|---|---|---|
| Course (core) | 140 | 140 × the share of the course's length behind the hero: every stretch cleared, and up to nine tenths of the one in play. A straight line (`SWING_V15_BAND_CURVE`, per mille). |
| Pars | 30 | Shared evenly by the stretches; each pays its share by how far under par it was cleared (the further under, the more; full at 30 ticks under). |
| Gates, gems, stars | 30 | 2 each for the 5 gates, 5 gems and 5 stars banked (10 a kind). |
| Clearing the course | 0 | |
| **Total** | **200** | No rising scales. No input scores 0; any input at least 1. |

## Skill bands

The bots (`scripts/arcade-skill-bands/bots/swingRework.ts`) look ahead with the sim's own rope physics and grab rule
(`swingBotKit`, perception only) and play every release and grab with the Human's timing error; the better levels
chase par and pickups, reel in for stars and (near-perfect and up) pick grabs that set up the next swing's pickups.
Medians on the six stored courses (`scripts/fixtures/swing-rework-runs.json`):

| Level | Median | Range (6 courses) |
|---|---|---|
| Weak | 52 | 28–57 |
| Average | 76 | 68–88 |
| Good | 91 | 83–103 |
| Great | 132 | 116–141 |
| Near-perfect | 172 | 152–175 |
| Elite | 179 | 169–192 |
| Flawless | 188 | 162–192 |
| Random | 7 | 5–14 |

On every course flawless > great > good. Only flawless (and some elite runs) clear the course inside the minute;
an ordinary (average) player stays within 68–88. Every played run scores 1 or more; no input scores 0.

## Build time

The build proves every hop in the sim. Measured in headless Chromium on 40 courses each: about 60–130 ms a course
unthrottled (the first in a fresh page 110–170 ms), **260–550 ms at a 4× CPU throttle** (median 267, first in a fresh
page 430–545) and 390–770 ms at 6×. That would be a visible pause at round start on an iPhone 11, so RoundIntro builds
the course while the intro is up (`prepareSwingCourse`, 120 ms after the intro's first paint; rooms and practice); the
round's own init is then a cache hit (under 0.1 ms at 4×). Async rounds (the daily, challenges) only receive their seed
when the round starts (by design), so they still build then.

## Checks

swing-rework-check (old rounds, dealing and identity, the course's structure on sampled seeds, the witness played
through the real sim clearing every stretch 30+ ticks under par with every gate, gem and star taken on its line and a
restart's hang reaching the next hook, the rules, the parts summing to exactly 200, the stored skill-band runs and
their medians, text, build time). swing-assault-check now deals swingRev 14 through `pinSwingPreRework`, its live
help-text assertions moved to swing-rework-check on the new text (as swingRev 14 did with swing-x200-check's). Updated
for the new deal: arcade-batch3, arcade-tuning-a/c/f2/g3, swing-rev8, swing-x200, six-game-scoring (the dealt stamp
and the intro text); arcade-self-replay gained `swing/rework` (appended); the replay fixture a rev-15 run (appended);
the room module (`scripts/x200/swing.ts`) deals rev 15.

## Follow-ups

- The intro demo needs recording on swingRev 15 (until then the intro shows its still).
- Screenshots: `screenshots/grappler-rework-oct-2026/` (`bun scripts/shots/swing-rework-shots.ts`): a swinging
  stretch, a ledge stretch and a squeeze at 414×896 and 375×667 (renderer frames in the play-screen box; the header
  is a stand-in).

# swingRev 16: the dark ledge runs, 90 s (1 Nov 2026)

Joe's notes on the swinging course, on a new stamp, **swingRev 16** (`SWING_REV_DARK`, one above swingRev 15). Rooms,
practice, the daily and challenges deal it; swingRev 14 and 15 (and every earlier revision) play and score exactly as
before (swing-dark-check replays 24 runs recorded on unmodified main ae1efbe, `scripts/fixtures/swing-dark-legacy.json`,
12 each of swingRev 14 and 15). Every rule is gated on the state's `dark` marker.

## What changed

- **90 s** (`SWING_V16_RUN_TICKS`, 5,400 ticks; the round clock `SWING_TIME_MS` 93 s). Older swingRev rounds still end
  at their own 60 s (the sim ends them; their clock shows 30 s unused, as Gemstone's and Tempo's did).
- **A longer course to fit the 90 s**: 42 blocks (`SWING_V16_BLOCKS`, was 27) with six ledge runs (`SWING_V16_RUNS`
  3, 2, 2, 3, 2, 3; was four) and three squeezes (was two), built and proved by rev 15's builder on its own stream
  (`V16_SHAPE`: the same hooks, ledges, proofs, features and pars, about 83 % of the length swinging, 51 stretches).
  Same gates, gems and stars (5 each). Decision: the course was lengthened rather than kept, so that, as on rev 15,
  only the best players reach the end and distance still separates the top levels (the same 27 blocks over 90 s would
  have every great player finishing; the length was fitted with the skill bands, below).
- **The dragon** still appears at the first stretch past three quarters of the course's length (`chaseFrom`, 750 ‰), so
  on the longer course it still chases only over the last quarter (rev 14's pace).
- **The ledge runs go dark** (`swingDarkFrom`, `swingHookLit`):
  - on the swinging stretch that ends on a ledge run's first ledge, everything past that ledge is dark: the sign a
    ledge run has started;
  - on a ledge section, everything past its landing ledge;
  - on the run's last ledge, everything past the next swinging stretch's first hook, until that hook is grabbed;
  - landing lights the next small part (up to the next ledge, or the first hook of the swinging part after the run),
    the newly lit cave brightening over a third of a second (display only).
  A hook in the dark **cannot be grabbed** (the step's grab rule skips anchors at or past `swingDarkFrom`), and the
  renderer draws no hook there and a near-black veil over everything past it, from the same function, so a hook is
  drawn exactly when it can be grabbed. The bots' look-ahead (`swingBotKit.target`) reads the same dark: they never aim
  at a hook they cannot see.
- **The ledge-run dim** (display only, `swingLedgeDim` / `drawLedgeDim` in `swing.renderer.ts`, rev 16 states only):
  from the stretch that ends on a run's first ledge until the dark lifts at the first hook after the run (exactly while
  `swingDarkFrom` is set), the whole scene is dimmed under a soft vignette (25 % in the middle to 55 % at the corners,
  about 30 % over the view), on top of the dark past the next ledge, so a platform section reads even when the camera
  puts the dark at the screen's edge. It fades in over 20 ticks from that stretch's start and out over 20 ticks from the
  grab that lifts it (on or off with reduced motion); the HUD and the edge warnings are drawn over it. The vignette is
  built once per canvas and world size, one fill a frame.

## Scoring (unchanged parts)

| Part | Points | How |
|---|---|---|
| Course (core) | 140 | 140 × the share of the course's length behind the hero (straight line, `SWING_V16_BAND_CURVE`, per mille). |
| Pars | 30 | As rev 15. |
| Gates, gems, stars | 30 | 2 each for the 5 of each kind. |
| **Total** | **200** | No input 0; any input at least 1. |

The core's maximum is fixed (the whole course), so it is full at the course's end, not at a measured median; the
course length is what is fitted to 90 s. Measured near-perfect median: see the table below (course ‰ column).

## Skill bands (room seeds 0–11, `bun scripts/swing-rework-bands.ts --rev=16`)

Before (swingRev 15, 60 s, 27 blocks) and after (swingRev 16, 90 s, 42 blocks, the dark), the same bots
(`scripts/arcade-skill-bands/bots/swingRework.ts`; the dark is seen through `swingBotKit.target`), room seeds 0–11,
every run through the server's replay:

| Level | rev 15 median (range) | rev 16 median (range) | rev 16 core | rev 16 course ‰ |
|---|---|---|---|---|
| Weak | 54 (28–59) | 50 (23–61) | 45 | 322 |
| Average | 76 (63–88) | 66 (61–77) | 62 | 448 |
| Good | 91 (80–103) | 90 (82–100) | 79 | 571 |
| Great | 127 (116–141) | 132 (114–141) | 105 | 750 |
| Near-perfect | 170 (152–175) | 169 (153–182) | 122 | 878 |
| Elite | 179 (169–192) | 183 (159–194) | 134 | 958 |
| Flawless | 186 (162–192) | 184 (167–195) | 137 | 985 |
| Random | 7 (3–14) | 8 (1–13) | 7 | 56 |

On every course flawless > great > good (12 of 12, both revisions). The six stored courses
(`scripts/fixtures/swing-dark-runs.json`, room seeds 0–5, the ones swing-dark-check holds): weak 55 · average 66 ·
good 88 · great 132 · near 169 · elite 182 · flawless 188 · random 6, every gap at the top 6 or more.

**Fit to 90 s:** near-perfect reaches a median 878 ‰ of the course (rev 15: about 886 ‰, core 124), flawless 985 ‰
(rev 15: 986 ‰), so the 42-block course sits where rev 15's 27 blocks sat in the minute. Tried and dropped: 40 blocks
(elite median 994 ‰, elite 187 = flawless 187) and 45 blocks (flawless 913 ‰, median 171 against elite 169).

**For Joe:** over all twelve courses the elite and flawless medians are close (183 and 184): the flawless bot banks
fewer gates, gems and stars than the elite one (20 against 22) and its pick barely moves with its pickup appetite
(tried 0.3–1.0: the same runs), so at the top the gap comes from distance and pars alone. The six stored courses keep a
clear gap (182 → 188). A wider gap would need a look at the flawless bot, or a game change; neither was in scope.

## Checks

swing-dark-check (old rounds; dealing; the course's structure; each course's own planned route played through the real
sim, the dark included, clearing every stretch 30+ ticks under par with every pickup on its line; the dark's rules and a
press-by-press probe along the witnesses that a hook is grabbable exactly when it is drawn lit; the 90 s clock; the
parts and 200; the stored skill-band runs `scripts/fixtures/swing-dark-runs.json` and their medians; the texts; build
time). swing-rework-check now deals swingRev 15 through `pinSwingPreDark`. The room module (`scripts/x200/swing.ts`),
the arcade-standard entry, the self-replay list (`swing/dark`, appended) and the replay fixture (one rev-16 run,
appended) follow rev 16.

## Follow-ups

- The intro demo needs recording on swingRev 16 (until then the intro shows its still).
- Screenshots: `screenshots/arcade-tuning-nov-2026/grappler-dark-*.png` (`bun scripts/shots/swing-dark-shots.ts`): a
  ledge run coming up, a ledge section before and after its landing, the run's last ledge, at 414×896, and the computer
  layout (1366×768, `tall`). On a ledge section the camera frames the section with its landing ledge near the right
  edge, so the dark shows there as a strip at the edge; the ledge-run dim over the whole scene marks the section anyway.
  `grappler-dark-lifted-414x896.png` shows the scene once the first hook after the run is grabbed (the dim lifted).
- Build time: about 1.5× rev 15's (about 130–230 ms a course here unthrottled, so roughly 0.4–0.8 s at a 4× CPU throttle), still built while the intro is up (`prepareSwingCourse`); async rounds (the daily, challenges) build at the round's start, as on rev 15.
