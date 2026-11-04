# Grappler: the swinging course (swingRev 15)

## The jungle canopy (3 Nov 2026, the Action polish; display only, swingRev 17)

Joe's audit: the hooks were tiny yellow dots on a mostly black screen, the rope and player small, and it looked like
Roofbound (both dark lava caves). swingRev 17 (the revision rooms deal) draws a prehistoric jungle canopy
(`src/lib/arcade/swingJungle.renderer.ts`, dispatched from `drawSwingArtWorld` on `state.slide`; every earlier revision keeps
its cave) with the same rules, course and timings, every shape on the sim's own geometry: the canopy is the mass above the
ceiling line, the river the floor line (a miss drops you in), grab points are knotted vine loops at the anchors hanging from
the canopy with a glow (swinging vines for the sliding hooks, drawn where the sim has the hook this tick, their travel a faint
dotted arc), ledges are tree platforms, squeezes a hanging trunk over the roof rectangle and a mossy boulder stack over the
floor one, speed gates bamboo posts, the dark ledge runs the canopy's deep shade (the same rule, in green-black), the dragon a
pterodactyl (its beak on the catch line; "PTERODACTYL n m" at the left edge). The backdrop is layered: a green haze, distant
tree crowns at slow parallax, mid trunks with lianas and light shafts. The hero fills the sim's 10 px body radius (±11 px;
it was about ±8) with a soft light round it, on a thicker vine. The HUD is the Action HUD's chips (STRETCH and STREAK; the
stretch's PAR clock with a bar, and GATES). The help, intro still and tile say vines, platforms, the river and the
pterodactyl. Sounds: `swing.vineCreak`, `swing.splash`, `swing.pterodactyl`, `swing.pteroCatch` on library files and the
`swing.jungle` bed (silent until recorded; docs/sound-cues/action-polish-nov-2026.md).


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

# swingRev 17: sliding hooks and the clean-swing streak (3 Nov 2026)

Joe's brief on Grappler, on a new stamp, **swingRev 17** (`SWING_REV_SLIDE`, one above swingRev 16). Rooms, practice,
the daily and challenges deal it; swingRev 15 and 16 (and every earlier revision) play and score exactly as before
(swing-slide-check replays 24 runs recorded on unmodified main 6326101, `scripts/fixtures/swing-slide-legacy.json`, 12
each of swingRev 15 and 16, recorded by `scripts/swing-slide-legacy.ts`). Every rule is gated on the state's `slide`
marker (rev-17 states also carry rev 16's `dark`, rev 15's `rework` and rev 14's `assault`).

## What changed

- **Kept:** 90 s, rev 16's course shape (42 blocks, six dark ledge runs, three squeezes), the dark rule, the ledge-run
  dim, the dragon over the last quarter, pars and gates. The course is built by rev 16's builder on its own stream
  (`V17_SHAPE`, salt `0x1f83d9ab`).
- **Removed:** the gems and the stars (the brief's "coins and diamonds": *assumption*, Grappler's coins are its gold
  star coins and its diamonds its cave-crystal gems). Rev-17 courses deal neither, so nothing draws or pays them.
- **Gates (5)** sit on the course's own planned line between two hooks (the witness flies through every one), near the
  middle of the hop, with a taller opening than before (`SWING_V17_GATE_HALF`, 100 px: the bots showed rev 16's 44 px
  opening on the planned line was only ever taken by the planned body itself), all inside the first 65 % of the
  course's hops (`SWING_V17_GATE_SPAN`), the part every good run reaches.
- **Sliding hooks** (`SwingSlider`, `swingSlideDx`, `swingAnchorAt`): some hooks of the swinging stretches slide back
  and forth on a short level rail, an integer triangle wave on the round's tick: half-length 20–32 px, period 120 or 180
  ticks (both divide 1800 and are multiples of 4), phase seeded. **None in the first quarter of the course, then 4, 6
  and 8** in the next three (`SWING_V17_SLIDERS`, 18 in all). Never a stretch's first hook, never two in a row, never a
  ledge section's hook. A press grabs a sliding hook where it is at that tick (drawn where the sim has it, so what you see
  is what you grab), and it **stops there for the rest of the run** (`slideStop`: the anchors are copied with that entry
  changed, so the rope's physics is a fixed hook's and nothing else moves). They follow the dark rule: a sliding hook in
  the dark can't be grabbed (`swingHookLit` reads its live place; the dark's edge allows for its rail's far end).
- **The clean-swing streak** (`slideGrab`, `swingStreakNow`): a grab of a new hook (further than any grabbed before)
  within `SWING_V17_STALL` (150 ticks, 2.5 s) of the last grab or landing extends it; a longer wait starts it again at 1;
  a miss or the dragon's catch ends it (it counts again after the 0.4 s hold); re-grabbing a hook already held adds
  nothing. Every 8 in a row (`SWING_V17_STREAK_BLOCK`) pays 2 (`SWING_V17_STREAK_EACH`), up to 40. The HUD shows
  "STREAK ×n" top right (gold from 8), "GATES n / 5" under it.

