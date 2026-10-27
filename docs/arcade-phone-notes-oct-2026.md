# Joe's phone notes on six arcade games (27 Oct 2026)

Joe tested on an iPhone 11 home-screen app (414 × 896). Two games change their scoring on new stamps (Roofbound
`flipRev 9`, Tilt `tiltRev 9`); everything else is display only. Rooms stay identical for every player: nothing
here reads the device, and the new stamps keep their predecessors' play tick for tick.

## Changes

| Game | Note | What changed | Stamp |
|---|---|---|---|
| Hover | No buildings, more starry space; stars in the gaps 1.2× | The city rows are gone: a near-black sky with a faint blue lift, a soft band of far star dust and a fixed star field (a few bright ones with a small glint); the drifting field has twice the stars; the fill below the world carries the same stars. Gold stars (barrier gaps and star chains) are drawn 1.2× (8.4 px on their 7 px pickup, inside the bounds rule's 2 px). | none (display) |
| Jaywalk | A dark evening, darker road | An evening palette: road #25292F (was #555B64), dim grass, hedges, paving and kerbs, a blue dusk wash over the cached scene, warm lamp pools on both verges (light only, the traffic drawn over it). Vehicles, walker, coins and HUD unchanged. | none (display) |
| Orbit | Black space with stars, no purple / pink / green; no orbit lines round moons and rocks; no bottom strip, world extended down; SET CHECKPOINT kept, over the play area | The nebula's coloured clouds are gone (black with far star dust and the star field). The slingshot moons' dashed rings, the asteroid fields' dotted gap line and the belts' track line are gone; a moon keeps a soft halo that fades out exactly at the assist's reach, so where a pass slings still shows. orbitRev 12's 450 × 782 framed view is drawn 839 tall (`orbitDrawHFor`: the extra 57 px below the frame; the camera and its framing are unchanged), so at 414 × 896 the world fills the 414 × 772 box; SET CHECKPOINT is laid over the play area's bottom (12 px above the world's edge; only the button takes a touch). | none (display) |
| Roofbound | No buildings, a dark eerie cave; scores low, lift them | The far city is replaced by the cave's depths: dark stalactites and stalagmites in two slow layers, a few faint cold crystals, a pale mist low over the floor, pale spores in place of embers, colder and darker tunnel air (the lava hazards keep their colours). Scoring: `flipRev 9` (below). | `flipRev 9` |
| Tilt | Fixed camera; subtler ice; scores low, lift them | The camera stays on the disc's centre (no panning), scaled so the whole disc fits the width (mazes 1–3 at about 0.98 / 0.86 / 0.77); only the board turns. The ice's frost is about a third as strong, so walls and openings read through it. Scoring: `tiltRev 9` (below). | `tiltRev 9` |
| Ball Tracker | Reveal shows 32/30; bottom countdown should say "20 to switch up", not "20 to drop" | The reveal (axis, line, tile), the round leaderboard summary and the "ALL n HOME!" moment count the course's own marbles: 36 on btRev 7, 30 before (the reveal reads the replay state's `r7`). The readout under the board counts the whole seconds to the next switch-up (the bottom row's re-lay, then the colour shuffle): "20 to switch up"; after both it shows marbles left ("6 left"). The help says what the count is. | none (display) |

## Scoring: flipRev 9 and tiltRev 9

Both keep their predecessor's course, rules, features and play exactly; only the two curves move (states add
`lift: 1`, outside the checkpoint checksum). The knots stay where they were, every knot is at least the old one,
the curves still rise and still end at 140 (base) and 50 (skill), so the ceiling stays 200 and every run scores at
least what it scored on rev 8, a better run never less than a worse one.

- Roofbound: base `FLIP_V9_BAND_CURVE` units 0 / 40 / 105 / 130 / 140 / 146 / 150 → 0 / 20 / 65 / 80 / 92 / 118 / 140
  (was 0 / 11 / 47 / 57 / 70 / 105 / 140); skill pay `FLIP_V9_SKILL_PAY` raw 12 / 22 / 53 / 59 / 63 → 5 / 16 / 26 / 38 / 50
  (was 3 / 13 / 21 / 34 / 50).
