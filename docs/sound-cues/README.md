# Sound cues

Every new effect, animation or feature moment announces itself with a **named sound cue**, so a sound can be attached without touching the game again. Every cue has a slot in the sound manifest; most are still silent. [cue-sheet.md](cue-sheet.md) (and [cue-sheet.csv](cue-sheet.csv)) lists every cue, what plays today and what is missing; [Adding a recorded file](#adding-a-recorded-file) says how to fill a slot.

## The convention (every session uses it)

Dispatch one window event at the moment the effect starts:

```ts
window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "<gameId>.<event>" } }));
```

or, from app code, the shared helper (same event, safe on the server):

```ts
import { soundCue } from "@/lib/fx/soundCues";
soundCue("tower.stackShine");
```

- **Name:** `<gameId>.<event>`. `<gameId>` is the game's `PuzzleType` id (`tower`, `wordsmith`, `snip`…), never its display name, so a rename never changes a cue. Shared moments (screens and effects every game uses) use `shared.<event>`; the room's big moments (Prepare to Duel, round titles, Final Round, the winner reveal) use `room.<event>`. `<event>` is lower camelCase, optionally dotted for a family (`shared.signature.solve`, `shared.signature.fast`).
- **When:** once, at the frame the effect starts (not when it is scheduled). A repeating effect dispatches once per repeat.
- **Presentation only:** a cue never reads or writes game state, recorded time, inputs or scores, and is never dispatched from inside an arcade sim (`src/lib/arcade/<game>.ts`); renderers, stages and shared effects dispatch it.
- **Demos stay silent:** don't dispatch from intro demos (check `demoHushed()` from `@/lib/sound` when the code also runs in a demo).
- **List your cues:** each session lists the cues it adds, with trigger and length, in `docs/sound-cues/<area>.md` (`shared.md` for shared screens and effects, `<gameId>.md` or a group file such as `pattern.md` for games) and in its PR, then runs `bun scripts/sound-cue-sheet.ts --slots` and pastes the printed slot lines into the manifest (`sound-manifest-check` fails on a cue without a slot).

## Seeing cues while developing

Open the app with `?dev=1` (for example `/practice?dev=1`): a dev-only listener (`installSoundCueLogger`, mounted with the effects layer on every screen) logs each cue to the console as `[duelz-sound] <cue> @ <ms since page load> ms`. Without `?dev=1` nothing is logged.

## Adding a recorded file

There is one loading system (`src/lib/sound.ts`, Web Audio, unlocked by the first tap) and one list of
files: `src/lib/fx/manifest.ts`. Every cue in [cue-sheet.md](cue-sheet.md) already has an entry there
(its **manifest slot**) with `url: null`. Giving a cue a sound means setting that one `url`; nothing else
changes.

1. **Make the file.** MP3 (music must be MP3: its loop points are found by trimming the encoder's
   silence; looping effects marked `loop: true` are trimmed the same way). Cut it to about the
   **suggested length** in the sheet. Music beds are seamless loops.
2. **One file per recording, never one per slot.** When one recording serves several slots (every replay
   moment, the menu music on the home and practice screens, a "done" sting shared by several puzzles), keep
   **one** copy and point every slot's `url` at it. Name a file used by one slot after that slot
   (`pinball.bumperHit.mp3`, `music_pinball.mp3`); name a file shared by several after the recording
   (`replay.moment.mp3`, `music_menu.mp3`, `done.glowSweep.mp3`), as the batch's mapping sheet does.
   Batch 1 (#78) saved a copy per slot (228 files for 72 recordings, 5.9 MB); they were folded back to 72
   files (2.7 MB).
3. **Put it where the existing files are:** upload it to the Lovable project's assets (served at
   `/__l5e/assets-v1/<id>/<name>.mp3`), or bring it in through git as `public/sounds/<name>.mp3` with the URL
   `/sounds/<name>.mp3`. The same loader fetches either, and `sound-manifest-check` fails on any audio file
   in the repo that no slot uses. To give a slot an existing recording (a shared stand-in), set its `url` to
   that recording's URL: no copy.
4. **Set the slot's `url`** in `src/lib/fx/manifest.ts` to that URL, and its `ms` to the file's length
   in milliseconds (used for ducking music before the file has decoded). Several slots naming one URL are
   fetched and decoded once.
5. **Set its volume** on the same entry if it needs one: `volume: 0.7` (0–1, default 1). It multiplies
   the game's own volume for that moment and the player's Effects or Music slider (Sound settings).
   Channels: effects and voice follow the Effects slider, music the Music slider.
6. Run `bun scripts/sound-cue-sheet.ts` to refresh the sheet (it keeps the CSV's **new file** column),
   and `bun scripts/sound-manifest-check.ts`.

**Loading.** Every effect and voice file (every manifest entry with a `url` that is not music) is preloaded
when the first tap unlocks audio: fetched and decoded once per URL, so slots sharing a recording cost one
download. Music beds load on demand when their screen or round starts and are released after. Git-route
files in `public/sounds/` (18 Oct 2026, after sound batches 2 and 3): 138 files, 4.61 MB, of which effects and
voice 3.25 MB are preloaded (the five batch 2 voice lines 0.60 MB) and the two music loops (`music_menu.mp3`
0.62 MB, `music_pinball.mp3` 0.74 MB) load on demand. Batch 1 alone was 72 files (2.74 MB, effects 1.39 MB);
before its de-duplication the preload fetched 225 separate effect files (3.93 MB) and the menu loop was two files.

**Play caps and loops** (sound batches 2 and 3): a slot may also set `gapMs` (a play this soon after its last is
dropped), `voices` (how many of its plays may sound at once) and `rate` (a shared recording played lower or higher).
The caps hold whether the slot plays its own file or the shared sound it stands in for. A named loop (`loop: true`)
plays through `loopCue()` in `gameSounds.ts` (`ensureCueLoop` / `stopCueLoop`): quiet (0.25–0.35), faded in over
500 ms and out when it ends, one per game. The mapping sheets are [batch2-mapping.csv](batch2-mapping.csv) and
[batch3-mapping.csv](batch3-mapping.csv) (`file,cues`; `EXISTING:<id>` points a slot at an app-wide entry or a file
already in `public/sounds/`).
Sound batch 4 (Joe's listening notes, 19 Oct 2026; wired 20 Oct 2026) is
[batch4-sound-polish.md](batch4-sound-polish.md) with [batch4-mapping.csv](batch4-mapping.csv): 48 effects and
Tempo's track, each trimmed (leading and trailing silence off, cut to about its listed length with a short fade)
and levelled to the library's median loudness (about -15 LUFS momentary peak, the two constant repeaters
`arcade.wallThock.mp3` and `wavefront.greenBolt.mp3` about -24, never above -1 dBFS); new hooks
`shared.roundResults`, `slice.specialIn` and `matchup.jackpotBlast`; Roofbound's speed-up sounds on every third step.
Sound batch 5 (Joe's iPhone 11 notes, 28 Oct 2026) is [batch5-chiptune.md](batch5-chiptune.md): two synthesised files
made by `bun scripts/chiptune-sounds.ts` (deterministic, ffmpeg): Tempo's note hit `beat.note8bit.mp3` (replacing
`beat.noteHit.mp3`, pitched per lane up a major pentatonic scale) and Gemstone's bed `music_matchup2.mp3`; Tempo's track
plays louder (manifest volume 1, `BEAT_TRACK_BOOST` 1.6).

What each kind of slot does once it has a file:

- **Named cues** (`shared.*`, `room.*`, replay cues, `<gameId>.<event>` from the polish passes): played by
  one listener on the `duelz-sound` event (`installSoundCueBridge`, mounted in `src/routes/__root.tsx`),
  on top of any generic sound the moment already plays (for example `correct`). Replay cues named
  `<gameId>.final-second` and `<gameId>.final` use the shared `*.final-second` / `*.final` slots unless a
  game gets its own (`hover.final-second`).
- **Arcade moments** ([arcade.md](arcade.md)): the file replaces the shared sound the moment plays today
  (`playSlotOr` in `gameSounds.ts`), at normal speed; loops (`orbit.ambience`, `tilt.roll`…) replace the
  shared loop.
- **Arcade effect cues** ([arcade-effects.md](arcade-effects.md)): named cues for every arcade-stage visual
  effect that had no sound. A cue that starts on the same frame as an existing sound lists it in `replaces`
  (`src/lib/fx/momentCues.ts`); once the cue has a file that sound is left out on that frame, for that game only.
- **Placeholders**: a file on `chain.linkTone` / `chain.breakTone` replaces Don't Break the Chain's
  synthesised tones (the link tone keeps its climbing pitch).
- **Music**: `music_<gameId>` (arcade) or `music_<category>_<gameId>` (puzzle) replaces the shared or
  borrowed bed for that game (`roundMusicFor`); the screen slots `music_home`, `music_practice`,
  `music_prepare`, `music_round_title`, `music_reveal` and `music_winner` start playing on their screens.
- **Replacing an existing recording**: change the `url` of its own entry (`correct`, `arc_retro_hit`…).
- **A game's own completion cue** (`strikeout.finish`, `codeword.finish`, `swapword.finish`, `wordfall.finish`,
  `stroop.gatesFlash`, `tendrop.solve`, `whack.finale`, `clayshoot.finalBurst`): these fire at the same moment as the
  generic `complete` sound, so once the cue's file has loaded the generic sound is left out there (`completeFx` in
  `src/lib/fx/index.ts`; the burst still shows). Every other completion cue plays on its own, so nothing else changes.
