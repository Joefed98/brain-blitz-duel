# Arcade sound gaps, Oct 2026

Audit of 16 Oct 2026, docs only: no code, slot or file changes. It aims for **every noticeable visual moment in the
22 arcade games having a sound**. It also covers the five engine games on the arcade stage (Letterfall, Tenfall, Bonk,
Pull!, Mixed Signals) and, more briefly, the puzzle games. Updated 16 Oct 2026 with sound batch 2's mapping
([batch2-mapping.csv](batch2-mapping.csv)) and a cut-down, ranked batch 3.

Sources:

- the cue docs: [arcade-effects.md](arcade-effects.md), [arcade.md](arcade.md), [puzzle-move-cues.md](puzzle-move-cues.md)
  and [cue-sheet.csv](cue-sheet.csv);
- the code that plays them: `src/lib/fx/gameSounds.ts`, `src/lib/fx/momentCues.ts`, the engine stages in `src/puzzles/`
  and `src/lib/fx/manifest.ts`;
- every renderer and sim in `src/lib/arcade/`, read for anything drawn that changes, appears, blinks or moves.

Counts per round are estimates from the sims' constants, not measured play. They use the revision rooms deal today
(`src/lib/duel/arcade.server.ts`).

## Assumptions

- **Batch 2** is Joe's mapping sheet, kept outside the repo until now and saved here as
  [batch2-mapping.csv](batch2-mapping.csv).
  - It has 54 rows: 42 effect recordings, 5 voice lines and 7 `EXISTING:` rows that point slots at app-wide sounds.
  - It covers 137 effect cues. That includes 118 of the 124 arcade-stage slots that were silent, and 18 puzzle slots.
  - Section 1 names the batch 2 file for each slot it covers, and says **none** where it doesn't.
  - Treated as given: the files themselves are not in the repo yet, and no manifest `url` points at them yet.
- **Batch 2 leaves six arcade-stage slots without a file.** Five are already heard through a shared sound on the same
  frame:
  - `tendrop.refused` (`tick`)
  - `clayshoot.shatter` and `clayshoot.goldShatter` (`pz_clay_hit`)
  - `clayshoot.goldSparkle` (the tail of `clayshoot.finalBurst`)
  - `stroop.gatePulse` (`pz_clash_*`)

  These five stay as they are. The sixth, `bintoss.hoopGlow`, is truly silent, so batch 3 takes it.
- **Batch 3 is the moments with no cue at all**, plus `bintoss.hoopGlow`, plus own files for two over-used stand-ins
  (`cross.hop`, `wavefront.fire`).
  - It was cut down the way batch 2 was: alike moments share one recording, and existing recordings are reused wherever
    they fit.
  - Each new slot still needs a hook in code: an `effectCue()` / `liveCue()` call, a manifest slot and a row in
    arcade-effects.md. That is a later code PR, not this one.
  - A shared recording sometimes needs a different playback rate or volume per slot (`wavefront.rowDrop` on the march
    file played lower, `burst.atomBounce` pitched by atom size). That is set when wiring, as `sfx()` already allows.
- **New slot names** follow the README: `<gameId>.<event>`, lower camelCase, and never a replay cue name.
  - Puzzle slots use the existing prefixes (`chain.`, `numhunt.`), and `shared.` for the shared reject shake.
  - Recordings shared by several slots are named after the recording (`alert.newHazard.mp3`), as in batch 2.
- **The shared every-5 milestone glow is not a gap.** `successFrame` in `success.renderer.ts` (border glow and HUD
  pop) always starts on a frame that already plays that game's hit, pop or home sound, so it counts as covered.
- **Low time is covered.** `TimerBar` plays `warning_tick` / `warning_tick_final` in the last 10 s of every timed
  screen, the arcade header included.