- Tilt: base `TILT_V9_BAND_CURVE` units 0 / 2 / 40 / 80 / 100 / 120 / 130 / 140 / 150 → 0 / 5 / 30 / 62 / 78 / 98 / 116 / 132 / 140
  (was 0 / 3 / 18 / 45 / 59 / 81 / 104 / 127 / 140); skill pay `TILT_V9_SKILL_PAY` raw 15 / 25 / 35 / 45 / 52 / 60 →
  10 / 16 / 36 / 38 / 48 / 50 (was 8 / 12 / 35 / 35 / 48 / 50).

**How it was measured.** #175's skill-band tool, paired seeds, every level including weak, elite and flawless:
`bun scripts/arcade-skill-bands.ts flip tilt --rev=now --levels=all --seeds=60 --jobs=4 --save=<dir>` (tuning seeds)
and the same with `--from=10000 --seeds=200` (fresh seeds), on the tree before this change. Because the new stamps
keep the play, the saved logs were re-scored through the server's replay on both stamps (the old scores reproduce
exactly: 0 mismatches over 2,800 runs); the new curves were chosen on the tuning seeds and the fresh seeds measured
once after.

### Medians by level, before (rev 8) → after (rev 9)

| Game | Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|---|
| Roofbound | Tuning (60) | 45 → 63 | 76 → 100 | 118 → 138 | 140 → 155 | 169 → 174 | 192 → 194 | 200 → 200 |
| Roofbound | Fresh (200) | 47 → 65 | 76 → 100 | 119 → 139 | 142 → 157 | 169 → 174 | 192 → 194 | 200 → 200 |
| Tilt | Tuning (60) | 53 → 71 | 77 → 96 | 126 → 144 | 149 → 162 | 172 → 179 | 177 → 184 | 185 → 186 |
| Tilt | Fresh (200) | 48 → 66 | 86 → 106 | 124 → 140 | 149 → 163 | 172 → 179 | 177 → 183 | 185 → 187 |

**Against Joe's bar.** Brilliant > great > good at every step on both seed sets; the order of runs is unchanged (both
curves rise). Played runs stay above 0: Roofbound's three fresh zeros are runs with no input (scored 0 before too);
Tilt has none. The ordinary player's score rises as Joe asked (good +20 on Roofbound, +16 to +18 on Tilt); the top
moves least (Roofbound's flawless stays 200, elite +2), so elite and flawless keep their margins over near-perfect.
Tilt's flawless bot still misses some quick-star windows (median 186, docs/expansions/x200-tilt.md); the oracle's
witness runs score 200.

## Assumptions

- **Orbit's "orbit lines around the moons and rocks"** are the slingshot moons' dashed rings, the asteroid fields'
  dotted line and the belts' track line. The planets' own orbit paths (the line the rocket rides, gold for the first
  lap) are kept: they show when to let go. A moon keeps a soft halo to its assist's reach instead of a ring.
- **"Drop the purple, pink and green"** is the background nebula; the planets keep their colours.
- **Orbit's world extended down** is a display change: the drawn view is taller below the camera's frame; the sim,
  its `worldH` and the checkpoint are unchanged, so no stamp. Earlier orbit revisions keep their views (also with
  SET CHECKPOINT over the play area). On 375 × 667 the taller view is 317 px wide (was 323 × 539, now 317 × 591).
- **Ball Tracker's "20 to switch up"** counts seconds to the next switch-up (the re-lay, then the shuffle), not
  marbles; Joe's wording implies the count is about the switch-up. After the last switch-up it shows marbles left.
- **Tilt's fixed camera** zooms each maze to fit the width, so the bigger mazes are drawn smaller (maze 3 at 0.77).
- **Intro demos.** Roofbound's and Tilt's demos play only when recorded on the new stamps (the HUD shows the run's
  score); none were recorded on rev 8, so nothing visible changes. Orbit's stays stopped as before.
- `practiceStamps.data.ts` regenerated (Roofbound and Tilt start fresh practice bests on the new stamps).

## Checks

arcade-phone-notes-check (new, ~1 min): every stored flipRev 8 / tiltRev 8 run replays on rev 9 to the same final state with
no desync and never scores less; the curves' knots, rise and tops; every Roofbound witness (260) and 120 Tilt oracle
bank runs score 200 on rev 9; no input scores 0; rooms, LIVE_BANDS and round maximums; the help's pay; Ball Tracker's
counts and readout; Hover's star size within the bounds rule; Orbit's drawn view and overlay; Tilt's fixed camera.
replay-runs.json gained a great-bot run on each new stamp.
