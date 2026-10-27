# Shared sound cues

Cues for moments every game shares. Convention: [README.md](README.md). No audio is attached yet.

| Cue | Trigger | Length |
|---|---|---|
| `shared.signature.solve` | The signature beat starts: 1.0 s after a puzzle's solve moment (verdict solved); after a non-arcade game with no finish state ends its run on 120 or more; 1.0 s after an arcade finish game reaches its finish; 1.0 s after an open arcade game ends a run of 120 or more on the phone's sim. | 0.6 s |
| `shared.signature.fast` | As `shared.signature.solve`, for a solve or finish with at least half the time left (the full speed part); the beat is a little bigger. Replaces the solve cue (one or the other, never both). | 0.6 s |
| `shared.perfect` | The reveal shows a stored score of 150: a short gold burst on the score (puzzle and arcade reveals). | 0.5 s |
| `shared.roundResults` | The room's Round results screen appears (`RoundResult`, `RoundResultsTable`, once on mount): every player but the round's top scorer, who hears `round_won` instead (never both). In a two-player room the loser's "round lost" or the tie's "tie" voice line follows it. Sound batch 4 (`room.roundResults.mp3`). | 0.9 s |
| `shared.help.open` | An in-game "?" help sheet opens. | instant |
| `shared.help.close` | An in-game "?" help sheet closes (close button, tap outside or Escape). | instant |
| `shared.reject` | A puzzle refuses a move with the shared shake (`puzzleReject()`: Operator, Chroma Lines, Labyrinth, Lamplighter, Counterweight, Slider, Heave, Cryptogrid and the rest that call it), unless the move already plays `wrong`; never in an intro demo. | 200 ms |

Where they fire: `src/lib/fx/signature.ts` (beat and perfect burst), `src/lib/fx/useSignature.ts` (the rooms and practice verdict point), `src/lib/fx/arcade.ts` (the arcade run-end point), `src/components/duel/PuzzleInstructions.tsx` (help sheet).

## Celebrations (Prompt S, 24 Oct 2026)

The celebrations' recorded set (Joe's ElevenLabs `sfx_*.mp3` files, in `public/sounds/`) replaces #134's three
synthesised placeholders. Each plays through `celebrationSound()` (`src/lib/fx/celebrations.ts`, slot table
`CELEBRATION_SOUND_SLOTS`) and `playCueSlot`, on the effects channel, only while `FX_CELEBRATIONS` is on; a file not
yet decoded is skipped, never waited for. Processing: leading silence off (each begins within 5 ms), cut to the
target length with a 15 ms fade, mono 44.1 kHz 112 kbps, levelled to sfx_joulz_zap's -17 LUFS momentary peak (about
2 dB under the library's median, -15.4), peaks under -0.5 dBFS.

| Cue | Trigger | Length |
|---|---|---|
| `shared.celebrate.zap` | Create a room (the Play tab's button) and GO (`goStrike`, with the thunder). `sfx_joulz_zap.mp3`. | 0.38 s |
| `shared.celebrate.chime` | A spark burst: practice's New best!, the podium's "You win!" on the winner's phone, the lobby meter filling up. `sfx_spark_chime.mp3`. | 0.6 s |
| `shared.celebrate.crackle1` | A lobby join (the charge meter rising): the three crackles rotate 1, 2, 3, so the same one never plays twice in a row. `sfx_meter_crackle_1.mp3`. | 0.45 s |
| `shared.celebrate.crackle2` | As crackle1, the second in turn. `sfx_meter_crackle_2.mp3`. | 0.38 s |
| `shared.celebrate.crackle3` | As crackle1, the third in turn. `sfx_meter_crackle_3.mp3`. | 0.45 s |
| `shared.celebrate.victory` | The podium hero takes his pose beside the winner's step, on every phone. `sfx_victory_sting.mp3`. | 1.76 s |
| `shared.celebrate.heroRun` | The hero's run after a round of 150+ (rooms, practice, daily), as it starts; none under reduced motion (no run). `sfx_hero_whoosh.mp3`. | 1.5 s |
| `shared.celebrate.overtake` | A player moved up a place: once as the standings, podium or two-player final rows finish sliding. `sfx_overtake_zap.mp3`. | 0.28 s |
| `shared.celebrate.countTick` | The results count-up's number changes: at most 12 ticks a second across every counting row. `sfx_count_tick.mp3`. | 0.06 s |
| `shared.celebrate.countDing` | A count-up lands on its final score (or a tap skips to it); rows landing together share one ding. `sfx_count_ding.mp3`. | 0.49 s |
| `shared.celebrate.thunder` | GO's lightning strike (`RoundIntro`); with reduced motion the sound still plays. `sfx_thunder_crack.mp3`. | 0.75 s |
| `shared.celebrate.prepareThunder` | Each Prepare to Duel strike as it lands, at half GO's level; never while the "Prepare to Duel" voice line plays: a strike sounds only if its crack ends 400 ms before the line starts or it lands 400 ms after the line ends (the decoded file's real length, `voiceDurationMs`; the manifest's 2,837 ms until it decodes). Strikes in between are drawn silently (`strikeSounds` in `prepareLightning.ts`). Shares `sfx_thunder_crack.mp3`. | 0.75 s |
| `shared.celebrate.streak` | The daily results' 3- and 7-day streak banners. `sfx_streak_flourish.mp3`. | 1.2 s |
| `shared.celebrate.streakBig` | The 30-day streak banner. `sfx_streak_flourish_big.mp3`. | 2.0 s |
| `shared.celebrate.logoCharge` | The app header's logo charges in, only if sound is already unlocked (an iPhone blocks sound before the first tap: the app's first charge-in is silent); none under reduced motion. `sfx_logo_charge.mp3`. | 0.69 s |
| `shared.celebrate.heroDance` | The hero's dance on a reveal of 190–199 (rooms, practice, daily), as it comes on; with reduced motion it plays with the still hero. Shares `sfx_streak_flourish.mp3`. | 1.2 s |
| `shared.celebrate.heroGrand` | The hero's lap of the screen on a reveal of 200, with `heroRun`'s whoosh as it starts (no whoosh under reduced motion, where the hero stands still). Shares `sfx_streak_flourish_big.mp3`. | 2.0 s |
| `shared.celebrate.firework` | Each firework of the 200 lap as it bursts (six, 450 ms apart; one sound if two land in a frame); none under reduced motion. Shares `sfx_meter_crackle_1.mp3`, at 0.6. | 0.45 s |