- **Some moments are left silent on purpose:**
  - continuous moments too dense to sound one by one (cell steps, falling notes, tile spawns, word spawns);
  - moments where a sound would give away the answer (Flash's decoys);
  - moments the effects doc already leaves silent (Gemstone's falling gems).

  These are listed as *keep silent*, with the reason.
- **Tables start with a moment or a row number, never a cue id.** `scripts/sound-cue-sheet.ts` reads every table in
  `docs/sound-cues/*.md` whose first cell looks like a cue id, so this keeps the proposed slots out of the cue sheet for
  now. It reads only `.md` files, so `batch2-mapping.csv` is not read either.

**Status key:**

- **own file**: the slot has its own recording.
- **shared: `x`**: the slot plays app-wide recording `x` as a stand-in.
- **batch 2: `file`**: batch 2 gives the slot that recording. **batch 2: existing `x`** means batch 2 points the slot at
  app-wide sound `x`.
- **none**: the slot has a hook but neither batch 1 nor batch 2 gives it a file (the reason is given).
- **no cue**: nothing is dispatched. Batch 3 (section 4) covers the moment.
- **keep silent**: deliberately left without a sound (reason given).

## 1. Arcade games: every moment and its cue

### Hover

| Moment | Cue | Status |
|---|---|---|
| Tap lifts the saucer (thruster puff) | `arc_hover_tap` | own file |
| Barrier passed (white pulse) | `hover.gate` | shared: `arc_retro_note` |
| Gold star collected | `hover.star` | shared: `arc_retro_coin` |
| Crash | `hover.crash` | shared: `arc_retro_explode` |
| New zone every 7th barrier: border flash, STREAK | `hover.newZone` | batch 2: `banner.streak.mp3` |
| Through a two-gap barrier | `hover.twoGap` | batch 2: `pop.bonus.mp3` |
| Past a moving barrier (near miss) | `hover.slippedThrough` | batch 2: `pop.bonus.mp3` |
| Every barrier passed: FULL CLEAR | `hover.allBarriers` | batch 2: `banner.fullClear.mp3` |
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
| Brick destroyed (pixel burst) | `breaker.brickBreak` | batch 2: `retro.brickBreak.mp3` |
| Every 10th brick: STREAK | `breaker.bricksStreak` | batch 2: `banner.streak.mp3` |
| Brick out of a sliding row | `breaker.movingTarget` | batch 2: `pop.bonus.mp3` |
| Row cleared: ROW CLEAR!, bulbs chase the border | `breaker.rowClear` | batch 2: `banner.clear.mp3` |
| Wall cleared: bulb chase, shake | `breaker.wallCleared` | batch 2: `banner.fullClear.mp3` |
| Power-up capsule drops | `breaker.capsuleDrop` | batch 2: `retro.itemDrop.mp3` |
| Power-up caught | `breaker.powerUp` | shared: `arc_retro_pickup` |
| Fireball lit | `breaker.fireballLit` | shared: `arc_retro_coin` |
| Fireball runs out | `breaker.fireballOut` | batch 2: `retro.powerDown.mp3` |
| Laser | `breaker.laser` | shared: `arc_laser_beam` |
| Multiball / spam ball added | `breaker.multiball` | shared: `arc_multiball` |
| Paddle bounce | `breaker.paddle` | shared: `arc_retro_blip` |
| Ball lost | `breaker.ballLost` | shared: `arc_retro_explode` |
| Relaunch after the pause | `breaker.relaunch` | batch 2: existing `arc_retro_blip` |
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
| SPINNER! rip | `pinball.spinnerRip` | batch 2: `pinball.spinnerRip.mp3` |
| Drop-target bank pops back up | `pinball.bankReset` | batch 2: existing `arc_latch` |
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
| Every 10th return: STREAK; ball turns gold / orange | `rally.longRally` | batch 2: `banner.streak.mp3` |
| Gold ball hits a far-wall pad | `rally.targetHit` | batch 2: `pop.perfect.mp3` |
| Bumper bounce | `rally.bumperBounce` | batch 2: existing `arc_bounce` |
| Gold ball enters | `rally.goldEnter` | batch 2: `retro.appear.mp3` |
| BUMPER warning blinks | `rally.bumperWarn` | batch 2: `ui.warn.mp3` |
| Bumper appears | `rally.bumperIn` | batch 2: `retro.appear.mp3` |
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
| COMBO ×n every 10 | `beat.comboTen` | batch 2: `banner.streak.mp3` |
| Combo 25: pink glow tier | `beat.comboTier` | batch 2: `banner.combo.mp3` |
| Swipe note hit | `beat.swipeHit` | batch 2: `pop.bonus.mp3` |
| Full combo | `beat.fullCombo` | batch 2: `banner.fullClear.mp3` |
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
| Every 10th star: STREAK, palette shift | `snake.starsStreak` | batch 2: `banner.streak.mp3` |
| Shower dodged: PERFECT | `snake.showerDodged` | batch 2: `pop.perfect.mp3` |
| Every star eaten | `snake.allEaten` | batch 2: `banner.fullClear.mp3` |
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
| Wave cleared on the last life | `burst.lastLifeWave` | batch 2: `banner.clear.mp3` |
| Flawless finish | `burst.flawlessFinish` | batch 2: `banner.fullClear.mp3` |
| Power-up icon drops | `burst.iconDrop` | batch 2: `retro.itemDrop.mp3` |
| Shield breaks | `burst.shieldBreak` | batch 2: `retro.shieldBreak.mp3` |
| FREEZE thaws | `burst.thaw` | batch 2: `retro.powerDown.mp3` |
| New wave drops in, ceiling steps down | `burst.newWave` | batch 2: `retro.appear.mp3` |
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
| Saucer down, wave cleared, diver down, boss streak, boss down | `wavefront.saucerDown`, `.waveCleared`, `.diverDown`, `.bossStreak`, `.bossDown` | batch 2: `pop.perfect.mp3` (saucerDown), `banner.clear.mp3` (waveCleared), `pop.bonus.mp3` (diverDown), `banner.streak.mp3` (bossStreak), `banner.fullClear.mp3` (bossDown) |
| Saucer enters, laser drops, armour plate off, enemy fires | `wavefront.saucerEnter`, `.laserDrop`, `.armourHit`, `.enemyFire` | batch 2: `retro.saucerEnter.mp3` (saucerEnter), `retro.itemDrop.mp3` (laserDrop), existing `arc_retro_hit` (armourHit), `retro.enemyFire.mp3` (enemyFire) |
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
| Caught by a planet | `orbit.planetCaught` | batch 2: `orbit.planetCatch.mp3` |
| First checkpoint | `orbit.checkpoint` | shared: `arc_pickup` |
| Respawn / crash | `orbit.crash` | shared: `arc_crash` |
| Black hole jump | `orbit.blackHole` | shared: `pz_gravity_pull` |
| Shooting star, STREAK, all planets | `orbit.shootingStar`, `.planetsStreak`, `.allPlanets` | batch 2: `orbit.shootingStar.mp3` (shootingStar), `banner.streak.mp3` (planetsStreak), `banner.fullClear.mp3` (allPlanets) |
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
| 100 m STREAK, past lava, 500 m finish | `swing.distanceStreak`, `.overLava`, `.finishLine` | batch 2: `banner.streak.mp3` (distanceStreak), `pop.bonus.mp3` (overLava), `banner.fullClear.mp3` (finishLine) |
| Stalactite drops, jet bubbles, jet erupts | `swing.rockFall`, `.jetBubble`, `.jetErupt` | batch 2: `cave.rockCrumble.mp3` (rockFall), `cave.lavaBubble.mp3` (jetBubble), `cave.lavaErupt.mp3` (jetErupt) |
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
| Past the bikes / through the roadworks | `cross.pastBikes`, `cross.pastRoadworks` | batch 2: `pop.bonus.mp3` |
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
| STREAK, SURVIVED!, all stars, JUST IN TIME!, crack, collapse | `flip.surviveStreak`, `.survivedFinish`, `.allStars`, `.justInTime`, `.crackStart`, `.collapse` | batch 2: `banner.streak.mp3` (surviveStreak), `banner.fullClear.mp3` (survivedFinish), `pop.perfect.mp3` (allStars), `pop.perfect.mp3` (justInTime), `cave.stoneCrack.mp3` (crackStart), `cave.rockCrumble.mp3` (collapse) |
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
| Gold star | `inkbridge.goldStar` | batch 2: `pop.perfect.mp3` (see note 2) |
| All levels, release, fail, ink out, reject | `inkbridge.allLevels`, `.release`, `.fail`, `.inkOut`, `.reject` | batch 2: `banner.fullClear.mp3` (allLevels), `marble.release.mp3` (release), `move.softFall.mp3` (fail), `ui.nope.mp3` (inkOut), `ui.nope.mp3` (reject) |
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
| 25 SLICED, many in one | `slice.slicedStreak`, `slice.manyInOne` | batch 2: `banner.streak.mp3` (slicedStreak), `banner.combo.mp3` (manyInOne) |
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
| In a row, hoop swish, spinner basket, hoop glow, spinner knock | `bintoss.inARow`, `.hoopSwish`, `.spinnerBasket`, `.hoopGlow`, `.spinnerKnock` | batch 2: `banner.combo.mp3` (inARow), `pop.perfect.mp3` (hoopSwish), `pop.bonus.mp3` (spinnerBasket), none (hoopGlow), existing `arc_wood_knock` (spinnerKnock) |
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
| Inner bull, bulls in a row, all on target, arrow thrown | `bullseye.innerBull`, `.bullsRow`, `.allOnTarget`, `.dartThrow` | batch 2: `pop.perfect.mp3` (innerBull), `banner.combo.mp3` (bullsRow), `banner.fullClear.mp3` (allOnTarget), `arrow.whoosh.mp3` (dartThrow) |
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
| Big pop, big drop, reef cleared, reef descends, shot sticks | `bubble.bigPop`, `.bigDrop`, `.reefCleared`, `.descend`, `.stick` | batch 2: `banner.combo.mp3` (bigPop), `pop.perfect.mp3` (bigDrop), `banner.fullClear.mp3` (reefCleared), `cave.rockCrumble.mp3` (descend), `sea.bubbleStick.mp3` (stick) |
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
| All apples fed | `snip.allApples` | batch 2: `banner.fullClear.mp3` |
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
| All mazes, chaser falls | `tilt.allMazes`, `tilt.chaserFall` | batch 2: `banner.fullClear.mp3` (allMazes), `move.softFall.mp3` (chaserFall) |
| Red chaser starts chasing | — | **no cue** (same frame as `tilt.gate`, but a different moment) |

### Ball Tracker

| Moment | Cue | Status |
|---|---|---|
| Roll | `balltrack.roll` | shared: `arc_marble_roll` (loop) |
| Switch / tube turn | `balltrack.switch` | shared: `arc_latch` |
| Marble home, cup flash | `balltrack.marbleHome` | shared: `arc_marble_clink` |
| Wrong cup | `balltrack.wrong` | shared: `arc_wood_knock` |
| Home streak, all home, turned home, switched home, release, lost, shuffle | `balltrack.homeStreak`, `.allHome`, `.turnedHome`, `.switchedHome`, `.release`, `.lost`, `.shuffle` | batch 2: `banner.streak.mp3` (homeStreak), `banner.fullClear.mp3` (allHome), `pop.perfect.mp3` (turnedHome), `pop.perfect.mp3` (switchedHome), `marble.release.mp3` (release), `move.softFall.mp3` (lost), `cups.shuffle.mp3` (shuffle) |
| 5-4-3-2-1 countdown in the hopper (before relay, before shuffle) | — | **no cue** |
| Hopper runs dry | — | **no cue** |

### High Rise

| Moment | Cue | Status |
|---|---|---|
| Block lands | `skyline.drop` | shared: `arc_clank` |
| Perfect drop | `skyline.perfect` | shared: `correct` |
| Streak drop | `skyline.streakDrop` | shared: `arc_retro_coin` |
| Miss | `skyline.miss` | shared: `arc_crash` |
| Floors streak, wind flag up, perfect in the wind, gust blows | `skyline.floorsStreak`, `.windFlag`, `.windPerfect`, `.gust` | batch 2: `banner.streak.mp3` (floorsStreak), `sky.gust.mp3` (windFlag), `pop.perfect.mp3` (windPerfect), `sky.gust.mp3` (gust) |
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
| Line of five, jackpot made, par smashed, swap, invalid swap, hint | `matchup.lineOfFive`, `.jackpotMade`, `.parSmashed`, `.swap`, `.invalid`, `.hint` | batch 2: `banner.combo.mp3` (lineOfFive), `pop.jackpotGem.mp3` (jackpotMade), `banner.fullClear.mp3` (parSmashed), `move.slide.mp3` (swap), `ui.nope.mp3` (invalid), `ui.hint.mp3` (hint) |
| Gem selected | — | **no cue** |
| Bomb / cross / star gem forged | — | **no cue** (only the jackpot has a "made" cue) |
| Gems falling into place | — | keep silent: the effects doc's choice, the chimes step with it |

### Engine games on the arcade stage

| Moment | Cue | Status |
|---|---|---|
| Letterfall: word made / not a word / letter added | `correct` / `wrong` / `tick` | own file |
| Letterfall: long word, par reached, column danger | `wordfall.longWord`, `.parReached`, `.danger` | batch 2: `banner.combo.mp3` (longWord), `banner.clear.mp3` (parReached), `ui.warn.mp3` (danger) |
| Letterfall: end shimmer | `wordfall.finish` | own file |
| Letterfall: tile drops in and lands | — | **no cue** |
| Letterfall: chain cut back or restarted | — | **no cue** |
| Letterfall: drop speed step every 18 s | — | keep silent until it is drawn |
| Tenfall: ten made, reset | `tendrop.clear`, `tendrop.reset` | own file |
| Tenfall: tile applied, next target | `tendrop.apply`, `tendrop.nextTarget` | batch 2: existing `place` (apply), `move.appear.mp3` (nextTarget) |
| Tenfall: ÷ or − tile refused | `tendrop.refused` (+ shared `tick`) | none (the shared `tick` plays) |
| Tenfall: tile spawns, falls off unplayed, empty-lane tap | — | keep silent: 100+ a round, or nothing drawn |
| Bonk: bonk / wrong / rule flip | `correct` / `wrong` / `tick` | own file |
| Bonk: hedgehog (bomb) tapped | `whack.bomb` | shared: `arc_retro_explode` |
| Bonk: finale | `whack.finale` | own file |
| Bonk: 10 bonks, 20 clean, gopher up, gopher sinks | `whack.bonkStreak`, `.cleanTwenty`, `.popUp`, `.sink` | batch 2: `banner.streak.mp3` (bonkStreak), `banner.combo.mp3` (cleanTwenty), `bonk.popUp.mp3` (popUp), `move.softFall.mp3` (sink) |
| Bonk: gold glow every 5 bonks in a row on gold | — | **no cue** |
| Bonk: hedgehog pops up | — | **no cue** (plays the generic pop-up) |
| Bonk: empty-hole tap costs 3 points | — | **no cue** (nothing drawn either) |
| Pull!: shot, clay hit, gold clay hit, bird, final burst | `tick`, `pz_clay_hit` + `clayshoot.shatter` / `.goldShatter`, `.birdStartle`, `.finalBurst` | own file (`clayshoot.shatter`: none, `pz_clay_hit` plays) |
| Pull!: clays streak, double, launch, miss puff, gold sparkle | `clayshoot.claysStreak`, `.doubleHit`, `.launch`, `.missPuff`, `.goldSparkle` | batch 2: `banner.streak.mp3` (claysStreak), `banner.combo.mp3` (doubleHit), `clay.launch.mp3` (launch), `clay.missPuff.mp3` (missPuff), none (goldSparkle: the tail of `clayshoot.finalBurst` plays) |
| Pull!: clay escapes (HUD pip turns red) | — | **no cue** |
| Pull!: bird flies in | — | **no cue** |
| Pull!: gold clay launches (glinting) | — | **no cue** (plays the generic launch) |
| Mixed Signals: lane, right, wrong gate | `stroop.lane`, `.right`, `.wrong` | shared: `pz_clash_*` |
| Mixed Signals: gates flash at the end | `stroop.gatesFlash` | own file |
| Mixed Signals: sorted streak, rule flash, lanes grow, drop, gate pulse | `stroop.sortedStreak`, `.ruleFlash`, `.lanesGrow`, `.drop`, `.gatePulse` | batch 2: `banner.streak.mp3` (sortedStreak), `signals.ruleChange.mp3` (ruleFlash), `move.appear.mp3` (lanesGrow), `signals.whoosh.mp3` (drop), none (gatePulse: `pz_clash_right` / `pz_clash_wrong` play) |
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

**Caps for the wiring prompt.** No code changes here. These six are the ones to add when batch 3 is wired, each with
a minimum gap between plays (a play inside the gap is dropped) and a limit on overlapping voices:

- `wavefront.fire`: at most 1 per 120 ms, 2 voices, one sound per volley (not per bolt), volume 0.5, on the new soft
  file.
- `breaker.brickHit`: at most 1 per 50 ms, 3 voices.
- `burst.shot`: at most 1 per 70 ms, 2 voices, volume 0.6.
- `burst.hit`: at most 1 per 50 ms, 3 voices.
- `cross.hop`: at most 1 per 90 ms, on the new soft footstep file.
- `whack.popUp`: at most 1 per 120 ms, very quiet. It fires about 100–115 times a round, not the 30–60 the effects doc
  says.

The table below has the full list, including the caps for batch 3's own frequent slots: wall and floor bounces, march,
toss, tile landing, turn and rope release.

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

Cut down the way batch 2 was: alike moments share one recording, and batch 1, batch 2 and app-wide recordings are
reused wherever they fit. **36 new recordings (19 must-have, 17 nice-to-have) and 53 reuses cover
103 cues** (50 on new recordings, 53 on existing ones): every moment in section 2, the five puzzle moments in
section 5, and `bintoss.hoopGlow`, the one silent arcade slot with a hook that batch 2 left out. Batch 2, for comparison,
covered 137 effect cues with 42 recordings and 7 existing ones.

Own recordings are kept only where the moment needs its own character: Meteor's incoming asteroids, Wavefront's
march, the ambient loops, Pinball's last ball and game over, the two stand-in replacements (`cross.hop`,
`wavefront.fire`), and a few that no existing sound fits: the dragon, the fuse, the bubble rush, the hedgehog, the bird.

**Rank.** *Must* = frequent (dozens a round) or important to play: a danger, a loss, a speed-up, a new hazard, a hidden
penalty, or a game with no ambience at all. *Nice* = everything else. Make the must-haves first; the slots of a
nice-to-have recording stay silent until it exists.

### New recordings

Prompts are original wording for ElevenLabs' sound-effects generator and name no other games, products or brands.
Loops must loop seamlessly (MP3, trimmed as the README says). Must-haves first.

| # | Rank | Recording | Slot names | Game | Moment | Length | ElevenLabs prompt | Loop / one-shot |
|---|---|---|---|---|---|---|---|---|
| 1 | must | `wavefront.fire.mp3` | `wavefront.fire` | Wavefront | Auto-fire (own file for the over-used `arc_blaster` stand-in) | 90 ms | Very soft short laser pew, light and airy, not harsh, quiet enough to repeat often | one-shot |
| 2 | must | `cross.hop.mp3` | `cross.hop` | Jaywalk | Hop / side-step (own file for the over-used `arc_honk` stand-in) | 80 ms | Single soft trainer footstep on pavement, light and quick | one-shot |
| 3 | must | `wavefront.march.mp3` | `wavefront.march`<br>`wavefront.rowDrop` | Wavefront | Formation march step<br>Formation drops a row (same file played lower) | 120 ms | Single deep bass synth thump, one note of a four-step marching bass line, dry | one-shot |
| 4 | must | `snake.rockFalling.mp3` | `snake.rockFalling` | Meteor | Incoming asteroid falls in before impact | 800 ms | Descending whistle of a small falling rock through air, retro-styled, ends just before impact | one-shot |
| 5 | must | `retro.wallBounce.mp3` | `breaker.wallBounce`<br>`rally.wallBounce`<br>`burst.ceilingTouch` | Breaker, Rally, Fission | Ball off a wall or the ceiling<br>Ball off a side or far wall<br>Atom touches the ceiling (white flash) | 60 ms | Tiny dry retro bleep, single square-wave tick, very short | one-shot |
| 6 | must | `retro.atomBounce.mp3` | `burst.atomBounce` | Fission | Atom bounces off the floor | 120 ms | Rubbery springy boing, short, retro synth, slightly bouncy | one-shot |
| 7 | must | `alert.newHazard.mp3` | `hover.newHazard`<br>`breaker.rowsSlide`<br>`beat.swipeArrive`<br>`orbit.newHazard`<br>`cross.newHazard`<br>`inkbridge.liveLevel`<br>`bintoss.newHazard` | Hover, Breaker, Tempo, Orbit, Jaywalk, Rainbow Bridge, Swish | First two-gap or moving barrier<br>Rows 3 and 7 start sliding<br>First swipe notes (30 s)<br>First figure-eight planet or belt<br>New layout: cycle lane, roadworks, chicane<br>Live levels begin<br>Bucket narrows, spinner or trolley arrives | 600 ms | Friendly two-tone heads-up chime with a short rising sparkle, something new is coming, alert but not alarming | one-shot |
| 8 | must | `combo.lost.mp3` | `beat.comboLost`<br>`slice.comboEnd` | Tempo, Slice | Combo of 10+ broken<br>Combo meter runs out | 500 ms | Short glitchy stumble into a falling synth tone, a streak breaking, light not harsh | one-shot |
| 9 | must | `speed.up.mp3` | `snake.speedUp`<br>`flip.speedUp`<br>`chain.faster` | Meteor, Roofbound, Don't Break the Chain | Speed step on the 5th, 15th, 25th… star<br>Speed step every 3 s<br>FASTER banner | 350 ms | Short accelerating three-note rising arpeggio with a quick whoosh, momentum building | one-shot |
| 10 | must | `pinball.lastBall.mp3` | `pinball.lastBall` | Pinball | BALL 3/3 | 800 ms | Tense three-note electromechanical bell sting, last-chance feel | one-shot |
| 11 | must | `pinball.gameOver.mp3` | `pinball.gameOver` | Pinball | All balls drained before time | 1500 ms | Descending electromechanical chime run ending in a low relay clunk, game over feel | one-shot |
| 12 | must | `wavefront.danger.mp3` | `wavefront.danger` | Wavefront | Formation within reach of the ship line | 2 s | Low urgent pulsing synth alarm, steady throb, seamless loop | loop |
| 13 | must | `swing.dragonNear.mp3` | `swing.dragonNear` | Grappler | Dragon closing in: label grows, arrow turns red | 1000 ms | Close menacing beast growl with a hot breath rasp | one-shot |
| 14 | must | `slice.fuse.mp3` | `slice.fuse` | Slice | Chilli launched with a fizzing fuse | 600 ms | Short fizzing fuse hiss with crackles | one-shot |
| 15 | must | `bubble.rush.mp3` | `bubble.rush` | Coral Pop | Rising bubble rush (8+ cleared in one shot) | 900 ms | Big underwater bubble stream rushing upward, fizzy and bright | one-shot |
| 16 | must | `whack.hedgehogUp.mp3` | `whack.hedgehogUp` | Bonk | Hedgehog (bomb) pops up | 200 ms | Quick prickly rustle with a tiny squeak, careful-now cue | one-shot |
| 17 | must | `clayshoot.birdIn.mp3` | `clayshoot.birdIn` | Pull! | Bird flies in (don't shoot) | 500 ms | Small bird wing flutter passing by with a soft chirp | one-shot |
| 18 | must | `swing.lava.mp3` | `swing.lava` | Grappler | Lava waves, embers, drips | 6 s | Bubbling molten lava with low rumble and occasional hiss, cavern echo, seamless loop | loop |
| 19 | must | `cross.traffic.mp3` | `cross.traffic` | Jaywalk | Traffic streaming | 8 s | Busy city road ambience, cars and lorries passing both ways, light bicycle whirr, seamless loop | loop |
| 20 | nice | `timer.runningOut.mp3` | `breaker.fireballLow`<br>`burst.freezeLow` | Breaker, Fission | Fireball's last second<br>FREEZE's last second | 1000 ms | Three quick soft ticks winding down, a power running out, light retro tone | one-shot |
| 21 | nice | `hover.hum.mp3` | `hover.hum` | Hover | Saucer lights and drifting stars | 4 s | Soft hovering craft hum with a slow pulsing shimmer, low volume, chiptune texture, seamless loop | loop |
| 22 | nice | `wavefront.space.mp3` | `wavefront.space` | Wavefront | Stars and engine glow | 8 s | Distant deep-space drone, very soft, cold and wide, seamless loop | loop |
| 23 | nice | `flip.lava.mp3` | `flip.lava` | Roofbound | Lava pools, spouts, embers in the tube | 6 s | Rushing tunnel wind over bubbling lava pools, warm and steady, seamless loop | loop |
| 24 | nice | `snip.wasps.mp3` | `snip.wasps` | Scrumper | Wasps circling a nest | 3 s | Small cluster of wasps buzzing around in circles, light, outdoors, seamless loop | loop |
| 25 | nice | `rally.bulbChase.mp3` | `rally.bulbChase` | Rally | Gold bulbs chasing down the side casings | 3 s | Very soft ticking light-chase pattern, gentle electric clicks in a steady rhythm, seamless loop | loop |
| 26 | nice | `beat.holdSustain.mp3` | `beat.holdSustain` | Tempo | Hold beam held | 1 s | Steady glowing synth pad tone, soft and bright, seamless loop | loop |
| 27 | nice | `wavefront.saucerHum.mp3` | `wavefront.saucerHum` | Wavefront | Saucer on screen | 2 s | Wobbling high-pitched alien craft warble, theremin-like, seamless loop | loop |
| 28 | nice | `swing.dragonWings.mp3` | `swing.dragonWings` | Grappler | Dragon wing-beats on screen | 1600 ms | Heavy leathery wing flaps, two beats, steady rhythm, seamless loop | loop |
| 29 | nice | `inkbridge.drawing.mp3` | `inkbridge.drawing` | Rainbow Bridge | Drawing during a live drop | 2 s | Soft sparkling marker squeak with a faint chime shimmer, seamless loop | loop |
| 30 | nice | `tunnel.groan.mp3` | `flip.bendStart`<br>`flip.bendTighten` | Roofbound | Tunnel starts bending (10 s)<br>Bends tighten (45 s) | 1200 ms | Deep stone groan and creak as a tunnel twists, rumbling | one-shot |
| 31 | nice | `orbit.sunNear.mp3` | `orbit.sunNear` | Orbit | Approaching the sun (planet 40) | 2 s | Roaring solar flare whoosh building warmly, heat and light | one-shot |
| 32 | nice | `bow.nock.mp3` | `bullseye.nock` | Flightpath | Next arrow nocked | 250 ms | Arrow nocking onto a bowstring with a soft creak | one-shot |
| 33 | nice | `cross.signal.mp3` | `cross.go` | Jaywalk | Kerb pause ends: go | 300 ms | Quick pedestrian crossing signal beep-beep, go | one-shot |
| 34 | nice | `clay.goldLaunch.mp3` | `clayshoot.goldLaunch` | Pull! | Gold clay launches | 300 ms | Clay trap throw with a bright golden sparkle glint | one-shot |
| 35 | nice | `sky.gustEnd.mp3` | `skyline.gustEnd` | High Rise | Gust ends, flag goes limp | 500 ms | Wind dying down with a last flag flap | one-shot |
| 36 | nice | `gem.forge.mp3` | `matchup.specialMade` | Gemstone | Bomb, cross or star gem forged | 600 ms | Gem being forged with a magical rising chime and a crystal ring | one-shot |

### Reused recordings (nothing to record)

The slot points at a recording that already exists. *Batch 2* files are in [batch2-mapping.csv](batch2-mapping.csv);
*batch 1* files are in `public/sounds/`; *app-wide* entries are the manifest's own sounds (`arc_*`, `tick`, `place`,
`countdown_step`). The play-limit caps in section 3 apply as they would to a new file.

| # | Rank | Slot name | Game | Moment | Plays | From |
|---|---|---|---|---|---|---|
| R1 | must | `burst.lastLife` | Fission | Last life: ship icons dim | `ui.warn.mp3` | batch 2 |
| R2 | must | `swing.rockCrumble` | Grappler | Stalactite crumble build-up | `cave.stoneCrack.mp3` | batch 2 |
| R3 | must | `inkbridge.coinLand` | Rainbow Bridge | Coin lands on the rainbow | `arc_marble_clink` | app-wide |
| R4 | must | `inkbridge.coinRoll` | Rainbow Bridge | Coin rolling along the rainbow (loop) | `arc_marble_roll` | app-wide |
| R5 | must | `slice.toss` | Slice | Food thrown up | `arrow.whoosh.mp3` | batch 2 |
| R6 | must | `bintoss.throw` | Swish | Throw released | `arrow.whoosh.mp3` | batch 2 |
| R7 | must | `bubble.reefLost` | Coral Pop | Reef reaches the gun: run lost | `arc_lose_life` | app-wide |
| R8 | must | `balltrack.countdown` | Ball Tracker | 5-4-3-2-1 countdown in the hopper | `countdown_step` | app-wide |
| R9 | must | `skyline.gustWarn` | High Rise | Flag streams 1 s before a gust | `ui.warn.mp3` | batch 2 |
| R10 | must | `matchup.select` | Gemstone | Gem selected | `ui.select.mp3` | batch 2 |
| R11 | must | `whack.emptyTap` | Bonk | Empty-hole tap (−3 points) | `ui.nope.mp3` | batch 2 |
| R12 | must | `clayshoot.escape` | Pull! | Clay escapes | `move.softFall.mp3` | batch 2 |
| R13 | must | `shared.reject` | Nine puzzles | Invalid-move shake (`puzzleReject`) | `ui.nope.mp3` | batch 2 |
| R14 | must | `chain.reverse` | Don't Break the Chain | REVERSE flash | `signals.ruleChange.mp3` | batch 2 |
| R15 | nice | `breaker.hotPaddle` | Breaker | Gold outline round the paddle at chain 10 | `pop.bonus.mp3` | batch 2 |
| R16 | nice | `breaker.capsuleMissed` | Breaker | Capsule falls past the paddle | `move.softFall.mp3` | batch 2 |
| R17 | nice | `breaker.ballDrained` | Breaker | Extra ball drained (not the last) | `move.softFall.mp3` | batch 2 |
| R18 | nice | `pinball.spinnerUnlit` | Pinball | Lit spinner goes dark | `retro.powerDown.mp3` | batch 2 |
| R19 | nice | `pinball.shooterReady` | Pinball | Ball waiting in the shooter lane | `pinball.laneLight.mp3` | batch 1 |
| R20 | nice | `pinball.nudge` | Pinball | Stuck-ball rescue nudge | `arc_clank` | app-wide |
| R21 | nice | `rally.goldMissed` | Rally | Gold ball missed | `move.softFall.mp3` | batch 2 |
| R22 | nice | `snake.turn` | Meteor | Swipe turns the comet | `tick` | app-wide |
| R23 | nice | `burst.atomGone` | Fission | Smallest atom destroyed | `retro.brickBreak.mp3` | batch 2 |
| R24 | nice | `burst.iconLost` | Fission | Power-up icon lost on the floor | `move.softFall.mp3` | batch 2 |
| R25 | nice | `burst.vulnerable` | Fission | Hit-blink ends | `retro.powerDown.mp3` | batch 2 |
| R26 | nice | `wavefront.laserOut` | Wavefront | Laser shots run out | `retro.powerDown.mp3` | batch 2 |
| R27 | nice | `wavefront.saucerEscape` | Wavefront | Saucer leaves unshot | `move.softFall.mp3` | batch 2 |
| R28 | nice | `wavefront.bossLow` | Wavefront | Boss health bar turns red | `ui.warn.mp3` | batch 2 |
| R29 | nice | `orbit.flyIn` | Orbit | Glide into orbit after a black hole | `orbit.planetCatch.mp3` | batch 2 |
| R30 | nice | `orbit.holeArmed` | Orbit | Black hole rim brightens | `ui.hint.mp3` | batch 2 |
| R31 | nice | `swing.release` | Grappler | Rope released | `arrow.whoosh.mp3` | batch 2 |
| R32 | nice | `swing.finishGate` | Grappler | 500 m gold gate in view | `orbit.shootingStar.mp3` | batch 2 |
| R33 | nice | `cross.blocked` | Jaywalk | Move refused by cones | `ui.nope.mp3` | batch 2 |
| R34 | nice | `cross.respawn` | Jaywalk | Walker back on the kerb | `move.appear.mp3` | batch 2 |
| R35 | nice | `inkbridge.rimBounce` | Rainbow Bridge | Coin bounces off the pot rim | `arc_bounce` | app-wide |
| R36 | nice | `inkbridge.inkEmpty` | Rainbow Bridge | Ink meter empty (normal level) | `ui.nope.mp3` | batch 2 |
| R37 | nice | `slice.specialIn` | Slice | Special bottle appears | `move.appear.mp3` | batch 2 |
| R38 | nice | `slice.dropped` | Slice | Food falls unsliced | `move.softFall.mp3` | batch 2 |
| R39 | nice | `slice.powerEnd` | Slice | Frenzy, simmer or squeeze ends | `retro.powerDown.mp3` | batch 2 |
| R40 | nice | `bintoss.nextBall` | Swish | Next ball: bucket moves, wind changes | `sky.gust.mp3` | batch 2 |
| R41 | nice | `bintoss.hoopGlow` | Swish | Ball goes through the hoop (existing slot batch 2 left out) | `pop.bonus.mp3` | batch 2 |
| R42 | nice | `bullseye.targetMoves` | Flightpath | Target drifts or ring values shuffle | `move.slide.mp3` | batch 2 |
| R43 | nice | `bullseye.balloonIn` | Flightpath | Balloon floats in | `move.appear.mp3` | batch 2 |
| R44 | nice | `bullseye.offBoard` | Flightpath | Arrow off the board | `move.softFall.mp3` | batch 2 |
| R45 | nice | `bubble.wallBank` | Coral Pop | Shot banks off a side wall | `arc_bounce` | app-wide |
| R46 | nice | `snip.plankKnock` | Scrumper | Apple bounces or rolls on a plank or gutter | `arc_wood_knock` | app-wide |
| R47 | nice | `tilt.chaserRelease` | Tilt | Red chaser starts chasing | `marble.release.mp3` | batch 2 |
| R48 | nice | `balltrack.hopperEmpty` | Ball Tracker | Hopper runs dry | `marble.release.mp3` | batch 2 |
| R49 | nice | `wordfall.tileLand` | Letterfall | Tile drops in and lands | `place` | app-wide |
| R50 | nice | `wordfall.chainCut` | Letterfall | Chain cut back or restarted | `ui.clear.mp3` | batch 2 |
| R51 | nice | `whack.goldRun` | Bonk | Gold glow every 5 bonks in a row | `pop.bonus.mp3` | batch 2 |
| R52 | nice | `numhunt.reshuffle` | Ascend | Discs reshuffle | `cups.shuffle.mp3` | batch 2 |
| R53 | nice | `chain.reverseWarn` | Don't Break the Chain | "Reverse after link N!" banner | `ui.warn.mp3` | batch 2 |

### mapping.csv (batch 3)

Batch 2's format: `file,cues`, cues separated by `;`, one row per recording. `EXISTING:<id>` names an app-wide manifest
entry, as in batch 2. `EXISTING:<file>.mp3` (new here) names a batch 1 or batch 2 file already in the app: point the
slot's `url` at that file, with no copy.

```csv
file,cues
wavefront.fire.mp3,wavefront.fire
cross.hop.mp3,cross.hop
wavefront.march.mp3,wavefront.march;wavefront.rowDrop
snake.rockFalling.mp3,snake.rockFalling
retro.wallBounce.mp3,breaker.wallBounce;rally.wallBounce;burst.ceilingTouch
retro.atomBounce.mp3,burst.atomBounce
alert.newHazard.mp3,hover.newHazard;breaker.rowsSlide;beat.swipeArrive;orbit.newHazard;cross.newHazard;inkbridge.liveLevel;bintoss.newHazard
combo.lost.mp3,beat.comboLost;slice.comboEnd
speed.up.mp3,snake.speedUp;flip.speedUp;chain.faster
pinball.lastBall.mp3,pinball.lastBall
pinball.gameOver.mp3,pinball.gameOver
wavefront.danger.mp3,wavefront.danger
swing.dragonNear.mp3,swing.dragonNear
slice.fuse.mp3,slice.fuse
bubble.rush.mp3,bubble.rush
whack.hedgehogUp.mp3,whack.hedgehogUp
clayshoot.birdIn.mp3,clayshoot.birdIn
swing.lava.mp3,swing.lava
cross.traffic.mp3,cross.traffic
timer.runningOut.mp3,breaker.fireballLow;burst.freezeLow
hover.hum.mp3,hover.hum
wavefront.space.mp3,wavefront.space
flip.lava.mp3,flip.lava
snip.wasps.mp3,snip.wasps
rally.bulbChase.mp3,rally.bulbChase
beat.holdSustain.mp3,beat.holdSustain
wavefront.saucerHum.mp3,wavefront.saucerHum
swing.dragonWings.mp3,swing.dragonWings
inkbridge.drawing.mp3,inkbridge.drawing
tunnel.groan.mp3,flip.bendStart;flip.bendTighten
orbit.sunNear.mp3,orbit.sunNear
bow.nock.mp3,bullseye.nock
cross.signal.mp3,cross.go
clay.goldLaunch.mp3,clayshoot.goldLaunch
sky.gustEnd.mp3,skyline.gustEnd
gem.forge.mp3,matchup.specialMade
EXISTING:ui.warn.mp3,burst.lastLife;skyline.gustWarn;wavefront.bossLow;chain.reverseWarn
EXISTING:cave.stoneCrack.mp3,swing.rockCrumble
EXISTING:arc_marble_clink,inkbridge.coinLand
EXISTING:arc_marble_roll,inkbridge.coinRoll
EXISTING:arrow.whoosh.mp3,slice.toss;bintoss.throw;swing.release
EXISTING:arc_lose_life,bubble.reefLost
EXISTING:countdown_step,balltrack.countdown
EXISTING:ui.select.mp3,matchup.select
EXISTING:ui.nope.mp3,whack.emptyTap;shared.reject;cross.blocked;inkbridge.inkEmpty
EXISTING:move.softFall.mp3,clayshoot.escape;breaker.capsuleMissed;breaker.ballDrained;rally.goldMissed;burst.iconLost;wavefront.saucerEscape;slice.dropped;bullseye.offBoard
EXISTING:signals.ruleChange.mp3,chain.reverse
EXISTING:pop.bonus.mp3,breaker.hotPaddle;bintoss.hoopGlow;whack.goldRun
EXISTING:retro.powerDown.mp3,pinball.spinnerUnlit;burst.vulnerable;wavefront.laserOut;slice.powerEnd
EXISTING:pinball.laneLight.mp3,pinball.shooterReady
EXISTING:arc_clank,pinball.nudge
EXISTING:tick,snake.turn
EXISTING:retro.brickBreak.mp3,burst.atomGone
EXISTING:orbit.planetCatch.mp3,orbit.flyIn
EXISTING:ui.hint.mp3,orbit.holeArmed
EXISTING:orbit.shootingStar.mp3,swing.finishGate
EXISTING:move.appear.mp3,cross.respawn;slice.specialIn;bullseye.balloonIn
EXISTING:arc_bounce,inkbridge.rimBounce;bubble.wallBank
EXISTING:sky.gust.mp3,bintoss.nextBall
EXISTING:move.slide.mp3,bullseye.targetMoves
EXISTING:arc_wood_knock,snip.plankKnock
EXISTING:marble.release.mp3,tilt.chaserRelease;balltrack.hopperEmpty
EXISTING:place,wordfall.tileLand
EXISTING:ui.clear.mp3,wordfall.chainCut
EXISTING:cups.shuffle.mp3,numhunt.reshuffle
```

**Final count:** 36 new recordings (19 must-have, 17 nice-to-have) and 29 existing recordings
reused, covering **103 cues** (45 of them must-have). Making only the must-haves gives 45 cues from
19 recordings.


## 5. Puzzle games (shorter audit)

Source: [puzzle-move-cues.md](puzzle-move-cues.md) (16 Oct 2026), checked against the stages. `FeedbackStage` plays
`move` (60 ms throttle) whenever a puzzle's draft answer changes; `puzzleReject()` (`src/lib/fx/puzzleReject.ts`)
shakes the board and **never plays audio**.

### Move cues and their status

- **Already sounded (47 cues).** These play `move`, `tick`, `place`, `lock`, `correct`, `wrong`, `stage_complete` or
  their own recording at that moment. Batch 2 gives none of them an own file (they were not silent to the player), and
  nothing is missing.
- **Truly silent (24 cues; 22 rows below, since Checkout and Exact have two moments on one row each in
  puzzle-move-cues.md).** Batch 2 fills 19:

| Game | Cue | Status |
|---|---|---|
| Ballpark | `numline.sweepTick` | batch 2: existing `tick` |
| Brimful | `measure.select` | batch 2: `ui.select.mp3` |
| Checkout | `checkout.aim` | batch 2: `ui.select.mp3` |
| Checkout | `checkout.tick` | none: the slot also fires when a dart lands, where `checkout.thud` plays, so Undo can't get its own file without a new slot |
| Counterweight | `balance.select` | batch 2: `ui.select.mp3` |
| Exact | `target.select` | batch 2: `ui.select.mp3` |
| Exact | `target.combine` | batch 2: `move.combine.mp3` |
| Tenfall | `tendrop.apply` | batch 2: existing `place` |
| Double Take | `spotdiff.nextPicture` | batch 2: `move.appear.mp3` |
| Eagle Eye | `symscan.revealGrid` | batch 2: existing `tick` |
| Gridlock | `unblock.slide` | batch 2: `move.slide.mp3` |
| Tessellate | `blockparty.place` | batch 2: `block.place.mp3` |
| Tessellate | `blockparty.turn` | batch 2: `ui.select.mp3` |
| Tessellate | `blockparty.flip` | batch 2: `ui.select.mp3` |
| Hanoi | `tower.lift` | batch 2: `ui.select.mp3` |
| Polypotions | `tubes.lift` | batch 2: `ui.select.mp3` |
| Safe Cracker | `safe.click` | batch 2: `safe.dialClick.mp3` |
| Lamplighter | `lightup.clear` | batch 2: `ui.clear.mp3` |
| Mosaic | `nonogram.clear` | batch 2: `ui.clear.mp3` |
| Tents and Trees | `tents.clear` | batch 2: `ui.clear.mp3` |
| Pull! | `clayshoot.goldSparkle` | none: the tail of `clayshoot.finalBurst` is still sounding |
| Shared | `warning_5` | none, by design |

  After batch 2, nothing a player would notice is left silent at a move. Checkout's Undo is the only gap, and it is
  minor.

### Puzzle moments with no cue at all

| Moment | Games | Note |
|---|---|---|
| Invalid move shake (`puzzleReject`) | Operator (wrong try), Chroma Lines (illegal drag step), Labyrinth (wall), Lamplighter (tap on a wall), Counterweight (notch taken), Slider (locked row), Jumbled (tile can't move), Heave (blocked step), Cryptogrid (letter already given) | batch 3 R13: `shared.reject` reuses batch 2's `ui.nope.mp3`; other games' shakes already play `wrong` |
| "That number is given" message | Cryptogrid | covered by the same reject sound if the message gets the shake too |
| Wrong tap: red disc flash | Ascend | plays only `move`; play the existing `wrong` (code only, no file) |
| Discs reshuffle with a pulse (3 a round) | Ascend | batch 3: `numhunt.reshuffle` reuses `cups.shuffle.mp3` |
| FASTER banner | Don't Break the Chain | batch 3: `chain.faster` shares new `speed.up.mp3` |
| ← REVERSE flash | Don't Break the Chain | batch 3: `chain.reverse` reuses `signals.ruleChange.mp3` |
| "Reverse after link N!" warning banner | Don't Break the Chain | batch 3: `chain.reverseWarn` reuses `ui.warn.mp3` |
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

The five puzzle slots are in section 4's tables and mapping block (one new recording is shared with arcade slots).

## Next steps (not in this PR)

1. Make batch 3's must-have recordings first: the 19 in section 4, which with their reuses cover 45 cues. Then make the
   nice-to-haves.
2. A code PR to wire batch 3. Presentation only: no sim, score, timing or stamp changes.
   - Add an `effectCue()` / `liveCue()` call per new slot.
   - Add manifest slots and rows in arcade-effects.md, and refresh the cue sheet.
   - Add `shared.reject` in `puzzleReject()`, with demos hushed.
   - Play `wrong` on Ascend's wrong tap (an existing recording; code only).
   - Apply the caps listed in section 3.
3. Correct the counts in arcade-effects.md:
   - `whack.popUp`: about 100–115 a round, not 30–60.
   - `whack.sink`: 45–60, not 5–20.
   - `wavefront.fire`: about 250 in 90 s, not "100+".
   - `inkbridge.goldStar`: fires on rev 4 only.
