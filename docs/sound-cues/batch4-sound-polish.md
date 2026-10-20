# Sound batch 4: Joe's listening notes (19 Oct 2026)

Joe listened to every arcade game and the shared screens. This page turns his notes into **49 recordings to make in
ElevenLabs** (48 effects and Tempo's music bed), plus one optional music bed, and a mapping sheet for the session that wires them in,
[batch4-mapping.csv](batch4-mapping.csv) (the batch 3 format: `file,cues`).

**Docs only.** No source, manifest or audio file changes in this batch. Every slot below keeps playing what it plays
today until the wire-in session sets its `url` (README, "Adding a recorded file").

## How to read this page

- One section per note: the slot(s), what triggers it, how often per round (the rate rooms deal today, from
  [arcade-effects.md](arcade-effects.md) and [arcade.md](arcade.md) and the sims' constants), what plays today and
  **who else shares that recording**. Those slots keep it, as the batch rules require.
- **Never replaced:** a shared recording (`banner.streak`, `banner.clear`, `pop.bonus`, `pop.perfect`,
  `retro.appear`, `retro.wallBounce`, `speed.up`, `correct`, `stage_complete`, `arc_*`…) stays exactly as it is.
  The disliked moment's own slot gets a new file instead, so only that moment changes. The only entries whose recording
  is replaced are ones every user of which is in Joe's notes: `round_won` (both users are the score page) and
  `arc_gem_match`, `arc_gem_zap`, `arc_gem_star` (Gemstone only).
- **Replay highlights are unchanged.** Every game moment cue in the results highlight and the podium's play of the
  game (`hover.zone`, `breaker.row-clear`, `cross.bikes`, `orbit.black-hole`, `snip.leaf`, `tilt.star`,
  `balltrack.home`, `bubble.mine`… [replays.md](replays.md)) plays `replay.moment.mp3`, and the final-second save
  plays `any.final-second.mp3`. None of them plays a recording Joe dislikes, so none changes.
- **New hooks.** Four rows name a cue or slot that doesn't exist yet, so the wire-in session adds a small hook for each:
  `shared.roundResults`, `slice.specialIn`, `matchup.jackpotBlast` and Tempo's bed (`music_beat`, which needs a
  tick-locked player). Each section says exactly what the hook is. Everything else is a `url` (and `ms`, `volume`)
  change on a slot that already exists.
- **Files that fall out of use.** After the wire-in, `pop.jackpotGem.mp3` (only `matchup.jackpotMade`),
  `wavefront.fire.mp3` (only `wavefront.fire`) and `ui.hint.mp3` (only `matchup.hint`) have no slot left.
  `sound-manifest-check` fails on an unused file, so the wire-in session deletes them. (Batch 3's not-yet-hooked
  nice-to-have `orbit.holeArmed` planned to reuse `ui.hint.mp3`. If it is ever hooked, restore that file from git
  history or give it another sound.)

## Assumptions

1. **"The score page"** is the room's **Round results** screen (phase `result`: `RoundResult` for two players,
   `RoundResultsTable` for three or more), the screen after the answer reveal, before the standings. Practice has no
   such screen: its answer reveal is the last screen of a run, so this note is about rooms only.
2. **Hover "zone 2, zone 3…"** is `hover.newZone` (every 7th barrier, the border flashes the next zone's colour).
3. **Ball Tracker "20 balls tracked correctly"** is `balltrack.homeStreak`, checked 19 Oct 2026. The "20 HOME" banner
   is that cue's streak effect (`count: s.home, every: 5` in `arcadeFxGames.renderer.ts`, where `home` counts marbles
   into their right cup; wrong cups are `wrong`). No other Ball Tracker sound fires at 20. The cue fires on every 5th
   marble home (5, 10, 15, 20, 25), so the new sound plays on all of them, not only at 20.
4. **Coral Pop's "torpedo"** is the line special: `bubble.line` (`BUB_LINE`; bubbleRev 4's directional torpedo).
   The "bomb" is the mine (`bubble.bomb`).
5. **Rally's "+3 target"** is the far-wall pad (`rally.targetHit`: `RALLY_TARGET_POINTS`, "+3 pad" in `rally.ts`).
6. **Wavefront's "green beam shot"** is the player's own shot (`wavefront.fire`; the bolt is drawn `#3DDC84`).
   **"Wave 2 sound"** is the WAVE n / BOSS arrival (`wavefront.formation`, today the app-wide `stage_complete`).
   The CLEAR! banner before it (`wavefront.waveCleared`) is not in the note and keeps `banner.clear.mp3`.
7. **Roofbound's "10 seconds"** is `flip.surviveStreak` (the STREAK banner every 10 s survived).
8. **Fission's "first atoms drop"** is `burst.newWave`. Its **"wave cleared"** is `burst.waveCleared`. The
   last-life variant `burst.lastLifeWave` is the same moment with a different banner, so it shares the new file
   (Decision 6).
9. **Gemstone "every sound except the bomb"** means every effect Gemstone plays: picking, swapping, the refused swap,
   the hint, the match chime and its cascade ladder, the cross and star specials, the jackpot going off, the
   jackpot gem and five-in-a-line banners, and par smashed. `arc_gem_bomb` stays. Gemstone's music bed
   (`music_matchup`) is not an effect and stays (Decision 4).
10. **Tempo "sort out the effects"** means the sounds tied to the music's timing: the note hit, the miss and the
    swipe hit. Tempo's banners (`beat.comboTen`, `beat.comboTier`, `beat.fullCombo`), `beat.comboLost` and
    `beat.swipeArrive` stay (Decision 3).
11. Prompts are original wording for ElevenLabs' sound-effects generator (music: ElevenLabs Music) and name no
    other games, products or brands. Lengths follow the visual effect each sound marks. Volumes are the slot's
    `volume` (0–1, multiplied by the Effects slider), set at the wire-in.

---

## 1. The score page (every puzzle and arcade game, rooms)

