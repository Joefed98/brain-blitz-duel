# Sound cues: core recorded sounds

The app's own recorded sounds, played directly by their manifest id (`src/lib/fx/manifest.ts`)
rather than through a `duelz-sound` event. Replacing one means changing that entry's `url`
(see [README.md](README.md)). The shared feedback hooks (`fx.onCorrect`, `fx.onPlace`…) map to
these ids in `DEFAULT_SOUNDS` (`src/lib/fx/theme.ts`).

The two synthesised placeholders (Don't Break the Chain's link and break tones) have named
slots: a file on `chain.linkTone` or `chain.breakTone` replaces the tone. Tempo's backing
beat (`playBeatStep`, synthesised hats and bass at 120 BPM) has no slot: a recorded
replacement would need to be locked to the chart's ticks, which is more than a file swap.

| Cue | Where | Trigger | Per round | Length |
|---|---|---|---|---|
| `round_start` | every game (FeedbackStage) | The live stage mounts (`fx.onRoundStart`) | 1 | 180 ms |
| `countdown_step` | intro (RoundIntro) | Each step of the 3-2-1 (`fx.onCountdown`) | 3 | 251 ms |
| `place` | Ballpark, Cryptogrid, Swapword, Strikeout | A piece, letter or marker placed (`fx.onPlace`) | 10–40 | 50 ms |
| `move` | puzzles with live checks (FeedbackStage), Swapword | A move sent for a live check (`fx.onMove`) | 10–60 | 40 ms |
| `correct` | FeedbackStage, reveal verdict, practice result, many puzzles (`playCorrect`), High Rise perfect drop | A right move, a stage or game solved, a correct verdict | 1–20 | 120 ms |
| `wrong` | FeedbackStage, reveal verdict, many puzzles (`playWrong`), arcade crashes in Jaywalk, Swish, Coral Pop | A wrong move or verdict | 0–10 | 140 ms |
| `lock` | Ready, Start, Submit, chat message (`playBlip`), several puzzles (`playLock`) | A confirming tap | 1–10 | 90 ms |
| `tick` | Ball Tracker, Don't Break the Chain, Pull!, Ballpark, Tenfall, Bonk, Letterfall (`playTick`) | A small tap | 10–60 | 55 ms |
| `stage_complete` | StageProgress, StageCorrect, Wavefront, Jaywalk, Junction | A stage of a staged game is complete (`fx.onStageComplete`) | 1–4 | 160 ms |
| `complete` | arcade run end (arcadeFeedback), Cryptogrid, Swapword, Strikeout | The run or puzzle is complete (`fx.onComplete`) | 1 | 200 ms |
| `combo` | arcade games with a combo or cascades (arcadeFeedback) | The combo grows (`fx.onCombo`) | 0–20 | 90 ms |
| `warning_10` | TimerBar | 10 s left: the countdown bed (starts part-way in for late joiners) | 1 | 10000 ms |
| `warning_tick` | TimerBar | Each second at 10–4 s left | 7 | 120 ms |
| `warning_tick_final` | TimerBar | Each second at 3–1 s left | 3 | 250 ms |
| `warning_5` | none | Registered for `fx.onTimerWarning5`, but the 5 s mark is visual only (`src/lib/fx/index.ts`) | 0 | 130 ms |
| `time_up` | TimerBar | The buzzer (`fx.onTimeUp`) | 1 | 250 ms |
| `reveal_score` | AnswerReveal | The stored score lands, 0.35 s after the verdict (`fx.onRevealScore`) | 1 | 140 ms |
| `reaction` | room chat | An emoji reaction (`fx.onReaction`) | 0–10 | 100 ms |
| `player_joined` | lobby | Another player joins the room | per player | 110 ms |
| `round_won` | round result, results table | You won the round (`playRoundWon`): the top scorer hears it in place of `shared.roundResults` (`room.roundWon.mp3`, sound batch 4, volume 0.9) | 0–1 | 680 ms |
| `podium_fanfare` | podium, final result | The podium appears (`fx.onPodium`) | 1 per room | 350 ms |
| `prepareToDuel` | Prepare to Duel (DuelStart) | The voice line "Prepare to duel" | 1 per room | 2837 ms |
| `round1` | round title | Voice "Round one" (`round2`–`round7` likewise) | 1 per round | 1298 ms |
| `round2` | round title | Voice "Round two" | 1 per round | 1532 ms |
| `round3` | round title | Voice "Round three" | 1 per round | 1399 ms |
| `round4` | round title | Voice "Round four" | 1 per round | 1351 ms |
| `round5` | round title | Voice "Round five" | 1 per round | 1569 ms |
| `round6` | round title | Voice "Round six" | 1 per round | 1553 ms |
| `round7` | round title | Voice "Round seven" (seven-round rooms) | 1 per round | 1716 ms |
| `round8` | round title | Voice "Round eight" (rooms of 9–12 rounds; Joe's recording, 3 Nov 2026) | 1 per round | 1933 ms |
| `round9` | round title | Voice "Round nine" | 1 per round | 2116 ms |
| `round10` | round title | Voice "Round ten" | 1 per round | 2038 ms |
| `round11` | round title | Voice "Round eleven" (round 12 is always the last: `finalRound`) | 1 per round | 2220 ms |
| `finalRound` | round title | Voice "Final round" | 1 per room | 2110 ms |
| `roundTaken` | round result, results table | Voice: you took the round | 0–1 | 1801 ms |
| `roundLost` | round result | Voice: you lost the round | 0–1 | 1801 ms |
| `winnerIs` | winner reveal | Voice "And the winner is…" | 1 per room | 1883 ms |
| `winner_drumroll` | winner reveal | The drum roll, cut at `WINNER_ROLL_END_MS` | 1 per room | 4000 ms |
| `winner_crash` | room (winner reveal end) | The cymbal crash as the winner shows | 1 per room | 2480 ms |
| `gg` | podium, final result | Voice "GG" (for the players who did not win; a winner hears `voice.youWin`, a shared first place `voice.tie`) | 1 per room | 1312 ms |
| `voice.timesUp` | every timed screen (TimerBar) | Voice "Time's up" as the clock reaches 0, with `time_up` | 0–1 | 2752 ms |
| `voice.perfect` | reveal (perfectBurst) | Voice "Perfect" with `shared.perfect`, on a stored 150 | 0–1 | 2395 ms |
| `voice.tie` | round result, results table, podium, final result | Voice "Tie": a tied round for the players sharing the top score, a shared first place, a draw | 0–1 | 2886 ms |
| `voice.youWin` | podium, final result | Voice "You win" for the winner, in place of `gg` | 0–1 per room | 2823 ms |
| `voice.rematch` | room (duel.$code) | Voice "Rematch" when Play again reopens a finished room, for every player in it | 0–1 per room | 2594 ms |
| `voice.newBest` | reveal (NewBestMoment, ArcadeReveal) | Voice "New best": practice's reveal when the run beat an earlier best, or a room's arcade reveal beating this device's best for the game (3 Nov 2026; `queueVoice`, never over another line) | 0–1 | 2482 ms |
| `voice.photoFinish` | round result, results table | Voice "Photo finish": the round's top two scores 1–5 points apart (`isPhotoFinish`), after the screen's own line | 0–1 per round | 2194 ms |
| `voice.newLeader` | standings | Voice "New leader": first place changed hands after this round (`isNewLeader`) | 0–1 per round | 1881 ms |
| `voice.cleanSweep` | podium, final result | Voice "Clean sweep": one player had the sole top score in every round (`cleanSweepSlot`), after the room's end line | 0–1 per room | 2220 ms |
| `voice.draw` | podium, final result | Voice "Draw": first place shared at the room's end (in place of `voice.tie` there; queued after "GG" for everyone else) | 0–1 per room | 2090 ms |
| `arc_blaster` | Wavefront | The shared shot sound `wavefront.fire` falls back to if its own file fails to load | 0 (stand-in) | 140 ms |
| `arc_leaf_collect` | Scrumper, Tilt | The shared sound `snip.star` and `tilt.starTaken` fall back to if their own files fail to load | 0 (stand-in) | 840 ms |
| `arc_ketchup` | Slice | The shared sound `slice.frenzyStart` falls back to if its own file fails to load | 0 (stand-in) | 230 ms |
| `arc_mustard` | Slice | The shared sound `slice.slow` falls back to if its own file fails to load | 0 (stand-in) | 410 ms |
| `arc_hover_tap` | Hover | Each tap that lifts the craft | 50–200 | 110 ms |
| `arc_gem_match` | Gemstone | A match lands (pitched by cascade depth; `gem.shatter.mp3`, sound batch 4, volume 0.8) | 20–60 | 400 ms |
| `arc_gem_zap` | Gemstone | A cross gem goes off (`gem.crossBeam.mp3`, sound batch 4, volume 0.8) | 0–5 | 450 ms |
| `arc_gem_bomb` | Gemstone | A bomb gem goes off | 0–5 | 722 ms |
| `arc_gem_star` | Gemstone | A star gem goes off (`gem.starBurst.mp3`, sound batch 4, volume 0.8) | 0–5 | 800 ms |
| `matchup.jackpotBlast` | Gemstone | A jackpot gem goes off (`matchupStepSound`; `arc_rainbow` until sound batch 4; `gem.jackpot.mp3`, volume 0.9) | 0–3 | 1200 ms |
| `pz_laser_gem` | Lightbender | The beam reaches a gem (pitched up gem by gem) | 3–8 | 1012 ms |
| `pz_laser_split` | Lightbender | The beam reaches a splitter | 0–4 | 1042 ms |
| `pz_padlock` | Slider | A row locks as a word | 5 | 450 ms |
| `pz_safe_open` | Safe Cracker | The safe opens (solve) | 0–1 | 2200 ms |
| `pz_bomb_explode` | reveal (Bomb Defusal) | The bomb explodes on a wrong answer | 0–1 | 1770 ms |
| `pz_car_escape` | Gridlock | The gold car drives out (solve) | 0–1 | 2470 ms |
| `pz_clay_hit` | Pull! | A clay is hit | 10–25 | 780 ms |
| `pz_gravity_pull` | Topsy-Turvy | The board tilts | 5–30 | 1100 ms |
| `chain.linkTone` | Don't Break the Chain | A link is tapped: a synthesised tone a semitone higher per link | 10–40 | 110 ms |
| `chain.breakTone` | Don't Break the Chain | The chain breaks: a falling synthesised sawtooth | 0–1 | 380 ms |
| `beat.backing` | Tempo | The synthesised 120 BPM backing beat, one step per eighth note (no slot); since sound batch 4 only until `music_beat` has decoded, or if it fails | loop | loop |
