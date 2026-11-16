# Moon Climb: the stage-2 look pass and ricoRev 4, the bigger ninja (15 Nov 2026)

## Stage 2: effects and the reveal (display only, no stamp)

Drawn by `ricochetNinja.renderer.ts` from the sim (`moonFxEvents` notices them by comparing each drawn state with the
last one drawn on the same canvas; ages in sim ticks; every physical action within 900 ms; reduced motion and reduced
effects get calm versions):

| Effect | Sim moment | Sound slot |
|---|---|---|
| Dust off the wall or ledge pushed off (slate grit, moss or ice flecks and a soft puff, 30 ticks) | a leap from a cling (`leaps` up) | `ricochet.leap` |
| A ring of air under the feet (24 ticks) | a double jump (`djs` up) | `ricochet.doubleJump` |
| Scuff gouges down moss or ice beside the face (hands' and feet's tracks), red from where the slide passes `MOON_FLOW_SLIDE` with a streak running; a left trail fades over 30 ticks, all red if the streak broke | clinging and sliding on moss or ice (`moonScuff`) | `ricochet.scuff` (loop), `ricochet.flowBreak` |
| The grabbed lantern flares and sways about the hands, settling over the ride (`moonLanternSway`) | a ride starts | `ricochet.lanternSway` |
| The scroll flies into the HUD's SCROLLS chip (24 ticks), the chip flashing as it lands | a scroll taken | `ricochet.scrollTally` (on the landing) |
| The ninja tumbles one turn through the knock-down's fall (20 ticks), a red "−3 m" beside HEIGHT for a second | a hit | `ricochet.fallWhistle` |

No edge glow (Moon Climb is one of `ACTION_EDGELESS_GAMES`); the red miss pulse stays.

**The reveal** (`RunPicture` on the puzzle definition, drawn by the shared arcade reveal in place of the stat tiles):
`moonRunSummary` (`src/lib/duel/moonSummary.ts`) replays the stored log through the real sim exactly as
`replayMoonRun` does and `drawMoonRunPicture` draws the shaft: the climb as a column to the height reached (labelled),
the longest Flow streak's stretch in gold, each hit a red mark with its drop and metres lost, lanterns ridden and scrolls
taken beside it at their heights, the core's full height dashed and a ruler every 50 m; above it Height, Best flow,
Rides n/6 and Scrolls n/3 in big type; a legend under it. ricoRev 2 rounds show their four numbers; the stage-1 hits line
stays in the breakdown. No score or grade change.

Joe's ask (the Action overhaul's stage 2; concept ricochet-A: carved slate with moss, steel katanas with gold guards
and wrapped hilts, a cratered warm moon, a paper lantern rising across it, the pagoda in mist), and a visible step up
from stage 1. Gallery: `docs/design/pages-review/action/GALLERY.md` "Moon Climb", "Stage 2 look pass".

## The look (display only, every Moon Climb revision; `ricochetNinja.renderer.ts`)

- **Sky** (`paintMoonSky`, cached per size): a deeper night in five stops (near-black indigo at the top to moonlit blue
  at the horizon), a faint slanting band of star dust, 170 stars of every kind (dim pinpoints, small cool and warm ones,
  a few bright with a soft core and a thin four-point glint). Each frame (`drawMoonNight`): the night's deepening and
  the stars that come out with it (bright ones glint), a wide faint lift of the sky round the moon (no ring), the moon,
  seven cloud wisps drifting across (their lobes lit where they pass the moon), a moonlit mist band at the moon's
  height, and six **far paper lanterns** rising slowly up the sky behind the walls (`farLanternAt`: placed by the tick
  alone, never touched, never taller than half a sky lantern), one at a time crossing the moon.
- **Moon** (`paintMoonDisc`, cached per radius, warmth step and device scale): larger (84 px low down, 66 px at the top,
  was 66 → 50), a sphere lit from the upper left darkening to its limb, broad soft maria, 28 craters (a few large with a
  central peak, many small; each floor shadowed towards the light, its far rim lit), fine grain; amber low down, warm
  cream high up (`warm = 1 − 0.75 p`). It still rises with the climb (`moonNight`, `moonPlace`).
- **Ridges and pagoda** (`paintMoonRidge`): three ranges with a thin moonlit line along each crest, a small far pagoda,
  a second pagoda on the middle range, the temple's pagoda with lit paper windows (two panes low down), layered mist.