| | |
|---|---|
| `round_won` (app-wide entry; replace its recording); new cue `shared.roundResults` | Slots |
| The Round results screen appears (once, on mount). Today `round_won` plays only for the round's top scorer (in a 2-player room, the winner), followed by the voice line `roundTaken` (or `voice.tie` for a shared top score in 3+ rooms). A 2-player loser hears `roundLost`, a 2-player tie `voice.tie`. In rooms of 3+, everyone else hears nothing but the music | Trigger |
| 1 per player, 6–7 times a room | Per round |
| `round_won` (220 ms, generic chime), voice lines as above, under the `standings_loop` music bed (result and standings screens). The results highlight on the same screen plays `shared.highlight.start` (`replay.rewind.mp3`), `shared.highlight.clip`, `shared.slowmo` and the game's `replay.moment.mp3` | Plays today |
| `round_won`: only `RoundResult` and `RoundResultsTable`, both this screen, so its recording is replaced. `standings_loop`: the standings screen too. The highlight cues: the podium's play of the game | Shared by |

**Plan.** Two new recordings:

- **#1 `room.roundResults.mp3`** on a new cue `shared.roundResults`, played for **every** player as the screen lands.
  It's the screen's own sound, so nobody gets silence in a big room. Hook: one `soundCue("shared.roundResults")`
  in the same mount effect in both components (beside the existing `cued` ref), a manifest slot, and a row in
  `shared.md`.
- **#2 `room.roundWon.mp3`** replaces `round_won`'s recording, layered on top for the top scorer. Its `ms` delays the
  `roundTaken` voice line (`cueDurationMs("round_won")`), so keep it at about 700 ms and set `ms` to the file's length.

The music bed and the highlight sounds stay as they are (Decision 1). If Joe meant the bed, optional recording **O1**
is ready below.

## 2. Hover

Hover sits in the Retro Arcade world: a saucer threading neon barriers. The three moments today are generic banner
and pop stings.

| Trigger | Slot | Per round | Plays today | Others sharing it (they keep it) |
| --- | --- | --- | --- | --- |
| Every 7th barrier: the border flashes the next zone colour, STREAK banner | `hover.newZone` | 3–8 | `banner.streak.mp3` | `breaker.bricksStreak`*, `rally.longRally`, `beat.comboTen`, `snake.starsStreak`, `wavefront.bossStreak`, `orbit.planetsStreak`, `swing.distanceStreak`*, `flip.surviveStreak`*, `slice.slicedStreak`, `balltrack.homeStreak`*, `skyline.floorsStreak`*, `whack.bonkStreak`, `clayshoot.claysStreak`, `stroop.sortedStreak` |
| Through a two-gap (split) barrier (hoverRev 2+), +1 pop and cyan glow | `hover.twoGap` | 2–8 | `pop.bonus.mp3` | `hover.slippedThrough`*, `breaker.movingTarget`*, `beat.swipeHit`*, `wavefront.diverDown`*, `cross.pastBikes`*, `cross.pastRoadworks`*, `swing.overLava`, `bintoss.spinnerBasket` |
| Past a moving barrier (hoverRev 2+), near-miss pop | `hover.slippedThrough` | 2–8 | `pop.bonus.mp3` | as above |

\* also moves to its own new file in this batch. Slots without a star keep the shared file.

New: **#3 `hover.zone.mp3`**, **#4 `hover.splitGap.mp3`**, **#5 `hover.slipPast.mp3`**. The two barrier sounds stay
separate: one is a squeeze through a gap, the other a near miss past something moving, and telling them apart by ear
is feedback.

## 3. High Rise

