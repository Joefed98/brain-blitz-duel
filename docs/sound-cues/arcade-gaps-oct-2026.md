# Arcade sound gaps, Oct 2026

Audit of 16 Oct 2026, docs only: no code, slot or file changes. It aims for **every noticeable visual moment in the
22 arcade games having a sound**. It also covers the five engine games on the arcade stage (Letterfall, Tenfall, Bonk,
Pull!, Mixed Signals) and, more briefly, the puzzle games.

Sources:

- the cue docs: [arcade-effects.md](arcade-effects.md), [arcade.md](arcade.md), [puzzle-move-cues.md](puzzle-move-cues.md)
  and [cue-sheet.csv](cue-sheet.csv);
- the code that plays them: `src/lib/fx/gameSounds.ts`, `src/lib/fx/momentCues.ts`, the engine stages in `src/puzzles/`
  and `src/lib/fx/manifest.ts`;
- every renderer and sim in `src/lib/arcade/`, read for anything drawn that changes, appears, blinks or moves.

Counts per round are estimates from the sims' constants, not measured play. They use the revision rooms deal today
(`src/lib/duel/arcade.server.ts`).

## Assumptions

- **Sound batch 2 is unknown.** No batch 2 `mapping.csv` is in the repo. I checked every branch, the git history and
  GitHub code search. The only mapping sheet ever committed is batch 1's (`sounds-incoming/mapping.csv`, added and then
  removed with #78). So every slot that has no file today is marked **silent, batch 2 ?**. Once batch 2's sheet is
  known, cross out the rows it covers. Any silent slot it leaves out carries over to batch 3 (see
  [Carry-over](#carry-over-existing-silent-slots)).
- **Batch 3 is the moments with no cue at all**, plus own files for two over-used stand-ins (`cross.hop`,
  `wavefront.fire`). Each new slot in the Batch 3 table also needs a hook in code: an `effectCue()` / `liveCue()` call,
  a manifest slot and a row in arcade-effects.md. That is a later code PR, not this one.
- **New slot names** follow the README: `<gameId>.<event>`, lower camelCase, and never a replay cue name. Puzzle slots
  use the existing prefixes (`chain.`, `numhunt.`) and `shared.` for the shared reject shake.
- **The shared every-5 milestone glow is not a gap.** `successFrame` in `success.renderer.ts` (border glow and HUD
  pop) always starts on a frame that already plays that game's hit, pop or home sound, so it counts as covered.
- **Low time is covered.** `TimerBar` plays `warning_tick` / `warning_tick_final` in the last 10 s of every timed
  screen, the arcade header included.
- **A moment is left silent on purpose** when it is continuous and too dense to sound one by one (cell steps, falling
  notes, tile spawns, word spawns), when sounding it would give away the answer (Flash's decoys), or when the doc
  already says so (Gemstone's falling gems). Those are listed as *keep silent* with the reason.
- **Tables start with a moment or a row number, never a cue id**, so `scripts/sound-cue-sheet.ts` (which reads every
  table in `docs/sound-cues/*.md` whose first cell looks like a cue id) does not read the proposed slots as cues yet.

**Status key:**

- **own file**: the slot has its own recording.
- **shared: `x`**: the slot plays app-wide recording `x` as a stand-in.
- **silent, batch 2 ?**: the slot exists with `url: null`; whether batch 2 fills it is unknown.
- **no cue**: nothing is dispatched; the moment goes to batch 3.
- **keep silent**: deliberately left without a sound (reason given).

## 1. Arcade games: every moment and its cue

### Hover

| Moment | Cue | Status |
|---|---|---|
| Tap lifts the saucer (thruster puff) | `arc_hover_tap` | own file |
| Barrier passed (white pulse) | `hover.gate` | shared: `arc_retro_note` |
| Gold star collected | `hover.star` | shared: `arc_retro_coin` |
| Crash | `hover.crash` | shared: `arc_retro_explode` |
| New zone every 7th barrier: border flash, STREAK | `hover.newZone` | silent, batch 2 ? |
| Through a two-gap barrier | `hover.twoGap` | silent, batch 2 ? |
| Past a moving barrier (near miss) | `hover.slippedThrough` | silent, batch 2 ? |
| Every barrier passed: FULL CLEAR | `hover.allBarriers` | silent, batch 2 ? |
| Every 5 barriers: spark burst, HUD pop | (frame of `hover.gate`) | covered |
| First two-gap barrier scrolls in (pillar 16) | — | **no cue** |
| First moving barrier scrolls in (pillar 23) | — | **no cue** |
| Saucer hull lights cycling, stars drifting, star twinkle (ambient) | — | **no cue** (quiet loop) |
| Scroll speed rising and gaps narrowing | — | keep silent: continuous, no step to mark |

### Breaker

| Moment | Cue | Status |
|---|---|---|
| Run starts | `breaker.start` | shared: `arc_retro_coin` |
| Brick cracks | `breaker.brickHit` | shared: `arc_retro_hit` |
| Brick destroyed (pixel burst) | `breaker.brickBreak` | silent, batch 2 ? |
| Every 10th brick: STREAK | `breaker.bricksStreak` | silent, batch 2 ? |
| Brick out of a sliding row | `breaker.movingTarget` | silent, batch 2 ? |
| Row cleared: ROW CLEAR!, bulbs chase the border | `breaker.rowClear` | silent, batch 2 ? |
| Wall cleared: bulb chase, shake | `breaker.wallCleared` | silent, batch 2 ? |
| Power-up capsule drops | `breaker.capsuleDrop` | silent, batch 2 ? |
| Power-up caught | `breaker.powerUp` | shared: `arc_retro_pickup` |
| Fireball lit | `breaker.fireballLit` | shared: `arc_retro_coin` |
| Fireball runs out | `breaker.fireballOut` | silent, batch 2 ? |
| Laser | `breaker.laser` | shared: `arc_laser_beam` |
| Multiball / spam ball added | `breaker.multiball` | shared: `arc_multiball` |
| Paddle bounce | `breaker.paddle` | shared: `arc_retro_blip` |
| Ball lost | `breaker.ballLost` | shared: `arc_retro_explode` |
| Relaunch after the pause | `breaker.relaunch` | silent, batch 2 ? |
| Wall and ceiling bounces | — | **no cue** |
| Hot paddle: gold outline at chain 10 | — | **no cue** |
| Fireball's last second (bar nearly empty) | — | **no cue** |
| Capsule missed (falls past the paddle) | — | **no cue** |
| Extra ball drained (not the last ball) | — | **no cue** |
| Rows 3 and 7 start sliding (30 s, 60 s) | — | **no cue** |
| Every 5 hits: border glow | (frame of `breaker.brickHit`) | covered |
| Ball speed steps | — | keep silent: not drawn |

### Pinball

| Moment | Cue | Status |
|---|---|---|
| Run starts / ball launched | `pinball.start`, `pinball.launch` | own file |
| Bumper glow and ripple | `pinball.bumperHit` | own file |
| Sling, drop target, lane lit, spinner, flipper | `pinball.sling`, `.dropTarget`, `.laneLight`, `.spinner`, `.flipper` | own file |
| Bank down, multiplier lanes | `pinball.bankComplete` | own file |
| Drain, lights out | `pinball.ballLost` | own file |
| SPINNER! rip | `pinball.spinnerRip` | silent, batch 2 ? |
| Drop-target bank pops back up | `pinball.bankReset` | silent, batch 2 ? |
| Lit spinner goes dark (15 s) | — | **no cue** |
| Ball waiting in the shooter lane ("^" blinks) | — | **no cue** |
| Last ball (BALL 3/3) | — | **no cue** |
| GAME OVER before time | — | **no cue** |
| Stuck-ball rescue nudge | — | **no cue** |
| Lit lane and multiplier inserts pulsing (ambient) | — | keep silent: music bed covers it |

### Rally

| Moment | Cue | Status |
|---|---|---|
| Run starts | `rally.start` | shared: `arc_retro_coin` |
| Ball returned (paddle light-up) | `rally.hit` | shared: `arc_retro_blip` |
| Gold ball returned | `rally.goldHit` | shared: `arc_retro_note` |
| Rally over | `rally.dead` | shared: `arc_retro_explode` |
| Every 10th return: STREAK; ball turns gold / orange | `rally.longRally` | silent, batch 2 ? |
| Gold ball hits a far-wall pad | `rally.targetHit` | silent, batch 2 ? |
| Bumper bounce | `rally.bumperBounce` | silent, batch 2 ? |
| Gold ball enters | `rally.goldEnter` | silent, batch 2 ? |
| BUMPER warning blinks | `rally.bumperWarn` | silent, batch 2 ? |
| Bumper appears | `rally.bumperIn` | silent, batch 2 ? |
| Side and far-wall bounces | — | **no cue** |
| Gold bulbs chasing down both side casings (ambient) | — | **no cue** (quiet loop) |
| Gold ball missed off the bottom | — | **no cue** |
| Wall-tube gold flash every 10 total returns | (frame of `rally.hit`) | covered, but see note 1 |
| Paddle shrinking, ball speeding up | — | keep silent: continuous |

Note 1: the wall flash counts gold returns too (`rallyTotalHits`), and `rally.longRally` does not, so once a gold ball
has been returned the two drift apart. The flash still lands on a hit sound, so nothing is silent. This is only flagged
in case `longRally` was meant to sit with the flash.

### Tempo

| Moment | Cue | Status |
|---|---|---|
| Run starts | `beat.start` | shared: `arc_retro_coin` |
| Note hit: lane flash, judgement, ring | `beat.note` | shared: `arc_retro_note` (lane-pitched) |
| Note missed / hold dropped | `beat.miss` | shared: `arc_retro_hit` |
| COMBO ×n every 10 | `beat.comboTen` | silent, batch 2 ? |
| Combo 25: pink glow tier | `beat.comboTier` | silent, batch 2 ? |
| Swipe note hit | `beat.swipeHit` | silent, batch 2 ? |
| Full combo | `beat.fullCombo` | silent, batch 2 ? |
| Backing beat | `beat.backing` | synthesised, no slot |
| Combo of 10+ broken: glow bands vanish | — | **no cue** |
| First swipe notes arrive (30 s) | — | **no cue** |
| Hold beam held bright | — | **no cue** (sustain loop) |
| Notes entering the top of the lanes | — | keep silent: 80–150 a round, the chart is the music |
| Stray tap on an empty lane | — | keep silent: nothing is drawn |

### Meteor

| Moment | Cue | Status |
|---|---|---|
| Run starts | `snake.start` | shared: `arc_retro_coin` |
| Star eaten | `snake.eat` | shared: `arc_retro_blip` |
| Rock shadow and crosshair appear | `snake.rockWarn` | shared: `arc_retro_note` |
| Rock lands clear | `snake.rockLand` | shared: `arc_retro_hit` |
| METEOR SHOWER alarm | `snake.showerAlarm` | shared: `arc_retro_note` |
| Death: body fades into sparks | `snake.dead` | shared: `arc_retro_explode` |
| Every 10th star: STREAK, palette shift | `snake.starsStreak` | silent, batch 2 ? |
| Shower dodged: PERFECT | `snake.showerDodged` | silent, batch 2 ? |
| Every star eaten | `snake.allEaten` | silent, batch 2 ? |
| Speed step on the 5th, 15th, 25th… star (palette shift, faster steps) | — | **no cue** |
| Impact imminent: rock sprite falls in, crosshair blinks faster | — | **no cue** |
| Turn | — | **no cue** |
| Tail sparks (ambient) | — | keep silent: music covers it |
| Cell steps | — | keep silent: 400+ a round |

### Fission

| Moment | Cue | Status |
|---|---|---|
| Run starts | `burst.start` | shared: `arc_retro_coin` |
| Shot | `burst.shot` | shared: `arc_retro_blip` |
| Atom split | `burst.hit` | shared: `arc_retro_hit` |
| Shield / BURST caught | `burst.powerUp` | shared: `arc_retro_pickup` |
| FREEZE caught: glaze | `burst.freezeCaught` | shared: `arc_retro_coin` |
| Life lost | `burst.lifeLost` | shared: `arc_lose_life` |
| Game over | `burst.gameOver` | shared: `arc_retro_explode` |
| Wave cleared: banner, light sweep | `burst.waveCleared` | shared: `stage_complete` |
| Wave cleared on the last life | `burst.lastLifeWave` | silent, batch 2 ? |
| Flawless finish | `burst.flawlessFinish` | silent, batch 2 ? |
| Power-up icon drops | `burst.iconDrop` | silent, batch 2 ? |
| Shield breaks | `burst.shieldBreak` | silent, batch 2 ? |
| FREEZE thaws | `burst.thaw` | silent, batch 2 ? |
| New wave drops in, ceiling steps down | `burst.newWave` | silent, batch 2 ? |
| Atom bounces off the floor | — | **no cue** |
| Ceiling flashes white (atom touches it) | — | **no cue** |
| Smallest atom destroyed (extra spark burst) | — | **no cue** (sounds the same as a split today) |
| Power-up icon lost on the floor | — | **no cue** |
| Last life: two ship icons dim | — | **no cue** |
| FREEZE's last second | — | **no cue** |
| Hit-blink ends (vulnerable again) | — | **no cue** |
| Shield ring flicker (ambient) | — | keep silent: short-lived, started by `burst.powerUp` |

### Wavefront

| Moment | Cue | Status |
|---|---|---|
| Shot (auto-fire) | `wavefront.fire` | shared: `arc_blaster` |
| Pierce pickup | `wavefront.pierce` | shared: `arc_retro_pickup` |
| Ship bursts | `wavefront.bigExplode`, `wavefront.shapePop` | shared: `arc_big_explode`, `arc_shape_pop` |
| Boss hit | `wavefront.bossHit` | shared: `arc_retro_hit` |
| Formation arrives | `wavefront.formation` | shared: `stage_complete` |
| Ship peels off to dive | `wavefront.dive` | shared: `arc_retro_blip` |
| Life lost | `wavefront.lifeLost` | shared: `arc_lose_life` |
| Saucer down, wave cleared, diver down, boss streak, boss down | `wavefront.saucerDown`, `.waveCleared`, `.diverDown`, `.bossStreak`, `.bossDown` | silent, batch 2 ? |
| Saucer enters, laser drops, armour plate off, enemy fires | `wavefront.saucerEnter`, `.laserDrop`, `.armourHit`, `.enemyFire` | silent, batch 2 ? |
| Formation march step (speeds up) | — | **no cue** |
| Formation drops a row at a wall | — | **no cue** |
| Formation within reach of the ship line | — | **no cue** (danger loop) |
| Laser shots run out | — | **no cue** |
| Saucer on screen (spinning lights) / saucer escapes | — | **no cue** |
| Boss health bar turns red (below 1/3) | — | **no cue** |
| Star twinkle, engine glow (ambient) | — | **no cue** (quiet space loop) |
| Boss bounces off a wall; hit-blink ends | — | keep silent: minor |

### Orbit

| Moment | Cue | Status |
|---|---|---|
| Launch | `orbit.launch` | shared: `arc_thruster` |
| Caught by a planet | `orbit.planetCaught` | silent, batch 2 ? |
| First checkpoint | `orbit.checkpoint` | shared: `arc_pickup` |
| Respawn / crash | `orbit.crash` | shared: `arc_crash` |
| Black hole jump | `orbit.blackHole` | shared: `pz_gravity_pull` |
| Shooting star, STREAK, all planets | `orbit.shootingStar`, `.planetsStreak`, `.allPlanets` | silent, batch 2 ? |
| Starfield, nebula, halo (ambient) | `orbit.ambience` | shared: `arc_space_ambience` (loop) |
| Fly-in glide after a black hole | — | **no cue** |
| Black hole armed: rim brightens | — | **no cue** |
| First figure-eight planet (21) / first asteroid belt (31) | — | **no cue** |
| Approaching the sun (planet 40, corona) | — | **no cue** |
| Checkpoint ring pulse | — | keep silent: ambience loop covers it |

### Grappler

| Moment | Cue | Status |
|---|---|---|
| Rope catches | `swing.grapple` | shared: `arc_grapple` |
| Star taken | `swing.starTaken` | shared: `arc_pickup` |
| Dragon appears | `swing.dragon` | shared: `arc_siren` |
| Stalactite shakes | `swing.rockShake` | shared: `arc_clank` |
| Stalactite lands | `swing.rockLand` | shared: `arc_wood_knock` |
| Crash | `swing.crash` | shared: `arc_crash` |
| 100 m STREAK, past lava, 500 m finish | `swing.distanceStreak`, `.overLava`, `.finishLine` | silent, batch 2 ? |
| Stalactite drops, jet bubbles, jet erupts | `swing.rockFall`, `.jetBubble`, `.jetErupt` | silent, batch 2 ? |
| Dragon closing in: label grows, arrow turns red | — | **no cue** |
| Dragon wing-beats while on screen | — | **no cue** (loop) |
| Stalactite crumble build-up (grit, shadow grows) | — | **no cue** |
| Rope released | — | **no cue** |
| 500 m gold gate comes into view | — | **no cue** |
| Lava waves, embers, drips (ambient) | — | **no cue** (quiet loop) |

### Jaywalk

| Moment | Cue | Status |
|---|---|---|
| Hop / side-step | `cross.hop` | shared: `arc_honk` (see section 3) |
| Crossing made | `cross.crossed` | shared: `stage_complete` |
| Hit and tumble | `cross.lifeLost` | shared: `arc_lose_life` |
| Past the bikes / through the roadworks | `cross.pastBikes`, `cross.pastRoadworks` | silent, batch 2 ? |
| Traffic streaming (ambient) | — | **no cue** (loop) |
| New hazard layout (first cycle lane, roadworks, chicane) | — | **no cue** |
| Kerb pause ends: go | — | **no cue** |
| Move refused by cones | — | **no cue** |
| Respawn on the kerb | — | **no cue** |
| Near misses | — | keep silent: not tracked by the sim |

### Roofbound

| Moment | Cue | Status |
|---|---|---|
| Gravity flip | `flip.flip` | shared: `arc_gravity_flip` |
| Star taken | `flip.starTaken` | shared: `arc_pickup` |
| Crash into the pool | `flip.crash` | shared: `arc_crash` |
| STREAK, SURVIVED!, all stars, JUST IN TIME!, crack, collapse | `flip.surviveStreak`, `.survivedFinish`, `.allStars`, `.justInTime`, `.crackStart`, `.collapse` | silent, batch 2 ? |
| Speed step every 3 s | — | **no cue** |
| Tunnel starts bending (10 s) | — | **no cue** |
| Bends tighten (45 s on) | — | **no cue** |
| Lava pools, spouts, embers (ambient) | — | **no cue** (quiet loop) |
| Passing spikes and overhangs | — | keep silent: not tracked as near misses |

### Rainbow Bridge

| Moment | Cue | Status |
|---|---|---|
| Stroke drawn | `inkbridge.draw` | shared: `arc_rainbow` |
| Pot of gold, level clear | `inkbridge.pot` | shared: `arc_rainbow_pot` |
| Stopped on a block | `inkbridge.bump` | shared: `arc_rainbow_bump` |
| Gold star | `inkbridge.goldStar` | silent, batch 2 ? (see note 2) |
| All levels, release, fail, ink out, reject | `inkbridge.allLevels`, `.release`, `.fail`, `.inkOut`, `.reject` | silent, batch 2 ? |
| Coin lands on the rainbow and rolls along it | — | **no cue** |
| Coin bounces off the pot rim | — | **no cue** |
| Live levels (9–10) begin: no-draw ring | — | **no cue** |
| Drawing during a live drop (only the lift sounds) | — | **no cue** (draw loop) |
| Ink meter empty on a normal level | — | **no cue** |
| Birds flapping, sliding pot (ambient) | — | keep silent: music covers it |

Note 2: stars exist only on `inkRev 4` (`inkBridge.ts:1379`); rooms deal `inkRev 6`, so `inkbridge.goldStar` fires only
on stored or practice rev-4 rounds, not the 2–10 a round the effects doc gives. Low priority for a file.

### Slice

| Moment | Cue | Status |
|---|---|---|
| Slice and juice | `slice.cut` | shared: `arc_knife_slice` |
| Combo grows, gold border | `slice.comboUp` | shared: `arc_slice_combo` |
| Ketchup frenzy | `slice.frenzyStart` | shared: `arc_ketchup` |
| Mustard simmer | `slice.slow` | shared: `arc_mustard` |
| Mayo squeeze | `slice.mayoSqueeze` | shared: `arc_mustard` |
| Chilli flash | `slice.bomb`, `slice.bombBell` | shared: `arc_crash`, `arc_chilli_bell` |
| 25 SLICED, many in one | `slice.slicedStreak`, `slice.manyInOne` | silent, batch 2 ? |
| Food thrown up | — | **no cue** |
| Chilli launched with a fizzing fuse | — | **no cue** |
| Special bottle appears (glowing ring) | — | **no cue** |
| Food falls unsliced | — | **no cue** |
| Combo meter's last second, combo runs out | — | **no cue** |
| Frenzy / simmer / squeeze ends | — | **no cue** |
| Blade trail | — | keep silent: follows the finger |

### Swish

| Moment | Cue | Status |
|---|---|---|
| Basket, bucket sway | `bintoss.basket` | shared: `arc_fair_bucket` |
| Rim wobble / miss bounce | `bintoss.wobble`, `bintoss.missBounce` | shared: `arc_bounce` |
| Ten out of ten | `bintoss.allBaskets`, `bintoss.perfect` | shared: `arc_fair_bell`, `arc_fair_sting` |
| In a row, hoop swish, spinner basket, hoop glow, spinner knock | `bintoss.inARow`, `.hoopSwish`, `.spinnerBasket`, `.hoopGlow`, `.spinnerKnock` | silent, batch 2 ? |
| Throw released (ball flies with a trail) | — | **no cue** |
| Next ball ready: bucket moves, wind changes | — | **no cue** |
| New hazard: bucket narrows (4), spinner (6), trolley (7) | — | **no cue** |
| Canopy bulbs twinkle, pennant flutters (ambient) | — | keep silent: music covers it |

### Flightpath

| Moment | Cue | Status |
|---|---|---|
| Arrow lands (also a miss off the board) | `bullseye.thud` | shared: `arc_fair_thud` |
| Bullseye | `bullseye.bull` | shared: `arc_fair_bell` |
| All tens | `bullseye.perfect` | shared: `arc_fair_sting` |
| Balloon popped | `bullseye.balloonPop` | shared: `arc_sea_pop` |
| Inner bull, bulls in a row, all on target, arrow thrown | `bullseye.innerBull`, `.bullsRow`, `.allOnTarget`, `.dartThrow` | silent, batch 2 ? |
| Next arrow nocked | — | **no cue** |
| Target starts drifting (arrow 4) | — | **no cue** |
| Ring values shuffle (arrow 7 on) | — | **no cue** |
| Balloon floats in | — | **no cue** |
| Arrow off the board (distinct from a hit) | — | **no cue** |
| Board shrinks a step each arrow | — | keep silent: lands with the next-arrow cue |

### Coral Pop

| Moment | Cue | Status |
|---|---|---|
| Next bubble loads | `bubble.load` | shared: `arc_sea_bubble` |
| Pop | `bubble.pop` | shared: `arc_sea_pop` |
| Mine, torpedo, joker | `bubble.bomb`, `bubble.line`, `bubble.jokerLand` | shared: `arc_big_explode`, `arc_laser_beam`, `arc_rainbow` |
| Light rays, kelp, background bubbles (ambient) | `bubble.waves` | shared: `arc_sea_waves` (loop) |
| Big pop, big drop, reef cleared, reef descends, shot sticks | `bubble.bigPop`, `.bigDrop`, `.reefCleared`, `.descend`, `.stick` | silent, batch 2 ? |
| Rising bubble rush (8+ cleared in one shot) | — | **no cue** (lands with `bigPop` / `bigDrop`; needs its own whoosh) |
| Shot banks off a side wall | — | **no cue** |
| Reef reaches the gun: run lost | — | **no cue** (only the generic `complete`) |

### Scrumper

| Moment | Cue | Status |
|---|---|---|
| Rope cut | `snip.cut` | shared: `arc_rope_cut` |
| Springy branch, picker's crook | `snip.springBounce`, `snip.hook` | shared: `arc_bounce` |
| Leaf star | `snip.star` | shared: `arc_leaf_collect` |
| Apple fed / lost (wasp flash) | `snip.basket`, `snip.miss` | shared: `arc_orchard_basket`, `arc_orchard_miss` |
| All apples fed | `snip.allApples` | silent, batch 2 ? |
| Wasps circling the nest (nest levels) | — | **no cue** (loop) |
| Apple bounces or rolls on a plank or gutter | — | **no cue** |
| Sliding basket, clouds, camera pan | — | keep silent: continuous, music covers it |

### Tilt

| Moment | Cue | Status |
|---|---|---|
| Roll | `tilt.roll` | shared: `arc_marble_roll` (loop) |
| Wall knock | `tilt.knock` | shared: `arc_wood_knock` |
| Gate opens | `tilt.gate` | shared: `arc_latch` |
| Cup, maze done | `tilt.cup`, `tilt.mazeDone` | shared: `arc_marble_clink` |
| Star | `tilt.starTaken` | shared: `arc_leaf_collect` |
| Caught / pit fall | `tilt.caught`, `tilt.pitFall` | shared: `arc_crash` |
| All mazes, chaser falls | `tilt.allMazes`, `tilt.chaserFall` | silent, batch 2 ? |
| Red chaser starts chasing | — | **no cue** (same frame as `tilt.gate`, but a different moment) |

### Ball Tracker

| Moment | Cue | Status |
|---|---|---|
| Roll | `balltrack.roll` | shared: `arc_marble_roll` (loop) |
| Switch / tube turn | `balltrack.switch` | shared: `arc_latch` |
| Marble home, cup flash | `balltrack.marbleHome` | shared: `arc_marble_clink` |
| Wrong cup | `balltrack.wrong` | shared: `arc_wood_knock` |
| Home streak, all home, turned home, switched home, release, lost, shuffle | `balltrack.homeStreak`, `.allHome`, `.turnedHome`, `.switchedHome`, `.release`, `.lost`, `.shuffle` | silent, batch 2 ? |
| 5-4-3-2-1 countdown in the hopper (before relay, before shuffle) | — | **no cue** |
| Hopper runs dry | — | **no cue** |

### High Rise

| Moment | Cue | Status |
|---|---|---|
| Block lands | `skyline.drop` | shared: `arc_clank` |
| Perfect drop | `skyline.perfect` | shared: `correct` |
| Streak drop | `skyline.streakDrop` | shared: `arc_retro_coin` |
| Miss | `skyline.miss` | shared: `arc_crash` |
| Floors streak, wind flag up, perfect in the wind, gust blows | `skyline.floorsStreak`, `.windFlag`, `.windPerfect`, `.gust` | silent, batch 2 ? |
| Gust warning: flag streams 1 s before | — | **no cue** |
| Gust ends: flag goes limp | — | **no cue** |
| Hanging block turns at the edge | — | keep silent: 30–60 a round |
| Speed creep, camera zoom-out | — | keep silent: continuous |

### Gemstone

| Moment | Cue | Status |
|---|---|---|
| Gems shatter (pitched by depth) | `arc_gem_match` (+ generic `combo` per cascade) | own file |
| Bomb, star, cross gem go off | `arc_gem_bomb`, `arc_gem_star`, `arc_gem_zap` | own file |
| Jackpot set off | `arc_rainbow` | own file (shared recording) |
| Line of five, jackpot made, par smashed, swap, invalid swap, hint | `matchup.lineOfFive`, `.jackpotMade`, `.parSmashed`, `.swap`, `.invalid`, `.hint` | silent, batch 2 ? |
| Gem selected | — | **no cue** |
| Bomb / cross / star gem forged | — | **no cue** (only the jackpot has a "made" cue) |
| Gems falling into place | — | keep silent: the effects doc's choice, the chimes step with it |

### Engine games on the arcade stage

| Moment | Cue | Status |
|---|---|---|
| Letterfall: word made / not a word / letter added | `correct` / `wrong` / `tick` | own file |
| Letterfall: long word, par reached, column danger | `wordfall.longWord`, `.parReached`, `.danger` | silent, batch 2 ? |
| Letterfall: end shimmer | `wordfall.finish` | own file |
| Letterfall: tile drops in and lands | — | **no cue** |
| Letterfall: chain cut back or restarted | — | **no cue** |
| Letterfall: drop speed step every 18 s | — | keep silent until it is drawn |
| Tenfall: ten made, reset | `tendrop.clear`, `tendrop.reset` | own file |
| Tenfall: tile applied, next target | `tendrop.apply`, `tendrop.nextTarget` | silent, batch 2 ? |
| Tenfall: ÷ or − tile refused | `tendrop.refused` (+ shared `tick`) | silent, batch 2 ? (the `tick` plays) |
| Tenfall: tile spawns, falls off unplayed, empty-lane tap | — | keep silent: 100+ a round, or nothing drawn |
| Bonk: bonk / wrong / rule flip | `correct` / `wrong` / `tick` | own file |
| Bonk: hedgehog (bomb) tapped | `whack.bomb` | shared: `arc_retro_explode` |
| Bonk: finale | `whack.finale` | own file |
| Bonk: 10 bonks, 20 clean, gopher up, gopher sinks | `whack.bonkStreak`, `.cleanTwenty`, `.popUp`, `.sink` | silent, batch 2 ? |
| Bonk: gold glow every 5 bonks in a row on gold | — | **no cue** |
| Bonk: hedgehog pops up | — | **no cue** (plays the generic pop-up) |
| Bonk: empty-hole tap costs 3 points | — | **no cue** (nothing drawn either) |
| Pull!: shot, clay hit, gold clay hit, bird, final burst | `tick`, `pz_clay_hit` + `clayshoot.shatter` / `.goldShatter`, `.birdStartle`, `.finalBurst` | own file (`shatter` silent, batch 2 ?) |
| Pull!: clays streak, double, launch, miss puff, gold sparkle | `clayshoot.claysStreak`, `.doubleHit`, `.launch`, `.missPuff`, `.goldSparkle` | silent, batch 2 ? |
| Pull!: clay escapes (HUD pip turns red) | — | **no cue** |
| Pull!: bird flies in | — | **no cue** |
| Pull!: gold clay launches (glinting) | — | **no cue** (plays the generic launch) |
| Mixed Signals: lane, right, wrong gate | `stroop.lane`, `.right`, `.wrong` | shared: `pz_clash_*` |
| Mixed Signals: gates flash at the end | `stroop.gatesFlash` | own file |
| Mixed Signals: sorted streak, rule flash, lanes grow, drop, gate pulse | `stroop.sortedStreak`, `.ruleFlash`, `.lanesGrow`, `.drop`, `.gatePulse` | silent, batch 2 ? |
| Mixed Signals: next word appears | — | keep silent: 52 a round, the lane move follows |

## 2. Moments with no cue at all

These are the rows marked **no cue** above, grouped by kind. Each becomes a row in the Batch 3 table.

- **Arrivals and new hazards:** Hover's first two-gap and moving barriers; Breaker's rows starting to slide; Tempo's
  first swipe notes; Meteor's falling rock in the last second before impact; Orbit's first figure-eight planet,
  first belt and the sun; Grappler's 500 m gate; Jaywalk's new layouts; Swish's next ball and new hazards; Flightpath's
  next arrow, drifting target and balloon; Pull!'s birds and gold clays; Bonk's hedgehogs; Letterfall's tile drops.
- **Bounces and contact:** Breaker and Rally wall bounces; Fission's atom floor bounces and ceiling flash; Coral Pop
  wall banks; Rainbow Bridge's coin rolling and rim bounce; Scrumper's plank and gutter knocks.
- **Ambient motion:** Rally's chasing wall bulbs; Hover's saucer lights and star field; Wavefront's space; Grappler's
  lava; Roofbound's lava tube; Jaywalk's traffic; Scrumper's wasps; Grappler's dragon wings; Wavefront's saucer.
- **Speed-ups and stage changes:** Meteor's speed steps; Roofbound's speed steps, bend start and tightening;
  Wavefront's march and row drops.
- **Warnings:** Wavefront's formation reaching the ship line; Grappler's dragon closing in; High Rise's gust warning;
  Pinball's last ball; Fission's last life; Grappler's crumble build-up.
- **Power-up and timer ends:** Breaker's Fireball and Fission's FREEZE last second; Pinball's lit spinner going dark;
  Wavefront's laser running out; Slice's power-ups and combo running out; High Rise's gust ending; Fission's hit-blink ending.
- **Losses and misses:** Breaker's capsule missed and extra ball drained; Fission's icon lost; Rally's gold ball
  missed; Coral Pop's reef reaching the gun; Pinball's GAME OVER; Wavefront's saucer escaping; Slice's food dropped;
  Flightpath's arrow off the board; Pull!'s clay escaping; Tempo's combo broken; Jaywalk's move refused; Bonk's empty tap.
- **Success and player feedback:** Breaker's hot paddle; Fission's smallest atom destroyed; Coral Pop's rising bubble
  rush; Gemstone's gem selected and special forged; Bonk's gold run; Tilt's chaser released; Ball Tracker's countdown
  and dry hopper; Rainbow Bridge's live-level start, live drawing and empty ink; Grappler's rope release; Meteor's turns;
  Pinball's shooter-lane wait and rescue nudge; Wavefront's boss on its last third; Orbit's fly-in and armed hole;
  Jaywalk's go and respawn; Letterfall's chain cut.

**No-cue moments with nothing drawn either:** Bonk's empty-hole tap (−3 points), Tempo's stray tap, Tenfall's
empty-lane tap and Letterfall's 18 s speed step. Only Bonk's is in batch 3, because it costs points silently. Its
sound should come with a small visual (not part of this audit).

## 3. Frequent moments that could get annoying

"Today" is the current rate limit in `gameSounds.ts` or the stage. A cap is the shortest gap between two plays of
that slot; "voices" is how many may overlap. These need code, so they ride with batch 3's hook PR.

| Game | Cue or moment | Per round | Today | Suggest | Cap |
|---|---|---|---|---|---|
| Wavefront | `wavefront.fire` (auto-fire) | ~250 in 90 s | none, overlapping | one-shot, own soft file (batch 3), one per volley not per bolt, volume 0.5 | 1 per 120 ms, 2 voices |
| Wavefront | `wavefront.enemyFire` | 20–80+ | 1 per 150 ms | one-shot, volume 0.5 | keep 150 ms, 2 voices |
| Wavefront | march step (new) | 150–400 | — | one-shot four-note cycle, very quiet | 1 per 100 ms |
| Breaker | `breaker.brickHit` | 50–150 | none, overlapping | one-shot | 1 per 50 ms, 3 voices |
| Breaker | `breaker.multiball` (one per spam ball) | up to 5 per tap | none | one-shot | 1 per 80 ms |
| Breaker / Rally | wall bounce (new) | 60–150 | — | one-shot, very short, volume 0.4 | 1 per 120 ms |
| Fission | `burst.shot` | 50–200 | none, overlapping | one-shot, volume 0.6 | 1 per 70 ms, 2 voices |
| Fission | `burst.hit` | 30–100 | none, overlapping | one-shot | 1 per 50 ms, 3 voices |
| Fission | floor bounce (new) | hundreds | — | one-shot, pitch by atom size, volume 0.35 | 1 per 100 ms |
| Pinball | `pinball.flipper` | 50–150 | none | one-shot | 1 per 60 ms per side |
| Pinball | `pinball.bumperHit` | 20–80 | none | one-shot | 1 per 50 ms, 3 voices |
| Jaywalk | `cross.hop` (a horn on every step) | 50–150 | none | own soft footstep file (batch 3), keep the horn for traffic | 1 per 90 ms |
| Bonk | `whack.popUp` | ~100–115 (doc says 30–60) | none | one-shot, very quiet | 1 per 120 ms |
| Bonk | `whack.sink` | 45–60 (doc says 5–20) | none | one-shot, or drop it for decoys | 1 per 200 ms |
| Mixed Signals | `stroop.lane` | 50–100 | none, overlapping | one-shot | 1 per 80 ms |
| Pull! | `clayshoot.missPuff` | up to 50 | none | one-shot, volume 0.5 | 1 per 150 ms |
| Gemstone | `arc_gem_match` + generic `combo` per cascade step | 30–100 + 10–40 | the chime pitches by depth | keep the chime, leave `combo` out for Gemstone | — |
| Orbit | `orbit.launch` + `orbit.planetCaught` pair | 40–80 together | none | keep `planetCaught` under 150 ms at volume 0.5 | 1 per 200 ms each |
| Grappler | `swing.jetBubble`, `swing.jetErupt` | likely above the doc's 5–20 | 1 per 300 ms | one-shot, only for jets on screen | 1 per 600 ms across all jets |
| Slice | `slice.cut` | 50–150 | 1 per 60 ms, overlapping | keep the cap | 3 voices |
| Slice | food thrown up (new) | ~100 | — | one-shot whoosh, volume 0.4 | 1 per 250 ms |
| Letterfall | letter `tick` | 70–120 | none | one-shot | fine as is (short) |
| Letterfall | tile lands (new) | ~40 | — | one-shot, very soft | 1 per 200 ms |
| Meteor | turn (new) | 20–60 | — | one-shot, very soft | 1 per 120 ms |
| Grappler | rope release (new) | 20–60 | — | one-shot, very soft | 1 per 150 ms |
| Tilt, Ball Tracker, Coral Pop, Orbit | `tilt.roll`, `balltrack.roll`, `bubble.waves`, `orbit.ambience` | continuous | loop | quiet loop, volume ≤ 0.4, under the music | one at a time |
| All new ambient loops (below) | — | continuous | — | quiet loop, volume 0.25–0.35, faded in over 500 ms and out at the end of the run | one loop per game |

## 4. Batch 3 – to make

One row per new recording. Prompts are original wording for ElevenLabs' sound-effects generator: they name no other
games, products or brands. "Loop" files must loop seamlessly (MP3, trimmed as the README says).

| # | Slot name | Game | Moment | Length | ElevenLabs prompt | Loop / one-shot |
|---|---|---|---|---|---|---|
| 1 | `hover.newHazard` | Hover | First two-gap or moving barrier scrolls in | 500 ms | Short rising two-note synth chirp with a faint digital warble, 8-bit style, alert but friendly | one-shot |
| 2 | `hover.hum` | Hover | Saucer lights and drifting stars | 4 s | Soft hovering spacecraft hum with a slow pulsing shimmer, low volume, chiptune texture, seamless loop | loop |
| 3 | `breaker.wallBounce` | Breaker | Ball bounces off a wall or the ceiling | 60 ms | Tiny dry retro bleep, single square-wave tick, very short | one-shot |
| 4 | `breaker.hotPaddle` | Breaker | Gold outline lights round the paddle at chain 10 | 400 ms | Bright 8-bit power-up shimmer rising quickly, warm golden tone | one-shot |
| 5 | `breaker.fireballLow` | Breaker | Fireball's last second | 1000 ms | Fizzing flame sputtering out with three quick descending retro blips | one-shot |
| 6 | `breaker.capsuleMissed` | Breaker | Power-up capsule falls past the paddle | 250 ms | Short downward 8-bit slide, deflated and soft, missed-chance sound | one-shot |
| 7 | `breaker.ballDrained` | Breaker | Extra ball falls off (not the last) | 250 ms | Quick falling chiptune blip into a soft thud, minor and light | one-shot |
| 8 | `breaker.rowsSlide` | Breaker | A row of bricks starts sliding | 600 ms | Mechanical retro grinding whir starting up, chiptune motor with a click | one-shot |
| 9 | `pinball.spinnerUnlit` | Pinball | Lit spinner insert goes dark | 300 ms | Electric light switching off with a soft descending buzz, vintage table machine | one-shot |
| 10 | `pinball.shooterReady` | Pinball | Ball waiting in the shooter lane | 400 ms | Two soft electromechanical chimes, inviting, ready-to-launch cue | one-shot |
| 11 | `pinball.lastBall` | Pinball | BALL 3/3 | 800 ms | Tense three-note electromechanical bell sting, last-chance feel | one-shot |
| 12 | `pinball.gameOver` | Pinball | All balls drained before time | 1500 ms | Descending electromechanical chime run ending in a low relay clunk, game over feel | one-shot |
| 13 | `pinball.nudge` | Pinball | Stuck ball rescued | 200 ms | Short solid table knock with a metal rattle | one-shot |
| 14 | `rally.wallBounce` | Rally | Ball off a side or far wall | 60 ms | (shares row 3's recording) | one-shot |
| 15 | `rally.bulbChase` | Rally | Gold bulbs chasing down the side casings | 3 s | Very soft ticking light-chase pattern, gentle electric clicks in a steady rhythm, seamless loop | loop |
| 16 | `rally.goldMissed` | Rally | Gold ball falls off unreturned | 300 ms | Bright coin tone that bends down and fades, disappointed chiptune | one-shot |
| 17 | `beat.comboLost` | Tempo | Combo of 10+ broken: glow bands vanish | 500 ms | Record-scratch style glitch into a short falling synth tone, rhythmic stumble | one-shot |
| 18 | `beat.swipeArrive` | Tempo | First swipe notes arrive (30 s) | 600 ms | Quick upward synth sweep with a sparkle, announces a new move, on-beat | one-shot |
| 19 | `beat.holdSustain` | Tempo | Hold beam held | 1 s | Steady glowing synth pad tone, soft and bright, seamless loop | loop |
| 20 | `snake.speedUp` | Meteor | Speed step on the 5th, 15th, 25th… star | 350 ms | Short accelerating chiptune arpeggio, three quick rising notes | one-shot |
| 21 | `snake.rockFalling` | Meteor | Rock sprite falls in before impact | 800 ms | Descending whistle of a small falling rock through air, retro-styled, ends just before impact | one-shot |
| 22 | `snake.turn` | Meteor | Swipe turns the comet | 40 ms | Barely audible soft retro tick | one-shot |
| 23 | `burst.atomBounce` | Fission | Atom bounces off the floor | 120 ms | Rubbery springy boing, short, retro synth, slightly bouncy | one-shot |
| 24 | `burst.ceilingTouch` | Fission | Ceiling flashes white | 150 ms | Short electric zap against metal, crisp, chiptune | one-shot |
| 25 | `burst.atomGone` | Fission | Smallest atom destroyed | 150 ms | Tiny crisp pop with a sparkle tail, final hit, 8-bit | one-shot |
| 26 | `burst.iconLost` | Fission | Power-up icon lost on the floor | 250 ms | (shares row 6's recording) | one-shot |
| 27 | `burst.lastLife` | Fission | Last life: ship icons dim | 900 ms | Low pulsing retro alarm, two slow beeps, danger, not panicked | one-shot |
| 28 | `burst.freezeLow` | Fission | FREEZE's last second | 1000 ms | Ice cracking with soft ticking, thaw about to happen | one-shot |
| 29 | `burst.vulnerable` | Fission | Hit-blink ends | 150 ms | Soft shield-down blip, short and neutral | one-shot |
| 30 | `wavefront.march` | Wavefront | Formation steps | 120 ms | Single deep bass synth thump, one note of a four-step marching bass line, dry | one-shot |
| 31 | `wavefront.rowDrop` | Wavefront | Formation drops a row | 300 ms | Heavy low descending synth thud, menacing, one step closer | one-shot |
| 32 | `wavefront.danger` | Wavefront | Formation within reach of the ship line | 2 s | Low urgent pulsing synth alarm, steady throb, seamless loop | loop |
| 33 | `wavefront.laserOut` | Wavefront | Laser shots run out | 300 ms | Energy beam powering down, falling synth whine, short | one-shot |
| 34 | `wavefront.saucerHum` | Wavefront | Saucer on screen | 2 s | Wobbling high-pitched alien craft warble, theremin-like, seamless loop | loop |
| 35 | `wavefront.saucerEscape` | Wavefront | Saucer leaves unshot | 500 ms | Warbling craft sound doppler-fading away to the side | one-shot |
| 36 | `wavefront.bossLow` | Wavefront | Boss health bar turns red | 700 ms | Damaged machine groan with sparking electrics, weakening giant | one-shot |
| 37 | `wavefront.space` | Wavefront | Stars and engine glow | 8 s | Distant deep-space drone, very soft, cold and wide, seamless loop | loop |
| 38 | `wavefront.fire` | Wavefront | Auto-fire (own file for the over-used stand-in) | 90 ms | Very soft short laser pew, light and airy, not harsh, quiet enough to repeat often | one-shot |
| 39 | `orbit.flyIn` | Orbit | Glide into orbit after a black hole | 900 ms | Smooth swooshing glide that settles into a soft resonant hum | one-shot |
| 40 | `orbit.holeArmed` | Orbit | Black hole rim brightens | 600 ms | Deep swirling bass rumble rising slightly, gravitational pull, ominous | one-shot |
| 41 | `orbit.newHazard` | Orbit | First figure-eight planet or asteroid belt | 700 ms | Spacey two-tone alert with a glassy shimmer, new obstacle ahead | one-shot |
| 42 | `orbit.sunNear` | Orbit | Approaching the sun (planet 40) | 2 s | Roaring solar flare whoosh building warmly, heat and light | one-shot |
| 43 | `swing.dragonNear` | Grappler | Dragon label grows, arrow turns red | 1000 ms | Close menacing dragon growl with a hot breath rasp | one-shot |
| 44 | `swing.dragonWings` | Grappler | Dragon wing-beats on screen | 1600 ms | Heavy leathery wing flaps, two beats, steady rhythm, seamless loop | loop |
| 45 | `swing.rockCrumble` | Grappler | Stalactite crumble build-up | 2000 ms | Trickling grit and small stones falling, growing louder, cave ceiling about to give | one-shot |
| 46 | `swing.release` | Grappler | Rope released | 120 ms | Soft rope whip whoosh, short | one-shot |
| 47 | `swing.finishGate` | Grappler | 500 m gold gate comes into view | 900 ms | Distant golden chime swell, hopeful, the end in sight | one-shot |
| 48 | `swing.lava` | Grappler | Lava waves, embers, drips | 6 s | Bubbling molten lava with low rumble and occasional hiss, cavern echo, seamless loop | loop |
| 49 | `cross.traffic` | Jaywalk | Traffic streaming | 8 s | Busy city road ambience, cars and lorries passing both ways, light bicycle whirr, seamless loop | loop |
| 50 | `cross.newHazard` | Jaywalk | New layout: cycle lane, roadworks or chicane | 600 ms | Friendly two-tone pedestrian crossing beep with a hint of caution | one-shot |
| 51 | `cross.go` | Jaywalk | Kerb pause ends | 300 ms | Quick crossing signal beep-beep, go | one-shot |
| 52 | `cross.blocked` | Jaywalk | Move refused by cones | 150 ms | Dull plastic traffic cone bump, short | one-shot |
| 53 | `cross.respawn` | Jaywalk | Walker back on the kerb | 400 ms | Light whoosh-in with a soft ding, back on your feet | one-shot |
| 54 | `cross.hop` | Jaywalk | Hop / side-step (own file for the over-used stand-in) | 80 ms | Single soft trainer footstep on pavement, light and quick | one-shot |
| 55 | `flip.speedUp` | Roofbound | Speed step every 3 s | 250 ms | Subtle rising whoosh, short, momentum building | one-shot |
| 56 | `flip.bendStart` | Roofbound | Tunnel starts bending (10 s) | 1200 ms | Deep stone groan and creak as a tunnel twists, rumbling | one-shot |
| 57 | `flip.bendTighten` | Roofbound | Bends tighten (45 s) | 1200 ms | Intensifying rumble with grinding rock and a rising tone, final stretch | one-shot |
| 58 | `flip.lava` | Roofbound | Lava pools, spouts, embers | 6 s | Rushing tunnel wind over bubbling lava pools, warm and steady, seamless loop | loop |
| 59 | `inkbridge.coinLand` | Rainbow Bridge | Coin lands on the rainbow | 200 ms | Light coin clink landing on glass, magical shimmer | one-shot |
| 60 | `inkbridge.coinRoll` | Rainbow Bridge | Coin rolling along the rainbow | 2 s | Gentle rolling coin with a soft sparkling glissando, seamless loop | loop |
| 61 | `inkbridge.rimBounce` | Rainbow Bridge | Coin bounces off the pot rim | 150 ms | Small metal coin pinging off an iron pot rim | one-shot |
| 62 | `inkbridge.liveLevel` | Rainbow Bridge | Live levels begin | 900 ms | Whimsical magical swell with harp flourish, a new challenge | one-shot |
| 63 | `inkbridge.drawing` | Rainbow Bridge | Drawing during a live drop | 2 s | Soft sparkling marker squeak with a faint rainbow chime shimmer, seamless loop | loop |
| 64 | `inkbridge.inkEmpty` | Rainbow Bridge | Ink meter empty (normal level) | 300 ms | Dry pen scratch that sputters out | one-shot |
| 65 | `slice.toss` | Slice | Food thrown up | 200 ms | Quick airy whoosh upward, light fruit toss | one-shot |
| 66 | `slice.fuse` | Slice | Chilli launched with a fizzing fuse | 600 ms | Short fizzing fuse hiss with crackles | one-shot |
| 67 | `slice.specialIn` | Slice | Special bottle appears | 400 ms | Glassy bottle clink with a magical sparkle, something special | one-shot |
| 68 | `slice.dropped` | Slice | Food falls unsliced | 150 ms | Soft muffled plop, quiet and short | one-shot |
| 69 | `slice.comboEnd` | Slice | Combo meter's last second, then empty | 600 ms | Quick ticking that winds down into a soft deflate | one-shot |
| 70 | `slice.powerEnd` | Slice | Frenzy, simmer or squeeze ends | 400 ms | Kitchen squeeze bottle sputter and a small descending pop | one-shot |
| 71 | `bintoss.throw` | Swish | Throw released | 200 ms | Ball whooshing out of a hand, light throw | one-shot |
| 72 | `bintoss.nextBall` | Swish | Next ball ready, bucket moves, wind changes | 500 ms | Fairground wind gust with a flag flutter and a bucket being set down | one-shot |
| 73 | `bintoss.newHazard` | Swish | Bucket narrows, spinner or trolley arrives | 600 ms | Funfair bell ding and a mechanical ratchet, the game gets harder | one-shot |
| 74 | `bullseye.nock` | Flightpath | Next arrow nocked | 250 ms | Arrow nocking onto a bowstring with a soft creak | one-shot |
| 75 | `bullseye.targetMoves` | Flightpath | Target drifts or ring values shuffle | 600 ms | Squeaky wheeled target rolling on a rail with a wooden clack | one-shot |
| 76 | `bullseye.balloonIn` | Flightpath | Balloon floats in | 500 ms | Rubber balloon squeak and gentle float, playful | one-shot |
| 77 | `bullseye.offBoard` | Flightpath | Arrow off the board | 300 ms | Arrow thudding into straw bale off target, dull and flat | one-shot |
| 78 | `bubble.rush` | Coral Pop | Rising bubble rush | 900 ms | Big underwater bubble stream rushing upward, fizzy and bright | one-shot |
| 79 | `bubble.wallBank` | Coral Pop | Shot banks off a side wall | 80 ms | Soft underwater tap against rock, muffled | one-shot |
| 80 | `bubble.reefLost` | Coral Pop | Reef reaches the gun | 1200 ms | Deep underwater rumble with a sinking descending tone, bubbles fading | one-shot |
| 81 | `snip.wasps` | Scrumper | Wasps circling a nest | 3 s | Small cluster of wasps buzzing around in circles, light, outdoors, seamless loop | loop |
| 82 | `snip.plankKnock` | Scrumper | Apple bounces or rolls on a plank or gutter | 150 ms | Apple tapping and rolling on a wooden plank, short | one-shot |
| 83 | `tilt.chaserRelease` | Tilt | Red chaser starts chasing | 500 ms | Marble rattling free and starting to roll with a short ominous tone | one-shot |
| 84 | `balltrack.countdown` | Ball Tracker | 5-4-3-2-1 countdown in the hopper | 150 ms | Single wooden toy tick-beep, warm, one count step | one-shot |
| 85 | `balltrack.hopperEmpty` | Ball Tracker | Hopper runs dry | 500 ms | Last marble rattling out of a wooden hopper, then a hollow knock | one-shot |
| 86 | `skyline.gustWarn` | High Rise | Flag streams before a gust | 1000 ms | Rising wind whistle with a flag starting to snap, building | one-shot |
| 87 | `skyline.gustEnd` | High Rise | Gust ends, flag goes limp | 500 ms | Wind dying down with a last flag flap | one-shot |
| 88 | `matchup.select` | Gemstone | Gem selected | 80 ms | Tiny crystal tick, clean and bright | one-shot |
| 89 | `matchup.specialMade` | Gemstone | Bomb, cross or star gem forged | 600 ms | Gem being forged with a magical rising chime and a crystal ring | one-shot |
| 90 | `wordfall.tileLand` | Letterfall | Tile drops in and lands | 100 ms | Soft wooden letter tile landing on a stack, light clack | one-shot |
| 91 | `wordfall.chainCut` | Letterfall | Chain cut back or restarted | 150 ms | Short soft reverse swipe, letters let go | one-shot |
| 92 | `whack.goldRun` | Bonk | Gold glow every 5 bonks in a row | 500 ms | Bright golden shimmer with a playful bell, streak reward | one-shot |
| 93 | `whack.hedgehogUp` | Bonk | Hedgehog pops up | 200 ms | Quick prickly rustle with a tiny squeak, careful-now cue | one-shot |
| 94 | `whack.emptyTap` | Bonk | Empty-hole tap (−3 points) | 150 ms | Hollow dull bonk on empty ground, short | one-shot |
| 95 | `clayshoot.escape` | Pull! | Clay escapes | 400 ms | Distant clay whooshing away out of range, fading | one-shot |
| 96 | `clayshoot.birdIn` | Pull! | Bird flies in | 500 ms | Small bird wing flutter passing by with a soft chirp | one-shot |
| 97 | `clayshoot.goldLaunch` | Pull! | Gold clay launches | 300 ms | Clay trap throw with a golden sparkle glint | one-shot |

Rows 14 and 26 reuse rows 3 and 6, so there are 95 recordings for 97 slots.

### mapping.csv (batch 3)

Batch 1's format (`file,cues`, cues separated by `;`); batch 2's sheet is not in the repo, so its exact format is
assumed to be the same. One file per recording, named after its slot, or after the recording when several slots share
it (README, step 2).

```csv
file,cues
hover.newHazard.mp3,hover.newHazard
hover.hum.mp3,hover.hum
retro.wallBounce.mp3,breaker.wallBounce;rally.wallBounce
breaker.hotPaddle.mp3,breaker.hotPaddle
breaker.fireballLow.mp3,breaker.fireballLow
retro.pickupMissed.mp3,breaker.capsuleMissed;burst.iconLost
breaker.ballDrained.mp3,breaker.ballDrained
breaker.rowsSlide.mp3,breaker.rowsSlide
pinball.spinnerUnlit.mp3,pinball.spinnerUnlit
pinball.shooterReady.mp3,pinball.shooterReady
pinball.lastBall.mp3,pinball.lastBall
pinball.gameOver.mp3,pinball.gameOver
pinball.nudge.mp3,pinball.nudge
rally.bulbChase.mp3,rally.bulbChase
rally.goldMissed.mp3,rally.goldMissed
beat.comboLost.mp3,beat.comboLost
beat.swipeArrive.mp3,beat.swipeArrive
beat.holdSustain.mp3,beat.holdSustain
snake.speedUp.mp3,snake.speedUp
snake.rockFalling.mp3,snake.rockFalling
snake.turn.mp3,snake.turn
burst.atomBounce.mp3,burst.atomBounce
burst.ceilingTouch.mp3,burst.ceilingTouch
burst.atomGone.mp3,burst.atomGone
burst.lastLife.mp3,burst.lastLife
burst.freezeLow.mp3,burst.freezeLow
burst.vulnerable.mp3,burst.vulnerable
wavefront.march.mp3,wavefront.march
wavefront.rowDrop.mp3,wavefront.rowDrop
wavefront.danger.mp3,wavefront.danger
wavefront.laserOut.mp3,wavefront.laserOut
wavefront.saucerHum.mp3,wavefront.saucerHum
wavefront.saucerEscape.mp3,wavefront.saucerEscape
wavefront.bossLow.mp3,wavefront.bossLow
wavefront.space.mp3,wavefront.space
wavefront.fire.mp3,wavefront.fire
orbit.flyIn.mp3,orbit.flyIn
orbit.holeArmed.mp3,orbit.holeArmed
orbit.newHazard.mp3,orbit.newHazard
orbit.sunNear.mp3,orbit.sunNear
swing.dragonNear.mp3,swing.dragonNear
swing.dragonWings.mp3,swing.dragonWings
swing.rockCrumble.mp3,swing.rockCrumble
swing.release.mp3,swing.release
swing.finishGate.mp3,swing.finishGate
swing.lava.mp3,swing.lava
cross.traffic.mp3,cross.traffic
cross.newHazard.mp3,cross.newHazard
cross.go.mp3,cross.go
cross.blocked.mp3,cross.blocked
cross.respawn.mp3,cross.respawn
cross.hop.mp3,cross.hop
flip.speedUp.mp3,flip.speedUp
flip.bendStart.mp3,flip.bendStart
flip.bendTighten.mp3,flip.bendTighten
flip.lava.mp3,flip.lava
inkbridge.coinLand.mp3,inkbridge.coinLand
inkbridge.coinRoll.mp3,inkbridge.coinRoll
inkbridge.rimBounce.mp3,inkbridge.rimBounce
inkbridge.liveLevel.mp3,inkbridge.liveLevel
inkbridge.drawing.mp3,inkbridge.drawing
inkbridge.inkEmpty.mp3,inkbridge.inkEmpty
slice.toss.mp3,slice.toss
slice.fuse.mp3,slice.fuse
slice.specialIn.mp3,slice.specialIn
slice.dropped.mp3,slice.dropped
slice.comboEnd.mp3,slice.comboEnd
slice.powerEnd.mp3,slice.powerEnd
bintoss.throw.mp3,bintoss.throw
bintoss.nextBall.mp3,bintoss.nextBall
bintoss.newHazard.mp3,bintoss.newHazard
bullseye.nock.mp3,bullseye.nock
bullseye.targetMoves.mp3,bullseye.targetMoves
bullseye.balloonIn.mp3,bullseye.balloonIn
bullseye.offBoard.mp3,bullseye.offBoard
bubble.rush.mp3,bubble.rush
bubble.wallBank.mp3,bubble.wallBank
bubble.reefLost.mp3,bubble.reefLost
snip.wasps.mp3,snip.wasps
snip.plankKnock.mp3,snip.plankKnock
tilt.chaserRelease.mp3,tilt.chaserRelease
balltrack.countdown.mp3,balltrack.countdown
balltrack.hopperEmpty.mp3,balltrack.hopperEmpty
skyline.gustWarn.mp3,skyline.gustWarn
skyline.gustEnd.mp3,skyline.gustEnd
matchup.select.mp3,matchup.select
matchup.specialMade.mp3,matchup.specialMade
wordfall.tileLand.mp3,wordfall.tileLand
wordfall.chainCut.mp3,wordfall.chainCut
whack.goldRun.mp3,whack.goldRun
whack.hedgehogUp.mp3,whack.hedgehogUp
whack.emptyTap.mp3,whack.emptyTap
clayshoot.escape.mp3,clayshoot.escape
clayshoot.birdIn.mp3,clayshoot.birdIn
clayshoot.goldLaunch.mp3,clayshoot.goldLaunch
```

### Carry-over: existing silent slots

The arcade-stage slots marked **silent, batch 2 ?** in section 1 already have hooks; they need only a file. There are
124: the 125 effect cues in [arcade-effects.md](arcade-effects.md) less the seven shared stand-ins, plus
`tendrop.apply`, `tendrop.refused` (the shared `tick` plays there), `clayshoot.shatter`, `clayshoot.goldShatter`, `clayshoot.goldSparkle` and `stroop.gatePulse`. Once
batch 2's mapping is known, add any it leaves out to batch 3. Their trigger, look and length are already in
arcade-effects.md and the cue sheet (`bun scripts/sound-cue-sheet.ts` lists them as `silent`).

## 5. Puzzle games (shorter audit)

Source: [puzzle-move-cues.md](puzzle-move-cues.md) (16 Oct 2026), checked against the stages. `FeedbackStage` plays
`move` (60 ms throttle) whenever a puzzle's draft answer changes; `puzzleReject()` (`src/lib/fx/puzzleReject.ts`)
shakes the board and **never plays audio**.

### Move cues and their status

- **Already sounded (47 cues).** These play `move`, `tick`, `place`, `lock`, `correct`, `wrong`, `stage_complete` or
  their own recording at that moment. Their own named slots are silent (batch 2 ?), but nothing is missing for the
  player.
- **Truly silent (24 cues), with a hook but no file:**
  - `numline.sweepTick`
  - `measure.select`
  - `checkout.aim`, `checkout.tick` (Undo)
  - `balance.select`
  - `target.select`, `target.combine`
  - `tendrop.apply`
  - `spotdiff.nextPicture`
  - `symscan.revealGrid`
  - `unblock.slide`
  - `blockparty.place`, `blockparty.turn`, `blockparty.flip`
  - `tower.lift`
  - `tubes.lift`
  - `safe.click`
  - `lightup.clear`
  - `nonogram.clear`
  - `tents.clear`
  - `clayshoot.goldSparkle`
  - `warning_5` (silent by design)

  All are silent, batch 2 ?. The ones a player would most notice are:
  - Tessellate's place, turn and flip
  - Gridlock's slide
  - Hanoi and Polypotions' lift
  - Safe Cracker's dial click

### Puzzle moments with no cue at all

| Moment | Games | Note |
|---|---|---|
| Invalid move shake (`puzzleReject`) | Operator (wrong try), Chroma Lines (illegal drag step), Labyrinth (wall), Lamplighter (tap on a wall), Counterweight (notch taken), Slider (locked row), Jumbled (tile can't move), Heave (blocked step), Cryptogrid (letter already given) | one shared reject sound covers all nine; other games' shakes already play `wrong` |
| "That number is given" message | Cryptogrid | covered by the same reject sound if the message gets the shake too |
| Wrong tap: red disc flash | Ascend | plays only `move`; play the existing `wrong` (code only, no file) |
| Discs reshuffle with a pulse (3 a round) | Ascend | new slot |
| FASTER banner | Don't Break the Chain | new slot |
| ← REVERSE flash | Don't Break the Chain | new slot |
| "Reverse after link N!" warning banner | Don't Break the Chain | new slot |
| Gold flash and decoys appearing | Flash | **keep silent**: a sound would give the moment away |
| Box Six pencil marks | Box Six | keep silent, or reuse `move` softly; marks are not part of the answer |

### Puzzle moves that fire very often

| Game | What | Suggest | Cap |
|---|---|---|---|
| Don't Break the Chain | `chain.linkTone` **and** `move` on every tap (two sounds) | leave `move` out for this stage; the link tone alone carries the tap | — |
| Chroma Lines, Labyrinth, Trail | `move` on every cell crossed while dragging (~16 a second) | one-shot, softer | 1 per 100 ms |
| Trail, Heave | the game's step cue plus `move` on every step | once the step cue has a file, leave `move` out on that frame | 1 per 90 ms |
| Ballpark | `tick` + `place` + `move` on every Place (15 a round) | drop `move` there | — |
| Safe Cracker | `safe.click` repeats while a dial is held | very short tick, volume 0.4 | 1 per 70 ms |
| Pipeline, Blackout, Eagle Eye | one `move` per tap, 20–60 a round | fine as is | — |

### Puzzle batch 3 rows

| # | Slot name | Game | Moment | Length | ElevenLabs prompt | Loop / one-shot |
|---|---|---|---|---|---|---|
| P1 | `shared.reject` | Nine puzzles (above) | Invalid move shake | 150 ms | Soft muted wooden double-knock, gentle no, not harsh | one-shot |
| P2 | `numhunt.reshuffle` | Ascend | Discs reshuffle | 500 ms | Quick shuffle of light plastic discs sliding, with a soft swish | one-shot |
| P3 | `chain.faster` | Don't Break the Chain | FASTER banner | 500 ms | Short upbeat accelerating tick run, tempo increasing | one-shot |
| P4 | `chain.reverse` | Don't Break the Chain | REVERSE flash | 400 ms | Tape-rewind style reverse whoosh, short and clear | one-shot |
| P5 | `chain.reverseWarn` | Don't Break the Chain | "Reverse after link N!" banner | 400 ms | Two quick soft warning pips, heads-up | one-shot |

```csv
file,cues
shared.reject.mp3,shared.reject
numhunt.reshuffle.mp3,numhunt.reshuffle
chain.faster.mp3,chain.faster
chain.reverse.mp3,chain.reverse
chain.reverseWarn.mp3,chain.reverseWarn
```

## Next steps (not in this PR)

1. Compare this audit against batch 2's mapping sheet once it is in hand. Strike the silent slots batch 2 fills, and
   move the rest into batch 3.
2. Code PR for batch 3's hooks:
   - an `effectCue()` / `liveCue()` call per new slot, with the caps in section 3;
   - manifest slots, rows in arcade-effects.md and the cue-sheet refresh;
   - `shared.reject` in `puzzleReject()` (presentation only, demos hushed).

   Presentation only: no sim, score, timing or stamp changes.
3. Correct the doc counts for `whack.popUp` (about 100–115 a round, not 30–60), `whack.sink` (45–60, not 5–20),
   `wavefront.fire` (~250 in 90 s, not "100+") and `inkbridge.goldStar` (rev 4 only).