- **Walls** (`paintSlate`): each block stands proud of a lighter mortar bed and casts a short shadow on it, down and away
  from the gap; its face rounded by light falling across it towards the gap; a brighter lit top and gap-side edge. Each
  frame the moon **rakes** across the stone (`wallRake`): strongest on the face towards the gap at the moon's height,
  falling off along the wall, warmer while the moon is low, none in the world's bottom 40 px (so the play screen's fill
  below meets it with no seam). **Moss and ice catch the moon** (`moonCatch`): a wet or glassy line along the lip,
  brightest level with the moon.
- **Mid-ledges** (`drawLedge`): the walls' own carved slate in short blocks (lit top and left, shaded underneath and
  right), iron bands with a bright edge at each end, a twisted rope.
- **Sky lanterns** (`drawSkyLantern`): a real sky lantern's shape (wider at the shoulder, the flame low in the open
  base), translucent paper glowing brightest round the flame and deepening to orange-red at its curve, four bamboo ribs
  dark against the light with the paper beside each a touch brighter, two cross ribs, a crisp sheen down the curve, a
  lacquered top rim and the flame seen through the base ring; nothing past its touch radius. Its **light falls on the
  walls and ledges near it** (`drawLanternLight`: a warm pool added to the stone only, `LANTERN_LIGHT_R` 210 px), so a
  lantern lights what is near it and is never ringed by a glow (ricochet-overhaul-check 10a: a frame with the lantern
  differs from one without it only inside its radius + 2 px or on the stone).
- **The ninja**: no gold rim round it any more (Joe: no glowing edges); the moonlit backing behind it fades out to its
  edge. Drawn at `ninjaArtScale(rev)`: 1 up to ricoRev 3, 17 / 13 on ricoRev 4.

## ricoRev 4: the bigger ninja (`MOON_BIG_REV`)

Rev 3's game with the ninja's body box `MOON_BIG_HW` × `MOON_BIG_HH` either side of its centre: **34 × 68 px** (was
26 × 52, ×1.31, as Grappler's figure was grown). Everything that reads the body follows it (`NinjaBody`,
`ninjaBodyFor(rev)`): the cling x on each wall (87 and 303), the floor's standing height (`start`, so metres are
measured from it and mean the same), a leap's sideways ticks (a wall-to-wall leap still `NINJA_LEAP_TICKS`, the gap
the bigger body's), the mid-ledges' faces, and the katana, shuriken, scroll and lantern touches. The figure is drawn at
17 / 13 and fills the box within the old figure's own allowance grown by the same scale (art-check 4a, Joe's explicit
approval of 15 Nov 2026; the old stamps' figure stays pinned to main's exactly).

- **The deal**: `moonBuildDeal(seed, 4)` draws its attempts from rev 3's seeded stream and plans, places and proves every
  tower with the bigger body (the witness through the real rev-4 step takes every part in full, no hit, 245 m or more).
  Every rev-4 tower is its own; a perfect run is 200 on every tower (ricochet-overhaul-check 9d through the server's
  replay, 24 seeds; `CHECKS_FULL=1` 120; 400 seeds checked while building it, the lowest witness 290 m).
- **Parts**: rev 3's exactly (`MOON_BIG_STD_SPEC` = `MOON_STD_SPEC` under the new stamp): height 125 (full at 245 m),
  flow 30, lantern rides 30, scrolls 15. Hit scoring unchanged (a hit costs the 3 m knock-down and the stun). "Moonwalker"
  (245 m on Hard) stays possible on every tower.
- **The 120 s rule and grace**: the run is still 60 s and no hit ends it.
- **Older rounds**: ricoRev 3 and 2 states keep `NINJA_BODY` and play, deal and score as before (ricochet-overhaul-check
  9a: 60 towers and 40 runs at every skill level recorded on 14ce058d before the change,
  `scripts/fixtures/ricochet-big-legacy.json`, `scripts/ricochet-big-legacy-record.ts`). Rooms deal ricoRev 4
  (`generateRicochet`); the deal pin `ricoPreBig` (`pinRicoPreBig`) deals ricoRev 3 for the checks written for it.
  `replayMoonRun(seed, raw, rev)` replays a stored round on its own stamp (3 when absent).

### Medians, weak → flawless, ricoRev 3 → ricoRev 4