High Rise is a construction site: steel and concrete blocks dropped from a crane.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| Every 10th floor: n FLOORS banner | `skyline.floorsStreak` | 1–4 | `banner.streak.mp3` | see Hover (they keep it) |
| A perfect drop (layered on `skyline.drop`'s clank; `skyline.streakDrop`'s coin joins on the 3rd perfect in a row) | `skyline.perfect` | 5–20 | `correct` (app-wide, every puzzle's right-answer sound) | `correct` is used everywhere and stays. The slot is empty today and gets the new file |
| A perfect drop during a gust: PERFECT pop (stands in for `skyline.perfect` on that frame) | `skyline.windPerfect` | 0–5 | `pop.perfect.mp3` | `rally.targetHit`*, `snake.showerDodged`, `wavefront.saucerDown`, `flip.allStars`, `flip.justInTime`, `inkbridge.goldStar`, `bintoss.hoopSwish`, `bullseye.innerBull`, `bubble.bigDrop`, `balltrack.turnedHome`, `balltrack.switchedHome` |

New: **#6 `skyline.floors.mp3`** and **#7 `skyline.perfectFit.mp3`**. The perfect sound also goes on
`skyline.windPerfect`, so every perfect drop sounds the same, gust or not (Decision 6). Without that, a perfect in
the wind would still play the old generic pop.

## 4. Gemstone

Gemstone is jewels in recessed violet velvet sockets. Everything is remade except the bomb going off.

**The bomb, kept (checked 19 Oct 2026).** The bomb gem is `MATCHUP_BOMB` (kind 6, made by a line of 4, a 3×3 blast in
`matchup.ts`). When it goes off, `matchupStepSound` (`matchup.renderer.ts`) returns the app-wide entry **`arc_gem_bomb`**,
which `matchup.tsx` plays over that step's match chime. It has no named `matchup.*` slot. No row in this list or the
mapping sheet touches `arc_gem_bomb`: its entry, file and volume stay exactly as they are. **#15 is not the bomb.** It is
the Jackpot gem (`MATCHUP_JACKPOT`, kinds 10–15, matchupRev 2+), a different special that clears every gem of its colour
plus its row and column, and today plays `arc_rainbow`. So #15 stays. One existing rule carries over unchanged: when a
single cascade step sets off a jackpot and a bomb together, `matchupStepSound` plays the jackpot's sound, not the
bomb's, as it does today with `arc_rainbow`.

| Trigger | Slot / entry | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A gem is picked | `matchup.select` | 20–60 | `ui.select.mp3` | `measure.select`, `checkout.aim`, `balance.select`, `target.select`, `blockparty.turn`, `blockparty.flip`, `tower.lift`, `tubes.lift` (keep it) |
| Two gems swap | `matchup.swap` | 20–60 | `move.slide.mp3` | `unblock.slide` (keeps it) |
| A swap that makes no match slides out and back | `matchup.invalid` | 0–10 | `ui.nope.mp3` | `inkbridge.inkOut`, `inkbridge.reject`, `whack.emptyTap`, `shared.reject` (keep it) |
| The hint highlight after a spell without a match | `matchup.hint` | 0–5 | `ui.hint.mp3` | none (the file falls out of use) |
| Each cascade step's shatter chime, pitched by depth (1.0 / 1.12 / 1.26 / 1.41, `MATCHUP_PITCH_RATES`) | `arc_gem_match` | 30–100 | `arc_gem_match` | Gemstone only: entry replaced |
| A cross gem goes off (row and column) | `arc_gem_zap` | 0–10 | `arc_gem_zap` | Gemstone only: entry replaced |
| A star gem goes off (every gem of a colour) | `arc_gem_star` | 0–10 | `arc_gem_star` | Gemstone only: entry replaced |
| A jackpot gem goes off | `matchup.jackpotBlast` (new) | 0–3 | `arc_rainbow` (`matchupStepSound`) | `inkbridge.draw`, `bubble.jokerLand`*: `arc_rainbow` stays for Rainbow Bridge |
| Five or more in a line: n IN A LINE! | `matchup.lineOfFive` | 0–5 | `banner.combo.mp3` | `beat.comboTier`, `slice.manyInOne`, `bintoss.inARow`, `bullseye.bullsRow`, `bubble.bigPop`, `wordfall.longWord`, `whack.cleanTwenty`, `clayshoot.doubleHit` (keep it) |
| A jackpot gem is made: JACKPOT GEM! | `matchup.jackpotMade` | 0–3 | `pop.jackpotGem.mp3` | none (the file falls out of use) |
| The score passes par: FULL CLEAR banner | `matchup.parSmashed` | 0–1 | `banner.fullClear.mp3` | `hover.allBarriers`, `breaker.wallCleared`, `beat.fullCombo`, `snake.allEaten`, `burst.flawlessFinish`, `wavefront.bossDown`, `orbit.allPlanets`, `swing.finishLine`, `flip.survivedFinish`, `inkbridge.allLevels`, `bullseye.allOnTarget`, `bubble.reefCleared`, `snip.allApples`, `tilt.allMazes`, `balltrack.allHome` (keep it) |
| A bomb gem (`MATCHUP_BOMB`, line of 4, 3×3 blast) goes off | `arc_gem_bomb` | 0–10 | `arc_gem_bomb` | **unchanged, not in this list** (Joe likes it) |

New: **#8–#16**: `gem.pick`, `gem.swap`, `gem.refuse`, `gem.glint` (hint), `gem.shatter` (match chime),
`gem.crossBeam`, `gem.starBurst`, `gem.jackpot` and `gem.forge`. The last is shared by `matchup.lineOfFive` and
`matchup.jackpotMade` (both mean "a special gem is forged"), and is the name batch 3 reserved for
`matchup.specialMade`. Play `jackpotMade` at `rate: 0.9` to make it a touch bigger. Par smashed is **#17
`gem.parSmashed.mp3`**.

- **The match chime is pitched up to ×1.41 for deep cascades,** so it must be a single clean pitched tone with a
  short tail. A chord or a long reverb smears when sped up. Replacing the `arc_gem_match` entry keeps the ladder with
  no code change. Specials still layer over the chime (`matchup.tsx`), so the cross and star sounds should leave room
  for it.
- **Hook for the jackpot:** `matchupStepSound` returns `"arc_rainbow"` for a jackpot. Make it return a new slot
  `matchup.jackpotBlast` (camelCase, not the replay cue `matchup.jackpot`), with a manifest entry. One line.
- **The generic `combo` sound** also plays on every cascade step through `arcadeFeedback`. It is app-wide, so it isn't
  replaced. Recommended: leave it out for Gemstone, as Slice already does (`arcadeFeedback({ combo: false })`), since
  the new chime climbs with the cascade on its own (Decision 4).

## 5. Breaker

Breaker is in the Retro Arcade world: glass-bright bricks and cabinet bulbs along the border.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A ball turns back off a side wall or the ceiling (no brick, no paddle; at most one per 120 ms, volume 0.4) | `breaker.wallBounce` | 60–150 | `retro.wallBounce.mp3` | `rally.wallBounce`*, `burst.ceilingTouch` (keeps it) |
| A whole row cleared: ROW CLEAR! banner, bulbs chase | `breaker.rowClear` | 1–6 | `banner.clear.mp3` | `burst.waveCleared`*, `burst.lastLifeWave`*, `wavefront.waveCleared`, `wordfall.parReached` (keep it) |
| Every 10th brick: STREAK banner, cool lights | `breaker.bricksStreak` | 5–12 | `banner.streak.mp3` | see Hover |
| A brick knocked out of a sliding row (brkRev 2+; at most one per 120 ms) | `breaker.movingTarget` | 0–10 | `pop.bonus.mp3` | see Hover |

New: **#18 `arcade.wallThock.mp3`**, shared with Rally's wall (the same world and the same kind of soft-walled court;
the batch's "share where it fits both equally" rule). Then **#19 `breaker.rowClear.mp3`**, **#20
`breaker.tenBricks.mp3`** and **#21 `breaker.slider.mp3`**. The wall file plays 60–150 times a round, so it must be
tiny and soft. Keep the slot's volume 0.4 and 120 ms gap.

## 6. Rally

Rally is a neon court in the Retro Arcade world, with a gold ball that can strike +3 pads on the far wall.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A ball turns back off a side or the far wall (at most one per 120 ms, volume 0.4) | `rally.wallBounce` | 60–150 | `retro.wallBounce.mp3` | `breaker.wallBounce`*, `burst.ceilingTouch` (keeps it) |
| A gold ball flies into the court with a trail | `rally.goldEnter` | 3–10 | `retro.appear.mp3` | `rally.bumperIn` (keeps it), `burst.newWave`* |
| The gold ball strikes a far-wall +3 pad (rallyRev 2+): pink light and burst, then the pad moves | `rally.targetHit` | 1–6 | `pop.perfect.mp3` | see High Rise (they keep it) |

New: wall **#18** (shared, above), **#22 `rally.goldServe.mp3`** and **#23 `rally.padPlusThree.mp3`** (three rising
notes, one per point).