- **Git-route files** live in `public/sounds/` (one per recording); the shared replay slots `*.final-second` and `*.final` use
  `any.final-second.mp3` and `any.final.mp3`, since `*` cannot be in a filename on Windows.

Without a file every slot keeps today's behaviour exactly: named cues stay silent, arcade moments play
their shared sound, the chain keeps its tones, games keep their shared bed and the screens stay silent.
A file that fails to load (missing, 404, undecodable) logs one `[sound]` warning and the cue falls back
the same way; a game's own music bed that fails leaves that round without music. Slots have
`frequency: 0`, so a missing file never beeps. Intro demos stay silent (`demoHushed()`).

Not a file swap: Tempo's track (`music_beat`) is locked to the chart's ticks, not started by the round
(`roundMusicFor` leaves `beat` out): `syncBeatTrack` in `src/lib/sound.ts` starts it when the sim reaches
tick 120 at file offset `downbeat + (tick - 120) / 60` s (the file starts on its first downbeat, and the
2.000 s lead-in is the player's, since the loader trims leading silence), jumps it back into place past
40 ms of drift and stops it when the run ends or the player locks in. Until it has decoded, or if it
fails, the synthesised beat (`playBeatStep`) plays as before. A replacement file must be exactly 120 BPM
(within 0.1 %), steady, and start on its first downbeat. The `tension_loop` bed is registered but not
placed on any screen.

## Files

- `src/lib/fx/soundCues.ts`: `SOUND_CUE_EVENT`, `soundCue()`, `installSoundCueLogger()`.
- `src/lib/fx/manifest.ts`: every file and every empty slot.
- `src/lib/sound.ts`: the loader and players; `installSoundCueBridge`, `playCueSlot`, `playSlotOr`, `screenMusic`.
- `src/lib/fx/gameSounds.ts`: the arcade observers (arcade moments and renderer-effect cues).
- `src/lib/fx/momentCues.ts`: live cues for the shared arcade success effects (`MOMENT_CUES`, `momentFrame`, `liveCue`).
- `docs/sound-cues/cue-sheet.md`, `cue-sheet.csv`: every cue (generated: `bun scripts/sound-cue-sheet.ts`).
- `docs/sound-cues/shared.md`: the shared cues.
- `docs/sound-cues/room.md`: the room's big-moment cues (`room.prepare`, `room.round.1`–`6`, `room.finalRound`, `room.winner`…).
- `docs/sound-cues/word.md`, `number.md`, `speed-attention.md`, `pattern.md`, `logic.md`: the puzzle polish cues.
- `docs/sound-cues/replays.md`: replay cues.
- `docs/sound-cues/puzzle-move-cues.md`: what already plays at each silent puzzle move cue, and which are truly silent.
- `docs/sound-cues/arcade.md`: the arcade games' live sounds and their slots.
- `docs/sound-cues/arcade-effects.md`: the arcade-stage visual effects' cues, what each looks like, and what already sounds.
- `docs/sound-cues/core.md`: the app's own recorded sounds, voice lines and the synthesised placeholders.
- `docs/sound-cues/music.md`: music per screen and per game.
- `scripts/sound-manifest-check.ts`: proves the manifest, the sheet and the players agree.