Fresh seeds 10000–10039 through the server replay (`bun scripts/ninja-bands.ts --rev=3|4 --from=10000 --seeds=40`):

| Level | ricoRev 3 | ricoRev 4 | Metres 3 → 4 | Hits 3 → 4 |
|---|---|---|---|---|
| Random | 34 | 29 | 60 → 54 | 21 → 22 |
| Weak | 55 | 49 | 96 → 85 | 21 → 21 |
| Average | 88 | 84 | 148 → 138 | 18 → 18 |
| Good | 126 | 128 | 204 → 201 | 15 → 15 |
| Great | 165 | 153 | 239 → 227 | 13 → 14 |
| Near-perfect | 178 | 172 | 259 → 247 | 12 → 12 |
| Elite | 189 | 186 | 272 → 262 | 11 → 11 |
| Flawless | 200 | 200 | 316 → 319 | 0 → 0 |

The bigger box is clipped a little more often by the hazards a player doesn't plan round: the medians fall 3–12 points
(Good is level), still rising weak → flawless, the flawless witness 200 on every tower. A decision for Joe: keep the
parts as they are (Joe's ask: hit scoring unchanged), or re-fit the core's 245 m to the new near-perfect median (247 m,
so practically unchanged) in his scoring review.


# Moon Climb: the Action overhaul (15 Nov 2026)

Phase 2, step 4 (`docs/design/game-reviews/action.md`, gallery `docs/design/pages-review/action/GALLERY.md`). Stage 1
is display only: no stamp, the sim, deal and scoring untouched (ricochet-overhaul-check replays 24 ricoRev 3 runs
recorded before it and the 12 ricoRev 2 runs recorded on main to the same scores and states).

- **The night** (`ricochetNinja.renderer.ts`): a deep blue moonlit sky that changes as the climb goes on. The moon rises
  from just over the far ridge (large, warm, behind the pagoda) to high above the shaft (smaller, pale) and the sky
  deepens with more stars, both from the run's best height (`moonNight`: 0 at the foot, 1 at the core's full 245 m,
  smoothstepped, never going back), so every player at the same height sees the same sky. Three layers: the sky
  (painted once per size), the deepening, extra stars and moon (a few fills each frame), the ridges, pagoda and mist
  (painted once per size, over the moon).
- **Crisper walls**: moonlit slate, every block bevelled (a lit top edge, a shadowed bottom, now and then a crack), a
  moonlit rim on the inner face; moss has dark damp clumps (never read as ice); katanas a dark outline, a white cutting
  edge and a long sharp tip; shurikens sharper points and a faint red ring at their touch radius. All inside their sim
  boxes (+2 px).