## 7. Slice

Joe asked whether the bottles have sounds. They do, but all borrowed. Ketchup plays `arc_ketchup`, mustard plays
`arc_mustard`, and mayonnaise reuses `arc_mustard` (`slice.mayoSqueeze`), so mustard and mayo sound the same. Slice is
a kitchen.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| Ketchup bottle cut: FRENZY starts | `slice.frenzyStart` | 0–3 | `arc_ketchup` | none: the slot is empty and gets the file. `arc_ketchup` stays as its fallback |
| Mustard bottle cut: slow-motion simmer starts | `slice.slow` | 0–3 | `arc_mustard` | `slice.mayoSqueeze`* |
| Mayonnaise bottle cut (sliceRev 2): SQUEEZE! pulls nearby food together | `slice.mayoSqueeze` | 1–5 | `arc_mustard` (0.8) | `slice.slow`* |
| A special bottle is thrown up (none today) | `slice.specialIn` (new) | 3–6 | silent | — |

New: **#24 `slice.ketchup.mp3`**, **#25 `slice.mustard.mp3`**, **#26 `slice.mayo.mp3`** and **#27
`slice.bottleToss.mp3`**.

**The bottle-appears hook is cheap.** `sliceSounds` already lists the objects thrown this frame (`thrown`, for
`slice.fuse` and `slice.toss`), and each carries `special` (`SLICE_SPECIAL_FRENZY` / `_SLOW` / `_MAYO`). Add
`if (thrown.some((o) => o.special)) effectCue("slice.specialIn");`, then a manifest slot and an arcade-effects.md row.
Batch 3 already reserved the name (R37). One shared "bottle tossed" sound is enough: the bottle's own sound comes when
it is cut. If Joe wants each bottle announced differently, that's three cues (`slice.ketchupIn`…) and three more
recordings (Decision 5). Leave `slice.toss`'s plain whoosh off on that frame when the special has its file, so the two
don't stack.

## 8. Coral Pop

Coral Pop is an underwater reef in the High Seas world. The three specials are a sea mine, a torpedo and a rainbow
joker bubble.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A mine bubble goes off (bubbleRev 2+) | `bubble.bomb` | 0–5 | `arc_big_explode` (0.6) | `wavefront.bigExplode` (keeps it) |
| The torpedo fires (bubbleRev 4: directional, stops after its hits) | `bubble.line` | 0–5 | `arc_laser_beam` (0.55, ×1.2) | `breaker.laser` (keeps it) |
| A joker bubble lands | `bubble.jokerLand` | 0–5 | `arc_rainbow` (0.6) | `inkbridge.draw` (keeps it), Gemstone's jackpot* |

New: **#28 `bubble.seaMine.mp3`**, **#29 `bubble.torpedo.mp3`** and **#30 `bubble.joker.mp3`**. All three slots are
empty today, so this is a `url` each. The replays' mine, torpedo and joker moments play `replay.moment.mp3` and stay.

## 9. Tempo: music and effects

**Today.** Tempo has no recorded music. As the sim runs, `playBeatStep` in `src/lib/sound.ts` synthesises a 120 BPM
loop one eighth note at a time: a noise hi-hat on every eighth and a triangle-wave bass on beats 1 and 3 over A–F–C–G.
It's called from `beat.tsx` on every 15th tick from tick 120. `music_beat` has no file. Notes play `arc_retro_note`
pitched by lane (`BEAT_LANE_RATES`: ×1, ×1.26, ×1.5, ×2, so root, major third, fifth and octave), misses play
`arc_retro_hit` and swipe hits play `pop.bonus.mp3`. `arc_retro_note` is also Hover's barrier, Meteor's rock warning
and shower alarm, Pinball's lane light and Rally's gold return, and they keep it. `arc_retro_hit` is also Breaker's
brick, Pinball's bumper, Meteor's rock landing, Fission's hit and Wavefront's boss and armour hits, and they keep it.

**The chart's clock** (every beatRev): 60 ticks a second, **120 BPM exactly** (a beat every 30 ticks, an eighth
every 15), the first beat at **tick 120 = 2.000 s** after the run starts, and the run lasts **60 s** (3,600 ticks). Notes
arrive at the hit line on that grid. That makes 29 bars of 4/4 between 2 s and 60 s (a bar is 2 s).

**The plan, in plain words.**

1. **One recorded track, made for Tempo's clock.** **#31 `music_beat.mp3`**: exactly 120 BPM, 4/4, about 60 s,
   in C major (C–Am–F–G), so the notes' lane pitches sit inside it. **It starts straight on its first downbeat**: no
   count-in, no silence, a full groove from the very first sample. It's not a loop: every Tempo run is exactly 60 s, and
   the chart's beats run from 2 s to 60 s (58 s, 29 bars), so one straight track fits. Anything past 58 s is cut when the
   run ends.
2. **The wire-in session lines it up; the file doesn't.** Before wiring, that session:
   - **measures** the file's tempo and its first downbeat (any audio editor, or a small onset check it writes);
   - **adds the 2.000 s lead-in of silence itself**, so the file's measured first downbeat lands on the chart's first
     beat, tick 120 = 2.000 s after the run starts (±10 ms). It does this in Tempo's player, by starting the file at
     that tick and skipping anything before the measured downbeat, not by baking silence into the MP3. The music
     loader trims leading audio quieter than -60 dB from MP3 beds (`detectLoopPoints` in `src/lib/sound.ts`), so a
     baked-in lead-in would be cut off;
   - **keeps the synthesised beat** (no `music_beat` url) if the file can't be fitted to the grid: tempo not within
     about 0.1 % of 120 BPM (about 30 ms of drift over the run), a downbeat it can't find, or a tempo that wanders.
     It then says so in its PR, and the file is regenerated or stretched in an editor. The game is never moved to fit the file.
