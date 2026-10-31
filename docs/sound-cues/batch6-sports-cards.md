# Sound cues: sound batch 6, Sports and Cards & Board (31 Oct 2026)

Joe's ElevenLabs recordings for the eleven new arcade games (Minigolf, Speed Pool, Curling, Home Run Derby, Free Kick,
Racing, Minefield, FreeCell, Mahjong Solitaire, TriPeaks, Poker Squares), trimmed, looped and levelled into
`public/sounds/<slot>.mp3` ([batch6-mapping.csv](batch6-mapping.csv): each file, its game, event, length budget, loop
flag and the cues that play it). sound-batch6-check proves every slot has its file, every file is within its length
budget (plus 150 ms) and every loop file is a `loop: true` slot.

Moments that already played a shared sound are in [arcade.md](arcade.md) (the game's own file now plays in place of the
shared one); the observers are in `src/lib/fx/gameSounds.ts`. The moments below had no sound before: each plays its own
file (through `effectCue` / `loopCue` in the observer, `liveCue` in FreeCell's stage, or the theme's `onCountdown` for
Racing's start lights) and stays silent without it. Loops are faded in over 500 ms and out when they stop or the run ends.
Each game's music bed is `music_<gameId>` ([music.md](music.md)), started with the run and looped until the buzzer.

How the files were made: leading silence cut to under 3 ms (quiet pre-roll more than 24 dB under the peak removed, a 3 ms
fade-in), each effect cut after its body (within 20 dB of its peak) with a 40 ms fade-out, at least its budget unless the
sound is shorter, at most 150 ms over it (cards_home's chime and homerun_sign's bell ring keep their quiet
tails to the full budget, with a 120 ms fade); loops cut where the waveform and level after the cut match the loop's start,
on an upward zero crossing, with a 120 ms crossfade (250 ms for the crowd) into the loop's head, music beds on the bar
whose next 4 s best match the bed's opening (a 40 ms crossfade); effects levelled to peaks of -1 dBFS but no louder
than 2 dB over the library's median loudest 100 ms (-13.8 dBFS), music to -18 LUFS integrated; MP3 44.1 kHz, mono
96 kbps, music and the crowd and engine loops stereo 128 kbps.

| Cue | Game | Trigger | File | Per round | Length |
|---|---|---|---|---|---|
| `pool.pocket` | Speed Pool | A ball drops into a pocket (the cue ball too) (without its file: `shared.celebrate.countDing`, 0.9, as before) | `pool_pocket.mp3` | 5–12 | 908 ms |
| `pool.foul` | Speed Pool | A foul (without its file: `shared.celebrate.zap`, 0.7, as before) | `pool_foul.mp3` | 0–5 | 484 ms |
| `pool.blackWin` | Speed Pool | The black potted after every spot (without its file: `shared.celebrate.chime`, as before) | `pool_black_win.mp3` | 0–1 | 1327 ms |
| `minesweeper.hit` | Minefield | A mine is hit (without its file: `shared.celebrate.zap`, as before) | `mines_hit.mp3` | 0–5 | 474 ms |
| `minesweeper.clear` | Minefield | Every safe square open (without its file: `shared.celebrate.chime`, as before) | `mines_clear.mp3` | 0–1 | 998 ms |
| `mahjong.match` | Mahjong Solitaire | A pair is taken away (without its file: `shared.celebrate.countDing`, 0.7, as before) | `mahjong_match.mp3` | 10–36 | 359 ms |
| `mahjong.shuffle` | Mahjong Solitaire | Shuffle (without its file: `shared.celebrate.zap`, as before) | `mahjong_shuffle.mp3` | 0–3 | 1043 ms |
| `mahjong.clear` | Mahjong Solitaire | The board cleared (without its file: `shared.celebrate.chime`, as before) | `mahjong_clear.mp3` | 0–1 | 1806 ms |
| `minigolf.roll` | Minigolf | While the ball rolls (0.32) | `minigolf_roll_loop.mp3` | loop | loop |
| `minigolf.bush` | Minigolf | The ball strikes a planter's bush (with `minigolf.stone`; at most one per 120 ms) | `minigolf_bush.mp3` | 0–10 | 439 ms |
| `pool.chalk` | Speed Pool | The run starts | `pool_chalk.mp3` | 1 | 733 ms |
| `pool.cueSoft` | Speed Pool | A shot under 55 % of the cue's speed range | `pool_cue_soft.mp3` | 5–20 | 400 ms |
| `pool.cueHard` | Speed Pool | A power shot (55 % of the range or more) | `pool_cue_hard.mp3` | 2–15 | 400 ms |
| `pool.cushion` | Speed Pool | A ball hits a cushion (at most one per 60 ms) | `pool_cushion.mp3` | 10–60 | 300 ms |
| `curling.release` | Curling | A stone released | `curling_release.mp3` | 8 | 484 ms |
| `curling.slide` | Curling | While a thrown stone travels (0.32) | `curling_slide_loop.mp3` | loop | loop |
| `curling.sweep` | Curling | While the brooms are sweeping a travelling stone (0.32) | `curling_sweep_loop.mp3` | loop | loop |
| `curling.hit` | Curling | Stone on stone (at most one per 80 ms) | `curling_hit.mp3` | 0–15 | 400 ms |
| `curling.board` | Curling | A moving stone goes out over a side or back board | `curling_board.mp3` | 0–5 | 400 ms |
| `curling.applause` | Curling | A thrown stone settles in the 4-foot or knocks a stone out | `curling_applause.mp3` | 0–8 | 1995 ms |
| `curling.shot` | Curling | A thrown stone settles and takes shot (nearest the button) | `curling_shot.mp3` | 0–8 | 998 ms |
| `homerun.crowd` | Home Run Derby | While the run is live (0.26) | `sports_crowd_loop.mp3` | loop | loop |
| `homerun.pitch` | Home Run Derby | The pitcher releases the ball | `homerun_pitch.mp3` | 10 | 259 ms |
| `homerun.whiff` | Home Run Derby | A swing and a miss (with `homerun.strike`, the mitt) | `homerun_whiff.mp3` | 0–10 | 400 ms |
| `homerun.roar` | Home Run Derby | A home run | `sports_crowd_roar.mp3` | 0–10 | 3477 ms |
| `homerun.groan` | Home Run Derby | A fair ball within 30 ft of the fence | `sports_crowd_groan.mp3` | 0–5 | 1995 ms |
| `freekick.crowd` | Free Kick | While the run is live (0.26) | `sports_crowd_loop.mp3` | loop | loop |
| `freekick.whistle` | Free Kick | The referee's whistle before each kick | `freekick_whistle.mp3` | 10 | 683 ms |
| `freekick.roar` | Free Kick | A goal | `sports_crowd_roar.mp3` | 0–10 | 3477 ms |
| `freekick.groan` | Free Kick | A save, or a kick off the woodwork and wide | `sports_crowd_groan.mp3` | 0–8 | 1995 ms |
| `racing.light` | Racing | Each of the intro's 3-2-1 (the start lights; theme `onCountdown`, in place of `countdown_step`) | `racing_light.mp3` | 3 | 155 ms |
| `racing.idle` | Racing | On the grid until the car first moves (0.3) | `racing_idle_loop.mp3` | loop | loop |
| `racing.drive` | Racing | While driving (0.3), pitched by speed: 0.7× at rest to 1.5× flat out | `racing_drive_loop.mp3` | loop | loop |
| `racing.squeal` | Racing | Cornering at 90 % or more of the corner's balance speed (at most one per 1.5 s) | `racing_squeal.mp3` | 5–20 | 1197 ms |
| `racing.kerb` | Racing | While a wheel is on the kerb (0.25) | `racing_kerb_loop.mp3` | loop | loop |
| `racing.grassLoop` | Racing | While off on the grass or gravel (0.25; with its file `racing.grass` is not played) | `racing_grass_loop.mp3` | loop | loop |
| `racing.roar` | Racing | The finish line after lap 2 | `sports_crowd_roar.mp3` | 0–1 | 3477 ms |
| `minesweeper.unflag` | Minefield | A flag is lifted | `mines_unflag.mp3` | 0–10 | 350 ms |
| `mahjong.select` | Mahjong Solitaire | A free tile selected | `mahjong_select.mp3` | 20–40 | 200 ms |
| `mahjong.invalid` | Mahjong Solitaire | A second free tile that doesn't match (the selection moves to it) | `mahjong_invalid.mp3` | 0–10 | 300 ms |
| `freecell.pick` | FreeCell | A card lifted as a drag starts (the stage; at most one per 60 ms) | `cards_pick.mp3` | 10–60 | 334 ms |
| `freecell.shuffle` | FreeCell | The run starts | `cards_shuffle.mp3` | 1 | 1093 ms |
| `tripeaks.shuffle` | TriPeaks | The run starts | `cards_shuffle.mp3` | 1 | 1093 ms |
| `pokersquares.shuffle` | Poker Squares | The run starts | `cards_shuffle.mp3` | 1 | 1093 ms |
| `pokersquares.final` | Poker Squares | The grid scored (the last card placed, or the buzzer) | `poker_final.mp3` | 1 | 983 ms |