- **The ninja**: bolder (limbs 5.2 px, was 4.6) with a brighter moonlit glow and gold rim. The figure already fills its
  26 × 52 body box, so it is drawn heavier, not larger (art-check holds every pose to main's extent + 0.5 px).
- **HUD**: a second row of the Action HUD: lantern RIDES n/6 and SCROLLS n/3 (with small icons, gold once complete,
  flashing as one is taken), under HEIGHT and FLOW (`moonHudRows`).
- **Hits on the reveal**: one plain line in the breakdown, "Hits: 11 · knocked down 3 m each" (or "Hits: none"),
  read from the stored Hits stat (`src/lib/duel/moonRevealHits.ts`), so older rounds show it too; the score unchanged.
- **Edge to edge**: the world's floor is the temple's slate (`MOON_FLOOR`) and the play screen's fill below carries it
  on to the screen's bottom; beside the world (wide screens) the slate wall continues, shaded as the world's walls are
  at their outer edge (`ricochetNinjaScene.renderer.ts`).
- **Materials pass** (15 Nov 2026, concept A as the bar): the walls are carved moonlit slate painted once per wall and
  device scale into a 32-course strip (`paintSlate`, `slateStrip`; lit bevels, grain, strata, chipped corners, cracks),
  wet moss with crisp highlights, glassy ice, polished steel katanas (temper line, specular edge, gold guards, a wrapped
  hilt stub in the stone), blued-steel shurikens with a sheen, paper sky lanterns lit from within (no glow round them),
  a cratered moon and the pagoda in layered mist with a far pagoda. The floor runs between the walls only, and the
  play screen's fill continues the walls' slate under them (`paintSlate` again). No images shipped (all painted in code).
- **Sounds**: new silent-until-recorded slots `ricochet.fallWhistle` (a hit), `ricochet.flowBreak` (a streak of 3+
  broken by a slide) and the loop `ricochet.scuff` (sliding on moss or ice); briefs in
  `docs/sound-cues/action-elevenlabs.md`. Every earlier slot keeps Joe's recording.

## Levels (ricoRev 4, 15 Nov 2026; Normal is today's game)

Joe's levels: "Easy about half the blades, less moss and ice, 6 slower lanterns, 2 m knock-down, full at 200 m; Normal
today; Hard about 1.3× blades, more ice, 3 m, 245 m; Expert 1.6× with faster shurikens, mostly ice, 4 faster lanterns,
4 m, 260 m." The deal stamps the puzzle's `level` (ricoRev 4 only; the generator is unchanged, so a level's puzzle is
Normal's plus `level`); the sim reads it into the state's `lvl` (absent at Normal, so a Normal state, tower and score are
exactly today's: ricochet-levels-check 1 against 24 towers and 24 runs recorded on de3bec96,
`scripts/fixtures/action-levels-legacy.json.gz`). Settings: `MOON_LEVELS` in `ricochetNinja.ts` (the registry's
`GAME_LEVELS.ricochet` repeats them for display); a change to one needs a new stamp.

| Lever (`MOON_LEVELS`) | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Katanas and shurikens (`blades`, density) | ×0.5 (and half the placed-on-purpose ones) | today | ×1.3 | ×1.6 |
| Shuriken crossing (`pace`) | today | today | today | ×0.75 the time (faster) |
| Moss / ice patches (`patchGap`, `ice`) | gaps ×1.8, 30 % ice | 40 % ice | 65 % ice | gaps ×0.8, 88 % ice |
| Sky lanterns (`sky`, `skyVy`) | 6, 144/256 px a tick | 6, 192 | 6, 192 | 4, 256 |
| Knock-down on a hit (`knock`) | 2 m | 3 m | 3 m | 4 m |
| Height part: max, full at | 125, 200 m | 125, 245 m | 125, 245 m | 135, 260 m |
| Lantern rides | 6 × 5 | 6 × 5 | 6 × 5 | 4 × 5 |

Parts sum to 200 at every level (Expert's 10 points from its two missing lanterns go to the height part); flow 30 and
scrolls 15 unchanged; hit scoring unchanged (Joe). Measured over 12 sampled towers (ricochet-levels-check 2h–2j):
blades 81 / 160 / 208 / 247 a tower, patches 24 / 40 / 40 / 48, ice 38 → 68 → 84 %, Expert's shurikens 80 ticks a
crossing against 105.

- **The proof.** Each level's tower is built from the seed with its own settings on its own attempt stream
  (`moonBuildDeal(seed, 4, level)`, salt `MOON_LEVELS[level].salt`) and kept only when its witness, played through the
  real step at that level, takes every part in full with no hit and reaches the level's full height; so 200 is reachable
  on every tower at every level (ricochet-levels-check 5: every sampled witness exactly 200 through `gradeAnswer`). The
  same seed and level always build the same tower (6). Builds ~20 / 27 / 136 / 27 ms (Easy / Normal / Hard / Expert, a
  desktop core); a level's tower is built while the round's intro is up (`RoundIntro`, `prepareMoonTower`).
- **120 s and grace.** The run is 60 s at every level; no hit ends it (3, 4).
- **"Moonwalker"** ("Climb 245 m on Hard") is met by every sampled Hard tower's witness (7b); Hard's height part is
  Normal's (125, full at 245 m), so its goal reads as before. Challenges complete only on Normal until Hard is live.
- **Plumbing.** `replayMoonRun(seed, raw, rev, level)`, `moonGameFor(rev, level)`, `moonArtGameFor(rev, level)`,
  `moonRunSummary(…, level)`, the steppers and playback renderer read the puzzle's `level`; the graded extra adds
  `rideTotal` and `fullM` at a level only (display; the reveal's rides tile and full-height line read them).

### Measured (15 Nov 2026)

`bun scripts/action-levels-bands.ts ricochet --seeds=12 --each`: real deals, graded by the server, the skill-band bots
under human limits (a double jump no sooner than 0.15 s into its leap; the leap as the ninja lands is a timed moment,
not a reaction, and keeps the level's own timing error; Flawless plays the witness). Averages:

| Bot | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Weak | 122.7 | 54.7 | 46.8 | 21.9 |
| Average | 161.7 (3 of 12 at 175+) | 85.8 | 74.8 | 41.3 |
| Good | 178.8 | 129.5 | 115.8 | 82.3 |
| Great | 190.8 | 164.8 | 142.2 | 105.9 |
| Near-perfect | 190.5 | 173.6 | 157.6 | 124.9 |
| Elite | 190.2 | 172.8 | 158.6 | 134.8 |
| Flawless | 200 | 200 | 200 | 200 |

Without the limits the elite bot averages 190 on Normal. Every level steps down from the one before at every bot
level. **Expert played well**: the elite bot scores 113–161 (average 135, every run past 110) on the 12 Expert towers;
the best boards to try (dealt seeds, elite score): 1636024891 (161), 1579423756 (153), 1650178925 (150), 623742088
(145), 355978649 (143).

# Moon Climb: ricoRev 3 (3 Nov 2026)

Ricochet is shown as **Moon Climb** since 3 Nov 2026 (`gameNames.ts`; the id stays `ricochet`). Rooms and practice deal
`ricoRev` 3 (`MOON_REV`); a ricoRev 2 round (the ninja wall-climb, below) and an unstamped one (the old shaft) replay and
score exactly as before (moon-blockzone-check replays 12 ricoRev 2 runs recorded on main). Rev 3 has its own step
(`stepMoon`), deal (`moonBuildDeal`), parts (`moonStdParts`), checkpoint and run plumbing (`replayMoonRun`); nothing in
rev 2's code path changed. Joe's mockup (the moon, the pagoda, the pills, the sky lantern, a mid-ledge) set the look.

## What changed

- **No coins and no gold lanterns.** **Scrolls** stay, rarer: three a tower (the brief's 2–4; a fixed count, the arcade
  rule), at the top of double-jump lines on the route, never off it.
- **Sky lanterns** (six a tower, `MOON_SKY`): paper lanterns glowing orange that float slowly up the middle of the shaft
  (0.75 px a tick, for 15 s each), seeded in place, height and time from the room seed, the same for everyone. A leap
  that touches one (the ninja's body box within 14 px of its centre) grabs it: the ninja hangs under it and rides up
  3 px a tick for 105 ticks (1.75 s). A tap leaps off: towards the left wall if the tap is on the screen's left half,
  the right wall on the right half (the input's `a`, −1 / 1; ← → or A / D on a computer, Space the wall it was heading
  for). Riding to the end lets go towards the wall the leap was heading for (a drop, not a leap). One ride a lantern.
- **Mid-ledges:** short hanging stone pieces in the middle of the shaft, 18 px wide (`MOON_LEDGE_HW` 9), 130–180 px tall.
  A leap that meets one clings to its near side (the body box overlapping the ledge by at least 2 px); a tap from there
  leaps back to the wall the ninja came from, a shorter hop (the sideways ticks are in proportion to the distance, so a
  hop to a ledge and back climbs faster than crossing the whole gap). Clinging on a ledge slides as stone and holds at
  its lower end.
- **Flow:** every landing (a wall, a ledge or a lantern grabbed) adds one to the streak; a hit, or taking off after
  sliding 16 px or more since the landing (waiting too long, or moss and ice), sets it to 0. "Flow ×N" in the HUD (gold
  while a streak runs), beside "Height N m". Every 7 in a row pays.
- **No triple jump;** the double jump is unchanged. Everything else (walls, leaps, katanas, shurikens, moss, ice, the
  knock-down and stun, 60 s) is rev 2's.
- **The look:** a larger moon high in the shaft and the pagoda under it (`paintMoonSky`), the ledges, the lanterns
  (`drawSkyLantern`, inside the touch radius; the glow is light only), the hanging pose (pose 4), the two pills.
- **The tile:** the Joulz hero ninja mid-leap towards a sky lantern, a mid-ledge and a katana, on the night temple with
  the moon and the pagoda (`scripts/shots/tile-scenes/arcade2.tsx`, `backgrounds.ts`).

## The deal and its proof

`moonBuildDeal(seed)`: the surfaces as rev 2, then a route planned through the real movement (`planMoon`): six leaps
(from walls, about every 500 ticks) meet a sky lantern placed to be where the leap will be in mid-gap (seeded float and
lead time; clear of the route before it), ridden 30–90 ticks and left towards a seeded wall; several leaps meet a ledge
placed in their way (clear of the route before it and of the lanterns' floats); waits never let a slide break the flow.
Scrolls go on three double-jump apexes; katanas and shurikens are laid clear of the route (and shurikens clear of the
ledges). The deal is kept only if the witness, played through the real step, rides all six lanterns, earns the whole
flow part, takes the three scrolls, takes no hit and climbs at least 245 m. **Every dealt tower has a route to 200**
(arcade-standard-check plays 24 witnesses through the server replay, 200 with `CHECKS_FULL=1`; moon-blockzone-check 12,
60 at full depth). A deal takes about 25 ms (cached, eight seeds).

## Parts (200 in all)

| Part | Max | How |
| --- | ---: | --- |
| Height (core) | 125 | metres climbed on a straight line, full at **245 m** |
| Flow | 30 | 3 for every 7 clean leaps in a row (Flow ×7, ×14, …), up to 10 |
| Lantern rides | 30 | 5 for each of 6 sky lanterns ridden |
| Scrolls | 15 | 5 for each of 3 scrolls |

Any input scores at least 1; no input 0. The core's full mark sits between the great (239 m) and near-perfect (259 m)
medians, fitted to the targets with the flow step (7).

## Medians, weak → flawless, before → after (fresh seeds 10000–10039, the server replay; `bun scripts/ninja-bands.ts --rev=3 --from=10000`)

| Level | ricoRev 2 | Moon Climb, ricoRev 3 | Target | Height | Flow | Rides | Scrolls | Metres | Hits | Best flow |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Random tapper | 44 | 34 | — | 31 | 0 | 0 | 0 | 60 | 21 | 6 |
| Weak | 76 | **55** | 30–60 | 48 | 0 | 0 | 5 | 96 | 21 | 6 |
| Average | 105 | **88** | ~90 | 75 | 6 | 5 | 5 | 148 | 18 | 9 |
| Good | 139 | **126** | 120–140 | 104 | 9 | 10 | 5 | 204 | 15 | 12 |
| Great | 162 | **165** | ~160 | 121 | 15 | 20 | 8 | 239 | 13 | 15 |
| Near-perfect | 175 | **178** | ~175 | 125 | 20 | 25 | 10 | 259 | 12 | 18 |
| Elite | 179 | **189** | 185–195 | 125 | 24 | 30 | 13 | 272 | 11 | 20 |
| Flawless | 187 | **200** | 200 | 125 | 30 | 30 | 15 | 316 | 0 | 110 |

The bot (`moonBot` in `scripts/arcade-skill-bands/bots/ricochet.ts`) weighs, at each landing, waits and double-jump
moments, and on a lantern how long to ride and which wall to leap towards, on the real sim, valuing height against time,
rides, scrolls and Flow steps (less the streak a plan throws away), with the level's reaction, timing, judgement and
slips. Flawless plays the deal's witness (the route the deal proved), as Blockfall's and Golf Solitaire's oracles do.

## Sounds and haptics

New slots `ricochet.lanternGrab`, `ricochet.lanternRide` (a loop while riding), `ricochet.ledge`, `ricochet.flow`;
`ricochet.leap`, `.doubleJump`, `.land`, `.hit`, `.slip`, `.scroll` kept; `ricochet.coin` and `ricochet.lantern`
removed; `music_ricochet` is the bed. Every slot has Joe's own recording since 3 Nov 2026
(`docs/sound-cues/mapping-nov-2026.csv`, `docs/sound-cues/moon-climb-blockzone.md`). Haptics unchanged: `impact` on a
hit and the arcade buzzer.

## Decisions and assumptions

- Lantern-ride direction is chosen by the tap's side of the screen (the brief: "tap to leap off towards either wall").
- The flow's "no slide" is a slide of 16 px before the take-off (about 0.7 s waiting on stone, a moment on moss, none
  on ice): short waits for a shuriken keep the flow.
- Moon Climb's intro still is seed 0's witness riding its first lantern; no intro demo is recorded yet.

---

# Ricochet: the ninja wall-climb (`ricoRev` 2, 1 Nov 2026)

Ricochet is back from retirement as an active arcade game in the **Action** group, under its existing id
(`ricochet`) on a new stamp, `ricoRev` 2. A puzzle without the stamp is the original ball-and-spikes shaft
(`src/lib/arcade/ricochet.ts`, `replayRicoRun`): its sim, grading, reveal, replay and 150-point score are unchanged,
so any stored Ricochet run replays exactly as before. The same id was kept (rather than a new one) because the
registry, names, tile, practice bests and history already carry it, and the stamp is the codebase's way to change a
game's rules (rule 2 in CLAUDE.md).

Code: sim `src/lib/arcade/ricochetNinja.ts`, art `ricochetNinja.renderer.ts` (and the play-screen fill
`ricochetNinjaScene.renderer.ts`), round plumbing `src/lib/duel/ricochet.ts` (`encodeNinjaRun`, `replayNinjaRun`),
stage and reveal `src/puzzles/ricochet.tsx` (dispatching on the stamp), sounds `ninjaSounds` in `gameSounds.ts`.

## The game

- 60 s, the old Ricochet's round length (63 s round clock). Two temple walls of dark stone at night, a moon and a
  distant pagoda behind; "HEIGHT N m" at the top left, coins, lanterns and scrolls at the top right.
- **Tap**: leap to the other wall (26 ticks of sideways travel on an arc, about +108 px, 2.7 m, a leap).
- **Tap again in the air**: the one double jump of that leap: new upward speed and a 10-tick hang (the sideways travel
  pauses), to clear a blade or reach a higher lantern or scroll.
- **Clinging** slides the ninja slowly down (0.375 px a tick on stone); **moss** slides fast (2.5 px a tick);
  **ice** gives no grip (5.5 px a tick: leap off at once). The floor stops the slide.
- **Katanas** stuck in the walls (a gold guard and a steel blade 48 px long that glints) and **shurikens** spinning
  across the gap on seeded paths (a back-and-forth crossing, level or slanting) knock the ninja down 120 px (3 m)
  over a third of a second, then a 1 s stun and a ¾ s grace (blinking, no hit). No game over.
- **The ninja is the Joulz hero** (`drawHero`, `src/lib/arcade/hero.renderer.ts`, the figure of the score celebrations:
  gold cape, gold-outlined black limbs, chest bolt, gold gloves and boots, black head with the gold ring, mask band and
  eye slits) in ninja gear: a dark wrap round the head that leaves the hero's face showing, a red headband with trailing
  tails, a red sash and a small katana on the back. Poses: clinging (hands and feet on the wall), leaping (stretched along
  the arc), double jump (a tuck turning a full circle through the hang) and stunned (arms dropped, swaying, stars). The
  tile icon and the intro still draw the same figure.
- **The body is a box**, 26 × 52 px (`NINJA_HW` 13, `NINJA_HH` 26; about twice the first drawing), and every pose is
  drawn inside it (the arcade bounds rule): a katana's blade or a coin, lantern or scroll touching the box is a touch.
  Shurikens are 11 px to their points (steel grey, a dark outline, a red centre ring, a bright bevel so the turning
  reads, a faint dotted line along each one's seeded path); a hit is the box within 1 px of a point.
- **Moss and ice** patches are 14 px into the stone. Moss: green with tufts and drips. Ice: pale blue, frosted
  (speckles and crystal streaks), a glint running down it and icicles off its lower edge.
- **Coins** (60) sit three to an arc along twenty good leaps; **gold lanterns** (10) hang on the walls where the
  route clings, about half sliding slowly up and down; **scrolls** (4, rare) sit at the top of double-jump lines,
  never off the route.
- Everyone in a room climbs the identical tower: everything is dealt from the room seed in the sim at init; nothing
  random is drawn during play.

## The deal and its proof

`ninjaBuildDeal(seed)`: surfaces first (moss and ice patches up each wall, closer together higher up); then a route
is planned through the real movement code (`planRoute`): at each landing a wait (none on ice, 0–2 ticks on moss,
otherwise usually none, sometimes a short or a longer wait), and about one leap in three double jumps. Coins,
lanterns and scrolls are laid on that route (sliding lanterns phased to be where the route clings when it clings).
Hazards are laid clear of the route (a katana or shuriken that would touch it, with a margin, is moved or dropped):
katanas where a plain leap would land on the route's double-jump leaps (so the double jump is the way past),
shurikens across where a leap-at-once would be on the route's longer waits (so waiting is the way past), and more of
both up the tower, closer together higher up. Finally the route is played through the real `step`: the deal is kept
only if it takes every item, takes no hit and climbs at least NINJA_CORE_FULL_M, 241 m (else the next attempt's seed). So
**a perfect run reaches 200 on every dealt tower**; arcade-standard-check plays 24 towers' witnesses through the
server replay (200 with `CHECKS_FULL=1`), all at 200 with every part at its maximum. A deal takes about 20–60 ms
(the stage and the server cache the last eight).

## Scoring (the arcade standard)

| Part | Maximum | How |
| --- | --- | --- |
| Height | 130 | metres climbed (best height above the start, 40 px a metre) on a straight line, full at **241 m** |
| Coins | 30 | shared across 60 coins (floor(30 × coins ÷ 60)) |
| Lanterns | 20 | 2 for each of 10 gold lanterns |
| Scrolls | 20 | 5 for each of 4 scrolls |
| **Total** | **200** | any input scores at least 1; no input 0 |

A hit costs only the height and time it takes (no points). The core's full figure, 241 m, is the near-perfect
level's median (below); every dealt tower's witness reaches it (the witnesses climb 278–324 m on 40 test towers).

## Skill bands

`bun scripts/ninja-bands.ts --seeds=40` (room seeds n = 0…39 through the server's encode and replay; bot
`scripts/arcade-skill-bands/bots/ricochet.ts`: at each landing it weighs 104 plans of wait and double-jump timing on
the real sim, looking one leap further for its ten best, with the level's reaction, timing error, judgement and
slips; elite and flawless weigh the items higher, since height past 241 m pays nothing):

| Level | Score | Height (130) | Coins (30) | Lanterns (20) | Scrolls (20) | Metres | Hits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Random tapper | 44 | 33 | 5 | 4 | 5 | 62 | 22 |
| Weak | 67 | 51 | 8 | 4 | 5 | 96 | 20 |
| Average | 105 | 78 | 11 | 8 | 8 | 145 | 17 |
| Good | 143 | 108 | 16 | 10 | 10 | 201 | 14 |
| Great | 161 | 120 | 17 | 10 | 15 | 222 | 13 |
| Near-perfect | 176 | 130 | 20 | 12 | 15 | 241 | 11 |
| Elite | 184 | 130 | 22 | 14 | 18 | 254 | 10 |
| Flawless | 188 | 130 | 25 | 14 | 20 | 269 | 10 |

Before the hero body (a 15 px circle, the first PR push), the same run gave 42 / 64 / 94 / 132 / 153 / 170 / 177 / 182
with the core full at 296 m: the larger body is easier to hit and catches items more readily, so the climb is
lower (near-perfect 296 → 241 m) and the full mark moved with it.

The witness (the deal's own route) scores 200 on every tower. The bots' flawless level stays below it because its
plan looks only two leaps ahead and finds the sliding lanterns hard to time; the gaps at the top are 8 (near →
elite) and 4 (elite → flawless).

## Decisions and assumptions

- The same id, `ricochet`, on `ricoRev` 2 (see the top). ROUND_MAX is 200 for the id (the reveal chart, help and
  awards read it); an unstamped round still scores at most 150 on its own sim.
- World 390 × 730 (the taller worlds' size), in the `realworld` success-layer world; Action's red is the tile border
  and intro colour through the Action group (`arcadeGroups.ts`).
- The mockup (ricochet-mockup.png) was not in the repository or the session; the look follows the brief's words.
- Music borrows Grappler's bed (`music_swing`) until `music_ricochet` has a file. Slots with no file yet (silent, or
  the shared sound they fall back to): `ricochet.leap`, `ricochet.doubleJump`, `ricochet.hit`, `ricochet.coin`,
  `ricochet.lantern`, `ricochet.scroll`, `ricochet.land`, `ricochet.slip`, `music_ricochet`.
- Haptics: `impact` on a hit (the sound observer's `feel`) and the shared arcade buzzer; nothing else.
- Desktop: `tall` (upright at full height; the stone wall carried on beside the world); Space, ↑ or W leaps, as does
  a click.
- No intro demo yet (the intro shows a still frame of seed 0's witness climb); listed in
  `docs/demo-replay-audit.md` "Demos still needed".