3. **The game starts the track on its own clock, not the round's.** Today a game's music starts at the 3-2-1 (the
   round-music owner), which is too early and too loose for a rhythm game. The wire-in session makes Tempo an
   exception:
   - leave `beat` out of `roundMusicFor`;
   - start `music_beat` on the audio clock when the sim reaches tick 120, at file offset
     `downbeat + (tick − 120) / 60` s (`downbeat` = the measured first downbeat, 0 for a file that starts on it);
   - every frame, compare where the track should be (that offset) with where it is. If they drift more than about
     40 ms apart (a stalled frame, the tab hidden and shown), jump the track back into place;
   - stop it when the run ends or the player locks in.

   That's presentation only: the chart, judging, input log and score don't change, so no `beatRev` stamp is needed,
   and stored runs replay exactly as before.
4. **The synthesised beat becomes the fallback.** While the track plays, `playBeatStep` is skipped. If the file fails
   to load (or before it has decoded), the synth plays exactly as today, so a run is never silent.
5. **A proper note sound that still climbs by lane.** **#32 `beat.noteHit.mp3`**: one short bright pluck tuned to
   **C5 (523 Hz)**. The lanes then play C5, E5, G5 and C6, a C major chord, which fits every chord of the track (an own
   file keeps the lane pitch: `sfx(..., keepRate)`). **#33 `beat.miss.mp3`**: a muted, dead off-beat thud that sits
   under the music. **#34 `beat.swipe.mp3`**: a short swish for a swipe note hit.
ElevenLabs Music doesn't promise an exact tempo or a click-exact start, which is why step 2 measures the file rather
than trusting the prompt.

**The decision Joe needs to make (Decision 2):** replace the synthesised beat with a recorded track locked to the
chart as above, keeping the synth as the fallback. Recommended: yes. The alternative is to keep the synth and only
improve its sounds (better hi-hat and bass patches), which needs no new file and no sync code but stays a placeholder.

## 10. Meteor

