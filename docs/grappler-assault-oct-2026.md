# Grappler: the assault course (swingRev 14)

27 Oct 2026. Grappler (`swing`) redesigned as a tactical assault course on a new stamp, **swingRev 14**
(`SWING_REV_ASSAULT`, one above swingRev 13). Rooms, practice, the daily and challenges deal it; every earlier
revision (no stamp, 2–13) plays and scores exactly as before (swing-assault-check replays 48 runs recorded on
unmodified main, `scripts/fixtures/swing-assault-legacy.json`). `ROUND_MAX.swing` stays 200.

## The idea

The old screen was full of anchors and the game was spam-tapping. Now each section is a small decision: pick your
hook, judge your release, land cleanly.

## Rules (all gated on the state's `assault` marker, `src/lib/arcade/swing.ts`, "The assault course")

- **36 sections** (`SWING_V14_SECTIONS`), "SECTION x / 36" in the HUD with the section's par clock under it.
- **A section** is a start ledge, one or two hooks and a landing ledge (the next section's start). Hold kicks off the
  ledge on to the section's first hook; let go to fly. Only the section's own hooks can be grabbed (the nearest within
  reach), so there are 1–2 hooks in sight. A two-hook section catches its far hook in the air.
- **Only the landing ledge is visible ahead**: the camera frames the section, the next section's hooks are not drawn
  until you land, and a dark veil covers the cave past the landing ledge.
- **Squeezes** (two a course, `SWING_V14_SQUEEZES`): the roof and floor close to a 49–72 px opening (the hero is
  20 px) near the top of the planned flight; one hook before it, one behind. Fly through, catch the far hook, swing on.
  The rock is exactly the sim's two rectangles (the arcade bounds rule).
- **Speed gates** (4) sit on the flight line of a well-timed release: no detour, just timing.
- **Gems** (4) on harder lines: a landing flight that only two or three of the landing releases share, never touched on
  the rope. **Stars** (4) on a tighter swing: where the rope reeled in (swipe up) runs, at least 27 px inside the plain
  swing. Both are proved, at build, to be on a line that lands.
- **A miss** (the lava or a squeeze's rock) restarts the section from its start ledge after a 0.4 s respawn hold; the
  clock keeps running; what the attempt picked up is put back. **No game-over**: the run ends only at the minute or the
  last section.
- **The dragon** appears as section 4 starts, 40 % slower (`SWING_V14_CHASE_PACE`, 2.4 px a tick). Its catch is a
  restart too, and on every restart it backs off to at least 300 px behind the start ledge. (Assumption: with a
  section restart instead of a game-over the dragon had to stop ending runs, or one miss next to it would cost an
  ordinary player half their score; an early version that kept the game-over scored one average run 46 against 136.)
- **Par per section**: its fastest proved route + 5 ticks of walk + 45 ticks; a section beaten by 30 ticks or more pays
  its whole share. Fixed when the course is built.
- **Identical for every player**: the course is built and proved from the seed alone, in the sim (no bank;
  `generateSwing` deals any seed). Each section is a seeded shape searched until the real physics proves it (a release
  window of four or more ticks; for two hooks and squeezes, grabs two ticks either side and releases a tick either side
  still land). Building a course takes ~30–70 ms.

## Scoring (`swingBandPartsV14`, depth stays in the sim: Grappler is an engine game, so `depth200.server.ts` is untouched)

- Units: 10 a section cleared plus 0–9 for the furthest point reached into the next, on `SWING_V14_BAND_CURVE`
  (0/2/20/60/120/200/280/360 → 0/3/14/36/64/92/110/120).
- +10 for clearing all 36, up to +34 for pars (by the ticks under par), +3 a gate, gem or star banked in a cleared
  section. 120 + 10 + 34 + 36 = 200. No input scores 0.

## Skill bands (sanity check, not targets)

The bots (`scripts/arcade-skill-bands/bots/swingAssault.ts`) pick lines by forking the real sim and play them with
the Human's timing error; better levels chase par and pickups. Median (min–max):

| Level | 12 fresh room seeds (`roomSeed(10000…10011)`) | 5 stored runs (swing-assault-runs.json) |
|---|---|---|
| Weak | 70 (52–78) | 75 |
| Average | 101 (91–105) | 96 |
| Good | 117 (107–121) | 114 |
| Great | 140 (122–148) | 134 |
| Near-perfect | 170 (134–178) | 172 |
| Elite | 179 (158–187) | 180 |
| Flawless | 189 (184–194) | 190 |
| Random | | 29 |

Flawless clears all 36 sections in 38–44 s; elite usually in 52–60 s; great reaches 26–35. An ordinary (average)
player's score stays within 91–105 across courses. Every played run scores above 0; no input scores 0.

## Checks

swing-assault-check (old rounds, dealing and identity, 36 sections and features on sampled courses, every section of
two courses played in the real sim with its fastest beating par by 30+ ticks, every gate/gem/star on a clearing line,
restart/respawn/pickup/dragon rules, scores and stored skill-band runs, text, build time). Updated for the new deal:
arcade-batch3, arcade-tuning-a/c/f2/g3, swing-rev8 and six-game-scoring (the dealt stamp and the intro text);
swing-x200-check now pins swingRev 13's deal (`pinSwingPreAssault`) and its three live help-text assertions moved to
swing-assault-check on the new text; arcade-fx-check bumps the five new effect events on a rev-14 state;
arcade-self-replay gained `swing/assault`; the replay fixture a rev-14 run; the room module (`scripts/x200/swing.ts`)
deals rev 14.

## Follow-ups

- The intro demo needs recording on swingRev 14 (until then the intro shows its still).
- Screenshots: `screenshots/grappler-assault-oct-2026/` (`bun scripts/shots/swing-assault-shots.ts`), a ledge
  section and a squeeze at 414×896 and 375×667 (renderer frames in the play-screen box; the header is a stand-in).