## Identical for everyone, and proved

The course is built and proved as rev 16's (every hook from the planned swing before it, restart hangs, near misses,
landings). Then `slideCourse` plays the course's **own planned route** through the step itself (`slideWitness`: each
hop's planned release and grab, each landing's planned release, each ledge's press as soon as the hero is centred; past
90 s the clock is moved back 1,800 ticks, a whole number of every rail's period), and adds the sliding hooks quarter by
quarter, one from each seeded band of candidates: a candidate's rail is phased so that it is **at home exactly when the
route grabs it** (so the route is unchanged), and it is kept only if:

- its rail clears the roof by 40 px at both ends;
- every press of the route in its stretch still takes the hook it took (with the sliding hooks where they are then);
- a restart's hang from the hook before reaches it on 3 or more release ticks **at each of 8 phases of its rail**;
- the route's swing on the hook before has a window of 3 or more releases on to it;
- a hang from it, stopped at either end of its rail or at home, reaches the next hook on 4 or more release ticks.

Finally the route is played again on the finished course and must make exactly the same input and grabs.
`swingSlidePlan(seed)` returns the witness: the planned route as input (`witness`) and the tick it grabs each sliding
hook (`slideTicks`).

## The deal: 200 proved on every dealt course (3 Nov 2026 follow-up)

Joe's follow-up: a perfect run reached 200 on only 10 of 24 courses, so 200 is now proved on every course a room deals,
as Apex's deal does. `scripts/swing-slide-deal.ts` builds each candidate course (the sim's own builder above, sliding
hooks phased to its planned route), lets the **oracle** play it (the flawless-level skill-band bot, no timing error) and
keeps the seed only when the oracle's log scores **exactly 200 through the server's replay** (`encodeSwingRun` →
`replaySwingRun`, unflagged); the rest are dropped. Rooms, practice, the daily and challenges deal through
`generateSwing` from `SWING_SLIDE_DEAL` (`src/lib/duel/swingSlideDeal.server.ts`, `swingSlideDealSeed(roomSeed)`), and
each kept course's oracle log is its witness (`scripts/fixtures/swing-slide-deal-witness.json.gz`).

- **120 courses kept of the first 234 candidates (114 dropped, 51 % kept).** Every course still builds from its seed
  in the sim (any seed plays, as before; only the deal is narrowed), and nothing about the game changed: the stamp,
  parts and rules are as above.
- Why not the planned route: the builder's planned route is a deliberately steady line (each stretch 30+ ticks under
  par); through the server replay its 90 s scores 165–181 (about 36 of 51 stretches, a streak of ~113 grabs), so it
  cannot carry 200. The oracle is the flawless bot, which flies the faster lines. A second or third look-ahead stream
  never rescued a course the first missed, so the oracle has one try. The misses are near-misses (197–198: one stalled
  grab breaking a streak block, or a stretch a few ticks short of full par).
- `bun scripts/swing-slide-deal.ts --check` replays all 120 witnesses (each exactly 200, the deal exactly those
  seeds); swing-slide-check replays every eighth (all with `CHECKS_FULL=1`), each at 200 with every part at its maximum,
  and asserts rooms deal only from the list; the arcade-standard entry's perfect runs are three dealt courses' witnesses
  through the server replay.

Medians before (swingRev 17 on any course, fresh room seeds 10000–10011, the table below) → after (the dealt courses
for fresh room seeds 10000–10023, 24 runs, 19 distinct courses), every run through the server's replay:

| Level | Before | After (range) |
|---|---|---|
| Weak | 59 | 69 (21–94) |
| Average | 90 | 95 (71–108) |
| Good | 121 | 122 (73–158) |
| Great | 161 | 165 (152–174) |
| Near-perfect | 189 | 190 (186–195) |
| Elite | 195 | 198 (193–200) |
| Flawless | 199 | **200 (200–200, 24 of 24)** |
| Random | 8 | 5 (2–15) |

Flawless > great > good on 24 of 24. The top four barely move; weak rises most (59 → 69, now above its 30–60 target):
the dealt courses are ones a flawless line clears cleanly, a little kinder on average to a weak player too.

## Scoring (`swingSlideParts`, `swingScoreV17`, `swingBandPartsV17`)