Meteor is the Retro Arcade snake in space: it eats stars while rocks rain down.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A speed step on the 5th, 15th and 25th star (the 10th and 20th have the STREAK banner) | `snake.speedUp` | 0–3 | `speed.up.mp3` | `flip.speedUp`*, `chain.faster` (Don't Break the Chain, keeps it) |

New: **#35 `snake.cometRush.mp3`**. Roofbound also gets its own (below); `speed.up.mp3` stays for Don't Break the Chain.

## 11. Jaywalk

Jaywalk is a busy city street: cyclists in a bike lane, cones round roadworks.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| Past the cyclists' lane: +1 pop | `cross.pastBikes` | 2–8 | `pop.bonus.mp3` | see Hover |
| Through the roadworks: +1 pop | `cross.pastRoadworks` | 2–8 | `pop.bonus.mp3` | see Hover |

New: **#36 `cross.bikeBell.mp3`** and **#37 `cross.cones.mp3`**.

## 12. Wavefront

Wavefront is a deep-space shooter. The player's fighter fires small green bolts at alien formations.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A diver shot mid-dive: +1 pop (at most one per 150 ms) | `wavefront.diverDown` | 2–15 | `pop.bonus.mp3` | see Hover |
| The player's green shot (one per volley; at most one per 120 ms, two at once) | `wavefront.fire` | about 250 | `wavefront.fire.mp3` (batch 3, 0.83) | none (the file falls out of use) |
| The next formation (or the boss) flies in under the WAVE n / BOSS banner | `wavefront.formation` | 3–5 | `stage_complete` (0.8, app-wide) | `cross.crossed`, `junction.complete` and every puzzle's stage complete (keep it) |

New: **#38 `wavefront.diverDown.mp3`**, **#39 `wavefront.greenBolt.mp3`** and **#40 `wavefront.waveIn.mp3`**. The
shot plays about 250 times a round: keep it under 100 ms, rounded and quiet (volume 0.6, the slot's caps unchanged).
The wave-in sound covers every WAVE n banner and the BOSS banner.

## 13. Roofbound

Roofbound is a gravity-flipping runner in a stone lava tube.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| The tunnel speeds up a step (every 3 s until the cap) | `flip.speedUp` | **15** (3 s, 6 s… 45 s) | `speed.up.mp3` | `snake.speedUp`*, `chain.faster` (keeps it) |
| Every 10 s survived: STREAK banner, confetti | `flip.surviveStreak` | 1–6 | `banner.streak.mp3` | see Hover |

New: **#41 `flip.tunnelRush.mp3`** and **#42 `flip.tenSeconds.mp3`**.

**Making the speed-up play less often (proposal only, not made).** The scroll speeds up at every 3 s step:
`SPEED_START` 1024 + 90 a step, capped at 2304, which takes 15 steps, the last at 45 s. The docs' "15–20" is really
15 for a full run. The proposal is to keep every step in the sim and on screen but **sound only every third step**,
at 9, 18, 27, 36 and 45 s: **5 a round instead of 15**. In `flipSounds` (`gameSounds.ts`), play
`effectCue("flip.speedUp")` only when the new step number `Math.trunc(state.tick / 180)` is a multiple of 3 (the
45 s step, the 15th, reaches the cap and is one). This is a sound observer, so the sim, scoring and replays don't
change and no `flipRev` is needed. None of the five lands on a 10 s STREAK banner (10, 20, 30, 40, 50 s), so the two
never stack. Decision 7.

## 14. Fission

Fission is the Retro Arcade atom splitter: atoms drop in from the ceiling and bounce, and you shoot them apart.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A wave of atoms cleared: WAVE n CLEARED, light sweep | `burst.waveCleared` | 2–5 | `banner.clear.mp3` | `breaker.rowClear`*, `burst.lastLifeWave`*, `wavefront.waveCleared`, `wordfall.parReached` (keep it) |
| A wave cleared on the last life (stands in for `burst.waveCleared`) | `burst.lastLifeWave` | 0–2 | `banner.clear.mp3` | as above |
| A new wave of atoms drops in from the top | `burst.newWave` | 3–6 | `retro.appear.mp3` | `rally.goldEnter`*, `rally.bumperIn` (keeps it) |

New: **#43 `burst.waveCleared.mp3`** (also on `burst.lastLifeWave`) and **#44 `burst.atomsDrop.mp3`**.

## 15. Orbit

Orbit is a rocket hopping between planets in deep space. A black hole flings it ahead.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| Through a black hole (orbitRev 4+): the rim turns gold, the rocket jumps ahead, CLEAR banner | `orbit.blackHole` | 0–5 | `pz_gravity_pull` (0.75, app-wide) | Gravity Maze's gravity pull (`gravityMaze.tsx`, keeps it) |

New: **#45 `orbit.blackHole.mp3`**.

## 16. Grappler

Grappler swings through a lava cavern, chased by a dragon.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| Every 100 m: STREAK banner with embers | `swing.distanceStreak` | 1–5 | `banner.streak.mp3` | see Hover |

New: **#46 `swing.hundredMetres.mp3`**.

## 17. Scrumper

Scrumper is an orchard: ropes, apples, a basket, and golden leaves to collect.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A golden leaf collected | `snip.star` | 10–30 | `arc_leaf_collect` (840 ms) | `tilt.starTaken`* (both slots move; `arc_leaf_collect` stays as their fallback) |

New: **#47 `snip.goldLeaf.mp3`**. It plays up to 30 times a round, so keep it near 500 ms, shorter than today's
840 ms.

## 18. Tilt

Tilt is in the Toybox world: a wooden labyrinth disc on an oak board, with brass fittings.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| A gold bonus star collected | `tilt.starTaken` | 3–15 | `arc_leaf_collect` (0.8) | `snip.star`* |

New: **#48 `tilt.goldStar.mp3`**. Not shared with Scrumper's leaf: a brass star in a wooden toy and a leaf in an
orchard are different worlds.

## 19. Ball Tracker

Ball Tracker is in the Toybox world too: a wooden marble run with glass marbles.

| Trigger | Slot | Per round | Plays today | Others sharing it |
| --- | --- | --- | --- | --- |
| Every 5th marble home (5, 10, 15, 20, 25): n HOME banner | `balltrack.homeStreak` | 1–6 (5 on a full run) | `banner.streak.mp3` | see Hover |

New: **#49 `balltrack.homeStreak.mp3`**. This is the moment Joe heard at 20 (assumption 3). One slot uses it, so it is named after that slot.

---

## ElevenLabs list

Make these in ElevenLabs' sound-effects generator (**#31** in ElevenLabs Music). Export MP3, trim leading silence so
each sound starts on its first transient, and save it under the file name shown. "Volume" is the suggested slot
`volume` at the wire-in (1 = as recorded). Lengths are targets: the wire-in sets each slot's `ms` to the real
length.

| # | File | Slots it fills | Prompt | Length | Type | Volume |
|---|---|---|---|---|---|---|
| 1 | `room.roundResults.mp3` | `shared.roundResults` (new cue) | Scoreboard reveal for a competitive game show: a quick rising metallic whoosh into three soft rolling counter flips, landing on a warm bright two-note chord, polished and modern, not cheesy | 1200 ms | one-shot | 0.8 |
| 2 | `room.roundWon.mp3` | `round_won` (entry replaced) | Short triumphant win sting: a punchy golden brass stab with a bright cymbal shimmer, confident, ends cleanly | 700 ms | one-shot | 0.9 |
| 3 | `hover.zone.mp3` | `hover.newZone` | Retro arcade zone change: a chiptune synth sweep rising through a neon shimmer as the arena lights switch colour, a short warp swoosh, bright and clean | 500 ms | one-shot | 0.8 |
| 4 | `hover.splitGap.mp3` | `hover.twoGap` | Small flying saucer zipping through a narrow gap between two neon bars: a quick zippy whoosh with a bright two-note chiptune blip, light electric hum | 300 ms | one-shot | 0.7 |
| 5 | `hover.slipPast.mp3` | `hover.slippedThrough` | Close call as a saucer slips past a sliding neon barrier: a fast doppler whoosh with a crackling electric buzz brushing by, retro synth | 350 ms | one-shot | 0.7 |
| 6 | `skyline.floors.mp3` | `skyline.floorsStreak` | Construction site milestone: a tower crane's warning bell rung twice with a short metallic ratchet and a satisfying steel clank, outdoors | 600 ms | one-shot | 0.8 |
| 7 | `skyline.perfectFit.mp3` | `skyline.perfect`; `skyline.windPerfect` | A steel block slotting perfectly into place on a building: a crisp solid locking clunk followed by a clear ringing ping like struck steel, satisfying | 450 ms | one-shot | 0.8 |
| 8 | `gem.pick.mp3` | `matchup.select` | A small polished gemstone lifted from a velvet socket: a tiny soft crystal tick, delicate and clean | 80 ms | one-shot | 0.6 |
| 9 | `gem.swap.mp3` | `matchup.swap` | Two cut gemstones sliding past each other on velvet: a short smooth glassy slide with a faint crystal clink at the end | 150 ms | one-shot | 0.7 |
| 10 | `gem.refuse.mp3` | `matchup.invalid` | Two gemstones bumping and sliding back into their velvet sockets: a dull muffled double clack, soft and gentle, a polite no | 220 ms | one-shot | 0.6 |
| 11 | `gem.glint.mp3` | `matchup.hint` | A single gem catching the light: a faint airy sparkle shimmer, very soft | 300 ms | one-shot | 0.5 |
| 12 | `gem.shatter.mp3` | `arc_gem_match` (entry replaced) | Three crystal gems shattering into sparkles: one clean bright crystalline chime at a single pitch with a quick glassy crumble, short tail, no reverb | 400 ms | one-shot | 0.8 |
| 13 | `gem.crossBeam.mp3` | `arc_gem_zap` (entry replaced) | A magic gem firing beams of light across a row and a column: a sharp crystalline laser zing splitting in two directions with glittering shards | 450 ms | one-shot | 0.8 |
| 14 | `gem.starBurst.mp3` | `arc_gem_star` (entry replaced) | A star-cut gem bursting and clearing every jewel of its colour: a rising sparkling crystal swell into a bright starburst chime with tinkling fragments | 800 ms | one-shot | 0.8 |
| 15 | `gem.jackpot.mp3` | `matchup.jackpotBlast` (new slot) | A rare jackpot jewel detonating in a cascade of gems: a big shimmering crystal explosion with a rushing glissando of tiny chimes, rich and celebratory | 1200 ms | one-shot | 0.9 |
| 16 | `gem.forge.mp3` | `matchup.lineOfFive`; `matchup.jackpotMade` (rate 0.9) | A special gemstone being forged: a magical rising crystal chime with a resonant ring as the new jewel locks into its velvet socket | 700 ms | one-shot | 0.8 |
| 17 | `gem.parSmashed.mp3` | `matchup.parSmashed` | Treasure vault triumph: a cascade of jewels pouring onto velvet with a bright crystal fanfare of rising chimes, celebratory | 1400 ms | one-shot | 0.9 |
| 18 | `arcade.wallThock.mp3` | `breaker.wallBounce`; `rally.wallBounce` | A small hard ball bouncing off a padded arcade cabinet wall: a tiny soft rubbery thock, muted, low-mid, no beep, very short | 50 ms | one-shot | 0.4 |
| 19 | `breaker.rowClear.mp3` | `breaker.rowClear` | A whole row of glowing glass bricks shattering left to right in a fast rippling cascade, ending on a bright retro arcade chime | 700 ms | one-shot | 0.8 |
| 20 | `breaker.tenBricks.mp3` | `breaker.bricksStreak` | Retro arcade cabinet bonus: a quick four-note square-wave run up with bulbs clicking on one after another, bright | 450 ms | one-shot | 0.8 |
| 21 | `breaker.slider.mp3` | `breaker.movingTarget` | A brick knocked off a moving track: a quick sideways metallic scrape and a pinging chiptune hit | 250 ms | one-shot | 0.7 |
| 22 | `rally.goldServe.mp3` | `rally.goldEnter` | A golden ball served into a neon court: a quick shimmering synth whoosh ending in a bright coin-like glint, retro | 350 ms | one-shot | 0.7 |
| 23 | `rally.padPlusThree.mp3` | `rally.targetHit` | A gold ball striking a target pad on the far wall: a punchy electronic thwack followed by three fast rising chiptune notes, a jackpot feel | 500 ms | one-shot | 0.8 |
| 24 | `slice.ketchup.mp3` | `slice.frenzyStart` | A plastic ketchup squeeze bottle: a thick wet splurt and squirt with a little pop of the cap, kitchen | 350 ms | one-shot | 0.8 |
| 25 | `slice.mustard.mp3` | `slice.slow` | A mustard bottle squeezed in a slow drawn-out squirt that winds down like time slowing, over a low warm bubbling simmer | 600 ms | one-shot | 0.8 |
| 26 | `slice.mayo.mp3` | `slice.mayoSqueeze` | Creamy mayonnaise squeezed from a soft bottle: a smooth gloopy swirl with a gentle sucking pull, kitchen | 450 ms | one-shot | 0.8 |
| 27 | `slice.bottleToss.mp3` | `slice.specialIn` (new cue) | A plastic sauce bottle tossed up spinning in a kitchen: a quick hollow tumbling whoosh with a light rattle | 300 ms | one-shot | 0.6 |
| 28 | `bubble.seaMine.mp3` | `bubble.bomb` | An underwater sea mine detonating: a muffled deep boom with a burst of rushing bubbles, heard underwater | 800 ms | one-shot | 0.7 |
| 29 | `bubble.torpedo.mp3` | `bubble.line` | A small torpedo launched underwater: a whirring propeller and a fizzing bubble trail rushing away, ending in a soft muffled thump | 600 ms | one-shot | 0.7 |
| 30 | `bubble.joker.mp3` | `bubble.jokerLand` | A magical rainbow bubble settling into a coral reef: a sparkling underwater chime glissando with soft bubble pops | 700 ms | one-shot | 0.7 |
| 31 | `music_beat.mp3` | `music_beat` (tick-locked player, see section 9) | **ElevenLabs Music.** Upbeat retro synthwave groove for a rhythm game, exactly 120 BPM, 4/4, C major, chords C, A minor, F, G. Tight drum machine, punchy bass, bright arpeggio, steady and danceable with no tempo changes. Starts immediately on the first downbeat with the full groove, no intro, count-in or silence, and plays straight through to a short final hit | about 60 s (30 bars), first downbeat at 0.000 s; the wire-in adds the 2.000 s lead-in (section 9) | music, one-shot (not a loop) | 0.8 (music channel) |
| 32 | `beat.noteHit.mp3` | `beat.note` (lane pitch kept) | A single short bright retro synth pluck on the note C, clean sharp attack, quick decay, no reverb tail, no chord | 120 ms | one-shot | 0.8 |
| 33 | `beat.miss.mp3` | `beat.miss` | A muted dead synth thud slightly off the beat, soft and low, a stumble that sits under music | 150 ms | one-shot | 0.6 |
| 34 | `beat.swipe.mp3` | `beat.swipeHit` | A short bright synth swish across the stereo field with a sparkle at the end, rhythmic and tight | 200 ms | one-shot | 0.7 |
| 35 | `snake.cometRush.mp3` | `snake.speedUp` | A retro arcade snake picking up speed in space: a quick chiptune pitch ramp with a rushing comet whoosh | 400 ms | one-shot | 0.7 |
| 36 | `cross.bikeBell.mp3` | `cross.pastBikes` | A bicycle whizzing past close on a city street with a quick double ring of its bell | 400 ms | one-shot | 0.7 |
| 37 | `cross.cones.mp3` | `cross.pastRoadworks` | Weaving through roadworks: a plastic traffic cone bumped and wobbling on tarmac, hollow knock and rattle | 350 ms | one-shot | 0.7 |
| 38 | `wavefront.diverDown.mp3` | `wavefront.diverDown` | A small alien fighter shot down mid-dive: a descending sci-fi whine cut short by a crisp crackling zap burst | 350 ms | one-shot | 0.7 |
| 39 | `wavefront.greenBolt.mp3` | `wavefront.fire` | A very soft short energy bolt from a small starfighter: a smooth airy rounded fwip, warm, no harsh high end, quiet enough to repeat constantly | 90 ms | one-shot | 0.6 |
| 40 | `wavefront.waveIn.mp3` | `wavefront.formation` | An alien squadron warping in from deep space: a rising sci-fi swoosh into a short ominous two-note synth horn | 900 ms | one-shot | 0.8 |
| 41 | `flip.tunnelRush.mp3` | `flip.speedUp` | Wind rushing faster through a stone tunnel: a brief low whoosh swelling with a deep rumble, subtle | 400 ms | one-shot | 0.6 |
| 42 | `flip.tenSeconds.mp3` | `flip.surviveStreak` | Survived another stretch in a lava tunnel: a bright stone chime clink with a warm whoosh of heat and crackling embers | 500 ms | one-shot | 0.8 |
| 43 | `burst.waveCleared.mp3` | `burst.waveCleared`; `burst.lastLifeWave` | The last atom of a wave split apart: a short reactor power-down hum resolving into a bright rising chiptune chord, a sense of relief | 700 ms | one-shot | 0.8 |
| 44 | `burst.atomsDrop.mp3` | `burst.newWave` | New atoms dropping in from the ceiling: three quick descending bubbly synth bloops landing with soft springy bounces, retro arcade | 450 ms | one-shot | 0.7 |
| 45 | `orbit.blackHole.mp3` | `orbit.blackHole` | A rocket slingshotting through a black hole: a deep sub-bass gravitational pull, a swirling reversed whoosh, then a bright pop out the other side | 1100 ms | one-shot | 0.8 |
| 46 | `swing.hundredMetres.mp3` | `swing.distanceStreak` | A distance milestone deep in a lava cavern: a stone gong struck once with a cavern echo and a crackle of embers | 600 ms | one-shot | 0.8 |
| 47 | `snip.goldLeaf.mp3` | `snip.star` | A golden leaf collected in an orchard: a soft leaf rustle with a warm glittering harp-like chime | 500 ms | one-shot | 0.7 |
| 48 | `tilt.goldStar.mp3` | `tilt.starTaken` | A wooden marble rolling over a brass star inlay in a toy maze: a bright metallic ting on brass with a short music-box twinkle | 450 ms | one-shot | 0.7 |
| 49 | `balltrack.homeStreak.mp3` | `balltrack.homeStreak` | Wooden marble run milestone: glass marbles clacking into a wooden tray one after another, then a cheerful little wooden xylophone flourish | 600 ms | one-shot | 0.8 |

**Optional, only if Decision 1 says the score page's music is the problem** (not in the mapping sheet):

| # | File | Slots it fills | Prompt | Length | Type | Volume |
|---|---|---|---|---|---|---|
| O1 | `music_results.mp3` | `standings_loop` (round result and standings) | **ElevenLabs Music.** Relaxed confident lounge groove for a game's scoreboard between rounds, 100 BPM, warm electric piano, soft bass and light brushed drums, no melody hook that tires, seamless loop | 30 s | music loop | 0.6 (music channel) |

49 recordings in all, filling 53 slots: four files fill two slots each (#7, #16, #18 and #43). Everything Joe
didn't mention keeps its sound.

## Decisions for Joe

1. **The score page: add a sting for everyone and a new win sting, and keep the music bed.** Recommended. The
   `standings_loop` bed also plays on the standings screen, and the highlight replay's sounds are the replay's. If the
   bed is what bothers you, make **O1** too and it replaces `standings_loop` on both screens.
2. **Tempo: a recorded 120 BPM track locked to the chart, with the synth kept as the fallback** (section 9).
   Recommended. The wire-in session measures the file's tempo and first downbeat, adds the 2.000 s lead-in itself
   and needs a small sync player in code. If the file can't be fitted to the grid, the synth stays. The alternative: keep the synth and only improve its sounds.
3. **Tempo's other effects:** remake the note, miss and swipe hit only (#32–#34), and keep the combo banners, combo
   lost and swipe warning. Recommended: they're shared banners that Tempo plays rarely. Say if you want them themed
   too.
4. **Gemstone:** leave the generic `combo` sound out for Gemstone, since the new chime already climbs with each
   cascade, and keep its music bed. Recommended.
5. **Slice:** one shared "bottle tossed" sound when any special bottle appears (#27, a new cue). Recommended. Each bottle
   still gets its own sound when cut (#24–#26). The alternative is three appear sounds, one per bottle (three more
   recordings).
6. **Same moment, same sound:** High Rise's perfect drop in the wind uses the new perfect sound (#7), and Fission's
   last-life wave clear uses the new wave-cleared sound (#43). Recommended. Otherwise those two moments keep the old
   generic pop and clear.
7. **Roofbound's speed-up: sound only every third step** (9, 18, 27, 36, 45 s: 5 a round instead of 15). The speed-ups
   themselves are unchanged. Recommended. Code change only, no version stamp.
8. **Breaker and Rally share one new wall bounce** (#18). Recommended: same world, same kind of wall. Say if you want
   them different.
