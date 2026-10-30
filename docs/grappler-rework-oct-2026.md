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