| Part | Points | How |
|---|---|---|
| Course (core) | 110 | A straight line on the share of the course behind the hero (as rev 15), **full at 700 per mille** (`SWING_V17_FULL`, about the great level's median; `SWING_V17_BAND_CURVE`). |
| Pars | 40 | Each stretch cleared pays by how far under par (full at 30 ticks under), counted over **45 stretches** (`SWING_V17_PAR_STRETCHES`; a course has 51), so the pars keep paying for every stretch after the core is full. |
| Gates | 10 | 2 each for the 5 (banked as before: put back on a miss since the last hook). |
| Clean-swing streak | 40 | 2 for every 8 clean grabs in a row (summed over the run's streaks), up to 40. |
| **Total** | **200** | No input 0; any input at least 1 (`stdFinal`). Earning a feature never costs core. |

Decisions: the core is full well before the course's end and the pars carry the rest of the distance (a straight core
over the whole course paid the great level too little and the near-perfect one too much for the targets); the streak
counts every block of 8 in every streak, so one miss costs the unfinished block, not the run.

## Skill bands (`bun scripts/swing-rework-bands.ts --rev=17`; the parts above)

The bots (`scripts/arcade-skill-bands/bots/swingRework.ts`) see a sliding hook where it will be at each moment they look
ahead (`swingBotKit.target(…, tick)`, `attachAt`, `grabView`: perception only, every input through the step). The
flawless level now plans as if a tick either way could happen and plays each moment exactly (rev 17 only): without it
it picked knife-edge lines past the sliding hooks and gates and fell or missed gates the elite bot took.

Before (swingRev 16) and after (swingRev 17), the same bots (the flawless level's plan floor on rev 17 only), every
run through the server's replay. Fresh seeds are room seeds 10000–10011; the room seeds 0–11 are the ones rev 16's
table used. Targets (Joe): weak 30–60, average about 90, good 120–140, great about 160, near-perfect about 175, elite
185–195, flawless 200.

| Level | rev 16, fresh (range) | rev 17, fresh (range) | rev 16, room 0–11 | rev 17, room 0–11 | rev 17 parts (24 courses: core · par · gates · streak) | rev 17 course ‰ |
|---|---|---|---|---|---|---|
| Weak | 56 (22–67) | 59 (38–87) | 50 | 62 | 53 · 2 · 2 · 6 | 343 |
| Average | 71 (66–76) | 90 (65–108) | 66 | 97 | 74 · 6 · 2 · 12 | 475 |
| Good | 90 (77–96) | 121 (105–137) | 90 | 118 | 90 · 12 · 4 · 18 | 574 |
| Great | 125 (116–142) | 161 (146–167) | 132 | 161 | 110 · 22 · 4 · 26 | 712 |
| Near-perfect | 168 (158–174) | 189 (176–193) | 169 | 189 | 110 · 34 · 10 · 36 | 892 |
| Elite | 180 (168–194) | 195 (189–200) | 183 | 198 | 110 · 38 · 10 · 40 | 975 |
| Flawless | 182 (169–189) | 199 (195–200) | 184 | 198 | 110 · 40 · 10 · 40 | 1000 |
| Random | 7 (2–12) | 8 (2–12) | 8 | 8 | | 44 |

Met: weak, average, good, great, elite (195 fresh, 198 on room seeds 0–11, a little over), flawless (199/198; 200
on 10 of 24 courses, every one 195 or more; since the deal above, 200 on every dealt course). **Not met: near-perfect** (189 against about 175): the near-perfect bot
clears about 90 % of the course with no miss and every gate, so it earns nearly the whole par, gate and streak parts;
any shape that held it to 175 left the great level well under 160 (the great bot reaches 71 % with two misses). The top
three levels are close (189 · 196 · 198 over 24 courses), as they were on rev 16 (169 · 183 · 184); every level's
median is above the one below. The stored six (`scripts/fixtures/swing-slide-runs.json`, room seeds 0–5): weak 62 ·
average 93 · good 127 · great 165 · near 189 · elite 199 · flawless 200 · random 8.

## Checks

swing-slide-check (old rounds; dealing; the course's structure and the sliding hooks' placement; each course's own
planned route through the real sim clearing every stretch 30+ ticks under par with every gate, every sliding hook
grabbed at home and no stall, and its 90 s through the server's replay; the wave, the grab and stop, the dark, and
fairness through the real step (a restart's hang catches the sliding hook at four phases); the streak's rules; the clock;
the parts and 200; the stored skill-band runs `scripts/fixtures/swing-slide-runs.json` with a stored run at exactly 200
through the server's replay, every part at its maximum; the texts; build time). swing-dark-check now deals swingRev 16
through `pinSwingPreSlide`. The room module (`scripts/x200/swing.ts`, schedule with the rails and each sliding hook at
home), the arcade-standard entry (four parts), the self-replay list (`swing/slide`, appended) and the replay fixture
(one rev-17 run, `scripts/fixtures/pending-replay-run-swing.json`, appended by the coordinator) follow rev 17.

## Follow-ups

- The intro demo needs recording on swingRev 17 (until then the intro shows its still).
- Sounds: the library only (no new slot); the streak and the sliding hooks have no cue of their own.
- Screenshots: `screenshots/grappler-slide-nov-2026/` (`bun scripts/shots/swing-slide-shots.ts`): a sliding hook at
  each end of its rail, the moment it is grabbed, and the streak in the HUD, at 414×896.
